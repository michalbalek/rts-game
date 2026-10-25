# Úvodní obrazovka (Intro & Menu)

## Vzhled a atmosféra
Úvodní obrazovka odpovídá stylu hry: horká pouštní krajina s písečnými dunami a oázami, pískovcová středověká architektura a pergamenově-pískovcový heraldický styl menu.

## Prvky menu
Po otevření aplikace hráč vidí na výběr dva režimy:

- **Single player** – hra bez připojení k serveru, s dvěma možnostmi:
  - **Hra s boty** – hráč hraje proti počítačovým protivníkům (botům), počet 1–3 volí hráč.
  - **Vlastní stavba** – hráč si staví základnu a jednotky sám, bez botů.
- **Multiplayer** – hráč se připojí na online server:
  - hra jej automaticky přiřadí na některý dostupný server,
  - každý hráč má svůj nick (viz Zadání nicku a Připojení k multiplayeru),
  - mapu, startovní kapitál a mlhu určí server (viz [multiplayer.md](multiplayer.md)).
- **Nastavení**, **Nápověda** a **Kredity** – pomocná tlačítka.
- **Konec** – ukončí aplikaci (v prohlížeči se zavře záložka, pokud to prohlížeč dovolí).

## Průběh spuštění hry
Po kliknutí na Start hráč nastaví:

- **Výběr mapy** – hráč zvolí jednu z dostupných map. Náhled ukazuje název, velikost v dlaždicích, počet startovních pozic a biom.
- **Počet botů** (jen Hra s boty) – 1 až 3, výchozí 1.
- **Startovní kapitál** – Bohatý, Střední nebo Skromný (viz [ekonomika.md](ekonomika.md)). Určuje počáteční peníze a suroviny. Peníze lze utratit v budově obchodu.
- **Úroveň bota** (jen Hra s boty) – Snadná, Střední, Těžká (viz [game.md](game.md)).
- **Mlha války** – zapnuta nebo vypnuta, výchozí vypnuta.

## Nastavení
- **Hlasitost**: hudba a zvukové efekty zvlášť, 0–100 %.
- **Jazyk**: čeština (jediný dostupný jazyk).
- **Rychlost kamery**: nízká, střední, vysoká.
- **Kvalita grafiky**: nízká, střední, vysoká.
- **Zobrazení FPS**: zapnuto nebo vypnuto, výchozí vypnuto.
- **Ukládání**: nastavení se ukládá v prohlížeči a platí i po restartu.
- **Pauza**: jen v Single player. V Multiplayeru hru nelze pozastavit.

## Zadání nicku
- Zadává se při prvním vstupu do Multiplayeru. Uloží se v prohlížeči a příště se předvyplní.
- Nick má 3–16 znaků (písmena, číslice, mezera a podtržítko). Na jednom serveru musí být jedinečný. Pokud je obsazený, server hráče vyzve k jinému nicku.
- Změnit ho lze v Nastavení.

## Načítání
- Obrazovka načítání zobrazí náhodný tip ze hry a průběh načítání v procentech.
- Při chybě načtení se zobrazí hláška a tlačítko Zpět do menu.

## Připojení k multiplayeru
- **Hledání serveru**: hra zkouší dostupné servery, nejdéle 10 s. Tlačítko Zrušit hledání je kdykoli k dispozici.
- **Plný server**: hledání pokračuje na dalším serveru. Pokud žádný nemá volno, zobrazí se hláška „Všechny servery jsou plné“ a tlačítko Zkusit znovu.
- **Server nedostupný**: zobrazí se hláška „Server není dostupný“ a tlačítko Zkusit znovu.
- **Výpadek během hry**: řídí se pravidly v [multiplayer.md](multiplayer.md).

## Herní menu (ESC)
- Otevře se klávesou ESC, pokud není nic vybráno a neumisťuje se žádná budova.
- **Single player**: hra se pozastaví. Tlačítka: Pokračovat, Nastavení, Ukončit hru (návrat do hlavního menu, rozehraná hra se zahodí).
- **Multiplayer**: hra běží dál. Tlačítka: Pokračovat, Nastavení, Odejít ze hry (hráč prohrává, viz [multiplayer.md](multiplayer.md)).

## Nápověda a kredity
- **Nápověda**: stručný přehled ovládání (podle [ovladani.md](ovladani.md)) a tipy ke hře.
- **Kredity**: název hry, autoři projektu a seznam použitých knihoven s verzemi.