# Vojenské jednotky a bojový systém

## Obecná mechanika jednotek
- **Pohyb**: hledání cesty (A*) po dlaždicích. Brody jsou průchodné, hluboká voda ne.
- **Útok**: jednotka se k cíli v dosahu přiblíží a zaútočí sama.
- **Zdraví**: každá jednotka má zdraví, při nule zemře. Mrtvá jednotka zmizí z mapy.
- **Obrana**: nečinná jednotka se po napadení sama brání a zaútočí na útočníka.

## Seznam jednotek

### 1. Pěšák / Šermíř
- **Vzhled**: těžký pěšák se štítem a mečem.
- **Statistiky**: zdraví 100, poškození 10, dosah 1 dlaždice, rychlost 1.
- **Cena výcviku**: 60 peněz, 20 jídla.
- **Doba výcviku**: 40 s.

### 2. Lučištník
- **Vzhled**: lučištník s dlouhým tisovým lukem.
- **Dostřel**: 6 dlaždic. Šíp letí obloukem a může minout pohybující se cíl.
- **Statistiky**: zdraví 60, poškození 8, rychlost 1.
- **Cena výcviku**: 70 peněz, 20 jídla.
- **Doba výcviku**: 45 s.

### 3. Poddaný / Dělník
- Chodí pro suroviny k budovám a odnášejí je po 10 kusech. Dřevo, kámen a železo jdou do Královského hradu, jídlo do nejbližší sýpky (bez sýpky do hradu, viz [ekonomika.md](ekonomika.md)).
- **Úloha**: čeká u ohniště před hradem, dokud ho hráč nepřiřadí k budově nebo ke stavbě na staveništi (tlačítkem stavby v sekci Stavět). Po dokončení stavby se vrací k ohništi. Tlačítkem „Uvolnit z práce“ ho lze v místní hře propustit; zůstane na místě. Poddaný, který nese náklad, ho nejdřív odevzdá; dokud ho nese, nejde přidělit na stavbu ani uvolnit.
- **Útok**: dělník nebojuje. Při napadení uteče do hradu.

### Další plánované jednotky
- **Rytíř**: těžká jízdní jednotka pro rychlý útok.
- **Kopiník**: lehčí jednotka s dlouhým kopím, silná proti jízdě.
- **Katapult / obléhací stroj**: pomalý stroj pro ničení hradeb a budov.

## Boj a poškození
- **Poškození**: základní poškození minus obrana cíle, nejméně 1.
- **Obrana hradeb**: jednotka za hradbou dostává +50 % obrany.
- **Boj z dálky a na blízko**: lučištník útočí z dálky, pěšák na blízko.
