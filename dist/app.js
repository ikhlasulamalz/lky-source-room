import { corpus } from './corpus.js';
import { plan, sourceAnswer } from './retrieval.js';
import { askGateway } from './gateway.js';

const $ = id => document.getElementById(id);
const messages = $('messages');
const welcome = $('welcome').cloneNode(true);
const question = $('question');
let previous = null;
let busy = false;

function node(tag, text, css) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (css) element.className = css;
  return element;
}

function sourceLink(note, text) {
  const link = node('a', text);
  link.href = note.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function sourceItem(note) {
  const item = node('li', '');
  item.append(sourceLink(note, `[${note.id}] ${note.topic}`),
    node('small', `${note.type} · ${note.date} · ${note.source}`),
    node('small', note.locator));
  return item;
}
$('catalog').append(...corpus.map(sourceItem));

function showSources(notes) {
  $('source-summary').textContent = notes.length
    ? `${notes.length} source ${notes.length === 1 ? 'note' : 'notes'} matched this turn.`
    : 'No source notes matched this turn.';
  $('sources').replaceChildren(...notes.map(sourceItem));
}

function addTurn(who, text, css) {
  $('welcome')?.remove();
  const turn = node('article', '', 'turn ' + css);
  turn.append(node('p', who, 'speaker'), node('p', text));
  messages.append(turn);
  return turn;
}

function renderAnswer(turn, paragraphs, notes, label) {
  turn.replaceChildren(node('p', label, 'speaker'));
  for (const paragraph of paragraphs) {
    const body = node('p', '', 'answer-text');
    if (paragraph.label) body.append(node('span', paragraph.label, 'answer-label'));
    body.append(document.createTextNode(paragraph.text));
    for (const id of [...new Set(paragraph.citations)]) {
      const note = notes.find(item => item.id === id);
      const link = sourceLink(note, `[${id}]`);
      link.className = 'cite';
      link.setAttribute('aria-label', 'Source ' + id + ': ' + note.topic);
      body.append(link);
    }
    turn.append(body);
  }
  messages.scrollTop = messages.scrollHeight;
}

function updateMode() {
  $('mode').textContent = $('key').value.trim()
    ? 'AI Gateway mode · Key used for the next supported question'
    : 'Source notes mode · No key required';
}
$('key').addEventListener('input', updateMode);

messages.addEventListener('click', event => {
  const starter = event.target.closest('.starters button');
  if (!starter || busy) return;
  question.value = starter.textContent;
  $('chat').requestSubmit();
});

$('clear').addEventListener('click', () => {
  if (busy) return;
  previous = null;
  messages.replaceChildren(welcome.cloneNode(true));
  $('source-summary').textContent = 'Sources appear here when you ask a question.';
  $('sources').replaceChildren();
  question.value = '';
  question.focus();
});

$('chat').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const input = question.value.trim();
  if (!input) { question.focus(); return; }
  const result = plan(input, previous);
  const previousQuestion = previous?.question ?? null;
  if (result.notes.length) previous = { ...result, question: input };
  question.value = '';
  addTurn('You', input, 'user');
  const turn = addTurn('The Source Room', 'Checking the source notes…', 'assistant');
  showSources(result.notes);
  const key = $('key').value.trim();
  if (!key || !result.notes.length) {
    renderAnswer(turn, sourceAnswer(result), result.notes, 'The Source Room · Source notes');
    question.focus();
    return;
  }
  busy = true;
  $('ask').disabled = true;
  $('clear').disabled = true;
  $('key').value = '';
  $('mode').textContent = 'Generating an answer from the matched sources…';
  try {
    const answer = await askGateway({ question: input, kind: result.kind, notes: result.notes, previousQuestion, key });
    renderAnswer(turn, answer, result.notes, 'The Source Room · AI synthesis');
  } catch {
    renderAnswer(turn, sourceAnswer(result), result.notes, 'The Source Room · Source notes');
    turn.append(node('p', 'AI Gateway could not provide a valid answer. Showing the matched notes instead.', 'mode'));
  } finally {
    busy = false;
    $('ask').disabled = false;
    $('clear').disabled = false;
    updateMode();
    question.focus();
  }
});
