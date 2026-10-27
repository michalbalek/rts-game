import { Modals, escapeHtml } from './modals.js';
import { t } from '../i18n/index.js';
import { audio } from '../engine/audio.js';
import { updateTopBar, getStorageCaps, updateLegend, renderLegend, setGameCountdown } from './ui-hud.js';
import { buildDock, refreshBuildDock, updateDockAffordability, canAfford, setBuildMode, hideBanner } from './ui-build-dock.js';
import { bindSelectionPanel, releaseSelectedVillagers, selectedVillagerIds, updateSelectionPanel, selectionSignature, renderSelection, refreshDynamic } from './ui-selection.js';
import { constructionSites, siteStats, siteLabel, siteInfoHtml, constructSectionHtml } from './ui-construction.js';
import { emptySelectionHtml, buildingPanelHtml, unitsPanelHtml } from './ui-selection-content.js';
import { openSettings, openHelp, openCredits, showPause, confirmDemolish } from './ui-dialogs.js';
import { showMarket, refreshMarket } from './ui-market.js';
import { showResults, updateResultsCountdown, closeResults } from './ui-results.js';

export class GameUI {
  constructor({ hooks = {}, settings, modals } = {}) {
    this.hooks = hooks;
    this.settings = settings || {};
    this.modals = modals || new Modals();
    this.session = null;
    this.buildMode = null;
    this.buildRotation = 0;
    this.buildCategory = 'resources';
    this.timer = 0;
    this.lastSelectionSignature = '';
    this.lastLegendSignature = '';
    this.resultsOpen = false;
    this.resultsReturnAt = 0;
    this.marketOpen = false;
    this.fps = 0;

    this.el = {
      hud: document.getElementById('hud'),
      buildDock: document.getElementById('build-dock'),
      selectionPanel: document.getElementById('selection-panel'),
      buildBanner: document.getElementById('build-banner'),
      toastRoot: document.getElementById('toast-root'),
      connectionBanner: document.getElementById('connection-banner'),
      minimapInfo: document.getElementById('minimap-info'),
      fps: document.getElementById('fps-counter'),
      countdown: document.getElementById('game-countdown'),
      resMoney: document.getElementById('res-money'),
      resWood: document.getElementById('res-wood'),
      resStone: document.getElementById('res-stone'),
      resFood: document.getElementById('res-food'),
      resIron: document.getElementById('res-iron'),
      storeValue: document.getElementById('store-value'),
      foodStoreValue: document.getElementById('food-store-value'),
      popValue: document.getElementById('pop-value'),
      menuButton: document.getElementById('menu-button')
    };

    this.buildDock();
    this.bindSelectionPanel();
    if (this.el.menuButton) {
      this.el.menuButton.addEventListener('click', () => {
        if (this.hooks.openMenu) this.hooks.openMenu();
      });
    }
  }

  setSession(session) {
    this.session = session;
    this.buildMode = null;
    this.buildRotation = 0;
    this.lastSelectionSignature = '';
    this.lastLegendSignature = '';
    this.resultsOpen = false;
    this.resultsReturnAt = 0;
    this.marketOpen = false;
    this.el.selectionPanel.innerHTML = '';
    this.hideBanner();
    this.setConnection(null);
    this.buildDock();
    this.refreshBuildDock();
    this.update(1);
    this.renderLegend(true);
  }

  clearSession() {
    this.session = null;
    this.buildMode = null;
    this.buildRotation = 0;
    this.el.selectionPanel.innerHTML = '';
    this.el.buildDock.innerHTML = '';
    this.el.minimapInfo.innerHTML = '';
    this.hideBanner();
    this.setConnection(null);
    this.closeResults();
  }

  showHud(show) {
    if (this.el.hud) this.el.hud.classList.toggle('hidden', !show);
  }

  setShowFps(show) {
    this.settings.showFps = !!show;
    if (this.el.fps) this.el.fps.classList.toggle('hidden', !show);
  }

  setFps(value) {
    this.fps = value;
    if (this.el.fps && this.settings.showFps) {
      this.el.fps.textContent = `${Math.round(value)} FPS`;
    }
  }

  setConnection(text, kind = 'warning') {
    this.connectionText = text;
    if (!this.el.connectionBanner) return;
    if (!text) {
      this.el.connectionBanner.classList.add('hidden');
      this.el.connectionBanner.textContent = '';
      return;
    }
    this.el.connectionBanner.classList.remove('hidden');
    this.el.connectionBanner.className = `connection-banner ${kind}`;
    this.el.connectionBanner.innerHTML = `<span class="spinner"></span><span>${escapeHtml(t(text))}</span>`;
  }

  setGameCountdown(...args) {
    return setGameCountdown.apply(this, args);
  }

  update(dt = 0.016) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.15;
    if (!this.session) return;

    this.updateTopBar();
    this.updateDockAffordability();
    this.updateSelectionPanel();
    this.refreshDynamic();
    this.refreshMarket();
    this.updateLegend();
    this.updateResultsCountdown(dt);
  }

  updateTopBar(...args) {
    return updateTopBar.apply(this, args);
  }

  getStorageCaps(...args) {
    return getStorageCaps.apply(this, args);
  }

  buildDock(...args) {
    return buildDock.apply(this, args);
  }

  refreshBuildDock(...args) {
    return refreshBuildDock.apply(this, args);
  }

  updateDockAffordability(...args) {
    return updateDockAffordability.apply(this, args);
  }

  canAfford(...args) {
    return canAfford.apply(this, args);
  }

  setBuildMode(...args) {
    return setBuildMode.apply(this, args);
  }

  hideBanner(...args) {
    return hideBanner.apply(this, args);
  }

  bindSelectionPanel(...args) {
    return bindSelectionPanel.apply(this, args);
  }

  releaseSelectedVillagers(...args) {
    return releaseSelectedVillagers.apply(this, args);
  }

  selectedVillagerIds(...args) {
    return selectedVillagerIds.apply(this, args);
  }

  constructionSites(...args) {
    return constructionSites.apply(this, args);
  }

  siteStats(...args) {
    return siteStats.apply(this, args);
  }

  siteLabel(...args) {
    return siteLabel.apply(this, args);
  }

  siteInfoHtml(...args) {
    return siteInfoHtml.apply(this, args);
  }

  constructSectionHtml(...args) {
    return constructSectionHtml.apply(this, args);
  }

  updateSelectionPanel(...args) {
    return updateSelectionPanel.apply(this, args);
  }

  selectionSignature(...args) {
    return selectionSignature.apply(this, args);
  }

  renderSelection(...args) {
    return renderSelection.apply(this, args);
  }

  emptySelectionHtml(...args) {
    return emptySelectionHtml.apply(this, args);
  }

  buildingPanelHtml(...args) {
    return buildingPanelHtml.apply(this, args);
  }

  unitsPanelHtml(...args) {
    return unitsPanelHtml.apply(this, args);
  }

  refreshDynamic(...args) {
    return refreshDynamic.apply(this, args);
  }

  updateLegend(...args) {
    return updateLegend.apply(this, args);
  }

  renderLegend(...args) {
    return renderLegend.apply(this, args);
  }

  issue(cmd) {
    if (!this.session) return null;
    const result = this.hooks.command ? this.hooks.command(cmd) : this.session.command(cmd);
    if (result && result.ok === false && result.reason) {
      this.toast(result.message || result.reason, 'error');
      audio.play('error');
    }
    return result;
  }

  toast(text, kind = 'info') {
    if (kind === 'error' && this.marketOpen && this.modals.root) {
      const error = this.modals.root.querySelector('[data-market-error]');
      if (error) {
        error.textContent = t(text);
        error.hidden = false;
      }
    }
    if (!this.el.toastRoot) return;
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.innerHTML = `<span class="toast-icon">${kind === 'error' ? '⚠️' : kind === 'success' ? '✅' : '📜'}</span><span>${escapeHtml(t(text))}</span>`;
    this.el.toastRoot.appendChild(node);
    while (this.el.toastRoot.children.length > 5) {
      this.el.toastRoot.firstElementChild.remove();
    }
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 350);
    }, kind === 'error' ? 6000 : 4500);
  }

  openSettings(...args) {
    return openSettings.apply(this, args);
  }

  openHelp(...args) {
    return openHelp.apply(this, args);
  }

  openCredits(...args) {
    return openCredits.apply(this, args);
  }

  showPause(...args) {
    return showPause.apply(this, args);
  }

  confirmDemolish(...args) {
    return confirmDemolish.apply(this, args);
  }

  showMarket(...args) {
    return showMarket.apply(this, args);
  }

  refreshMarket(...args) {
    return refreshMarket.apply(this, args);
  }

  showResults(...args) {
    return showResults.apply(this, args);
  }

  updateResultsCountdown(...args) {
    return updateResultsCountdown.apply(this, args);
  }

  closeResults(...args) {
    return closeResults.apply(this, args);
  }
}

export { timeLabel } from './ui-format.js';
