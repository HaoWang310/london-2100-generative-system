// Where the Growth Simulator lives, and how to read it.
//
// This module does not keep a copy of the simulator. It reads the incubator
// app's own files, so a change made there (engine, controls, words, data)
// reaches the workspace too:
//   incubator/growth-simulator-dark/engine.js     the engine GV
//   incubator/growth-simulator-dark/controls.js   I18N, GVC (settings, simple controls, red stretches)
//   incubator/growth-simulator-dark/data/meta.js  D (meta, rails, the final's stats), SIZES
//   incubator/growth-simulator-dark/data/*.z      the grids, raw deflate
// The isolation rule (modules import only shared/ and themselves) still holds:
// these files are fetched as data, never imported.

export const SOURCE_PATH = 'incubator/growth-simulator-dark/';

/** Absolute URL of the incubator app. Frozen releases (/releases/<id>/) carry no
 *  incubator/, so they read the live one at the site root. */
export function sourceBase(from = import.meta.url) {
  const u = new URL(`../../${SOURCE_PATH}`, from);
  u.pathname = u.pathname.replace(/\/releases\/[^/]+\//, '/');
  return u.href;
}

/** Evaluate the incubator's meta.js and controls.js in a private scope. */
export function evaluateShared(metaText, controlsText) {
  // eslint-disable-next-line no-new-func
  return new Function(`${metaText}\n${controlsText}\nreturn { D: D, SIZES: SIZES, I18N: I18N, GVC: GVC };`)();
}

/** Evaluate the incubator's engine.js in a private scope. */
export function evaluateEngine(engineText) {
  // eslint-disable-next-line no-new-func
  return new Function(`${engineText}\nreturn GV;`)();
}

/** Inflate raw-deflate bytes (the incubator's .z files). */
export async function inflate(buf) {
  const ds = new DecompressionStream('deflate');
  return new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
}
