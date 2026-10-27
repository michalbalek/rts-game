# 🏰 Království – isometric RTS

Czech version: [README.md](README.md)

> **Version 2.0.0** · A web-based real-time strategy game set in a desert kingdom, built with HTML5 Canvas and Node.js. The game runs directly in the browser, with no plugins to install and no dependencies.

---

## 📖 About the Game

Take charge of a desert domain. Summon your subjects to the campfire in front of the Royal Castle, assign them to harvest wood, stone, iron and apples, construct economic buildings and train an army. You win by destroying the Royal Castles of all your rivals – or, in **Custom build** (Vlastní stavba) mode, simply build an empire for the fun of it.

### Key Features

- **3 randomly generated maps** – Desert with a River (Poušť s řekou), Oasis by the Lake (Oáza u jezera) and Rocky Gorge (Skalní rokle). Each has 4 symmetrical starting positions.
- **Full economy** – wood, stone, food, iron and money. Warehouses, granaries and a market with fixed prices and optional automatic buying and selling. Taxes and the happiness indicator are removed for now; money comes from starting capital and resource sales.
- **14 structures** – economic and military buildings, including walls, a defensive tower and two gate sizes.
- **3 unit types** – Footman (Pěšák), Archer (Lučištník) and Subject (Poddaný). Footmen and archers fight; subjects work and build.
- **Bots** – 1–3 opponents across three difficulty levels. They build in a documented order, earn money by selling resources at the Market, keep part of their army near the castle and attack.
- **Fog of war** – optional, with explored and unexplored areas and a soft edge of vision.
- **Procedural graphics** – organic terrain transitions, shoreline foam, grainy ground and trees swaying in the wind; terrain is drawn from a cache, so the game stays smooth even when zoomed out.
- **Attack alerts and game speed** – a horn sounds and the spot flashes on the minimap when you are attacked (`Backspace` moves the camera there); single player can run at up to 3× speed.
- **Multiplayer for up to 4 players** – authoritative server, automatic room assignment, start countdown, connection recovery and a results screen.
- **Procedural audio** – music, ambient environment sounds, scribe announcements and fanfares generated via the Web Audio API.
- **Czech and English** – switch languages above the game-mode choices in the main menu or in Settings. Menus, HUD, buildings, units, help, gameplay notices and multiplayer messages are translated.
- **Saved settings** – language, volume, graphics quality, camera speed, FPS and nickname are stored in the browser. Czech is the default language.

---

## 🚀 Getting Started

Requirements: **Node.js 20 or newer**. The project needs no external packages, so `npm install` is not necessary.

```bash
npm start
```

Then open **[http://localhost:3000](http://localhost:3000)**.

For development with automatic server restart:

```bash
npm run dev
```

### Optional Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP and WebSocket server port |
| `HOST` | `0.0.0.0` | Network interface the server listens on |
| `LOBBY_COUNTDOWN` | `20` | Lobby countdown length (s) |
| `RETURN_DELAY` | `30` | Time on the results screen before returning to the lobby (s) |
| `RECONNECT_GRACE` | `120` | How long a connection can be restored after a dropout (s) |
| `MAX_ROOMS` | `8` | Maximum number of concurrent rooms |

Example:

```powershell
$env:LOBBY_COUNTDOWN='10'; npm start
```

---

## 🎮 Controls

### Camera

| Action | Control |
| :--- | :--- |
| Pan | `W`, `A`, `S`, `D` or arrow keys; moving the mouse to the screen edge |
| Zoom | Mouse wheel |
| Center on the Royal Castle | `Space` |

### Mouse

| Action | Control |
| :--- | :--- |
| Select unit / building | Left button |
| Select multiple units | Left button and drag a rectangle |
| Select all units of one type on screen | Double-click a unit or `Ctrl` + click |
| Movement and orders | Right button |
| Order subjects to build | Select subjects, then right-click your construction site or click its button in the Construction section of their panel |
| Place a building | Left button |
| Lay out a wall | Select the wall and drag with the left button |
| Garrison a tower | Select archers and right-click your completed tower |
| Cancel building / selection | Right button or `ESC` |

### Keys

| Action | Key |
| :--- | :--- |
| Rotate a building before placement | `R` (90°) |
| Save a unit group | `Ctrl` + `1`–`9` |
| Select a saved group | `1`–`9` |
| Jump to the latest attack | `Backspace` or `Home` |
| Game speed in single player (0.5×–3×) | `+` / `−` (also on the numeric keypad) |
| Cancel building or selection | `ESC` |
| Open the game menu | `ESC` (when nothing is selected) |
| Demolish the selected building | `Delete` (with confirmation) |

### HUD

- **Top bar** – money, wood, stone, food, iron and population. When the game speed is changed, a speed badge appears next to the menu button.
- **Bottom dock** – building menu grouped into resources, economy, military and fortifications.
- **Selection panel** – information about the selected building, construction site or units, worker assignment, training, repair and demolition.
- **Minimap** – map overview including fog of war; clicking or dragging moves the camera. When your units or buildings are attacked, a horn sounds, the scribe reports it and the spot flashes red on the minimap.

---

## ⚔️ Rules

- **Construction** is allowed anywhere on the map, at least **20 tiles** away from enemy units and buildings. Buildings may not overlap and need a one-tile gap, except adjacent warehouses and your own fortifications.
- **Construction time** for ordinary buildings depends on size: 1×1 = 30 s, 2×2 = 60 s, 3×3 = 90 s, 4×4 = 120 s. Fortifications have their own times shown in the menu. The time applies to one subject; each additional subject adds half of the base speed.
- **Fortifications** – drag to lay out a straight section of up to 48 wall tiles, each a separate construction site. The small gate is 1×1; the large gate is 4×1 tiles (1×4 when rotated). An open gate admits everyone, closes when an enemy is within 6 tiles, and reopens when they leave; the selection panel can also lock it. A tower holds four archers with 2 extra tiles of range; release them from its panel or order them to move.
- **Construction site** – buying a building creates a construction site. The player selects subjects and right-clicks their own site, or clicks the site's button in their panel's Construction section. In a mixed selection, only subjects are assigned; soldiers keep their existing orders. It progresses only while they work on it. Once finished, subjects continue at the nearest reachable owned construction site within 10 tiles of their position, or return to the campfire if none is available.
- **Woodcutter** must stand on a site without trees, preferably near a forest; **Quarry** on a stone deposit and **Iron Mine** on an iron deposit.
- **Subjects** gather resources in batches of 10 and carry them to the nearest completed warehouse or the castle; food goes to the nearest granary (castle if there is none). A stone deposit holds 2000 units and an iron deposit 1000; once depleted, a new deposit appears after 3 minutes.
- **Insufficient resources** mean the order is not carried out and the scribe reports it. The full cost is paid when the order is given.
- **Training** uses a free subject at the campfire. Footman = 60 money + 20 food / 40 s, Archer = 70 money + 20 food / 45 s.
- **Victory** – destroy all enemy Royal Castles. **Defeat** – your castle falls; remaining buildings become neutral.
- **Custom build** has no victory condition; you end the game from the in-game menu.

---

## 🌐 Multiplayer

1. In the main menu, choose **Multiplayer** and enter a nickname (3–16 characters: letters, digits, spaces, underscores).
2. The game automatically assigns you to the first available room with a free slot. Rooms in progress cannot be joined.
3. The game starts as soon as there are at least **2 players** in the lobby. The countdown lasts 20 s; the last 5 seconds are counted down.
4. The server is the single source of truth – it simulates **20 ticks/s** and sends snapshots **5 times/s**. The client smoothly interpolates movement.
5. After a connection dropout you have **120 s** to reconnect. After reconnecting, you receive the current state.
6. When the game ends, the results are shown, and after **30 s** everyone returns to the lobby.

The server determines the map, starting capital and fog of war. Multiplayer has no bots, and the game cannot be paused.

---

## 🧪 Tests

The tests cover simulation, client logic, server rooms and repository rules:

```bash
npm test              # all tests including source file size checks
npm run test:sim      # map generation, economy, market, training, repairs, demolition, fog, warehouses, combat, attack alerts, pathfinding, bot economy
npm run test:client   # zoom limits, click, double-click and rectangle selection, hitboxes, game speed
npm run test:commit   # commit message validator (Conventional Commits)
npm run test:rooms    # connections, lobby, reconnection and match lifecycle
npm run test:structure # maximum of 500 lines per source file
```

The tests require neither a running server nor a browser.

---

## 📁 Project Structure

```
rts-game/
├─ .githooks/               # Git hook checking commit messages
├─ client/                  # Client application
│  ├─ index.html            # DOM skeleton of the HUD, menus and modals
│  ├─ css/                  # Styles by UI area; style.css entry point
│  └─ js/
│     ├─ sim/               # Shared simulation without DOM (client and server)
│     │  ├─ constants.js    # Stats, prices, maps, bots
│     │  ├─ mapgen.js       # Procedural map generation
│     │  ├─ sim.js          # Authoritative game loop and commands
│     │  ├─ bot.js          # Bot behaviour
│     │  ├─ placement.js    # Building placement rules
│     │  └─ ...
│     ├─ engine/            # Renderer, camera, isometry, audio
│     ├─ game/              # Menu, HUD, input, session, entity selection, modals, settings
│     ├─ net.js             # WebSocket client
│     └─ main.js            # Application state machine
├─ server/
│  └─ src/
│     ├─ index.js           # Static server, API and WebSocket upgrade
│     ├─ rooms.js           # Room management and player login
│     ├─ room.js            # Connections and lobby
│     ├─ room-match.js      # Authoritative loop and match lifecycle
│     ├─ room-config.js     # Shared limits and timing
│     └─ websocket.js       # Minimal RFC 6455 WebSocket server
├─ tools/
│  ├─ test-sim.js           # Simulation tests
│  ├─ test-client.js        # Camera, zoom and selection tests
│  ├─ test-rooms.js         # Room and match lifecycle tests
│  ├─ test-structure.js     # Source file size checks
│  ├─ check-commit-msg.js   # Commit message validator
│  └─ test-commit-msg.js    # Validator tests
├─ dokumentace/             # Game specification (in Czech)
├─ CONTRIBUTING.md          # Contribution and commit rules
└─ package.json
```

---

## 📚 Documentation

The complete specification is in the [`dokumentace/`](dokumentace/) folder (in Czech):

- [game.md](dokumentace/game.md) – concept, game goal and bots
- [intro.md](dokumentace/intro.md) – menu, settings and multiplayer
- [budovy.md](dokumentace/budovy.md) – buildings and construction rules
- [vojaci.md](dokumentace/vojaci.md) – units and combat
- [ekonomika.md](dokumentace/ekonomika.md) – resources, population and trade
- [mapa.md](dokumentace/mapa.md) – biomes, resources and fog of war
- [multiplayer.md](dokumentace/multiplayer.md) – network model and matchmaking
- [ovladani.md](dokumentace/ovladani.md) – controls and HUD
- [audio.md](dokumentace/audio.md) – music and sounds

---

## 🤝 Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The rules and steps to enable the commit message check are in [CONTRIBUTING.md](CONTRIBUTING.md) (in Czech).

Source files should target at most 300 lines, with a maximum of 500 lines. See the [code maintainability guidelines](CONTRIBUTING.md#velikost-souborů-a-členění-kódu) (in Czech) for splitting code into modules and logical sections and gradually updating existing oversized files.

---

## 📜 License

MIT
