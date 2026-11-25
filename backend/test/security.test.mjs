import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isInside, safeSegment, safeFormat, escapeHtml, csvCell, maskSecret, isSecretKey, safeCssColor } from '../security.mjs';
import { buildCalendarCsv, buildProposalHtml } from '../services/exporter.mjs';

test('safeFormat path traversal ve bilinmeyen değerleri reddeder', () => {
  assert.equal(safeFormat('../../evil'), 'post');
  assert.equal(safeFormat('story'), 'story');
  assert.equal(safeFormat('x"; app.quit(); //'), 'post');
});

test('safeSegment yalnızca güvenli karakter bırakır', () => {
  assert.equal(safeSegment('a/b\\c..d'), 'a-b-c-d');
  assert.equal(safeSegment('', 'x'), 'x');
});

test('isInside: kök içi/dışı ve .. kaçışı', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ajans-'));
  assert.ok(isInside(root, path.join(root, 'a', 'b.png')));
  assert.ok(!isInside(root, path.join(root, '..', 'x.png')));
  assert.ok(!isInside(root, '/etc/passwd'));
  const link = path.join(root, 'link');
  fs.symlinkSync('/etc', link);
  assert.ok(!isInside(root, path.join(link, 'passwd')));
});

test('HTML kaçışı ve renk doğrulama', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(safeCssColor('red;}</style><script>', '#111111'), '#111111');
  const html = buildProposalHtml({ name: '<script>x</script>', sector: 's', primary_color: 'x', secondary_color: 'y' }, '<b>', [
    { day: 1, format: '<i>', topic: '<u>', title: '<s>', goal: '<a>' }
  ]);
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(!/onclick=/.test(html));
});

test('CSV formül enjeksiyonu etkisizleşir', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  const csv = buildCalendarCsv({}, [{ day: 1, format: 'f', topic: '+1+1', eyebrow: '', title: '@SUM(A1)', desc: '', cta: '', goal: '-2' }]);
  assert.ok(csv.includes(`"'+1+1"`) && csv.includes(`"'@SUM(A1)"`) && csv.includes(`"'-2"`));
});

test('gizli anahtarlar maskelenir', () => {
  assert.ok(isSecretKey('gemini_api_key'));
  assert.ok(!isSecretKey('output_dir'));
  assert.equal(maskSecret('abcdefghijkl'), '••••ijkl');
});

import { localOnly, validatedPath } from '../security.mjs';

function runGuard(headers) {
  let status = 200, nextCalled = false;
  const res = { status(c) { status = c; return this; }, json() { return this; } };
  localOnly({ headers }, res, () => { nextCalled = true; });
  return { status, nextCalled };
}

test('localOnly: yalnızca yerel Host/Origin', () => {
  assert.equal(runGuard({ host: '127.0.0.1:4190' }).nextCalled, true);
  assert.equal(runGuard({ host: 'localhost:4000', origin: 'http://localhost:4000' }).nextCalled, true);
  assert.equal(runGuard({ host: 'evil.com' }).status, 403);
  assert.equal(runGuard({ host: '127.0.0.1:4010', origin: 'https://evil.com' }).status, 403);
  assert.equal(runGuard({ host: 'localhost.evil.com' }).status, 403);
});

test('validatedPath: kök dışı, yanlış uzantı ve yok olan dosya reddedilir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ajans-'));
  const ok = path.join(root, 'a.png');
  fs.writeFileSync(ok, 'x');
  const exts = new Set(['.png']);
  assert.equal(validatedPath(ok, [root], exts), ok);
  assert.equal(validatedPath('/etc/passwd', [root], exts), null);
  assert.equal(validatedPath(path.join(root, 'a.txt'), [root], exts), null);
  assert.equal(validatedPath(path.join(root, 'yok.png'), [root], exts), null);
  assert.equal(validatedPath(path.join(root, '..', path.basename(root), 'a.png'), [root], exts), ok);
  assert.equal(validatedPath(ok, [], exts), null);
});
