# Budovy a architektura

## Základní pravidla výstavby

### Mřížkový systém a uchycení (Grid Snapping)
- **Přesná mřížka a rozměry**: Každá budova zabírá přesně definovanou plochu na herní mřížce (např. 1×1, 2×2, 3×3 nebo 4×4 bloky).
- **Pevně daná velikost (Footprint)**: Každá budova má svou pevně definovanou šířku a délku v celočíselných jednotkách dlaždic ($W \times H$).
- **Uchycení na mřížku (Snap to Grid)**: Umístění budovy se automaticky přichytává k celočíselným souřadnicím dlaždic. Není možné umístit budovu „mezi“ bloky.
- **Výchozí izometrická orientace (symetrická dlaždice 2:1)**: Všechny budovy jsou výchozím způsobem vykreslovány i kolizně orientovány na symetrické mřížce 64×32 px v souladu s celou herní mapou. Základna každé budovy na mřížce tvoří izometrický kosočtverec/polygon.
- **Stavební okruh**: Stavba je povolena pouze v okruhu **100 bloků** od královského hradu.
- **Materiál na stavbu**: suroviny se berou ze skladu a dělníci je odnášejí na staviště. Náklady jsou u každé budovy v jejím popisu.
- **Doba stavby**: podle velikosti 1×1 30 s, 2×2 60 s, 3×3 90 s, 4×4 120 s.
- **Kolize a terén**: 
  - Žádné dvě budovy se nesmí překrývat.
  - Mezi budovami musí zůstat volný pruh, kterým procházejí NPC a vojáci (šířka pruhu: 1 dlaždice).
  - Výjimka: sklady lze stavět přímo vedle sebe bez pruhu.
  - Dlaždice pod budovou musí být volné (přírodní zdroje jako stromy či kameny se při stavbě vyčistí, nebo je stavba přímo vyžaduje jako kamenolom).

### Zdraví, poškození a zánik
- **Zdraví budov**: 1×1 500, 2×2 800, 3×3 1200, 4×4 1500, Královský hrad 2000.
- **Poškození**: nepřátelské jednotky ubírají budově zdraví. Hradby a věže chrání budovy za nimi.
- **Rozestavěná budova**: zdraví roste úměrně postupu stavby. Při zničení se vrátí 50 % surovin.
- **Zánik**: při nule zdraví budova zanikne a je zničena. Zásoby v ní uložené se ztratí a dělníci se vrací do hradu k ohništi.
- **Dobytí**: budovy nelze obsadit, lze je jen zničit.
- **Obydlí**: při zániku ztratí 8 míst v kapacitě. Přebytečné volné obyvatele odejdou.
- **Sklad a sýpka**: zásoby nad kapacitou zbývajících skladů se ztratí.
- **Oprava**: volní obyvatelé z hradu opravují budovu za 20 % jejích nákladů. Oprava trvá 1 s na 10 zdraví. Zdraví se jinak neobnovuje.
- **Královský hrad**: lze opravit stejně. Jeho zánik znamená prohru.
- **Ložiska a stromy**: zničením budovy nezanikají.
- **Býrání**: hráč může vlastní budovu zbýrat. Vrátí se 50 % nákladů, zásoby uvnitř se ztratí a dělníci se uvolní do hradu. Královský hrad nelze zbýrat.

---

## Seznam a detailní popis budov

### 1. Královský hrad
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: zdarma, vzniká při spuštění hry.
- **Vzhled**: pískovcová pevnost a sídlo lorda. Před hradem plane táborové ohniště, u kterého čekají nezaměstnaní poddaní.
- **Funkce**: centrální správa panství. Na začátku hry má 20 volných obyvatel.
- **Výroba jednotek**: těžcí pěšáci (bojovníci s mečem a štítem).

### 2. Kasárna
- **Velikost na mřížce**: 2×2 bloky
- **Náklady**: 150 peněz, 100 dřeva, 50 kamene.
- **Vzhled**: vojenská pískovcová budova s cvičnými terči a zbrojnicí.
- **Výcvik jednotek**: lučištníci s dlouhým tisovým lukem.

### 3. Dřevorubec
- **Velikost na mřížce**: 1×1 bloky
- **Náklady**: 50 peněz, 20 dřeva.
- **Umístění**: v oblasti se stromy. Alespoň jedna dlaždice pod budovou musí být strom.
- **Vzhled**: dřevorubecký tábor.
- **Funkce**: těžba cenného dřeva v oázách a hájích. Do budovy lze přiřadit dělníky z hradu.

### 4. Kamenolom
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 100 peněz, 50 dřeva.
- **Umístění**: pouze na ložisko kamene. Celá plocha budovy musí ležet na ložisku.
- **Vzhled**: pískovcový a vápencový lom s těžebním jeřábem.
- **Funkce**: těžba kamene na skalních nalezištích. Do budovy lze přiřadit dělníky z hradu.
- **Zásoba ložiska**: 2000 jednotek kamene. Po vyčerpání se lom uzavře a nové ložisko se objeví jinde na mapě (viz [mapa.md](mapa.md)).

### 5. Jabloňový sad
- **Velikost na mřížce**: 4×4 bloky
- **Náklady**: 120 peněz, 60 dřeva.
- **Vzhled**: zavlažovaný sad s jabloňovými stromy v úrodné oázové půdě.
- **Funkce**: stálý přísun jídla pro sýpku a udržování vysoké spokojenosti lidu. Do budovy lze přiřadit dělníky z hradu.

### 6. Obchod
- **Velikost na mřížce**: 2×2 bloky
- **Náklady**: 200 peněz, 100 dřeva, 100 kamene.
- **Funkce**: Budova, ve které hráč utrácí peníze (startovní kapitál zvolený při spuštění hry).
- **Nabídka**: dřevo, kámen, jídlo, železo. Nabídka je pevná.
- **Ceny** (pevné, za 1 jednotku). Nákupní cena je vždy vyšší než prodejní, takže opakovaný nákup a prodej vede ke ztrátě.

| Surovina | Nákup | Prodej |
|---|---|---|
| Dřevo | 10 | 6 |
| Kámen | 12 | 8 |
| Jídlo | 8 | 5 |
| Železo | 20 | 14 |

- **Vzhled**: tržnice s pultem a stánky pod plachtou.

### 7. Obydlí
- **Velikost na mřížce**: 2×2 bloky
- **Náklady**: 80 peněz, 60 dřeva, 20 kamene.
- **Funkce**: přidá 8 obyvatel do kapacity panství.
- **Vzhled**: jednoduchý kamenný dům s hliněnou střechou.

### 8. Sýpka
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 150 peněz, 100 dřeva, 50 kamene.
- **Funkce**: skladuje jídlo. Dělníci z Jabloňového sadu sem odnášejí jídlo po 10 kusech.
- **Kapacita**: 300 jednotek jídla.
- **Vzhled**: vysoká kulatá sýpka s dřevěnou střechou a kamennými základy.

### 9. Sklad
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 150 peněz, 120 dřeva, 60 kamene.
- **Funkce**: centrální sklad dřeva, kámene a železa. Dělníci sem suroviny nosí a odtud je berou na stavbu.
- **Kapacita**: 500 jednotek na jeden sklad (dřevo, kámen a železo dohromady). Sklady stojící vedle sebe se sčítají.
- **Vzhled**: dlouhá pískovcová hala s otevřenými vraty a dřevěnými regály.

### 10. Železný důl
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 150 peněz, 80 dřeva, 40 kamene.
- **Umístění**: pouze na ložisko železné rudy. Celá plocha budovy musí ležet na ložisku.
- **Funkce**: dělníci z hradu těží železnou rudu a nosí ji po 10 kusech do skladu, kde se eviduje jako železo. Do dolu lze přiřadit dělníky z hradu.
- **Zásoba ložiska**: 1000 jednotek rudy. Po vyčerpání se důl uzavře a nové ložisko se objeví jinde na mapě (viz [mapa.md](mapa.md)).
- **Vzhled**: šachta s dřevěnou konstrukcí, vozíky na kolejnicích a hromada železné rudy před vchodem.

---

### Další plánované budovy
- **Hradby**: 1×1 bloky, zvyšují obranu jednotek za nimi.
- **Strážní věže**: 1×1 nebo 2×2 bloky, rozšiřují dohled (10 dlaždic) a dostřel lučištníků.
- **Zbrojnice**: 2×2 bloky, výcvik těžkých jednotek.
