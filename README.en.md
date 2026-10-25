# 🏰 Království – isometric RTS

Czech version: [README.md](README.md)

> **Version 2.0.0** · A web-based real-time strategy game set in a desert kingdom, built with HTML5 Canvas and Node.js. The game runs directly in the browser, with no plugins to install and no dependencies.

---

## 📖 About the Game

Take charge of a desert domain. Summon your subjects to the campfire in front of the Royal Castle, assign them to harvest wood, stone, iron and apples, construct economic buildings and train an army. You win by destroying the Royal Castles of all your rivals – or, in **Custom build** (Vlastní stavba) mode, simply build an empire for the fun of it.

### Key Features

- **3 randomly generated maps** – Desert with a River (Poušť s řekou), Oasis by the Lake (Oáza u jezera) and Rocky Gorge (Skalní rokle). Each has 4 symmetrical starting positions.
- **Full economy** – wood, stone, food, iron and money. Warehouses, granaries, taxes, public happiness and a market with fixed prices.
- **10 buildings** – Royal Castle (Královský hrad), Barracks (Kasárna), Woodcutter (Dřevorubec), Quarry (Kamenolom), Apple Orchard (Jabloňový sad), Market (Obchod), Housing (Obydlí), Granary (Sýpka), Warehouse (Sklad) and Iron Mine (Železný důl).
- **3 unit types** – Footman (Pěšák), Archer (Lučištník) and Subject (Poddaný). Footmen and archers fight; subjects work and build.
- **Bots** – 1–3 opponents across three difficulty levels. They build in a documented order, keep part of their army near the castle and attack.
- **Fog of war** – optional, with explored and unexplored areas.
- **Multiplayer for up to 4 players** – authoritative server, automatic room assignment, start countdown, connection recovery and a results screen.
- **Procedural audio** – music, ambient environment sounds, scribe announcements and fanfares generated via the Web Audio API.
- **Saved settings** – volume, graphics quality, camera speed, FPS and nickname are stored in the browser.

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
| Movement and orders | Right button |
| Order subjects to build | Select subjects, then click the site's button in the Construction section of their panel |
| Place a building | Left button |
| Cancel building / selection | Right button or `ESC` |

### Keys

| Action | Key |
| :--- | :--- |
| Save a unit group | `Ctrl` + `1`–`9` |
| Select a saved group | `1`–`9` |
| Cancel building or selection | `ESC` |
| Open the game menu | `ESC` (when nothing is selected) |
| Demolish the selected building | `Delete` (with confirmation) |

### HUD

- **Top bar** – money, wood, stone, food, iron, population and happiness, tax switch.
- **Bottom dock** – building menu with cost and construction time.
- **Selection panel** – information about the selected building, construction site or units, worker assignment, training, repair and demolition.
- **Minimap** – map overview including fog of war; clicking or dragging moves the camera.

---

## ⚔️ Rules

- **Construction** is allowed anywhere on the map, at least **20 tiles** away from enemy units and buildings. Buildings snap to the grid and may not overlap; a free strip of 1 tile must remain between them (exception: warehouses next to each other).
- **Construction time** depends on size: 1×1 = 30 s, 2×2 = 60 s, 3×3 = 90 s, 4×4 = 120 s. The time applies to one subject. Each additional subject adds half of the base speed, with no upper limit (a 2×2 site takes 40 s with two subjects, 24 s with four).
- **Construction site** – buying a building creates a construction site. The player selects subjects and clicks the site's button in their panel's Construction section. It progresses only while they work on it. When it is finished, they return to the campfire.
- **Woodcutter** must stand on a tree, **Quarry** on a stone deposit and **Iron Mine** on an iron deposit.
- **Subjects** gather resources in batches of 10 and carry them to the castle; food goes to the nearest granary (castle if there is none). A stone deposit holds 2000 units and an iron deposit 1000; once depleted, a new deposit appears after 3 minutes.
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

The tests cover the simulation and client logic:

```bash
npm test              # simulation, client and commit message format
npm run test:sim      # map generation, economy, market, training, repairs, demolition, fog, warehouses, combat, pathfinding
npm run test:client   # zoom limits, click and rectangle selection, hitboxes
npm run test:commit   # commit message validator (Conventional Commits)
```

The tests require neither a running server nor a browser.

---

## 📁 Project Structure

```
rts-game/
├─ .githooks/               # Git hook checking commit messages
├─ client/                  # Client application
│  ├─ index.html            # DOM skeleton of the HUD, menus and modals
│  ├─ css/style.css         # Desert sandstone visual style
│  └─ js/
│     ├─ sim/               # Shared simulation without DOM (client and server)
│     │  ├─ constants.js    # Stats, prices, maps, bots, taxes
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
│     ├─ rooms.js           # Rooms, lobby, authoritative loop
│     └─ websocket.js       # Minimal RFC 6455 WebSocket server
├─ tools/
│  ├─ test-sim.js           # Simulation tests
│  ├─ test-client.js        # Camera, zoom and selection tests
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
- [ekonomika.md](dokumentace/ekonomika.md) – resources, taxes and trade
- [mapa.md](dokumentace/mapa.md) – biomes, resources and fog of war
- [multiplayer.md](dokumentace/multiplayer.md) – network model and matchmaking
- [ovladani.md](dokumentace/ovladani.md) – controls and HUD
- [audio.md](dokumentace/audio.md) – music and sounds

---

## 🤝 Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The rules and steps to enable the commit message check are in [CONTRIBUTING.md](CONTRIBUTING.md) (in Czech).

---

## 📜 License

MIT
