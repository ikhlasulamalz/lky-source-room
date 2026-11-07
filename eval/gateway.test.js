import assert from 'node:assert/strict';
import test from 'node:test';
import { askGateway, validateAnswer } from '../dist/gateway.js';
import { corpus } from '../dist/corpus.js';

const notes = [corpus.find(note => note.id === 'M2')];
const example = { label: 'Historical record', text: 'Lee connected home ownership to a tangible stake in Singapore.', citations: ['M2'] };

test('rejects fabricated or absent citation IDs', () => {
  for (const citations of [['S1'], ['made-up'], []]) {
    assert.throws(() => validateAnswer({ paragraphs: [{ ...example, citations }] }, notes), /source IDs/);
  }
});

test('requires a distinct label when applying a historical idea', () => {
  assert.throws(() => validateAnswer({ paragraphs: [example] }, notes, 'application'), /application label/);
});

test('mocked Gateway receives only selected notes and returns validated paragraphs', async () => {
  const paragraphs = await askGateway({ question: 'Why did Lee encourage home ownership?', kind: 'historical', notes, key: 'test-key' }, async (_, options) => {
    const payload = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(payload.messages[1].content).evidence.map(note => note.id), ['M2']);
    assert.equal(payload.response_format.type, 'json_schema');
    return Response.json({ choices: [{ message: { content: JSON.stringify({ paragraphs: [example] }) } }] });
  });
  assert.deepEqual(paragraphs, [example]);
});

test('rejects HTTP errors so the interface can show source notes', async () => {
  await assert.rejects(askGateway({ question: 'Housing?', kind: 'historical', notes, key: 'invalid' },
    async () => new Response(null, { status: 401 })), /HTTP 401/);
});
