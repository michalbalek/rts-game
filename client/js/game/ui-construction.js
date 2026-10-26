import { BUILDING_DEFS, BUILD, buildSpeedFactor } from '../sim/constants.js';
import { escapeHtml } from './modals.js';

export function constructionSites() {
  const s = this.session;
  if (!s) return [];
  return s.state.buildings.filter(b => {
    if (b.ownerId !== s.selfId || b.complete) return false;
    const def = b.config || BUILDING_DEFS[b.type];
    return !!def && def.buildTime > 0;
  });
}

export function siteStats(b) {
  const def = b.config || BUILDING_DEFS[b.type];
  const info = this.session.getBuilderInfo(b);
  const active = info.active || 0;
  const total = info.total || 0;
  const factor = buildSpeedFactor(active);
  return {
    progress: Math.round(b.progress * 100),
    active,
    total,
    builders: `${active} na místě · ${total} přiřazeno`,
    speed: `${Math.round(factor * 100)} %`,
    left: factor > 0 ? `~${Math.ceil((1 - b.progress) * def.buildTime / factor)} s` : 'čeká na stavitele'
  };
}

export function siteLabel(b) {
  const { progress, active, total } = this.siteStats(b);
  return total ? `${progress} % · stavitelů ${active}/${total}` : `${progress} % · nikdo nestaví`;
}

export function siteInfoHtml(b) {
  const stats = this.siteStats(b);
  return `
    <div class="sel-rows" data-site-info>
      <div class="sel-row"><span>👷 Stavitelé</span><b data-site-builders>${stats.builders}</b></div>
      <div class="sel-row"><span>Rychlost stavby</span><b data-site-speed>${stats.speed}</b></div>
      <div class="sel-row"><span>Zbývá</span><b data-site-left>${stats.left}</b></div>
    </div>
    <p class="sel-desc">Vyberte poddané a klikněte pravým tlačítkem na toto staveniště, nebo v jejich panelu zvolte stavbu v sekci Stavět. Každý další stavitel přidá ${Math.round(BUILD.extraBuilderSpeed * 100)} % základní rychlosti.</p>`;
}

export function constructSectionHtml(units) {
  const s = this.session;
  if (!units.some(u => u.isVillager && u.ownerId === s.selfId)) return '';
  const sites = this.constructionSites();
  if (!sites.length) return '';
  let html = '<div class="train-section"><div class="sub-heading">Stavět</div><div class="train-buttons">';
  for (const site of sites) {
    const def = site.config || BUILDING_DEFS[site.type];
    html += `
      <button class="train-button" data-action="construct" data-building-id="${site.id}">
        <span class="train-icon">${def.icon}</span>
        <span class="train-info">
          <strong>${escapeHtml(def.name)}</strong>
          <span data-site-label>${escapeHtml(this.siteLabel(site))}</span>
        </span>
      </button>`;
  }
  html += '</div><p class="sel-desc">Vybraní poddaní půjdou na zvolenou stavbu a začnou stavět. Můžete také kliknout pravým tlačítkem přímo na vlastní staveniště.</p></div>';
  return html;
}
