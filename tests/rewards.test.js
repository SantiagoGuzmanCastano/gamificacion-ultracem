import test from 'node:test';
import assert from 'node:assert/strict';
import { rewards, rewardCategories, rewardPoints, rewardProgress, filterRewards, daysLeftInMonth, POINTS_PER_SALE } from '../src/rewards.js';

test('points come only from confirmed sales and never go negative', () => {
  assert.equal(POINTS_PER_SALE, 50);
  assert.equal(rewardPoints(0), 0);
  assert.equal(rewardPoints(3), 150);
  assert.equal(rewardPoints(-2), 0);
  assert.equal(rewardPoints(undefined), 0);
});

test('progress reports missing points and caps the percentage', () => {
  const cinema = rewards.find(reward => reward.id === 'cinema');
  assert.deepEqual(rewardProgress(cinema, 50), { reachable: false, missing: 50, percentage: 50 });
  assert.deepEqual(rewardProgress(cinema, 100), { reachable: true, missing: 0, percentage: 100 });
  assert.deepEqual(rewardProgress(cinema, 250), { reachable: true, missing: 0, percentage: 100 });
});

test('two featured rewards stay out of the filtered collection', () => {
  assert.equal(rewards.filter(reward => reward.featured).length, 2);
  assert.equal(filterRewards('all').length, 6);
  assert.ok(filterRewards('fun').every(reward => reward.category === 'fun'));
  for (const [category] of rewardCategories.slice(1)) assert.ok(rewards.some(reward => reward.category === category), category);
});

test('the monthly challenge counts down to the first day of next month', () => {
  assert.deepEqual(daysLeftInMonth(new Date(2026, 9, 22, 12)), { days: 9, hours: 12 });
  assert.deepEqual(daysLeftInMonth(new Date(2026, 11, 31, 23)), { days: 0, hours: 1 });
});
