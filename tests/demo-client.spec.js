// Spec del modo demo (fase Red): cliente con la misma forma que Supabase, datos de muestra en memoria
// y ninguna llamada de red. Se activa con VITE_DEMO=true (ver src/main.js).
import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoClient, DEMO_ADVISOR_ID } from '../src/demo-client.js';

const NOW = new Date(2026, 9, 22, 10, 0);

describe('modo demo: sesión y perfil', () => {
  let db;
  beforeEach(() => { db = createDemoClient({ now: NOW }); });

  it('arranca con la sesión del asesor de demo', async () => {
    const { data } = await db.auth.getUser();
    expect(data.user.id).toBe(DEMO_ADVISOR_ID);
    const own = await db.from('mvp_profiles').select('user_id,full_name,role').eq('user_id', DEMO_ADVISOR_ID).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ user_id: DEMO_ADVISOR_ID, full_name: 'Asesor Demo', role: 'advisor' });
  });

  it('con role admin el perfil es de administrador y ve a los asesores', async () => {
    const admin = createDemoClient({ role: 'admin', now: NOW });
    const { data: { user } } = await admin.auth.getUser();
    const own = await admin.from('mvp_profiles').select('role').eq('user_id', user.id).single();
    expect(own.data.role).toBe('admin');
    const advisors = await admin.rpc('get_mvp_advisors');
    expect(advisors.data.length).toBeGreaterThanOrEqual(3);
    expect(advisors.data.every(row => row.role === 'advisor' && row.email.endsWith('@demo.test'))).toBe(true);
  });

  it('cerrar sesión deja la app sin usuario y entrar la recupera con cualquier dato', async () => {
    await db.auth.signOut();
    expect((await db.auth.getUser()).data.user).toBeNull();
    const login = await db.auth.signInWithPassword({ email: 'x@y.z', password: 'cualquiera' });
    expect(login.error).toBeNull();
    expect((await db.auth.getUser()).data.user.id).toBe(DEMO_ADVISOR_ID);
  });

  it('no permite crear cuentas reales', async () => {
    const signup = await db.auth.signUp({ email: 'a@b.c', password: '123456' });
    expect(signup.error.message).toMatch(/modo demo/i);
  });
});

describe('modo demo: datos de muestra', () => {
  let db;
  beforeEach(() => { db = createDemoClient({ now: NOW }); });

  it('el asesor solo ve sus clientes, con toneladas y 4 tareas cada uno', async () => {
    const { data } = await db.from('mvp_clients').select('id,name,type,advisor_id,tons_requested,mvp_tasks(id,title,description,completed_at)').order('created_at', { ascending: false });
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(data.every(client => client.advisor_id === DEMO_ADVISOR_ID)).toBe(true);
    expect(data.every(client => client.tons_requested > 0 && client.mvp_tasks.length === 4)).toBe(true);
  });

  it('las ventas confirmadas traen toneladas y fecha de confirmación', async () => {
    const { data } = await db.from('mvp_sales').select('id,client_id,advisor_id,amount,tons_sold,completed_at,confirmed,confirmed_at');
    const confirmed = data.filter(sale => sale.confirmed);
    expect(confirmed.length).toBeGreaterThan(0);
    expect(confirmed.every(sale => sale.tons_sold > 0 && !Number.isNaN(Date.parse(sale.confirmed_at)))).toBe(true);
  });

  it('el ranking tiene posición, ventas y toneladas confirmadas', async () => {
    const { data } = await db.rpc('get_mvp_advisor_ranking');
    expect(data.map(row => row.position)).toEqual(data.map((_, index) => index + 1));
    expect(data.find(row => row.advisor_id === DEMO_ADVISOR_ID)).toMatchObject({ full_name: 'Asesor Demo' });
    expect(data.every(row => 'confirmed_sales' in row && 'confirmed_tons' in row && 'xp' in row)).toBe(true);
  });
});

describe('modo demo: acciones', () => {
  let db;
  beforeEach(() => { db = createDemoClient({ now: NOW }); });

  const ownClients = async () => (await db.from('mvp_clients').select('id,tons_requested,mvp_tasks(id,completed_at)')).data;

  it('completar una tarea la marca y no se puede completar dos veces', async () => {
    const task = (await ownClients()).flatMap(client => client.mvp_tasks).find(item => !item.completed_at);
    expect((await db.rpc('complete_mvp_task', { target_task: task.id })).data).toBe(true);
    expect((await db.rpc('complete_mvp_task', { target_task: task.id })).data).toBe(false);
    const after = (await ownClients()).flatMap(client => client.mvp_tasks).find(item => item.id === task.id);
    expect(after.completed_at).not.toBeNull();
  });

  it('confirmar venta exige 4 de 4 y luego suma la venta con sus toneladas', async () => {
    const client = (await ownClients()).find(item => item.mvp_tasks.some(task => !task.completed_at));
    expect((await db.rpc('confirm_mvp_sale', { target_client: client.id })).error).not.toBeNull();
    for (const task of client.mvp_tasks) await db.rpc('complete_mvp_task', { target_task: task.id });
    const before = (await db.rpc('get_mvp_advisor_ranking')).data.find(row => row.advisor_id === DEMO_ADVISOR_ID);
    const sale = await db.rpc('confirm_mvp_sale', { target_client: client.id });
    expect(sale.error).toBeNull();
    const after = (await db.rpc('get_mvp_advisor_ranking')).data.find(row => row.advisor_id === DEMO_ADVISOR_ID);
    expect(after.confirmed_sales).toBe(before.confirmed_sales + 1);
    expect(after.confirmed_tons).toBe(before.confirmed_tons + client.tons_requested);
  });

  it('la sugerencia de Trompín sale de los datos, sin IA ni red', async () => {
    const { data, error } = await db.functions.invoke('recommend-client', { body: { name: 'Ferretería Norte', tasks: [{ title: 'Revisar una cotización' }] } });
    expect(error).toBeNull();
    expect(data.recommendation).toContain('Revisar una cotización');
    expect(data.recommendation).toContain('Ferretería Norte');
  });

  it('subir fotos y borrar la cuenta quedan desactivados con un mensaje claro', async () => {
    const upload = await db.storage.from('advisor-profile-photos').upload('x.png', new Blob(['x']));
    expect(upload.error.message).toMatch(/modo demo/i);
    const remove = await db.rpc('delete_mvp_own_account');
    expect(remove.error.message).toMatch(/modo demo/i);
  });
});
