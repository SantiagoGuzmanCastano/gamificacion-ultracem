import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commissionSummary, getCommissionStatus } from '../src/commission-wallet.js';

const migration = readFileSync(new URL('../supabase/migrations/20261022225412_commission_wallet.sql', import.meta.url), 'utf8');

test('summarizes only claimable commission snapshots', () => {
  const sales = [
    { advisor_id: 'advisor-1', confirmed: true, commission_amount: 24000, commission_status: 'available' },
    { advisor_id: 'advisor-1', confirmed: true, commission_amount: 48000, commission_status: 'pending' },
    { advisor_id: 'advisor-1', confirmed: true, commission_amount: null, commission_status: null },
    { advisor_id: 'advisor-2', confirmed: true, commission_amount: 90000, commission_status: 'available' },
  ];

  assert.deepEqual(commissionSummary(sales, 'advisor-1'), { available: 24000, pending: 48000, total: 72000, sales: 2 });
});

test('labels new, pending and legacy commissions safely', () => {
  assert.deepEqual(getCommissionStatus({ commission_amount: 24000, commission_status: 'available' }), { label: 'Disponible', claimable: true });
  assert.deepEqual(getCommissionStatus({ commission_amount: 24000, commission_status: 'pending' }), { label: 'Canjeada', claimable: false });
  assert.deepEqual(getCommissionStatus({ commission_amount: null, commission_status: null }), { label: 'Sin comisión configurada', claimable: false });
});

test('commission migration snapshots settings and prevents duplicate claims', () => {
  assert.match(migration, /commission_price_per_ton numeric\(12, 2\) not null default 800000/);
  assert.match(migration, /commission_rate numeric\(5, 4\) not null default 0\.03/);
  assert.match(migration, /commission := round\(requested_tons \* price_per_ton \* rate, 2\)/);
  assert.match(migration, /commission_status = 'available'/);
  assert.match(migration, /create function public\.request_mvp_commission\(target_sale uuid\)/);
  assert.match(migration, /advisor_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /commission_status = 'available'/);
  assert.match(migration, /commission_status = 'pending'/);
  assert.match(migration, /revoke all on function public\.request_mvp_commission\(uuid\) from public, anon/);
});
