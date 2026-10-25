# Ekonomika a hospodářství

## Suroviny a zásoby
- **Suroviny**: dřevo, kámen, jídlo, železo. Železo se těží z ložisek železné rudy v Železném dole.
- **Hrad**: jediné místo, kam dělníci odevzdávají suroviny i jídlo. Má základní kapacitu 500 jednotek dřeva, kamene a železa dohromady a 300 jídla.
- **Sklad**: zvyšuje kapacitu pro dřevo, kámen a železo dohromady o 500 jednotek.
- **Sýpka**: zvyšuje kapacitu jen pro jídlo, o 300 jednotek.
- **Stavba**: budova se hradí ze zásob panství v okamžiku položení základů. Náklady jednotlivých budov jsou v [budovy.md](budovy.md).
- **Měna**: peníze, utrácí se v budově Obchodu. Nákup omezuje jen peníze a volná kapacita (sklad pro suroviny, sýpka pro jídlo). Prodej omezuje zásoba.
- **Nedostatek zdrojů**: stavba, výcvik i nákup vyžadují celé náklady už při zadání. Pokud zdroje nestačí, příkaz se neprovede a písař to oznámí.
- **Vyčerpání zdrojů**: ložisko kamene má zásobu 2000 jednotek, ložisko železa 1000. Po vyčerpání se nové ložisko objeví jinde na mapě (viz [mapa.md](mapa.md)). Stromy se obnovují a jablka v sadu jsou nevyčerpatelná.
- **Startovní kapitál**: hráč volí při spuštění hry, kolik peněz a surovin dostane na začátku. Méně kapitálu znamená vyšší obtížnost.
  - Bohatý: 1000 peněz, 300 dřeva, 200 kamene, 300 jídla.
  - Střední: 600 peněz, 200 dřeva, 100 kamene, 200 jídla.
  - Skromný: 300 peněz, 150 dřeva, 80 kamene, 100 jídla.
- **Daně**: výše daně určuje příjem peněz. Vyšší daň přináší více peněz, nižší daň méně.
  - Nízká: 1 peněz za obyvatele za minutu.
  - Střední (výchozí): 2 peněze za obyvatele za minutu.
  - Vysoká: 3 peněze za obyvatele za minutu.

## Obyvatelstvo a pracovní síla
- **Počáteční obyvatelé**: hrad má na začátku 20 volných obyvatel.
- **Kapacita**: 20 obyvatel z hradu a 8 dalších za každé obydlí.
- **Přiřazení**: volné obyvatele lze přiřadit jako dělníky do Dřevorubce, Kamenolomu, Jabloňového sadu a Železného dolu, nebo rekrutovat jako vojáky (pěšáci v Královském hradu, lučištníci v Kasárnách).
- **Práce dělníka**: dělník přiřazený k budově jde pro surovinu v jejím okolí. Na mapě je vidět jeho cíl, například jablka u sadu.
- **Nosnost**: dělník nese 10 jednotek najednou.
- **Doba sběru**: 10 kusů trvá 20 s.
- **Produkce**: jeden dělník dá nejvýše 30 jednotek za minutu. S rostoucí vzdáleností od cíle produkce klesá.
- **Odnos**: naplněný dělník nese zásobu do Královského hradu a odevzdá ji. Pak se cyklus opakuje.
- **Cíl odnosu**: všechny suroviny i jídlo se odnášejí do Královského hradu. Sklad a sýpka cílem odnosu nejsou.
- **Bez cíle**: pokud Královský hrad chybí, dělník čeká s plnou zásobou.
- **Plná kapacita**: dělník s nákladem čeká, dokud v zásobách nevznikne místo.
- **Úmrtí**: zemřelý dělník nebo voják uvolní místo v kapacitě, ale nevrací se. Kapacitu lze doplnit jen novým Obydlím.

## Spotřeba jídla
- **Dělník**: spotřebuje 2 jídla za minutu, jen když pracuje.
- **Voják**: spotřebuje 1 jídlo za minutu.
- **Nepracující obyvatelé**: jídlo nespotřebovávají.
- **Zdroj**: jídlo se odebírá z celkových zásob panství.
- **Nedostatek**: když v zásobách není dost jídla, spokojenost klesá a dělníci přestanou těžit, dokud se jídlo nedoplní.

## Spokojenost lidu a popularita
- Spokojenost závisí na dostupnosti jídla a zásobách.
- Při vysoké spokojenosti hrad vzkvétá.
- **Vliv daní**: nízká daň zvyšuje spokojenost o 5 bodů, vysoká ji snižuje o 10 bodů. Střední daň je neutrální.
- **Náboženství a zábava**: zatím neovlivňují spokojenost, je to plánované rozšíření.

## Hospodářské řetězce
- Jabloňový sad zajišťuje jídlo. Dělníci ho odnášejí do Královského hradu. Každá sýpka zvyšuje kapacitu jídla o 300 jednotek.
- Železný důl těží železnou rudu z ložiska. Dělníci ji odnášejí do Královského hradu, kde se eviduje jako železo.
