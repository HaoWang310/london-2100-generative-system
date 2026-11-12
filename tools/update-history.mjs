// Add the freshly built site to the release history and prune old releases.
//   node tools/update-history.mjs <siteDir> <historyDir> [keep]
//
// historyDir/releases/<version>-<sha7>/   frozen copy of each build
// historyDir/releases/index.json          newest first
// The copy's app/version.js gets releasePath set, so the app knows it is a
// historical release (shows a "back to latest" banner, separate saved workspace).

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const site = resolve(process.argv[2]);
const hist = resolve(process.argv[3]);
const keep = Number(process.argv[4] || 20);

const latest = JSON.parse(readFileSync(join(site, 'version.json'), 'utf8'));
const id = `${latest.version}-${latest.commit.slice(0, 7)}`;
const relDir = join(hist, 'releases', id);
mkdirSync(join(hist, 'releases'), { recursive: true });

rmSync(relDir, { recursive: true, force: true });
// incubator/ apps are large and versioned by their own folders, so history
// snapshots cover the unified app only (keeps the history branch small).
cpSync(site, relDir, { recursive: true,
  filter: p => !p.startsWith(join(site, 'releases')) && !p.startsWith(join(site, 'incubator')) });
const path = `releases/${id}/`;
writeFileSync(join(relDir, 'app/version.js'),
  `// Historical release copy\nexport const BUILD = ${JSON.stringify({ ...latest, releasePath: path })};\n`);

const indexFile = join(hist, 'releases', 'index.json');
let index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];
index = [{ id, ...latest, path }, ...index.filter(r => r.id !== id)];
for (const old of index.slice(keep)) rmSync(join(hist, 'releases', old.id), { recursive: true, force: true });
index = index.slice(0, keep);
writeFileSync(indexFile, JSON.stringify(index, null, 2));
console.log(`Release ${id} recorded; ${index.length} kept.`);
