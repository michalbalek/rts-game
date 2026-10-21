import { BUILDING_TYPES, BUILDING_CONFIG } from './buildings.js';
import { UNIT_TYPES, UNIT_CONFIG } from './units.js';
import { sound } from '../engine/audio.js';
import { getDistance } from '../engine/isometric.js';
import { CASTLE_START_X, CASTLE_START_Y } from '../engine/map.js';

export class UIManager {
  constructor(state, camera) {
    this.state = state;
    this.camera = camera;

    // Horní lišta
    this.elValWood = document.getElementById('val-wood');
    this.elValStone = document.getElementById('val-stone');
    this.elValFood = document.getElementById('val-food');
    this.elValCitizens = document.getElementById('val-citizens');
    this.elValArmy = document.getElementById('val-army');
    this.elCitizenTimerTxt = document.getElementById('citizen-timer-txt');
    this.elCitizenProgressFill = document.getElementById('citizen-progress-fill');

    // Scribe / Popularita
    this.elPopFace = document.getElementById('pop-face');
    this.elPopQuote = document.getElementById('pop-quote');
    this.elPopScore = document.getElementById('pop-score');

    // Tlačítka
    this.btnSound = document.getElementById('btn-sound');
    this.btnCenterCastle = document.getElementById('btn-center-castle');
    this.btnHelp = document.getElementById('btn-help');

    // Stavební banner
    this.buildBanner = document.getElementById('build-status-banner');
    this.bannerBuildingIcon = document.getElementById('banner-building-icon');
    this.bannerBuildingName = document.getElementById('banner-building-name');
    this.bannerDistanceInfo = document.getElementById('banner-distance-info');
    this.btnCancelBuild = document.getElementById('btn-cancel-build');

    // Panel výběru
    this.selIcon = document.getElementById('sel-icon');
    this.selTitle = document.getElementById('sel-title');
    this.selSubtitle = document.getElementById('sel-subtitle');
    this.selDesc = document.getElementById('sel-desc');
    this.selStats = document.getElementById('sel-stats');
    this.selActions = document.getElementById('sel-actions');

    // Tlačítka budov
    this.buildBtns = document.querySelectorAll('.build-btn');

    // Minimapa
    this.elMinimapCoords = document.getElementById('minimap-coords');

    // Toasty a Nápověda
    this.toastContainer = document.getElementById('toast-container');
    this.helpModal = document.getElementById('help-modal');
    this.btnCloseHelp = document.getElementById('btn-close-help');

    this.bindEvents();
  }

  bindEvents() {
    this.btnSound.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      this.btnSound.textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? 'Zvuky ztišeny, můj pane' : 'Zvuky zbroje a polnic zapnuty');
    });

    this.btnCenterCastle.addEventListener('click', () => {
      this.camera.centerOnTile(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);
      sound.playClick();
    });

    this.btnHelp.addEventListener('click', () => {
      this.helpModal.classList.remove('hidden');
      sound.playClick();
    });

    this.btnCloseHelp.addEventListener('click', () => {
      this.helpModal.classList.add('hidden');
    });

    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) {
        this.helpModal.classList.add('hidden');
      }
    });

    this.btnCancelBuild.addEventListener('click', () => {
      this.cancelBuildMode();
    });

    this.buildBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const buildingType = btn.dataset.building;
        sound.playClick();

        if (buildingType === 'castle') {
          this.camera.centerOnTile(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);
          if (this.state.castle) {
            this.state.selectedEntity = { type: 'building', entity: this.state.castle };
          }
          this.cancelBuildMode();
          this.updateSelectionPanel();
        } else {
          this.setBuildMode(buildingType);
        }
      });
    });
  }

  setBuildMode(buildingType) {
    this.state.buildMode = buildingType;
    const config = BUILDING_CONFIG[buildingType];

    this.buildBtns.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.building === buildingType);
    });

    this.buildBanner.classList.remove('hidden');
    this.bannerBuildingIcon.textContent = config.icon;
    this.bannerBuildingName.textContent = `Stavební plány: ${config.name}`;
    this.updateBannerDistance();
  }

  cancelBuildMode() {
    this.state.buildMode = null;
    this.buildBtns.forEach(btn => btn.classList.remove('selected'));
    this.buildBanner.classList.add('hidden');
  }

  updateBannerDistance() {
    if (!this.state.buildMode) return;

    const hoverX = this.state.hoverTile.x;
    const hoverY = this.state.hoverTile.y;
    const dist = Math.round(getDistance(hoverX, hoverY, CASTLE_START_X, CASTLE_START_Y));

    if (dist <= 100) {
      this.bannerDistanceInfo.textContent = `Vzdálenost od Donjonu: ${dist} / 100 bloků (Povoleno panovníkem ✓)`;
      this.bannerDistanceInfo.style.color = '#4ade80';
    } else {
      this.bannerDistanceInfo.textContent = `Vzdálenost od Donjonu: ${dist} / 100 bloků (MIMO STAVEBNÍ OKRUH ✗)`;
      this.bannerDistanceInfo.style.color = '#ef4444';
    }
  }

  update() {
    // 1. Zdroje
    this.elValWood.textContent = this.state.resources.wood;
    this.elValStone.textContent = this.state.resources.stone;
    this.elValFood.textContent = this.state.resources.food;
    this.elValCitizens.textContent = `${this.state.unemployedCitizens} / ${this.state.maxUnemployedCitizens}`;
    this.elValArmy.textContent = this.state.totalArmy;

    // 2. Scribe & Popularita
    if (this.state.resources.food > 20) {
      this.elPopFace.textContent = '😀';
      this.elPopQuote.textContent = '„Lidé jsou spokojeni, můj pane.“';
      this.elPopScore.textContent = 'Popularita: 100%';
      this.elPopScore.style.color = '#86efac';
    } else if (this.state.resources.food > 0) {
      this.elPopFace.textContent = '😐';
      this.elPopQuote.textContent = '„Sýpka je poloprázdná, můj pane!“';
      this.elPopScore.textContent = 'Popularita: 75%';
      this.elPopScore.style.color = '#fde047';
    } else {
      this.elPopFace.textContent = '😟';
      this.elPopQuote.textContent = '„Sýpka zeje prázdnotou, lid reptá!“';
      this.elPopScore.textContent = 'Popularita: 40%';
      this.elPopScore.style.color = '#f87171';
    }

    // 3. Časovač ohniště
    if (this.state.unemployedCitizens >= this.state.maxUnemployedCitizens) {
      this.elCitizenTimerTxt.textContent = 'PLNO (20)';
      this.elCitizenProgressFill.style.width = '100%';
    } else {
      const remaining = Math.max(0, this.state.citizenTimer).toFixed(1);
      this.elCitizenTimerTxt.textContent = `${remaining}s`;
      const progress = ((this.state.citizenSpawnInterval - this.state.citizenTimer) / this.state.citizenSpawnInterval) * 100;
      this.elCitizenProgressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    // 4. Souřadnice
    this.elMinimapCoords.textContent = `X: ${this.state.hoverTile.x}, Y: ${this.state.hoverTile.y}`;

    if (this.state.buildMode) {
      this.updateBannerDistance();
    }
  }

  updateSelectionPanel() {
    const sel = this.state.selectedEntity;
    this.selStats.innerHTML = '';
    this.selActions.innerHTML = '';

    if (!sel) {
      this.selIcon.textContent = '🏰';
      this.selTitle.textContent = 'Křižácké Panství';
      this.selSubtitle.textContent = 'Vyberte budovu nebo jednotku';
      this.selDesc.textContent = 'Klikněte levým tlačítkem myši na Donjon, kasárna či bojovníka pro zadání rozkazů.';
      return;
    }

    if (sel.type === 'building') {
      const b = sel.entity;
      const cfg = b.config;

      this.selIcon.textContent = cfg.icon;
      this.selTitle.textContent = cfg.name;
      this.selSubtitle.textContent = `Pozice v oáze: [${b.tileX}, ${b.tileY}]`;
      this.selDesc.textContent = cfg.description;

      let statsHtml = `<div class="stat-row"><span>Odolnost hradeb</span><span>${b.health} / ${b.maxHealth}</span></div>`;

      if (cfg.maxWorkers > 0) {
        statsHtml += `<div class="stat-row"><span>Pracující poddaní</span><span>${b.assignedWorkers} / ${cfg.maxWorkers}</span></div>`;
        const resName = cfg.producesResource === 'wood' ? 'Dřevo' : (cfg.producesResource === 'stone' ? 'Kámen' : 'Jablka');
        const totalYield = b.assignedWorkers * cfg.yieldPerWorker;
        statsHtml += `<div class="stat-row"><span>Sklizeň do skladu</span><span>+${totalYield} ${resName} / 3s</span></div>`;
      }
      this.selStats.innerHTML = statsHtml;

      // Donjon akce (Výcvik křižáckého pěšáka)
      if (b.type === BUILDING_TYPES.CASTLE) {
        const btnTrainSwordsman = document.createElement('button');
        btnTrainSwordsman.className = 'action-btn';
        btnTrainSwordsman.innerHTML = `
          <span>⚔️ Vycvičit Pěšáka</span>
          <span class="action-cost">🔥 1 poddaný | 🍎 30 | 🪵 15</span>
        `;
        btnTrainSwordsman.addEventListener('click', () => {
          const res = this.state.trainUnit(UNIT_TYPES.SWORDSMAN);
          if (!res.success) {
            this.showToast(res.reason, 'error');
          } else {
            this.showToast('Bojovník pozvedl meč ve jménu koruny!', 'success');
            this.updateSelectionPanel();
          }
        });
        this.selActions.appendChild(btnTrainSwordsman);
      }

      // Kasárna akce (Výcvik evropského lučištníka)
      if (b.type === BUILDING_TYPES.BARRACKS) {
        const btnTrainArcher = document.createElement('button');
        btnTrainArcher.className = 'action-btn';
        btnTrainArcher.innerHTML = `
          <span>🏹 Vycvičit Lučištníka</span>
          <span class="action-cost">🔥 1 poddaný | 🍎 40 | 🪵 35</span>
        `;
        btnTrainArcher.addEventListener('click', () => {
          const res = this.state.trainUnit(UNIT_TYPES.ARCHER);
          if (!res.success) {
            this.showToast(res.reason, 'error');
          } else {
            this.showToast('Lučištník napnul tětivu a je připraven k obraně!', 'success');
            this.updateSelectionPanel();
          }
        });
        this.selActions.appendChild(btnTrainArcher);
      }

      // Pracovní budovy
      if (cfg.maxWorkers > 0) {
        const btnAddWorker = document.createElement('button');
        btnAddWorker.className = 'action-btn';
        btnAddWorker.innerHTML = `
          <span>👥 + Povolat poddaného</span>
          <span class="action-cost">Vezme 1 poddaného od ohniště</span>
        `;
        btnAddWorker.disabled = b.assignedWorkers >= cfg.maxWorkers || this.state.unemployedCitizens <= 0;
        btnAddWorker.addEventListener('click', () => {
          const res = this.state.assignWorkerToBuilding(b);
          if (!res.success) {
            this.showToast(res.reason, 'error');
          } else {
            this.updateSelectionPanel();
          }
        });

        const btnRemoveWorker = document.createElement('button');
        btnRemoveWorker.className = 'action-btn';
        btnRemoveWorker.innerHTML = `
          <span>↩️ Poslat k ohništi</span>
          <span class="action-cost">Uvolní pracovníka zpět</span>
        `;
        btnRemoveWorker.disabled = b.assignedWorkers <= 0;
        btnRemoveWorker.addEventListener('click', () => {
          const res = this.state.unassignWorkerFromBuilding(b);
          if (res.success) {
            this.updateSelectionPanel();
          }
        });

        this.selActions.appendChild(btnAddWorker);
        this.selActions.appendChild(btnRemoveWorker);
      }
    } else if (sel.type === 'unit') {
      const u = sel.entity;
      const cfg = u.config;

      this.selIcon.textContent = cfg.icon;
      this.selTitle.textContent = cfg.name;
      this.selSubtitle.textContent = `Pozice: [${u.x.toFixed(1)}, ${u.y.toFixed(1)}]`;
      this.selDesc.textContent = `${cfg.description} „${cfg.voice}“`;

      this.selStats.innerHTML = `
        <div class="stat-row"><span>Životy</span><span>${u.hp} / ${u.maxHp}</span></div>
        <div class="stat-row"><span>Rychlost přesunu</span><span>${u.speed} bloků/s</span></div>
        <div class="stat-row"><span>Dostřel zbraně</span><span>${cfg.range} bloků</span></div>
      `;

      const tipAction = document.createElement('div');
      tipAction.className = 'stat-row';
      tipAction.style.color = '#fde047';
      tipAction.textContent = '👉 Pravým kliknutím myši vyšlete křižáky na pochod';
      this.selActions.appendChild(tipAction);
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'success' ? 'toast-success' : '')}`;

    let icon = '📜';
    if (type === 'error') icon = '⚠️';
    if (type === 'success') icon = '⚔️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}
