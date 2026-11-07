import { corpus } from './corpus.js';

const stop = new Set('a an and are as at be but by can could did do does for from had has have he her him his how i if in is it its lee kuan yew me my of on or our say she should singapore singaporean singaporeans so than that the their them they this to us we were what when where which who why will with would you your about now today current latest think thought tell explain apply handle help deal new make way some there been'.split(' '));
// Keep US as a country name even though the lowercase word "us" is a pronoun.
function tokens(text) {
  return (text.replace(/\bU\.?S\.?A?\.?\b/g, ' america ').toLowerCase()
    .normalize('NFKD').match(/[a-z0-9]+/g) ?? []).filter(term => !stop.has(term));
}

const index = corpus.map(note => ({
  note, tagged: new Set(tokens(note.terms)), words: new Set(tokens(note.topic + ' ' + note.evidence)),
}));
const weights = new Map();
for (const row of index) {
  for (const term of new Set([...row.tagged, ...row.words])) {
    weights.set(term, (weights.get(term) ?? 0) + 1);
  }
}

export function retrieve(question) {
  const query = [...new Set(tokens(question))];
  if (!query.length) return [];
  const ranked = index.map(({ note, tagged, words }) => {
    const matches = query.filter(word => tagged.has(word) || words.has(word));
    const score = matches.reduce((sum, term) => {
      const idf = Math.log(1 + index.length / weights.get(term));
      return sum + idf * (tagged.has(term) ? 1.5 : 0.75);
    }, 0);
    return { note, score, overlap: matches.length };
  }).sort((a, b) => b.score - a.score || a.note.id.localeCompare(b.note.id));

  const best = ranked[0];
  if (best.score < 3.4 || (best.overlap === 1 && query.length > 2) ||
      best.overlap / query.length < 0.2) return [];
  return ranked.filter(hit => hit.score >= Math.max(3.4, best.score * 0.6)).slice(0, 3).map(hit => hit.note);
}

const manipulation = /\b(ignore|override|disregard)\b.{0,65}\b(instructions|system|rules|sources)\b|\b(fabricate|invent|make up)\b.{0,45}\b(quote|citation|source)\b/i;
const evidenceDemand = /\b(latest|real[ -]time|current price|current rate|today.s price|today.s rate|who (won|wins|will win))\b/i;
const application = /\b(would|should|today|modern|apply|advice|recommend|my|can i|20(1[6-9]|[2-9][0-9]))\b/i;
const followup = /^(and\b|why\b|what (about|does that)\b|how (about|so|does that|would that|can i apply that)\b|can you (expand|elaborate)\b)/i;

export function plan(question, previous = null) {
  if (manipulation.test(question)) return { kind: 'unsupported', notes: [], reason: 'I can discuss the historical sources, but I cannot invent quotations or citations.' };
  if (evidenceDemand.test(question)) return { kind: 'unsupported', notes: [], reason: 'This collection cannot verify current figures, results, or forecasts. Ask for a historical principle or context instead.' };
  let notes = retrieve(question);
  if (!notes.length && previous && followup.test(question) && tokens(question).length <= 2) {
    notes = previous.notes;
  }
  if (!notes.length) return { kind: 'unsupported', notes, reason: 'I found no close match in this collection. Try a question about small-state diplomacy, public housing, corruption, language learning, climate risk, or independence.' };
  return { kind: application.test(question) ? 'application' : 'historical', notes };
}

export function sourceAnswer(result) {
  if (!result.notes.length) return [{ text: result.reason, citations: [] }];
  const [first, ...rest] = result.notes;
  return [
    { label: 'Historical record', text: first.evidence, citations: [first.id] },
    ...(result.kind === 'application'
      ? [{ label: 'Application · AI interpretation', text: first.application, citations: [first.id] }]
      : []),
    ...rest.map(note => ({ label: 'Related context', text: note.evidence, citations: [note.id] })),
  ];
}
