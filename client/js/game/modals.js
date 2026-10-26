import { t, languageOptions } from '../i18n/index.js';
import { CAMERA_SPEEDS, isValidNick } from './settings.js';

/** Jednoduchý správce modálních oken sdílený menu i hrou. */
export class Modals {
  constructor(root = document.getElementById('modal-root')) {
    this.root = root;
    this.current = null;
  }

  isOpen() {
    return !!this.current;
  }

  open({ title, icon = '', body = '', actions = [], className = '', dismissable = true, onClose = null }) {
    if (!this.root) return;
    this.close(false);
    const buttons = actions.map((a, i) =>
      `<button class="btn ${a.kind || 'btn-secondary'}" data-modal-action="${i}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`
    ).join('');
    this.root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box ${className}">
          <div class="modal-header">
            <h2>${icon ? `<span class="modal-icon">${icon}</span> ` : ''}${title}</h2>
            ${dismissable ? `<button class="modal-close" aria-label="${t("Zavřít")}">&times;</button>` : ''}
          </div>
          <div class="modal-body">${body}</div>
          ${buttons ? `<div class="modal-actions">${buttons}</div>` : ''}
        </div>
      </div>`;

    const overlay = this.root.querySelector('.modal-overlay');
    const closeBtn = this.root.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (dismissable) {
      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) this.close();
      });
    }
    this.root.querySelectorAll('[data-modal-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = actions[Number(btn.dataset.modalAction)];
        if (!action) return;
        if (action.onClick) action.onClick(this);
      });
    });

    this.current = { onClose };
    const focus = this.root.querySelector('.modal-actions .btn-primary, .modal-close');
    if (focus) focus.focus({ preventScroll: true });
  }

  close(notify = true) {
    if (!this.root) return;
    const prev = this.current;
    this.current = null;
    this.root.innerHTML = '';
    if (notify && prev && prev.onClose) prev.onClose();
  }
}

/** HTML formuláře nastavení. */
export function settingsForm(settings, opts = {}) {
  const nickField = opts.showNick === false ? '' : `
    <div class="form-row">
      <label for="opt-nick">${t("Nick pro multiplayer")}</label>
      <input id="opt-nick" class="text-input" maxlength="16" value="${escapeAttr(settings.nick || '')}"
        placeholder="${t("3–16 znaků (písmena, číslice, mezera, _)")}">
      <div class="form-hint" id="nick-hint">${t("Nick se ukládá v prohlížeči a musí být na serveru jedinečný.")}</div>
    </div>`;

  return `
    <div class="settings-form">
      <div class="form-section">
        <h4>${t("Zvuk")}</h4>
        <div class="form-row">
          <label for="opt-music">${t("Hudba")}</label>
          <div class="range-row">
            <input id="opt-music" type="range" min="0" max="100" step="1" value="${settings.musicVolume}">
            <span class="range-value" id="music-value">${settings.musicVolume} %</span>
          </div>
        </div>
        <div class="form-row">
          <label for="opt-sfx">${t("Zvukové efekty")}</label>
          <div class="range-row">
            <input id="opt-sfx" type="range" min="0" max="100" step="1" value="${settings.sfxVolume}">
            <span class="range-value" id="sfx-value">${settings.sfxVolume} %</span>
          </div>
        </div>
        <div class="form-row checkbox-row">
          <label><input id="opt-mute-music" type="checkbox" ${settings.musicMuted ? 'checked' : ''}> ${t("Ztlumit hudbu")}</label>
          <label><input id="opt-mute-sfx" type="checkbox" ${settings.sfxMuted ? 'checked' : ''}> ${t("Ztlumit efekty")}</label>
        </div>
      </div>

      <div class="form-section">
        <h4>${t("Obraz a ovládání")}</h4>
        <div class="form-row">
          <label for="opt-camera">${t("Rychlost kamery")}</label>
          <select id="opt-camera" class="select-input">
            ${Object.entries(CAMERA_SPEEDS).map(([key, speed]) =>
              `<option value="${key}" ${settings.cameraSpeed === key ? 'selected' : ''}>${cameraLabel(key)} (${speed} ${t("px/s)")}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row">
          <label for="opt-quality">${t("Kvalita grafiky")}</label>
          <select id="opt-quality" class="select-input">
            ${qualityOptions(settings.quality)}
          </select>
        </div>
        <div class="form-row checkbox-row">
          <label><input id="opt-fps" type="checkbox" ${settings.showFps ? 'checked' : ''}> ${t("Zobrazovat FPS")}</label>
        </div>
        <div class="form-row">
          <label for="opt-language">${t("Jazyk")}</label>
          <select id="opt-language" class="select-input">${languageOptions()}</select>
        </div>
      </div>

      ${nickField}
    </div>`;
}

function qualityOptions(current) {
  const values = [['low', t("Nízká")], ['medium', t("Střední")], ['high', t("Vysoká")]];
  return values.map(([key, label]) =>
    `<option value="${key}" ${current === key ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function cameraLabel(key) {
  return key === 'low' ? t("Nízká") : key === 'high' ? t("Vysoká") : t("Střední");
}

/** Napojí formulář nastavení na objekt settings. */
export function bindSettingsForm(root, settings, onChange) {
  if (!root) return;
  const music = root.querySelector('#opt-music');
  const sfx = root.querySelector('#opt-sfx');
  const musicVal = root.querySelector('#music-value');
  const sfxVal = root.querySelector('#sfx-value');
  const nick = root.querySelector('#opt-nick');
  const nickHint = root.querySelector('#nick-hint');

  const emit = () => {
    if (onChange) onChange(settings);
  };

  if (music) music.addEventListener('input', () => {
    settings.musicVolume = Number(music.value);
    if (musicVal) musicVal.textContent = `${settings.musicVolume} %`;
    emit();
  });
  if (sfx) sfx.addEventListener('input', () => {
    settings.sfxVolume = Number(sfx.value);
    if (sfxVal) sfxVal.textContent = `${settings.sfxVolume} %`;
    emit();
  });
  const muteMusic = root.querySelector('#opt-mute-music');
  const muteSfx = root.querySelector('#opt-mute-sfx');
  if (muteMusic) muteMusic.addEventListener('change', () => {
    settings.musicMuted = muteMusic.checked; emit();
  });
  if (muteSfx) muteSfx.addEventListener('change', () => {
    settings.sfxMuted = muteSfx.checked; emit();
  });
  const camera = root.querySelector('#opt-camera');
  if (camera) camera.addEventListener('change', () => {
    settings.cameraSpeed = camera.value; emit();
  });
  const quality = root.querySelector('#opt-quality');
  if (quality) quality.addEventListener('change', () => {
    settings.quality = quality.value; emit();
  });
  const fps = root.querySelector('#opt-fps');
  if (fps) fps.addEventListener('change', () => {
    settings.showFps = fps.checked; emit();
  });
  const language = root.querySelector('#opt-language');
  if (language) language.addEventListener('change', () => {
    settings.language = language.value; emit();
  });
  if (nick) {
    nick.addEventListener('input', () => {
      const value = nick.value.trim();
      settings.nick = value;
      if (nickHint) {
        if (!value) {
          nickHint.textContent = t("Nick se ukládá v prohlížeči a musí být na serveru jedinečný.");
          nickHint.className = 'form-hint';
        } else if (!isValidNick(value)) {
          nickHint.textContent = t("Nick musí mít 3–16 znaků: písmena, číslice, mezera nebo podtržítko.");
          nickHint.className = 'form-hint error';
        } else {
          nickHint.textContent = t("Nick je v pořádku.");
          nickHint.className = 'form-hint success';
        }
      }
      emit();
    });
  }
}

export function helpContent() {
  return `
    <div class="help-grid">
      <section class="help-section">
        <h4>${t("🎮 Ovládání")}</h4>
        <ul>
          <li><strong>${t("WASD / šipky")}</strong> ${t("– posun kamery, najetí myší k okraji také posouvá.")}</li>
          <li><strong>${t("Kolečko myši")}</strong> ${t("– přiblížení a oddálení.")}</li>
          <li><strong>${t("Levé tlačítko")}</strong> ${t("– výběr jednotek a budov, potvrzení stavby.")}</li>
          <li><strong>${t("Tažení levým tlačítkem")}</strong> ${t("– výběr více jednotek obdélníkem.")}</li>
          <li><strong>${t("Pravé tlačítko")}</strong> ${t("– pohyb, útok, stavba na vlastním staveništi, zrušení akce.")}</li>
          <li><strong>${t("Ctrl + 1–9")}</strong> ${t("– uložení skupiny,")} <strong>1–9</strong> ${t("– její výběr.")}</li>
          <li><strong>${t("Mezerník")}</strong> ${t("– vycentrování na Královský hrad.")}</li>
          <li><strong>${t("ESC")}</strong> ${t("– zruší stavbu/výběr, jinak otevře herní menu.")}</li>
          <li><strong>${t("Delete")}</strong> ${t("– zbourání vybrané vlastní budovy (po potvrzení).")}</li>
        </ul>
      </section>
      <section class="help-section">
        <h4>${t("🏰 Základní pravidla")}</h4>
        <ul>
          <li>${t("Stavět lze kdekoli na mapě, nejméně")} <strong>${t("20 bloků")}</strong> ${t("od nepřátelských jednotek a budov.")}</li>
          <li>${t("Mezi budovami musí zůstat volný pruh široký 1 dlaždici; výjimkou jsou sklady vedle sebe.")}</li>
          <li>${t("Dřevorubec musí stát na stromě, kamenolom a železný důl celé na ložisku.")}</li>
          <li>${t("Poddaní čekají u ohniště. Přiřaďte je do hospodářství, pošlete na stavbu, nebo je povolejte jako vojáky.")}</li>
          <li>${t("Dělníci nosí dřevo, kámen a železo po 10 kusech do nejbližšího hotového skladu nebo Královského hradu, jídlo do nejbližší sýpky (bez sýpky do hradu). Sýpky a sklady zvyšují kapacitu.")}</li>
          <li>${t("Obydlí přidá 8 míst v kapacitě. Hrad sám pojme 20 obyvatel.")}</li>
        </ul>
      </section>
      <section class="help-section">
        <h4>${t("💡 Tipy písaře")}</h4>
        <ul>
          <li>${t("Nejprve postavte Dřevorubce a Kamenolom, poté Jabloňový sad a Kasárna.")}</li>
          <li>${t("Kasárna vyrábějí lučištníky, Královský hrad těžké pěšáky.")}</li>
          <li>${t("Lučištníci útočí z dálky a jejich šípy mohou minout pohybující se cíl.")}</li>
          <li>${t("Plná kapacita zastaví dělníky. Postavte včas další Sklad (suroviny) nebo Sýpku (jídlo).")}</li>
          <li>${t("Další peníze získáte prodejem přebytečných surovin v Obchodu.")}</li>
          <li>${t("Vyčerpané ložisko se po 3 minutách objeví jinde na mapě.")}</li>
        </ul>
      </section>
    </div>`;
}

export function creditsContent() {
  return `
    <div class="credits-content">
      <div class="credits-logo">✠</div>
      <h3>${t("KRÁLOVSTVÍ")}</h3>
      <p class="credits-subtitle">${t("Izometrická real-time strategie z pouštního království")}</p>
      <div class="credits-block">
        <h4>${t("Autoři projektu")}</h4>
        <p>${t("Návrh a vývoj: tým Království")}</p>
        <p>${t("Herní design, simulace a síťová část: vlastní implementace")}</p>
      </div>
      <div class="credits-block">
        <h4>${t("Použité technologie")}</h4>
        <ul>
          <li>${t("HTML5 Canvas 2D – vykreslování hry")}</li>
          <li>${t("Web Audio API – procedurální hudba a zvuky")}</li>
          <li>${t("WebSockets – multiplayer")}</li>
          <li>${t("Node.js (bez externích herních knihoven) – server")}</li>
          <li>${t("Cinzel &amp; Outfit – písma z Google Fonts")}</li>
        </ul>
      </div>
      <div class="credits-block">
        <h4>${t("Verze")}</h4>
        <p>${t("Verze 2.0.0 · © 2026")}</p>
      </div>
    </div>`;
}

export function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function escapeHtml(value) {
  return escapeAttr(value);
}
