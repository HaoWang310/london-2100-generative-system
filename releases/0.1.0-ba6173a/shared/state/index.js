// Multi-scale workspace state.
//
// The workspace keeps one entry per (level, input) pair, so every scale keeps
// its own parameters, status and generated result. Navigating up and down
// only moves the `path`; it never deletes entries. Map zooming is not part of
// this store at all, so zooming can never clear or regenerate a model.
//
// When a parent is regenerated, child entries created from the old parent
// result are flagged `stale` (kept, not deleted) so the user decides whether
// to regenerate them.

export const WORKSPACE_VERSION = 1;
export const SCALE_ORDER = ['london', 'region', 'wool', 'tensor'];

export const entryKey = (level, inputId) => `${level}|${inputId}`;

function blankState() {
  return { version: WORKSPACE_VERSION, path: [], entries: {} };
}

export function createWorkspaceStore({ storage = null, key = 'l2100.workspace' } = {}) {
  let state = blankState();
  const listeners = new Set();
  let persistWarning = null;

  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === WORKSPACE_VERSION) state = parsed;
      }
    } catch (e) { persistWarning = 'restore-failed'; }
  }

  const emit = (reason) => {
    if (storage) {
      try { storage.setItem(key, JSON.stringify(state)); persistWarning = null; }
      catch (e) { persistWarning = 'storage-full'; }
    }
    for (const fn of listeners) fn(state, reason);
  };

  const get = (level, inputId) => state.entries[entryKey(level, inputId)] || null;

  function patch(level, inputId, fields, reason) {
    const k = entryKey(level, inputId);
    if (!state.entries[k]) throw new Error(`no workspace entry ${k}`);
    state.entries[k] = { ...state.entries[k], ...fields, updatedAt: Date.now() };
    emit(reason);
    return state.entries[k];
  }

  return {
    getState: () => state,
    get persistWarning() { return persistWarning; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    entry: get,
    current() {
      const top = state.path[state.path.length - 1];
      return top ? get(top.level, top.inputId) : null;
    },
    parentOf(entry) {
      const i = state.path.findIndex(p => p.level === entry.level && p.inputId === entry.inputId);
      const prev = i > 0 ? state.path[i - 1] : null;
      return prev ? get(prev.level, prev.inputId) : null;
    },

    /** Enter a level with a given input. Re-entering restores the saved entry. */
    enter(level, input, defaults = {}, parentStamp = null) {
      const inputId = input ? input.id : 'root';
      const k = entryKey(level, inputId);
      const existing = state.entries[k];
      if (!existing) {
        state.entries[k] = {
          level, inputId, input, params: { ...defaults }, result: null,
          status: 'idle', selectedChildId: null, progress: 1,
          parentStamp, stale: false, createdAt: Date.now(), updatedAt: Date.now()
        };
      } else {
        // Refresh the input (e.g. updated parent roads) but keep params/result.
        const stale = existing.result && parentStamp && existing.parentStamp !== parentStamp;
        state.entries[k] = {
          ...existing, input,
          params: { ...defaults, ...existing.params },
          stale: existing.stale || Boolean(stale)
        };
      }
      const depth = SCALE_ORDER.indexOf(level);
      state.path = state.path.filter(p => SCALE_ORDER.indexOf(p.level) < depth);
      state.path.push({ level, inputId });
      emit('enter');
      return state.entries[k];
    },

    /** Create or refresh an entry WITHOUT moving the path (tools such as 04/05). */
    upsert(level, input, defaults = {}) {
      const inputId = input ? input.id : 'root';
      const k = entryKey(level, inputId);
      const existing = state.entries[k];
      state.entries[k] = existing
        ? { ...existing, input, params: { ...defaults, ...existing.params } }
        : { level, inputId, input, params: { ...defaults }, result: null, status: 'idle',
            selectedChildId: null, progress: 1, parentStamp: null, stale: false,
            createdAt: Date.now(), updatedAt: Date.now() };
      emit('upsert');
      return state.entries[k];
    },

    back() {
      if (state.path.length <= 1) return null;
      state.path = state.path.slice(0, -1);
      emit('back');
      return this.current();
    },

    goTo(index) {
      if (index < 0 || index >= state.path.length) return null;
      state.path = state.path.slice(0, index + 1);
      emit('navigate');
      return this.current();
    },

    setParams(level, inputId, values) {
      const e = get(level, inputId);
      return patch(level, inputId, { params: { ...e.params, ...values } }, 'params');
    },
    setStatus(level, inputId, status, extra = {}) {
      return patch(level, inputId, { status, ...extra }, 'status');
    },
    setProgress(level, inputId, progress) {
      const k = entryKey(level, inputId);
      if (!state.entries[k]) return;
      state.entries[k].progress = progress;   // high-frequency: no persistence
      for (const fn of listeners) fn(state, 'progress');
    },
    setResult(level, inputId, result) {
      const e = patch(level, inputId, { result, status: 'done', stale: false, progress: 1, error: null }, 'result');
      // Flag (never delete) entries generated from an older version of this result.
      const prefix = new Set((result.children || []).map(c => c.id));
      for (const other of Object.values(state.entries)) {
        if (prefix.has(other.inputId) && other.result && other.parentStamp !== result.createdAt) {
          other.stale = true;
        }
      }
      emit('result');
      return e;
    },
    select(level, inputId, childId) {
      return patch(level, inputId, { selectedChildId: childId }, 'select');
    },

    /** All saved entries below a given input (used by integration/export). */
    descendants(level, inputId) {
      const root = get(level, inputId);
      if (!root || !root.result) return [];
      const ids = new Set((root.result.children || []).map(c => c.id));
      return Object.values(state.entries).filter(e => ids.has(e.inputId));
    },

    reset() { state = blankState(); emit('reset'); },
    exportJSON() { return JSON.parse(JSON.stringify(state)); },
    importJSON(data) {
      if (!data || data.version !== WORKSPACE_VERSION) throw new Error('unsupported workspace file');
      state = data; emit('import');
    }
  };
}
