// Version detection, update prompt and release history.
//
// The deploy workflow publishes:
//   /version.json              { version, commit, builtAt }  (latest build)
//   /releases/index.json       [{ id, version, commit, builtAt, path }]  newest first
//   /releases/<id>/            a frozen copy of each earlier build
// A page knows its own build from app/version.js (stamped at deploy time).

import { BUILD } from './version.js?v=47d6f75';
import { t } from '../shared/i18n/index.js?v=47d6f75';

const root = () => {
  // When running inside /releases/<id>/, the site root is two levels up.
  const here = new URL('.', location.href);
  return BUILD.releasePath ? new URL('../../', here) : here;
};

export async function fetchLatest() {
  const res = await fetch(new URL(`version.json?ts=${Date.now()}`, root()), { cache: 'no-store' });
  if (!res.ok) throw new Error('no version.json');
  return res.json();
}

export async function fetchReleases() {
  try {
    const res = await fetch(new URL(`releases/index.json?ts=${Date.now()}`, root()), { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export const isDevBuild = () => BUILD.commit === 'dev';
export const latestUrl = () => new URL(`?v=${Date.now()}`, root()).href;
export const releaseUrl = rel => new URL(rel.path, root()).href;

/** Polls for a newer deployment; calls onUpdate(latest) once when found. */
export function watchForUpdates(onUpdate, intervalMs = 5 * 60 * 1000) {
  if (isDevBuild() || BUILD.releasePath) return () => {};
  let notified = false;
  const check = async () => {
    if (notified) return;
    try {
      const latest = await fetchLatest();
      if (latest.commit && latest.commit !== BUILD.commit) { notified = true; onUpdate(latest); }
    } catch { /* offline or local file — ignore */ }
  };
  check();
  const timer = setInterval(check, intervalMs);
  const onVis = () => document.visibilityState === 'visible' && check();
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
}

export function versionLabel() {
  return BUILD.commit === 'dev' ? `v${BUILD.version} · dev` : `v${BUILD.version} · ${BUILD.commit.slice(0, 7)}`;
}

export function describeBuild(b) {
  const when = b.builtAt ? new Date(b.builtAt).toLocaleString() : t('ver.unknownDate');
  return `v${b.version} · ${String(b.commit).slice(0, 7)} · ${when}`;
}

export { BUILD };
