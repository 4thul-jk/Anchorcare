import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedSourceQuotes } from './source-quotes';
const context = { sections: { episodes: { status: 'available', records: [{ id: 'e1', evidence: [{ id: 's1', text: 'Sarah cancelled her visit.', inspection_required: false }] }] } } };
function output(quote?: string) { return { status: 'supported', claims: [{ text: 'Sarah is arriving at 4:30.', citations: [{ section: 'episodes', recordId: 'e1', sourceId: 's1', quote }] }] }; }
test('valid identifier with missing or invented quote is rejected', () => {
  assert.equal(checkedSourceQuotes(context, output()).allowed, false);
  assert.equal(checkedSourceQuotes(context, output('Sarah will arrive.')).allowed, false);
});
test('only exact source excerpts are displayed, never the unsupported paraphrase', () => {
  const result = checkedSourceQuotes(context, output('Sarah cancelled her visit.'));
  assert.equal(result.allowed, true); assert.match(result.answer!, /cancelled/);
  assert.doesNotMatch(result.answer!, /4:30/);
});
