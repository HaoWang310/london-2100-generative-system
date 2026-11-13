// Assemble the GitHub Pages site into <outDir> and stamp the build.
//   node tools/build-site.mjs _site [commit] [builtAt]
//
// - copies the app, shared/, modules/ and incubator/ (tests and tooling excluded)
// - writes app/version.js and version.json with the version/commit
// - appends ?v=<commit> to relative imports so a new deploy is never mixed
//   with cached files from the previous one (incubator/ is left untouched)

import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const out = resolve(process.argv[2] || '_site');
const commit = process.argv[3] || process.env.GITHUB_SHA || (() => { try { return execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { return 'dev'; } })();
const builtAt = process.argv[4] || new Date().toISOString();
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();

const INCLUDE = ['index.html', 'app', 'shared', 'modules', 'incubator', 'assets', 'data', 'VERSION'];
const SKIP_DIR = new Set(['tests', 'node_modules', '_template']);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of INCLUDE) {
  const src = join(root, item);
  if (!existsSync(src)) continue;
  cpSync(src, join(out, item), {
    recursive: true,
    filter: p => !p.split(sep).some(part => SKIP_DIR.has(part)) && !/\.test\.mjs$/.test(p)
  });
}
writeFileSync(join(out, '.nojekyll'), '');

const build = { version, commit, builtAt, releasePath: null };
writeFileSync(join(out, 'app/version.js'),
  `// Stamped by tools/build-site.mjs\nexport const BUILD = ${JSON.stringify(build)};\n`);
writeFileSync(join(out, 'version.json'), JSON.stringify({ version, commit, builtAt }, null, 2));

// Cache-busting for relative imports and asset links.
const tag = commit.slice(0, 7);
const RE = /((?:from\s*|import\s*\(\s*|src=|href=)\s*["'])(\.{1,2}\/[^"'?#]+?\.(?:m?js|css))(["'])/g;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(out, p);
    if (rel.startsWith('incubator')) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(m?js|html)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      const next = src.replace(RE, (_, a, spec, c) => `${a}${spec}?v=${tag}${c}`);
      if (next !== src) writeFileSync(p, next);
    }
  }
}
walk(out);
console.log(`Built site v${version} (${tag}) -> ${relative(root, out) || out}`);
