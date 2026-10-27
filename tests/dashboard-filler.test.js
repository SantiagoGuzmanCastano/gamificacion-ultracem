import test from 'node:test';
import assert from 'node:assert/strict';
import { SALES_QUOTES, ULTRACEM_FACTS, fillerMessages } from '../src/dashboard-filler.js';

test('the empty-space filler mixes sales quotes with Ultracem facts, no personal data', () => {
  assert.ok(SALES_QUOTES.length >= 10 && SALES_QUOTES.every(quote => quote.text && quote.author));
  assert.ok(ULTRACEM_FACTS.length >= 5);
  const messages = fillerMessages();
  assert.equal(messages.length, SALES_QUOTES.length + ULTRACEM_FACTS.length);
  assert.deepEqual(messages.slice(0, 3).map(item => item.kind), ['quote', 'quote', 'fact']);
  assert.ok(messages.every(item => item.kind === 'quote' || item.kind === 'fact'));
});

test('the filler order is shuffled each time but keeps two quotes and one fact', () => {
  // Generador fijo para que la prueba sea repetible.
  const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const first = fillerMessages(seeded(7)).map(item => item.text);
  const second = fillerMessages(seeded(99)).map(item => item.text);
  assert.notDeepEqual(first, second);
  assert.deepEqual([...first].sort(), [...second].sort());
  const kinds = fillerMessages(seeded(3)).map(item => item.kind);
  assert.deepEqual(kinds.slice(0, 6), ['quote', 'quote', 'fact', 'quote', 'quote', 'fact']);
});
