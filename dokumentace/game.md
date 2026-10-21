# Izometrická RTS Strategie

Tato hra je Real-Time strategie (RTS) zasazená do prostředí pouštního království a oáz.

## 1. Architektura projektu
Projekt se skládá z:
- **Serveru (`server/`)**: Webový Node.js server, který po otevření stránky v prohlížeči nahraje a spustí celého herního klienta.
- **Klienta (`client/`)**: Webová aplikace postavená na moderním HTML5 Canvasu s izometrickým 2D vykreslováním pod fixním úhlem 45 stupňů.

---

## 2. Vizuální styl a prostředí (Poušť a Oáza)
- **Prostředí**: Horká pouštní krajina s písečnými dunami, skalními masivy a úrodnými oázami s palmami, trávou a vodními plochami.
- **Vizuál**: Pískovcová středověká architektura, cimbuří, hradební věže s vlajícími zástavami a pergamenově-pískovcový heraldický HUD.
- **Hlášky a atmosféra**: Hlášení poddaných a písaře (*"K vašim službám, sire!"*, *"Lidé jsou spokojeni, můj pane."*, *"Na toto místo nelze stavět!"*).

---

## 3. Základna, hrad a stavební rádius
- Uživatel začíná s centrální pevností (**Královský hrad / Donjon**).
- V rozmezí **100 bloků** od hradu je vymezen posvátný stavební okruh panovníka, kde je dovoleno stavět budovy a opevnění. Mimo tento rádius stavebníci odmítnou pracovat.

---

## 4. Budovy
1. **Královský hrad (Donjon)**:
   - Sídlo lorda a centrální správa.
   - Přímo před hradem plane **táborové ohniště**, u kterého se shromažďují poddaní čekající na práci.
   - Umožňuje výcvik těžkých pěšáků (bojovníků s mečem a štítem).
2. **Kasárna (Barracks)**:
   - Vojenská pískovcová budova se cvičnými terči a zbrojnicí.
   - Výroba a výcvik lučištníků s dlouhým tisovým lukem.
3. **Dřevorubec (Lumber Camp)**:
   - Dřevorubecký tábor pro těžbu cenného dřeva v oázách a hájích.
4. **Kamenolom (Quarry)**:
   - Pískovcový a vápencový lom s těžebním jeřábem na skalních nalezištích.
5. **Jablečný sad (Apple Orchard)**:
   - Zavlažovaný sad v úrodné oázové půdě s jabloňovými stromy. Zajišťuje stálý přísun jídla pro sýpku a udržuje vysokou spokojenost lidu.

---

## 5. Systém obyvatel a ohniště
- Hrad má své **nezaměstnané poddané**, kteří se zdržují u hradního ohniště.
- Volní obyvatelé se rodí postupně **každých 5 sekund – 1 obyvatel** (do maxima **20 obyvatel**).
- Tyto obyvatele může pán panství:
  - **Přiřadit jako dělníky** do hospodářských budov (Dřevorubec, Kamenolom, Sad) pro automatický sběr surovin.
  - **Rekrutovat jako vojáky** (Pěšáci v Hradu, Lučištníci v Kasárnách).
- Spokojenost lidu (Popularita) závisí na dostupnosti jídla a zásobách. Když jsou lidé šťastní, hrad vzkvétá!
