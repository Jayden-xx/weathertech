import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, validateAbout } from '../src/lib/dom.js';

test('주소 검사에서 스크립트와 데이터 주소를 거부한다', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'vbscript:test']) assert.throws(() => safeUrl(url));
  assert.throws(() => safeUrl('mailto:hello@example.com', { image: true }));
  assert.equal(safeUrl('/work/quiet-coast'), '/work/quiet-coast');
  assert.equal(safeUrl('https://example.com/photo.jpg', { image: true }), 'https://example.com/photo.jpg');
});
test('소개 필수값과 필드별 길이를 검사한다', () => {
  assert.equal(Object.keys(validateAbout({ title: ' ', body: '', specialty: '' })).length, 3);
  assert.deepEqual(validateAbout({ title: 'Nuvv', body: 'Quiet moments.', specialty: 'Travel' }), {});
  assert.equal(Object.keys(validateAbout({ title: 'a'.repeat(81), body: 'b'.repeat(1201), specialty: 'c'.repeat(121) })).length, 3);
});
test('유니코드 글자 수와 HTML 문구를 일반 문자열로 처리한다', () => {
  assert.deepEqual(validateAbout({ title: '🌿'.repeat(80), body: '<script>example</script>', specialty: 'Travel' }), {});
  assert.ok(validateAbout({ title: '🌿'.repeat(81), body: 'text', specialty: 'Travel' }).title);
});
