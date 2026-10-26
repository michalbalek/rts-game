# 🏰 Království – izometrická RTS

Anglická verze: [README.en.md](README.en.md)

> **Verze 2.0.0** · Webová real-time strategie v pouštním království, postavená na HTML5 Canvasu a Node.js. Hra běží přímo v prohlížeči bez instalace pluginů a bez jakýchkoli závislostí.

---

## 📖 O hře

Ujměte se vlády nad pouštním panstvím. Povolejte poddané k ohništi před Královským hradem, přiřaďte je k těžbě dřeva, kamene, železa a jablek, stavte hospodářské budovy a cvičte vojsko. Vyhrajete, když zničíte Královské hrady všech soupeřů – nebo si v režimu **Vlastní stavba** postavíte říši jen tak pro radost.

### Hlavní prvky

- **3 náhodně generované mapy** – Poušť s řekou, Oáza u jezera a Skalní rokle. Každá má 4 symetrické startovní pozice.
- **Plná ekonomika** – dřevo, kámen, jídlo, železo a peníze. Sklady, sýpky a obchod s pevnými cenami. Daně a ukazatel spokojenosti jsou zatím odstraněné; peníze pocházejí ze startovního kapitálu a prodeje surovin.
- **10 budov** – Královský hrad, Kasárna, Dřevorubec, Kamenolom, Jabloňový sad, Obchod, Obydlí, Sýpka, Sklad a Železný důl.
- **3 typy jednotek** – Pěšák, Lučištník a Poddaný. Pěšáci a lučištníci bojují, poddaní pracují a staví.
- **Boti** – 1–3 protivníci ve třech obtížnostech. Staví podle dokumentovaného pořadí, drží část vojska u hradu a útočí.
- **Mlha války** – volitelně zapnutelná, s prozkoumanými a neprozkoumanými oblastmi.
- **Multiplayer až pro 4 hráče** – autoritativní server, automatické přiřazení do místnosti, odpočet startu, obnova spojení a výsledková obrazovka.
- **Procedurální zvuk** – hudba, ambientní zvuky prostředí, hlášky písaře a fanfáry generované přes Web Audio API.
- **Ukládání nastavení** – hlasitost, kvalita grafiky, rychlost kamery, FPS a nick se ukládají v prohlížeči.

---

## 🚀 Spuštění

Požadavek: **Node.js 20 nebo novější**. Projekt nepotřebuje žádné externí balíčky, takže `npm install` není nutný.

```bash
npm start
```

Poté otevřete **[http://localhost:3000](http://localhost:3000)**.

Pro vývoj s automatickým restartem serveru:

```bash
npm run dev
```

### Volitelné proměnné prostředí

| Proměnná | Výchozí | Význam |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port HTTP a WebSocket serveru |
| `HOST` | `0.0.0.0` | Rozhraní, na kterém server naslouchá |
| `LOBBY_COUNTDOWN` | `20` | Délka odpočtu v lobby (s) |
| `RETURN_DELAY` | `30` | Čas na výsledkovou obrazovku před návratem do lobby (s) |
| `RECONNECT_GRACE` | `120` | Jak dlouho lze obnovit spojení po výpadku (s) |
| `MAX_ROOMS` | `8` | Maximální počet souběžných místností |

Příklad:

```powershell
$env:LOBBY_COUNTDOWN='10'; npm start
```

---

## 🎮 Ovládání

### Kamera

| Akce | Ovládání |
| :--- | :--- |
| Posun | `W`, `A`, `S`, `D` nebo šipky; najetí myší k okraji obrazovky |
| Zoom | Kolečko myši |
| Vycentrování na Královský hrad | `Mezerník` |

### Myš

| Akce | Ovládání |
| :--- | :--- |
| Výběr jednotky / budovy | Levé tlačítko |
| Výběr více jednotek | Levé tlačítko a tažení obdélníkem |
| Pohyb a povely | Pravé tlačítko |
| Zadání stavby poddaným | Vybrané poddané: v jejich panelu klikněte na stavbu v sekci Stavět |
| Umístění stavby | Levé tlačítko |
| Zrušení stavby / výběru | Pravé tlačítko nebo `ESC` |

### Klávesy

| Akce | Klávesa |
| :--- | :--- |
| Uložení skupiny jednotek | `Ctrl` + `1`–`9` |
| Výběr uložené skupiny | `1`–`9` |
| Zrušení stavby nebo výběru | `ESC` |
| Otevření herního menu | `ESC` (když nic není vybráno) |
| Zbourání vybrané budovy | `Delete` (s potvrzením) |

### HUD

- **Horní lišta** – peníze, dřevo, kámen, jídlo, železo a obyvatelstvo.
- **Spodní dok** – nabídka staveb s cenou a dobou výstavby.
- **Výběrový panel** – informace o budově, staveništi nebo jednotkách, přiřazení dělníků, výcvik, oprava a bourání.
- **Minimapa** – přehled mapy včetně mlhy války; kliknutím nebo tažením se kamera přesune.

---

## ⚔️ Pravidla

- **Stavění** je povoleno kdekoli na mapě, nejméně **20 dlaždic** od nepřátelských jednotek a budov. Budovy se přichytávají na mřížku a nesmějí se překrývat; mezi nimi musí zůstat volný pruh 1 dlaždice (výjimka: sklady vedle sebe).
- **Doba stavby** odpovídá velikosti: 1×1 = 30 s, 2×2 = 60 s, 3×3 = 90 s, 4×4 = 120 s. Tato doba platí pro jednoho poddaného. Každý další poddaný přidá polovinu základní rychlosti, bez horní hranice. Například 2×2 se dvěma poddanými trvá 40 s, se čtyřmi 24 s.
- **Staveniště** – po zakoupení budovy vznikne staveniště. Stavba postupuje jen tehdy, když na ní pracují přidělení poddaní. Hráč je vybere a v jejich panelu klikne na stavbu v sekci Stavět. Po dokončení se poddaní vrátí k ohništi.
- **Dřevorubec** musí stát na stromě, **Kamenolom** na ložisku kamene a **Železný důl** na ložisku železa.
- **Poddaní** sbírají suroviny po 10 kusech a odnášejí je do nejbližšího hotového skladu nebo hradu; jídlo jde do nejbližší sýpky (bez sýpky do hradu). Ložisko kamene má 2000 jednotek, železa 1000; po vyčerpání se po 3 minutách objeví nové.
- **Nedostatek surovin** znamená, že se příkaz neprovede a písař to oznámí. Náklady se platí celé při zadání.
- **Výcvik** spotřebuje volného poddaného u ohniště. Pěšák = 60 peněz + 20 jídla / 40 s, Lučištník = 70 peněz + 20 jídla / 45 s.
- **Vítězství** – zničte všechny nepřátelské Královské hrady. **Prohra** – padne váš hrad; zbývající budovy se stanou neutrálními.
- **Vlastní stavba** nemá vítěznou podmínku; hru ukončíte v herním menu.

---

## 🌐 Multiplayer

1. V hlavním menu zvolte **Multiplayer** a zadejte nick (3–16 znaků: písmena, číslice, mezera, podtržítko).
2. Hra vás automaticky přiřadí do první dostupné místnosti s volným místem. Hrající místnosti se neobsazují.
3. Hra začne, jakmile jsou v lobby alespoň **2 hráči**. Odpočet trvá 20 s; posledních 5 s odtikává.
4. Server je jediný zdroj pravdy – simuluje **20 ticků/s** a posílá snímky **5×/s**. Klient pohyb plynule interpoluje.
5. Po výpadku spojení máte **120 s** na obnovení. Po znovupřipojení obdržíte aktuální stav.
6. Po konci hry se zobrazí výsledky a po **30 s** se všichni vrátí do lobby.

Mapu, startovní kapitál a mlhu války určuje server. Multiplayer neobsahuje boty a hru nelze pozastavit.

---

## 🧪 Testy

Testy pokrývají simulaci i klientskou logiku:

```bash
npm test              # simulace, klient a formát zpráv commitů
npm run test:sim      # generování map, ekonomika, obchod, výcvik, opravy, bourání, mlha, sklady, boj, pathfinding
npm run test:client   # meze zoomu, výběr kliknutím i obdélníkem, hitboxy
npm run test:commit   # validátor zpráv commitů (Conventional Commits)
```

Testy nevyžadují běžící server ani prohlížeč.

---

## 📁 Struktura projektu

```
rts-game/
├─ .githooks/               # Git hook kontrolující zprávy commitů
├─ client/                  # Klientská aplikace
│  ├─ index.html            # DOM kostra HUD, menu a modálů
│  ├─ css/style.css         # Pouštní pískovcový vizuální styl
│  └─ js/
│     ├─ sim/               # Sdílená simulace bez DOM (klient i server)
│     │  ├─ constants.js    # Statistiky, ceny, mapy, boti
│     │  ├─ mapgen.js       # Procedurální generování map
│     │  ├─ sim.js          # Autoritativní herní smyčka a příkazy
│     │  ├─ bot.js          # Chování botů
│     │  ├─ placement.js    # Pravidla umísťování budov
│     │  └─ ...
│     ├─ engine/            # Renderer, kamera, izometrie, zvuk
│     ├─ game/              # Menu, HUD, vstup, session, výběr entit, modály, nastavení
│     ├─ net.js             # WebSocket klient
│     └─ main.js            # Stavový automat aplikace
├─ server/
│  └─ src/
│     ├─ index.js           # Statický server, API a WebSocket upgrade
│     ├─ rooms.js           # Místnosti, lobby, autoritativní smyčka
│     └─ websocket.js       # Minimální RFC 6455 WebSocket server
├─ tools/
│  ├─ test-sim.js           # Simulační testy
│  ├─ test-client.js        # Testy kamery, zoomu a výběru
│  ├─ check-commit-msg.js   # Validátor zpráv commitů
│  └─ test-commit-msg.js    # Testy validátoru zpráv
├─ dokumentace/             # Herní specifikace
├─ CONTRIBUTING.md          # Pravidla pro přispívání a commity
└─ package.json
```

---

## 📚 Dokumentace

Kompletní specifikace je ve složce [`dokumentace/`](dokumentace/):

- [game.md](dokumentace/game.md) – koncept, cíl hry a boti
- [intro.md](dokumentace/intro.md) – menu, nastavení a multiplayer
- [budovy.md](dokumentace/budovy.md) – budovy a pravidla výstavby
- [vojaci.md](dokumentace/vojaci.md) – jednotky a boj
- [ekonomika.md](dokumentace/ekonomika.md) – suroviny, obyvatelstvo a obchod
- [mapa.md](dokumentace/mapa.md) – biomy, zdroje a mlha války
- [multiplayer.md](dokumentace/multiplayer.md) – síťový model a párování
- [ovladani.md](dokumentace/ovladani.md) – ovládání a HUD
- [audio.md](dokumentace/audio.md) – hudba a zvuky

---

## 🤝 Přispívání

Commity se řídí [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Pravidla a aktivaci kontroly zpráv najdeš v [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 Licence

MIT
