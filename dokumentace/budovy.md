# Budovy a architektura

## Základní pravidla výstavby

### Mřížkový systém a uchycení (Grid Snapping)
- **Přesná mřížka a rozměry**: Každá budova zabírá přesně definovanou plochu na herní mřížce (např. 1×1, 2×2, 3×3 nebo 4×4 bloky).
- **Pevně daná velikost (Footprint)**: Každá budova má svou pevně definovanou šířku a délku v celočíselných jednotkách dlaždic ($W \times H$).
- **Otáčení**: Před umístěním lze budovu klávesou **R** otáčet po 90°. U obdélníkových staveb se tím prohodí šířka a délka půdorysu; po umístění už rotaci měnit nelze.
- **Uchycení na mřížku (Snap to Grid)**: Umístění budovy se automaticky přichytává k celočíselným souřadnicím dlaždic. Není možné umístit budovu „mezi“ bloky.
- **Výchozí izometrická orientace (symetrická dlaždice 2:1)**: Všechny budovy jsou výchozím způsobem vykreslovány i kolizně orientovány na symetrické mřížce 56×28 px v souladu s celou herní mapou. Základna každé budovy na mřížce tvoří izometrický kosočtverec/polygon.
- **Stavební okruh**: Stavba je neomezená, jen ji nelze položit v okruhu **20 bloků** od nepřátelské jednotky nebo budovy. Poddaní na rozestavěné stavbě nepřestanou stavět jen kvůli nepříteli v okolí; napadený poddaný uteče a práci přeruší.
- **Materiál na stavbu**: stavba se hradí ze zásob panství v okamžiku položení základů. Náklady jsou u každé budovy v jejím popisu.
- **Staveniště**: po zakoupení vznikne na místě budovy staveniště. Stavba postupuje jen tehdy, když na ní pracují přidělení poddaní. Bez nich stavba stojí.
- **Zadání stavby poddaným**: hráč vybere libovolný počet poddaných a klikne pravým tlačítkem na vlastní staveniště, nebo v jejich panelu v sekci **Stavět** klikne na tlačítko stavby. Vybraní poddaní pak jdou na staveniště a začnou stavět. Ve smíšeném výběru se přiřadí pouze poddaní; vojákům se rozkazy nezmění.
- **Doba stavby**: běžné budovy podle velikosti 1×1 30 s, 2×2 60 s, 3×3 90 s, 4×4 120 s; opevnění má vlastní časy uvedené níže. Čas platí pro jednoho poddaného. Každý další poddaný přidá polovinu základní rychlosti.
- **Dokončení stavby**: každý přidělený poddaný pokračuje k nejbližšímu dosažitelnému vlastnímu staveništi do 10 dlaždic od své pozice (vzdálenost se měří k okraji staveniště). Není-li žádné v dosahu, vrátí se k ohništi. Hotovou budovu lze používat a přiřazovat do ní dělníky (viz [ekonomika.md](ekonomika.md)).
- **Kolize a terén**: 
  - Žádné dvě budovy se nesmí překrývat.
  - Mezi budovami musí zůstat volný pruh, kterým procházejí NPC a vojáci (šířka pruhu: 1 dlaždice).
  - Výjimka: sklady a vlastní hradby, věže a brány lze navzájem stavět bez pruhu.
  - Dlaždice pod budovou musí být volné (přírodní zdroje jako stromy či kameny se při stavbě vyčistí, nebo je stavba přímo vyžaduje jako kamenolom).

### Uzavřené a otevřené budovy, kolize a vykreslování postav
- **Uzavřené budovy**: Všechny stavby s pevnými stěnami (Královský hrad, Kasárna, Dřevorubec, Kamenolom, Obchod, Obydlí, Sýpka, Sklad, Železný důl) jsou uzavřené. Žádná postava (NPC, dělník ani voják) na ně nemůže vstoupit ani skrz ně procházet. Při zahájení stavby i při jejím dokončení jsou případné jednotky nacházející se pod půdorysem stavby automaticky bezpečně odsunuty na nejbližší volnou dlaždici.
- **Otevřené budovy (Jabloňový sad)**: Jabloňový sad je otevřenou zemědělskou plochou v oáze. Po dokončení stavby neblokuje chůzi (`passable: true`), dělníci vstupují přímo do sadu a chodí mezi stromy, kde sbírají jablka.
- **Pravidlo viditelnosti postav (vykreslování a z-ordering)**: Žádná postava ve hře nesmí být vykreslována tak, že by chodila „pod texturou“ budovy.
  - Kontaktní stíny budov a travnatý půdorys jabloňového sadu se vykreslují na úrovni terénu ještě před vykreslením postav. Dělníci tak vždy chodí **na** trávě a na zemi, nikdy pod texturou.
  - V otevřeném jabloňovém sadu jsou jednotlivé stromy a košík izometricky řazeny podle své hloubky společně s dělníky. Dělník procházející sadem je plně viditelný: stromy za ním jsou vykresleny za ním a stromy před ním před ním.
  - U uzavřených budov jsou postavy procházející kolem budovy zepředu (jižní a východní stěna) vykresleny před budovou, zatímco postavy za budovou jsou přirozeně zakryty 3D stěnami budovy.

### Zdraví, poškození a zánik
- **Zdraví budov**: běžné 1×1 500, 2×2 800, 3×3 1200, 4×4 1500, Královský hrad 2000; opevnění má vlastní hodnoty níže.
- **Poškození**: nepřátelské jednotky ubírají budově zdraví. Hradby a věže chrání budovy za nimi.
- **Rozestavěná budova**: zdraví roste úměrně postupu stavby. Při zničení se vrátí 50 % surovin.
- **Zánik**: při nule zdraví budova zanikne a je zničena. Dělníci se vrací do hradu k ohništi.
- **Dobytí**: budovy nelze obsadit, lze je jen zničit.
- **Obydlí**: při zániku ztratí 8 míst v kapacitě. Přebytečné volné obyvatele odejdou.
- **Sklad a sýpka**: zásoby nad kapacitou zbylých skladů (suroviny) nebo sýpek (jídlo) se ztratí.
- **Oprava**: volní obyvatelé z hradu opravují budovu za 20 % jejích nákladů. Oprava trvá 1 s na 10 zdraví. Zdraví se jinak neobnovuje.
- **Královský hrad**: lze opravit stejně. Jeho zánik znamená prohru.
- **Ložiska a stromy**: zničením budovy nezanikají.
- **Býrání**: hráč může vlastní budovu zbýrat. Vrátí se 50 % nákladů, zásoby se ztratí jen nad zbylou kapacitou a dělníci se uvolní do hradu. Královský hrad nelze zbýrat.

---

## Seznam a detailní popis budov

### Opevnění
- **Hradba**: 1×1, 1000 zdraví, 20 s, 20 peněz a 20 kamene za díl. Tažením vznikne rovný úsek až 48 samostatných stavenišť; každé potřebuje stavitele.
- **Malá brána**: 1×1, 1200 zdraví, 45 s, 80 peněz, 40 dřeva a 50 kamene.
- **Velká brána**: 4×1 (po otočení 1×4), 2400 zdraví, 90 s, 180 peněz, 80 dřeva a 120 kamene.
- Otevřenou bránou kterékoliv velikosti projde kdokoliv; nepřítel do 6 dlaždic ji automaticky zavře. Po jeho odchodu se odemčená brána znovu otevře. Vlastník ji může zamknout nebo povolit otevření v panelu.
- **Obranná věž**: 2×2, 1800 zdraví, 90 s, 160 peněz, 40 dřeva a 100 kamene. Výběrem lučištníků a pravým kliknutím na dokončenou vlastní věž do ní lze poslat až čtyři; mají dostřel o 2 dlaždice vyšší. Vysadit je lze z panelu nebo rozkazem k pohybu. Po zničení věže se obsádka uvolní.

### 1. Královský hrad
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: zdarma, vzniká při spuštění hry.
- **Vzhled**: pískovcová pevnost a sídlo lorda. Před hradem plane táborové ohniště, u kterého čekají nezaměstnaní poddaní.
- **Funkce**: centrální správa panství a místo, kam dělníci odevzdávají dřevo, kámen a železo, pokud je z jejich místa nejblíž mezi hradem a sklady. Jídlo odnášejí do nejbližší sýpky, bez sýpky do hradu. Má základní kapacitu 500 jednotek dřeva, kamene a železa dohromady a 300 jídla. Na začátku hry má 20 volných obyvatel.
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
- **Funkce**: těžba cenného dřeva v oázách a hájích. Dělníci přiřazení k budově nejdřív přijdou k ní, najdou nejbližší dosažitelný strom, pokácejí ho a rozřežou. Dřevo nesou po 10 kusech do nejbližšího dosažitelného hotového skladu nebo hradu. Pokud se náklad nevejde do zásob, počkají, až se uvolní místo, a odevzdají ho celý najednou. Do budovy lze přiřadit dělníky z hradu.

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
- **Typ**: otevřená budova / zemědělská plocha (průchozí po dokončení).
- **Vzhled**: zavlažovaný sad s jabloňovými stromy v úrodné oázové půdě, zavlažovací stružkou a nízkou zídkou.
- **Funkce**: stálý přísun jídla. Dělníci chodí přímo v sadu po trávě mezi jabloněmi, kde jsou plně viditelní (nejsou vykresleni pod texturou). Sbírají jablka a nosí je do nejbližší sýpky (bez sýpky do hradu). Do budovy lze přiřadit až 4 dělníky z hradu. Při nedostatku jídla dělníci sadu pracují dál, takže se zásoba spolehlivě obnoví. Jablka v sadu jsou nevyčerpatelná.

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
- **Funkce**: zvyšuje kapacitu pro jídlo. Dělníci odnášejí jídlo z Jabloňového sadu do nejbližší hotové sýpky po 10 kusech (bez sýpky do hradu). Pokud se náklad jídla nevejde do zásob, dělník čeká a odevzdá ho celý najednou.
- **Kapacita**: 300 jednotek jídla na jednu sýpku. Kapacitu pro suroviny nezvyšuje.
- **Vzhled**: vysoká kulatá sýpka s dřevěnou střechou a kamennými základy.

### 9. Sklad
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 150 peněz, 120 dřeva, 60 kamene.
- **Funkce**: zvyšuje kapacitu pro dřevo, kámen a železo. Dělníci sem odnášejí suroviny, pokud je z jejich místa blíž než hrad.
- **Kapacita**: 500 jednotek na jeden sklad (dřevo, kámen a železo dohromady). Kapacity všech skladů se sčítají.
- **Vzhled**: dlouhá pískovcová hala s otevřenými vraty a dřevěnými regály.

### 10. Železný důl
- **Velikost na mřížce**: 3×3 bloky
- **Náklady**: 150 peněz, 80 dřeva, 40 kamene.
- **Umístění**: pouze na ložisko železné rudy. Celá plocha budovy musí ležet na ložisku.
- **Funkce**: dělníci z hradu těží železnou rudu a nosí ji po 10 kusech do nejbližšího dosažitelného hotového skladu nebo hradu, kde se eviduje jako železo. Do dolu lze přiřadit dělníky z hradu.
- **Zásoba ložiska**: 1000 jednotek rudy. Po vyčerpání se důl uzavře a nové ložisko se objeví jinde na mapě (viz [mapa.md](mapa.md)).
- **Vzhled**: šachta s dřevěnou konstrukcí, vozíky na kolejnicích a hromada železné rudy před vchodem.

---

### Další plánované budovy
- **Hradby**: 1×1 bloky, zvyšují obranu jednotek za nimi.
- **Strážní věže**: 1×1 nebo 2×2 bloky, rozšiřují dohled (10 dlaždic) a dostřel lučištníků.
- **Zbrojnice**: 2×2 bloky, výcvik těžkých jednotek.
