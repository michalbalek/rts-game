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
            ${dismissable ? '<button class="modal-close" aria-label="Zavřít">&times;</button>' : ''}
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
      <label for="opt-nick">Nick pro multiplayer</label>
      <input id="opt-nick" class="text-input" maxlength="16" value="${escapeAttr(settings.nick || '')}"
        placeholder="3–16 znaků (písmena, číslice, mezera, _)">
      <div class="form-hint" id="nick-hint">Nick se ukládá v prohlížeči a musí být na serveru jedinečný.</div>
    </div>`;

  return `
    <div class="settings-form">
      <div class="form-section">
        <h4>Zvuk</h4>
        <div class="form-row">
          <label for="opt-music">Hudba</label>
          <div class="range-row">
            <input id="opt-music" type="range" min="0" max="100" step="1" value="${settings.musicVolume}">
            <span class="range-value" id="music-value">${settings.musicVolume} %</span>
          </div>
        </div>
        <div class="form-row">
          <label for="opt-sfx">Zvukové efekty</label>
          <div class="range-row">
            <input id="opt-sfx" type="range" min="0" max="100" step="1" value="${settings.sfxVolume}">
            <span class="range-value" id="sfx-value">${settings.sfxVolume} %</span>
          </div>
        </div>
        <div class="form-row checkbox-row">
          <label><input id="opt-mute-music" type="checkbox" ${settings.musicMuted ? 'checked' : ''}> Ztlumit hudbu</label>
          <label><input id="opt-mute-sfx" type="checkbox" ${settings.sfxMuted ? 'checked' : ''}> Ztlumit efekty</label>
        </div>
      </div>

      <div class="form-section">
        <h4>Obraz a ovládání</h4>
        <div class="form-row">
          <label for="opt-camera">Rychlost kamery</label>
          <select id="opt-camera" class="select-input">
            ${Object.entries(CAMERA_SPEEDS).map(([key, speed]) =>
              `<option value="${key}" ${settings.cameraSpeed === key ? 'selected' : ''}>${cameraLabel(key)} (${speed} px/s)</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row">
          <label for="opt-quality">Kvalita grafiky</label>
          <select id="opt-quality" class="select-input">
            ${qualityOptions(settings.quality)}
          </select>
        </div>
        <div class="form-row checkbox-row">
          <label><input id="opt-fps" type="checkbox" ${settings.showFps ? 'checked' : ''}> Zobrazovat FPS</label>
        </div>
        <div class="form-row">
          <label>Jazyk</label>
          <div class="static-value">Čeština</div>
        </div>
      </div>

      ${nickField}
    </div>`;
}

function qualityOptions(current) {
  const values = [['low', 'Nízká'], ['medium', 'Střední'], ['high', 'Vysoká']];
  return values.map(([key, label]) =>
    `<option value="${key}" ${current === key ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function cameraLabel(key) {
  return key === 'low' ? 'Nízká' : key === 'high' ? 'Vysoká' : 'Střední';
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
  if (nick) {
    nick.addEventListener('input', () => {
      const value = nick.value.trim();
      settings.nick = value;
      if (nickHint) {
        if (!value) {
          nickHint.textContent = 'Nick se ukládá v prohlížeči a musí být na serveru jedinečný.';
          nickHint.className = 'form-hint';
        } else if (!isValidNick(value)) {
          nickHint.textContent = 'Nick musí mít 3–16 znaků: písmena, číslice, mezera nebo podtržítko.';
          nickHint.className = 'form-hint error';
        } else {
          nickHint.textContent = 'Nick je v pořádku.';
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
        <h4>🎮 Ovládání</h4>
        <ul>
          <li><strong>WASD / šipky</strong> – posun kamery, najetí myší k okraji také posouvá.</li>
          <li><strong>Kolečko myši</strong> – přiblížení a oddálení.</li>
          <li><strong>Levé tlačítko</strong> – výběr jednotek a budov, potvrzení stavby.</li>
          <li><strong>Tažení levým tlačítkem</strong> – výběr více jednotek obdélníkem.</li>
          <li><strong>Pravé tlačítko</strong> – pohyb, útok, zrušení akce.</li>
          <li><strong>Ctrl + 1–9</strong> – uložení skupiny, <strong>1–9</strong> – její výběr.</li>
          <li><strong>Mezerník</strong> – vycentrování na Královský hrad.</li>
          <li><strong>ESC</strong> – zruší stavbu/výběr, jinak otevře herní menu.</li>
          <li><strong>Delete</strong> – zbourání vybrané vlastní budovy (po potvrzení).</li>
        </ul>
      </section>
      <section class="help-section">
        <h4>🏰 Základní pravidla</h4>
        <ul>
          <li>Stavět lze kdekoli na mapě, nejméně <strong>20 bloků</strong> od nepřátelských jednotek a budov.</li>
          <li>Mezi budovami musí zůstat volný pruh široký 1 dlaždici; výjimkou jsou sklady vedle sebe.</li>
          <li>Dřevorubec musí stát na stromě, kamenolom a železný důl celé na ložisku.</li>
          <li>Poddaní čekají u ohniště. Přiřaďte je do hospodářství, nebo je povolejte jako vojáky.</li>
          <li>Dělníci nosí suroviny po 10 kusech do Královského hradu. Sýpky a sklady zvyšují kapacitu.</li>
          <li>Obydlí přidá 8 míst v kapacitě. Hrad sám pojme 20 obyvatel.</li>
        </ul>
      </section>
      <section class="help-section">
        <h4>💡 Tipy písaře</h4>
        <ul>
          <li>Nejprve postavte Dřevorubce a Kamenolom, poté Jabloňový sad a Kasárna.</li>
          <li>Kasárna vyrábějí lučištníky, Královský hrad těžké pěšáky.</li>
          <li>Lučištníci útočí z dálky a jejich šípy mohou minout pohybující se cíl.</li>
          <li>Plná kapacita zastaví dělníky. Postavte včas další Sklad (suroviny) nebo Sýpku (jídlo).</li>
          <li>Vysoká daň vynáší více peněz, ale snižuje spokojenost lidu.</li>
          <li>Vyčerpané ložisko se po 3 minutách objeví jinde na mapě.</li>
        </ul>
      </section>
    </div>`;
}

export function creditsContent() {
  return `
    <div class="credits-content">
      <div class="credits-logo">✠</div>
      <h3>KRÁLOVSTVÍ</h3>
      <p class="credits-subtitle">Izometrická real-time strategie z pouštního království</p>
      <div class="credits-block">
        <h4>Autoři projektu</h4>
        <p>Návrh a vývoj: tým Království</p>
        <p>Herní design, simulace a síťová část: vlastní implementace</p>
      </div>
      <div class="credits-block">
        <h4>Použité technologie</h4>
        <ul>
          <li>HTML5 Canvas 2D – vykreslování hry</li>
          <li>Web Audio API – procedurální hudba a zvuky</li>
          <li>WebSockets – multiplayer</li>
          <li>Node.js (bez externích herních knihoven) – server</li>
          <li>Cinzel &amp; Outfit – písma z Google Fonts</li>
        </ul>
      </div>
      <div class="credits-block">
        <h4>Verze</h4>
        <p>Verze 2.0.0 · © 2026</p>
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
