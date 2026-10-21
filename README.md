# 🏰 Izometrická RTS Strategie

> ⚡ **Upozornění:** Tento repozitář je experimentální, testovací **vibe-coding** projekt pro vývoj webové 2D izometrické Real-Time strategie (RTS) inspirované atmosférou pouštního středověkého království.

---

## 📖 O projektu

Hra je stavěna jako plnohodnotná real-time strategie běžící přímo ve webovém prohlížeči bez nutnosti instalace jakýchkoli pluginů.

### Klíčové herní prvky:
- **Izometrický 2D svět (úhel 45°)**: Vykreslování na HTML5 Canvas s dynamickým cullingem, plynulým zoomem a posunem kamery.
- **Královská základna (Donjon)**: Centrální sídlo lorda s posvátným **stavebním okruhem 100 bloků**.
- **Táborové ohniště a poddaní**: Každých **5 sekund** usedne k hradnímu ohništi 1 nový volný poddaný (do limitu 20). Poddané lze přiřazovat do práce nebo rekrutovat do armády.
- **Budovy & Hospodářství**:
  - 🏰 **Královský hrad / Donjon** – správa panství a výcvik těžkých pěšáků.
  - 🏹 **Kasárna** – zbrojnice a výcvik lučištníků.
  - 🪓 **Dřevorubecký tábor** – těžba dřeva z oázových hájů a palem.
  - ⛏️ **Kamenolom** – lámání pískovcových kvádrů ze skal.
  - 🍏 **Jabloňový sad** – zavlažované sady produkující jídlo pro sýpku.
- **Zvuková syntéza**: Zvuky a fanfáry generované procedurálně přímo v prohlížeči pomocí Web Audio API.

---

## 🛠️ Použité technologie

- **Frontend**: Čisté HTML5, CSS3 (moderní glassmorphic heraldický design) a modulární Vanilla JavaScript (ES6).
- **Grafika**: 2.5D Canvas API s hloubkovým řazením objektů a vlastní matematickou izometrickou projekcí.
- **Backend / Server**: Node.js & Express pro okamžité servírování klienta a připravenost na budoucí multiplayer.

---

## 🚀 Jak projekt spustit

1. Ujistěte se, že máte nainstalovaný [Node.js](https://nodejs.org/) (doporučena verze 18+).
2. V kořenové složce projektu spusťte instalaci závislostí:
   ```bash
   cd server && npm install && cd ..
   ```
3. Spusťte server:
   ```bash
   npm start
   ```
4. Otevřete prohlížeč na adrese:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🎮 Ovládání

| Akce | Klávesa / Myš |
| :--- | :--- |
| **Posun kamery** | `W`, `A`, `S`, `D` nebo `Šipky` |
| **Rychlé tažení pohledu** | Stisk a tažení pravým / prostředním tlačítkem myši |
| **Přiblížení / Oddálení (Zoom)** | Kolečko myši |
| **Vycentrování na Donjon** | `Mezerník` |
| **Rychlý výběr stavby** | Klávesy `1` až `5` |
| **Výběr objektu / Umístění stavby** | Levé tlačítko myši |
| **Povel k přesunu / Zrušení stavby** | Pravé tlačítko myši / `ESC` |
| **Nápověda k ovládání** | Klávesa `H` |

---

## 📁 Dokumentace

Detailní rozpis herních subsystémů a návrhů naleznete ve složce **`dokumentace/`**:
- [game.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/game.md) – Původní koncept a specifikace
- [intro.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/intro.md) – Úvodní obrazovka a menu
- [budovy.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/budovy.md) – Popis a parametry budov
- [vojaci.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/vojaci.md) – Bojové jednotky
- [ekonomika.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/ekonomika.md) – Suroviny a obyvatelstvo
- [mapa.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/mapa.md) – Svět, biomy a terény
- [multiplayer.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/multiplayer.md) – Síťový model a multiplayer
- [ovladani.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/ovladani.md) – Uživatelské rozhraní
- [audio.md](file:///c:/Users/micha/Projects/rts-game/dokumentace/audio.md) – Zvuky a hudba
