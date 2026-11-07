import { readFile } from 'node:fs/promises';
import { plan, sourceAnswer } from '../dist/retrieval.js';

const cases = JSON.parse(await readFile(new URL('./cases.json', import.meta.url), 'utf8'));
let passed = 0;
let top1 = 0;
let ranked = 0;
let supported = 0;
let abstained = 0;
for (const test of cases) {
  const result = plan(test.question, test.previous ? plan(test.previous) : null);
  const ids = result.notes.map(note => note.id);
  const answers = sourceAnswer(result);
  const citationsValid = answers.every(answer =>
    ids.length ? answer.citations.length > 0 && answer.citations.every(id => ids.includes(id)) : answer.citations.length === 0);
  const labeled = result.kind !== 'application' || answers.some(answer => answer.label === 'Application · AI interpretation');
  const ok = result.kind === test.kind && (test.expected ? ids.includes(test.expected) : !ids.length) && citationsValid && labeled;
  if (ok) passed++;
  if (test.expected) {
    supported++;
    if (ids[0] === test.expected) top1++;
    if (ids.includes(test.expected)) ranked++;
  } else if (result.kind === 'unsupported' && !ids.length) abstained++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${test.id.padEnd(15)} ${result.kind.padEnd(12)} ${ids.join(', ') || '—'}`);
}
console.log(`\nCases ${passed}/${cases.length} | Top-1 ${top1}/${supported} | Recall@3 ${ranked}/${supported} | Abstention ${abstained}/${cases.length - supported}`);
if (passed !== cases.length) process.exitCode = 1;
