import { loadZoneMarket } from '../zone-opportunity.js';
import { renderSummary } from './admin-kpi.js';
import { renderTeam } from './admin-advisors.js';
import { renderZones } from './admin-zones.js';

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
}
