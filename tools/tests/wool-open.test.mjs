// 27 Nov 2026 · Loop City step 2 (wool): the example opens on the prologue's bare site, not on step 1's finished mould
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/loop-city-wool/' + p, import.meta.url), 'utf8');
test('the wool example opens on the bare site (prologue), and the state ends once anything plays', () => {
  const h = read('index.html'), f = read('flow.js'), s = read('skin.js');
  assert.ok(f.includes("return !a || (+a[1] === 1 && /[#&]site\\b/.test(h0)); }"), 'only the example opened plainly (or with &site)');
  assert.ok(h.includes("(window.__lcSiteOnly && (k === 'mould' || k === 'rail')) ? 0 :"), 'the mould and the rail drawn at nothing');
  assert.ok(/function siteStart\(\) \{ window.__lcSiteOnly = true; P.start = true; P.k = 0;/.test(f), 'flow opens on card 0');
  assert.ok(f.includes('else if (fromStart() && S.step === 1) siteStart();'), 'started from the demo hook');
  assert.ok(f.includes("if (k !== 0) siteEnd();") && f.includes('siteEnd(); P.on = true; P.single = true;'), 'ends when a step plays or Finish now');
  assert.ok(f.includes('if (window.__lcSiteOnly && S.step !== 1) siteEnd();'), 'ends when another step is set');
  assert.ok(s.includes("if (window.__lcSiteOnly) return isZh() ? '0 场地与环线' : '0 The site and the loop';"), 'the phone sheet says the prologue');
  assert.ok(/skin\.js\?v=7/.test(h) && /flow\.js\?v=8/.test(h), 'versions bumped');
});
