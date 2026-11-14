// A run's event stream as one record per 50 m parcel, so any year can be shown
// without replaying events: 4 bytes per parcel
//   [0] class of its first event (1 low rise, 4 fields, 5 vertical farm; 2/3 if it starts denser)
//   [1] year index (0 = 2025) of that first event
//   [2] year index it became mid rise   (255 = never)
//   [3] year index it became high rise  (255 = never)
// Events of year index y are idx[off[y] .. off[y+1]); the state shown at year y
// is every event before off[y+1] (the incubator's Replay.set does the same).

export const NEVER = 255;
export const CLASSES = { 1: 'low', 2: 'mid', 3: 'high', 4: 'fields', 5: 'vfarm' };

export function cellsFromEvents(n, ev) {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { out[i * 4 + 1] = NEVER; out[i * 4 + 2] = NEVER; out[i * 4 + 3] = NEVER; }
  const { idx, cls, off } = ev;
  let y = 0;
  for (let k = 0; k < idx.length; k++) {
    while (y < off.length - 2 && k >= off[y + 1]) y++;
    const q = idx[k] * 4, c = cls[k];
    if (out[q] === 0) { out[q] = c; out[q + 1] = y; }
    if (c === 2 && out[q + 2] === NEVER) out[q + 2] = y;
    if (c === 3 && out[q + 3] === NEVER) out[q + 3] = y;
  }
  return out;
}

/** Class of parcel i at year index y (0 = nothing). Same rule as the map shader. */
export function classAt(cells, i, y) {
  const q = i * 4;
  if (cells[q + 3] <= y) return 3;
  if (cells[q + 2] <= y) return 2;
  if (cells[q] && cells[q + 1] <= y) return cells[q];
  return 0;
}

/** The whole grid's classes at year index y. */
export function tierAt(cells, n, y, out = new Uint8Array(n)) {
  for (let i = 0; i < n; i++) out[i] = classAt(cells, i, y);
  return out;
}
