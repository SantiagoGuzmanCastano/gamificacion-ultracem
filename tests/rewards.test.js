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
