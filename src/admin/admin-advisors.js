import { gsap } from 'gsap';
import { advisorRows, sortAdvisors, withGoal } from './admin-model.js';
import { bar, count, el, header, lightPill, percent, tons } from './admin-ui.js';

const COLUMNS = ['#', 'Asesor', 'Meta', 'Venta', 'Cumplimiento', 'Brecha', 'Clientes activos', 'Nuevos', 'Recuperados', 'Pedido prom.', 'Estado', 'Participación obj.', 'Clientes obj.'];
// Sin la migración aplicada la meta vive solo en esta sesión; cualquier otro error se revierte.
const MISSING_TABLE = /could not find the function|does not exist|schema cache/i;

// A1 · Avance por asesor + A5 · Definir metas (editables en la fila).
export function renderTeam(page, { db, advisors, clients, sales, goals, notice, onGoalSaved }) {
  let rows = advisorRows(advisors, sales, clients, goals);
  let ahead = false;

  page.append(header('Avance por asesor', 'Meta, venta y brecha de cada asesor con sus ventas confirmadas. Cambia la participación o los clientes objetivo y el avance se recalcula.'));
  if (!rows.length) { page.append(el('p', 'empty-state', 'Todavía no hay asesores. Pídeles que creen una cuenta.')); return; }

  const toolbar = el('div', 'admin-toolbar');
  const summary = el('p', 'admin-states');
  const toggle = el('div', 'admin-segmented');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Orden de la tabla');
  const options = [['Más atrasados', false], ['Más adelantados', true]].map(([label, value]) => {
    const option = el('button', '', label);
    option.type = 'button';
    option.addEventListener('click', () => { ahead = value; paint(); });
    toggle.append(option);
    return [option, value];
  });
  toolbar.append(summary, toggle);

  const wrap = el('div', 'admin-table-wrap');
  const table = el('table', 'admin-table admin-team-table');
  const head = el('thead'), headRow = el('tr');
  COLUMNS.forEach(label => headRow.append(el('th', '', label)));
  head.append(headRow);
  const body = el('tbody');
  table.append(head, body);
  wrap.append(table);
  page.append(toolbar, wrap);

  function paint(flashKey) {
    rows = sortAdvisors(rows, ahead);
    options.forEach(([option, value]) => option.setAttribute('aria-pressed', String(value === ahead)));
    const byLabel = label => rows.filter(row => row.label === label).length;
    summary.replaceChildren(lightPill('green', `${byLabel('Cumple')} cumplen`), lightPill('yellow', `${byLabel('En riesgo')} en riesgo`), lightPill('red', `${byLabel('Crítico')} críticos`));
    body.replaceChildren(...rows.map((row, index) => rowNode(row, index)));
    const flashed = flashKey && body.querySelector(`[data-key="${flashKey}"]`);
    if (flashed) gsap.fromTo(flashed, { backgroundColor: 'rgba(18, 185, 214, .22)' }, { backgroundColor: 'rgba(18, 185, 214, 0)', duration: 1.2, clearProps: 'backgroundColor' });
  }

  function rowNode(row, index) {
    const tr = el('tr');
    tr.dataset.key = row.key;
    const name = el('div', 'admin-person');
    name.append(el('strong', '', row.name), el('span', '', `${row.departments.join(', ') || 'Sin zona'} · ${row.assignedClients} ${row.assignedClients === 1 ? 'cliente asignado' : 'clientes asignados'}`));
    const compliance = el('div', 'admin-compliance');
    compliance.append(bar(row.compliance, row.light), el('span', '', percent(row.compliance)));
    const clientsCell = el('div', 'admin-stack');
    clientsCell.append(el('strong', '', `${row.activeClients} de ${row.targetClients}`), el('span', '', row.clientGap ? `faltan ${row.clientGap}` : 'meta cumplida'));
    const order = el('div', 'admin-stack');
    order.append(el('strong', '', tons(row.avgOrder)), el('span', '', `requiere ${tons(row.requiredAvgOrder)}`));
    const cells = [
      [String(index + 1), 'admin-rank'], [name], [tons(row.goalTons)], [tons(row.soldTons)], [compliance],
      [tons(row.gapTons), row.gapTons ? 'admin-gap' : ''], [clientsCell], [count(row.newClients)], [count(row.recoveredClients)], [order],
      [lightPill(row.light, row.label)],
      [goalInput(row, 'share')], [goalInput(row, 'clients')],
    ];
    cells.forEach(([content, className], column) => {
      const td = el('td', className);
      td.dataset.label = COLUMNS[column];
      td.append(content);
      tr.append(td);
    });
    return tr;
  }

  function goalInput(row, kind) {
    const control = el('input', 'admin-goal-input');
    control.type = 'number';
    control.inputMode = 'decimal';
    if (kind === 'share') { control.min = '1'; control.max = '100'; control.step = '0.5'; control.value = String(+(row.targetShare * 100).toFixed(2)); }
    else { control.min = '1'; control.max = '500'; control.step = '1'; control.value = String(row.targetClients); }
    control.setAttribute('aria-label', `${kind === 'share' ? 'Participación objetivo (%)' : 'Clientes objetivo'} de ${row.name}`);
    const wrapper = el('label', 'admin-goal');
    wrapper.append(control);
    if (kind === 'share') wrapper.append(el('span', '', '%'));
    control.addEventListener('change', () => saveGoal(row, kind, control));
    return wrapper;
  }

  async function saveGoal(row, kind, control) {
    const value = Number(control.value);
    const valid = kind === 'share' ? value > 0 && value <= 100 : Number.isInteger(value) && value > 0 && value <= 500;
    const previous = kind === 'share' ? String(+(row.targetShare * 100).toFixed(2)) : String(row.targetClients);
    if (!valid) {
      notice(kind === 'share' ? 'La participación objetivo va de 1 a 100 %.' : 'Los clientes objetivo deben ser un número entero entre 1 y 500.', true);
      control.value = previous;
      return;
    }
    const goal = {
      advisor_key: row.key,
      market_tons: Number(row.goal.market_tons),
      target_share: kind === 'share' ? value / 100 : row.targetShare,
      target_clients: kind === 'clients' ? value : row.targetClients,
    };
    control.disabled = true;
    const result = await db.rpc('set_mvp_advisor_goal', {
      target_key: goal.advisor_key, new_target_share: goal.target_share, new_target_clients: goal.target_clients, new_market_tons: goal.market_tons,
    });
    control.disabled = false;
    if (result.error && !MISSING_TABLE.test(result.error.message || '')) {
      notice(result.error.message || 'No se pudo guardar la meta.', true);
      control.value = previous;
      return;
    }
    onGoalSaved(goal);
    rows = rows.map(item => item.key === row.key ? withGoal(item, goal) : item);
    paint(row.key);
    notice(result.error ? `Meta de ${row.name} aplicada solo en esta sesión: falta la tabla de metas en Supabase.` : `Meta de ${row.name} actualizada: ${tons(rows.find(item => item.key === row.key).goalTons)}.`, Boolean(result.error));
  }

  paint();
}
