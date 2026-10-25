import { showAdminPrdGuide, showAdminViewGuide } from '../progress-guide.js';
import { mascotImages } from '../mascot.js';
import { advisorIcon } from '../advisor-icons.js';

// Bajo el título de cada vista del admin va «¿Cómo funciona?» (qué hace esa vista). Solo en
// Resumen aparece además «Importante» (el PRD); al cerrarlo se resalta «¿Cómo funciona?».
// Una acción opcional (Gestión: cliente de prueba) va al lado y también al final de la guía.
export function adminGuideBar(view, action = null) {
  const bar = document.createElement('div');
  bar.className = 'admin-guide-bar';
  const important = document.createElement('button');
  important.type = 'button';
  important.className = 'admin-guide-button';
  important.innerHTML = '<span class="admin-guide-dot" aria-hidden="true">!</span>';
  important.append('Importante: este panel y el PRD');
  const how = document.createElement('button');
  how.type = 'button';
  how.className = 'admin-how-button';
  how.innerHTML = `<span class="admin-how-icon" aria-hidden="true">${advisorIcon('sparkles')}</span>`;
  how.append('¿Cómo funciona?');
  const nudge = () => {
    how.classList.remove('is-nudged');
    void how.offsetWidth;
    how.classList.add('is-nudged');
    how.focus({ preventScroll: false });
    setTimeout(() => how.classList.remove('is-nudged'), 4200);
  };
  important.addEventListener('click', () => showAdminPrdGuide({ mascot: mascotImages.happy, onFinish: () => requestAnimationFrame(nudge) }));
  how.addEventListener('click', () => { how.classList.remove('is-nudged'); showAdminViewGuide(view, { mascot: mascotImages.happy, finish: action?.label, onFinish: action?.run }); });
  if (view === 'dashboard') bar.append(important);
  bar.append(how);
  if (action) {
    const extra = document.createElement('button');
    extra.type = 'button';
    extra.className = 'admin-demo-button';
    extra.innerHTML = `<span class="admin-how-icon" aria-hidden="true">${advisorIcon('clients')}</span>`;
    extra.append(action.label);
    extra.addEventListener('click', async () => {
      extra.disabled = true;
      try { await action.run(); } finally { extra.disabled = false; }
    });
    bar.append(extra);
  }
  return bar;
}
