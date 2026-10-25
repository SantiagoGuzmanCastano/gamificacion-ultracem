import { loadZoneMarket } from '../zone-opportunity.js';
import { renderSummary } from './admin-kpi.js';
import { renderTeam } from './admin-advisors.js';
import { renderZones } from './admin-zones.js';
import { adminGuideBar } from './admin-guide.js';
import { playAdminEntrance } from './admin-entrance.js';

let marketRequest = null;

// El mercado por zona solo existe en zone-market.json; se pide una vez.
function loadMarket() {
  marketRequest ??= loadZoneMarket().catch(cause => { marketRequest = null; throw cause; });
  return marketRequest;
}

export async function renderAdminView(page, view, context) {
  const market = await loadMarket();
  if (!page.isConnected) return;
  page.replaceChildren();
  page.className = 'admin-page admin-prd';
  const render = { team: renderTeam, zones: renderZones }[view] ?? renderSummary;
  render(page, { ...context, market });
  // Guías bajo el título: «Importante» (PRD) y «¿Cómo funciona?» de esta vista.
  page.querySelector('.admin-head > div')?.append(adminGuideBar({ team: 'team', zones: 'zones' }[view] ?? 'dashboard'));
  playAdminEntrance(page, view ?? 'dashboard');
}
