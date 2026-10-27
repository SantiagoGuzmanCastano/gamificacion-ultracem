import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, fillGap, isDefaultLayout, neighborOf, parseLayout, placeNear, stackedOrder, swapCards } from '../src/dashboard-layout.js';

test('by default clients and weekly sales sit left; ranking, goal and portfolio right', () => {
  assert.deepEqual(DEFAULT_LAYOUT, { left: ['clients', 'weekly'], right: ['ranking', 'goal', 'portfolio'] });
});

test('a saved layout is used only when it has the five cards exactly once', () => {
  assert.deepEqual(parseLayout(null), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout('no es json'), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout({ left: ['ranking', 'ranking'], right: ['clients', 'weekly', 'goal'] }), DEFAULT_LAYOUT);
  const custom = { left: ['ranking', 'goal', 'portfolio'], right: ['clients', 'weekly'] };
  assert.deepEqual(parseLayout(JSON.stringify(custom)), custom);
  assert.equal(isDefaultLayout(parseLayout(null)), true);
  assert.equal(isDefaultLayout(custom), false);
  // Un orden guardado con 1 y 4 se reparte 3/2.
  assert.deepEqual(parseLayout({ left: ['weekly'], right: ['clients', 'ranking', 'portfolio', 'goal'] }), { left: ['weekly', 'goal'], right: ['clients', 'ranking', 'portfolio'] });
});

test('swapping exchanges the exact places, also across columns', () => {
  assert.deepEqual(swapCards(DEFAULT_LAYOUT, 'clients', 'ranking'), { left: ['ranking', 'weekly'], right: ['clients', 'goal', 'portfolio'] });
  assert.deepEqual(swapCards(DEFAULT_LAYOUT, 'goal', 'portfolio').right, ['ranking', 'portfolio', 'goal']);
  assert.deepEqual(swapCards(DEFAULT_LAYOUT, 'goal', 'goal'), DEFAULT_LAYOUT);
});

test('a card dropped on the top or bottom of another goes above or below it', () => {
  // Avance pasa debajo de Ventas, en la columna izquierda.
  assert.deepEqual(placeNear(DEFAULT_LAYOUT, 'portfolio', 'weekly', 'below'), { left: ['clients', 'weekly', 'portfolio'], right: ['ranking', 'goal'] });
  // Avance pasa encima de Ventas.
  assert.deepEqual(placeNear(DEFAULT_LAYOUT, 'portfolio', 'weekly', 'above').left, ['clients', 'portfolio', 'weekly']);
  // En la misma columna: Ranking baja debajo de Meta.
  assert.deepEqual(placeNear(DEFAULT_LAYOUT, 'ranking', 'goal', 'below').right, ['goal', 'ranking', 'portfolio']);
  // Reparto 3/2: si Clientes se va a la derecha, la última de la derecha (Avance) pasa a la izquierda.
  const crowded = placeNear(DEFAULT_LAYOUT, 'clients', 'ranking', 'above');
  assert.deepEqual(crowded, { left: ['weekly', 'portfolio'], right: ['clients', 'ranking', 'goal'] });
  // Nunca 4 y 1, ni una columna vacía, aunque se intente.
  for (const [moved, target] of [['weekly', 'goal'], ['clients', 'portfolio']]) {
    const next = placeNear({ left: ['clients', 'weekly'], right: ['ranking', 'goal', 'portfolio'] }, moved, target, 'below');
    assert.ok(Math.abs(next.left.length - next.right.length) <= 1);
    assert.ok([...next.left, ...next.right].includes(moved));
  }
});

test('a big empty gap is filled by the last card of the taller column', () => {
  // La captura: izquierda Clientes, Meta, Ranking; derecha Ventas y Avance (con hueco).
  const heights = { clients: 370, goal: 175, ranking: 245, weekly: 258, portfolio: 170 };
  const layout = { left: ['clients', 'goal', 'ranking'], right: ['weekly', 'portfolio'] };
  assert.deepEqual(fillGap(layout, heights), { left: ['clients', 'goal'], right: ['weekly', 'portfolio', 'ranking'] });
  // La tarjeta que se acaba de mover no se va: pasa la anterior a ella.
  assert.deepEqual(fillGap(layout, heights, { keep: 'ranking' }), { left: ['clients', 'ranking'], right: ['weekly', 'portfolio', 'goal'] });
  // Si ya están parejas, o mover empeora o rompe el 3/2, no se toca.
  const even = { left: ['ranking', 'goal'], right: ['clients'] };
  assert.deepEqual(fillGap(even, { ranking: 300, goal: 260, clients: 580 }), even);
  const lopsided = { left: ['clients', 'weekly'], right: ['ranking', 'goal', 'portfolio'] };
  assert.deepEqual(fillGap(lopsided, { clients: 900, weekly: 300, ranking: 100, goal: 100, portfolio: 100 }), lopsided);
});

test('on one column the cards read interleaved, and arrows find the neighbor', () => {
  assert.deepEqual(stackedOrder(DEFAULT_LAYOUT), ['clients', 'ranking', 'weekly', 'goal', 'portfolio']);
  assert.equal(neighborOf(DEFAULT_LAYOUT, 'goal', 'up'), 'ranking');
  assert.equal(neighborOf(DEFAULT_LAYOUT, 'goal', 'left'), 'weekly');
  assert.equal(neighborOf(DEFAULT_LAYOUT, 'portfolio', 'left'), 'weekly');
  assert.equal(neighborOf(DEFAULT_LAYOUT, 'clients', 'left'), null);
});
