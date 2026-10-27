# Ekonomika a hospodářství

## Suroviny a zásoby
- **Suroviny**: dřevo, kámen, jídlo, železo. Železo se těží z ložisek železné rudy v Železném dole.
- **Celé jednotky**: dřevo, kámen, železo a jídlo se nosí, skladují i odečítají jen v celých kusech.
- **Hrad**: místo, kam dělníci odevzdávají dřevo, kámen a železo, pokud je z jejich místa nejblíž mezi hradem a sklady. Jídlo odnášejí do nejbližší sýpky, bez sýpky do hradu. Má základní kapacitu 500 jednotek dřeva, kamene a železa dohromady a 300 jídla.
- **Sklad**: zvyšuje kapacitu pro dřevo, kámen a železo dohromady o 500 jednotek. Dělníci sem odevzdávají suroviny, pokud je z jejich místa nejblíž mezi hradem a sklady.
- **Sýpka**: zvyšuje kapacitu jen pro jídlo, o 300 jednotek. Je cílem odnosu jídla z jabloňového sadu.
- **Stavba**: budova se hradí ze zásob panství v okamžiku položení základů. Stavbu dokončí přidělení poddaných na staveniště. Náklady jednotlivých budov jsou v [budovy.md](budovy.md).
- **Měna**: peníze, utrácí se v budově Obchodu. Nákup omezuje jen peníze a volná kapacita (sklad pro suroviny, sýpka pro jídlo). Prodej omezuje zásoba.
- **Automatický obchod**: v dokončeném Obchodu lze pro každou surovinu nastavit „Dokoupit do“ a „Prodat nad“. Každých 10 herních sekund se zásoba pod první hranicí doplní a přebytek nad druhou prodá na danou hranici. Prázdné pole příslušnou akci vypne; nákupní hranice nesmí být vyšší než prodejní. Nejdříve se provedou prodeje, potom nákupy, v pořadí dřevo, kámen, jídlo, železo. Nákup proběhne i částečně podle peněz a místa, zbytek se zkusí později. Pravidla jsou společná všem obchodům hráče, ukládají se s hrou a fungují, jen pokud má alespoň jeden dokončený Obchod.
- **Nedostatek zdrojů**: stavba, výcvik i nákup vyžadují celé náklady už při zadání. Pokud zdroje nestačí, příkaz se neprovede a písař to oznámí.
- **Vyčerpání zdrojů**: ložisko kamene má zásobu 2000 jednotek, ložisko železa 1000. Po vyčerpání se nové ložisko objeví jinde na mapě (viz [mapa.md](mapa.md)). Stromy se obnovují a jablka v sadu jsou nevyčerpatelná.
- **Startovní kapitál**: hráč volí při spuštění hry, kolik peněz a surovin dostane na začátku. Méně kapitálu znamená vyšší obtížnost.
  - Bohatý: 1000 peněz, 300 dřeva, 200 kamene, 300 jídla.
  - Střední: 600 peněz, 200 dřeva, 100 kamene, 200 jídla.
  - Skromný: 300 peněz, 150 dřeva, 80 kamene, 100 jídla.
- **Příjem peněz**: po vyčerpání startovního kapitálu lze peníze získávat prodejem surovin v Obchodu. Výběr a nastavení daní jsou zatím odstraněné; peníze automaticky nepřibývají hráčům ani botům.

## Obyvatelstvo a pracovní síla
- **Počáteční obyvatelé**: hrad má na začátku 20 volných obyvatel.
- **Kapacita**: 20 obyvatel z hradu a 8 dalších za každé obydlí.
- **Přiřazení**: volné obyvatele lze přiřadit jako dělníky do Dřevorubce, Kamenolomu, Jabloňového sadu a Železného dolu, nebo rekrutovat jako vojáky (pěšáci v Královském hradu, lučištníci v Kasárnách).
- **Stavění**: po zakoupení budovy vznikne staveniště. Vybrané volné obyvatele přidělíte tlačítkem stavby v sekci Stavět v jejich panelu. Pracují na něm, dokud není budova hotová. Každý další stavitel přidá 50 % základní rychlosti, bez horní hranice. Poté pokračují k dosažitelnému vlastnímu staveništi do 10 dlaždic, jinak se vrátí k ohništi (viz [budovy.md](budovy.md)).
- **Práce dělníka**: dělník přiřazený k budově nejdřív přijde k této budově. U uzavřených budov zůstává venku u vstupu/obvodu budovy a chodí ke zdroji (např. stromy, ložisko). Při těžbě dřeva dojde ke stromu, stojí otočený k němu a seká; po vytěžení odnese náklad. Stejně pracuje i poddaný poslaný ke stromu bez budovy. U otevřených budov (Jabloňový sad) dělník vstupuje přímo do sadu, chodí po trávě mezi stromy (kde je plně viditelný a neskrývá se pod texturou) a sbírá jablka. V místní hře je na mapě vidět čára od dělníka k jeho cíli.
- **Nosnost**: dělník nese 10 jednotek najednou. U botů se nosnost řídí obtížností.
- **Doba sběru**: 10 kusů trvá 20 s.
- **Přímá těžba**: bez pracovní budovy lze poddaného poslat na strom nebo ložisko kamene či železa. Za 20 s nasbírá 1 kus a odnese jej do skladu nebo hradu. Výkon bez započtení cesty je tak desetkrát nižší než u pracovníka budovy; kvůli častějším cestám bývá skutečný výkon ještě nižší. Strom poskytuje deset kusů i při přímé těžbě; po jeho vytěžení poddaný pokračuje u nejbližšího dosažitelného stromu v okolí původního cíle. Vyčerpané ložisko už dál netěží. Jídlo se získává v sadu.
- **Produkce**: jeden dělník dá nejvýše 30 jednotek za minutu (10 za 20 s). Skutečně dá méně, protože cesta k cíli a zpět trvá. Čím je cíl dál, tím je produkce nižší.
- **Odnos**: naplněný dělník nese zásobu do cíle odnosu (viz níže) a odevzdá ji celou najednou. Pak se vrátí ke zdroji a cyklus se opakuje.
- **Cíl odnosu**: dřevo, kámen a železo se odnášejí do nejbližšího dosažitelného hotového skladu nebo Královského hradu. Cíl se vybírá podle vzdálenosti od dělníka, když je náklad naplněn, a při každém dalším pokusu. Jídlo se odnáší do nejbližší hotové sýpky (bez sýpky do hradu).
- **Bez přístupu**: pokud k žádnému cíli nevede přístup z místa dělníka, dělník drží náklad, čeká 3 s a cíl hledá znovu.
- **Plná kapacita**: pokud se celý náklad nevejde do zásob, dělník s ním čeká u cíle a zhruba každé 3 s to zkouší znovu (cíl se přitom vybírá znovu). Jakmile se celý náklad vejde, odevzdá ho najednou. Částečné odevzdání se nedělá. Hráč dostane upozornění „Sklady jsou plné, dělníci čekají.“ (u jídla „Sýpky jsou plné, dělníci čekají.“)
- **Úmrtí**: zemřelý dělník nebo voják uvolní místo v kapacitě, ale nevrací se. Kapacitu lze doplnit jen novým Obydlím.

## Spotřeba jídla
- **Dělník**: spotřebuje 2 jídla za minutu, jen když pracuje nebo staví. I dělníci, které nedostatek jídla pozastavil, se do spotřeby počítají. Pokud je zásoba jídla na nule, nic se neodečte a nepřenáší se to jako dluh.
- **Voják**: spotřebuje 1 jídlo za minutu.
- **Nepracující obyvatelé**: jídlo nespotřebovávají.
- **Zdroj**: jídlo se odebírá z celkových zásob panství. Spotřeba se počítá průběžně, ze zásob se odečítají celé jednotky.
- **Nedostatek**: když v zásobách není dost jídla, dělníci přestanou těžit a stavitelé stavět, dokud se jídlo nedoplní. Výjimkou jsou dělníci v jabloňovém sadu: ti dál sbírají jablka a odnášejí je do nejbližší sýpky (bez sýpky do hradu), takže se zásoba jídla obnoví i z nuly.

## Hospodářské řetězce
- Jabloňový sad zajišťuje jídlo. Sad je otevřená plocha, kde dělníci viditelně sbírají jablka mezi stromy a odnášejí je do nejbližší sýpky, bez sýpky do hradu. Každá sýpka zvyšuje kapacitu jídla o 300 jednotek.
- Železný důl těží železnou rudu z ložiska. Dělníci ji odnášejí do nejbližšího dosažitelného hotového skladu nebo hradu, kde se eviduje jako železo.
