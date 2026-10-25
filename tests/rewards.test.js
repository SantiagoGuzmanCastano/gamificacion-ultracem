import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardPoints, rewardProgress } from '../src/rewards.js';
import { advisorIcon } from '../src/advisor-icons.js';

test('rewards use the stored profile points without recalculating from sales', () => {
  assert.equal(rewardPoints(275), 275);
  assert.equal(rewardPoints(null), 0);
  assert.equal(rewardPoints('invalid'), 0);
});

test('reward progress is calculated from the stored point balance', () => {
  assert.deepEqual(rewardProgress({ cost: 400 }, 275), {
    reachable: false,
    missing: 125,
    percentage: 69,
  });
});

test('rewards navigation keeps the gift icon', () => {
  assert.match(advisorIcon('gift'), /M3 8h18v4H3z/);
});

test('the Inicio points goal is the cheapest reward not reached yet', async () => {
  const { nextRewardGoal } = await import('../src/rewards.js');
  const goal = nextRewardGoal(410);
  assert.equal(goal.next.id, 'cash-200');
  assert.equal(goal.missing, 190);
  assert.equal(goal.available, 4);
  assert.equal(nextRewardGoal(0).next.id, 'cinema');
  assert.equal(nextRewardGoal(5000).next, null);
});
