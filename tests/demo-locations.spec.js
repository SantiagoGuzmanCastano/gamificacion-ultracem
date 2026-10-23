// Spec de ubicaciones en el modo demo (fase Red): todos los clientes de muestra
// tienen departamento y ciudad del catálogo local, para que el mapa los pinte.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDemoClient } from '../src/demo-client.js';

const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url), 'utf8'));

describe('modo demo: ubicaciones', () => {
  it('cada cliente de muestra está en una ciudad del catálogo', async () => {
    const db = createDemoClient({ role: 'admin' });
    const { data } = await db.from('mvp_clients').select('id,department,city');
    expect(data.length).toBeGreaterThan(0);
    for (const client of data) {
      expect(capitals.some(capital => capital.department === client.department && capital.name === client.city), client.id).toBe(true);
    }
  });

  it('el asesor tiene clientes en más de un departamento', async () => {
    const db = createDemoClient();
    const { data } = await db.from('mvp_clients').select('department');
    expect(new Set(data.map(client => client.department)).size).toBeGreaterThan(1);
  });
});
