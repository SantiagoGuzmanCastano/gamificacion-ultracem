import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

test('map build emits its local MapLibre worker and references the emitted URL', async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('../', import.meta.url)),
    build: { write: false },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  const worker = output.find(item => item.type === 'asset' && /maplibre-gl-worker.*\.mjs$/.test(item.fileName));
  assert.ok(worker, 'The worker must be emitted, not inferred beside a transformed module');
  const installedWorker = readFileSync(new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url), 'utf8');
  assert.equal(Buffer.from(worker.source).toString('utf8'), installedWorker);
  assert.ok(output.some(item => item.type === 'chunk' && item.code.includes(worker.fileName)));
});
