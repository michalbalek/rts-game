# Izometrická RTS Strategie

Tato hra je Real-Time strategie (RTS) zasazená do prostředí pouštního království a oáz.

## 1. Architektura projektu
Projekt se skládá z:
- **Serveru (`server/`)**: Webový Node.js server, který po otevření stránky v prohlížeči nahraje a spustí celého herního klienta.
- **Klienta (`client/`)**: Webová aplikace postavená na moderním HTML5 Canvasu s izometrickým 2D vykreslováním na symetrické mřížce 64×32 px.

---

## 2. Vizuální styl a prostředí (Poušť a Oáza)
- **Prostředí**: Horká pouštní krajina s písečnými dunami, skalními masivy a úrodnými oázami s palmami, trávou a vodními plochami.
- **Vizuál**: Pískovcová středověká architektura, cimbuří, hradební věže s vlajícími zástavami a pergamenově-pískovcový heraldický HUD.
- **Hlášky a atmosféra**: Hlášení poddaných a písaře (*"K vašim službám, sire!"*, *"Na toto místo nelze stavět!"*).

---

## 3. Základna, hrad a stavební pravidla
- Uživatel začíná s centrální pevností (**Královský hrad**).
- Stavební okruh je neomezený: budovy a opevnění lze stavět kdekoli na mapě, jen ne v okruhu **20 bloků** od nepřátelské jednotky nebo budovy.
- Rozestavěnou stavbu poddaní neopouštějí kvůli nepříteli v okolí; napadený poddaný uteče a práci přeruší.

---

## 4. Budovy
1. **Královský hrad**:
   - Sídlo lorda a centrální správa.
   - Přímo před hradem plane **táborové ohniště**, u kterého se shromažďují poddaní čekající na práci.
   - Umožňuje výcvik těžkých pěšáků (bojovníků s mečem a štítem).
2. **Kasárna (Barracks)**:
   - Vojenská pískovcová budova s cvičnými terči a střelnicí.
   - Výroba a výcvik lučištníků s dlouhým tisovým lukem.
3. **Dřevorubec (Lumber Camp)**:
   - Dřevorubecký tábor pro těžbu cenného dřeva v oázách a hájích.
4. **Kamenolom (Quarry)**:
   - Pískovcový a vápencový lom s těžebním jeřábem na skalních nalezištích.
5. **Jabloňový sad (Apple Orchard)**:
   - Zavlažovaný sad v úrodné oázové půdě s jabloňovými stromy. Zajišťuje stálý přísun jídla do nejbližší sýpky (bez sýpky do hradu) a udržuje vysokou spokojenost lidu.
6. **Obchod (Market)**:
   - Tržnice, kde hráč nakupuje a prodává suroviny za pevné ceny.
7. **Obydlí (Dwelling)**:
   - Jednoduchý kamenný dům, přidá 8 obyvatel do kapacity panství.
8. **Sýpka (Granary)**:
   - Zvyšuje kapacitu pro jídlo o 300 jednotek. Kapacitu pro suroviny nezvyšuje. Je cílem odnosu jídla z jabloňového sadu.
9. **Sklad (Warehouse)**:
   - Zvyšuje kapacitu pro dřevo, kámen a železo dohromady o 500 jednotek. Kapacitu pro jídlo nezvyšuje. Dělníci sem odnášejí suroviny, pokud je z jejich místa blíž než hrad.
10. **Železný důl (Iron Mine)**:
   - Těží železnou rudu z ložiska, kterou dělníci nosí do nejbližšího dosažitelného hotového skladu nebo hradu.

---

## 5. Systém obyvatel a ohniště
- Hrad má své **nezaměstnané poddané**, kteří se zdržují u hradního ohniště.
- Hrad má na začátku **20 volných obyvatel**. Každá budova Obydlí přidá do kapacity dalších **8 obyvatel**.
- Tyto obyvatele může pán panství:
  - **Přiřadit jako dělníky** do hospodářských budov (Dřevorubec, Kamenolom, Jabloňový sad, Železný důl) pro automatický sběr surovin.
  - **Poslat na staveniště**: vyberte poddané a v jejich panelu klikněte na stavbu v sekci Stavět. Každý další stavitel přidá 50 % základní rychlosti, bez horní hranice. Po dokončení se vrátí k ohništi.
  - **Rekrutovat jako vojáky** (Pěšáci v Hradu, Lučištníci v Kasárnách).
- **Chování dělníků**: každý dělník, ať pracuje v kterékoli hospodářské budově, odejde do přiřazené budovy a tam pracuje. Chodí po okolí zdroje, sbírá suroviny a nosí je do cíle odnosu: dřevo, kámen a železo do nejbližšího dosažitelného hotového skladu nebo hradu, jídlo do nejbližší sýpky (bez sýpky do hradu). Dřevorubec nejdřív přijde k budově, najde nejbližší dosažitelný strom, pokácí ho a rozřeže. Náklady jsou vždy celé jednotky. Pokud se náklad nevejde do zásob, dělník čeká, až se uvolní místo, a odevzdá ho celý najednou. Dělník, který nese náklad, ho nejdřív odevzdá. Přiřazení není pasivní přičtení k budově.
- Spokojenost lidu (Popularita) závisí na dostupnosti jídla a zásobách. Když jsou lidé šťastní, hrad vzkvétá!

---

## 6. Cíl hry
- **Vítězství**: hráč vyhrává, když zničí Královské hrady všech soupeřů.
- **Prohra**: hráč prohrává, když padne jeho Královský hrad. Jeho zbývající budovy se stanou neutrálními.
- **Multiplayer**: hra končí, když zůstane jediný hráč s hradem. Ostatní prohrávají.
- **Hra s boty**: stejná podmínka platí pro boty.
- **Vlastní stavba**: bez botů a bez vítězné podmínky. Hru hráč ukončí v herním menu.
- **Ukládání**: rozehranou singleplayerovou hru lze uložit do local storage prohlížeče. Ukládá se vždy jeden slot, nové uložení přepíše předchozí. Uložení je označeno datem a časem zahájení hry.

---

## 7. Boti (hra s boty)
- **Stavba**: bot staví v pořadí hrad, Dřevorubec, Kamenolom, Obydlí, Jabloňový sad, Kasárna, Sklad, Sýpka, Železný důl, Obchod. Dbá na volný pruh mezi budovami. Na staveniště posílá volné poddané stejně jako hráč.
- **Obrana**: bot drží u hradu alespoň třetinu vojska, zbytek posílá na útok.
- **Útok**: bot zaútočí, když má aspoň 15 vojáků. Útočí na nejbližší budovu soupeře.
- **Počet botů**: 1 až 3, výchozí 1. Mapa musí mít dostatek startovních pozic.
- **Úroveň bota**: volí hráč v menu. Snadná: sbírá o 30 % pomaleji a útočí až po 15 minutách. Střední: bez úprav. Těžká: sbírá o 20 % rychleji a útočí už při 10 vojácích.
