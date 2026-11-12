// Fails if any module imports files from another module.
// Modules may import only from shared/ and from inside their own folder.
// Run: node tools/check-isolation.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const modulesDir = join(root, 'modules');
const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|html)$/.test(name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const mod of readdirSync(modulesDir)) {
  const modDir = join(modulesDir, mod);
  if (!statSync(modDir).isDirectory()) continue;
  for (const file of walk(modDir)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue; // CDN / bare imports are allowed
      const target = resolve(dirname(file), spec.split('?')[0]);
      const rel = relative(root, target).split(sep);
      const ok = rel[0] === 'shared' || (rel[0] === 'modules' && rel[1] === mod);
      if (!ok) problems.push(`${relative(root, file)} imports ${spec}`);
    }
  }
}

if (problems.length) {
  console.error('Module isolation violated (modules may only import shared/ or their own files):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('Module isolation OK');
