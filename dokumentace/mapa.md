# Mapa a herní svět

## Izometrický systém
- **Dlaždice**: symetrický kosočtverec 56×28 px. Vodorovná i svislá osa jsou souměrné, hrany svírají s vodorovnou čárou úhel 26,6° (poměr 2:1).
- **Projekce**: izometrická, mřížka je natočena o 45°.
- **Vrstvy**: terén, vodní toky a přírodní zdroje, budovy, jednotky.
- **Výška**: terén je plochý, bez výškových úrovní.

## Biomy a terény
Hra má tři mapy, které hráč vybírá při spuštění:
- **Poušť** – písečné duny a horké pouštní prostředí.
- **Oáza** – palmy, tráva a vodní plochy.
- **Skály** – skalní masivy.

## Start hry
- **Startovní pozice**: každá mapa má 4 pozice a každá pozice je pro jeden hrad. Každý hráč i bot obsadí jednu pozici. Pozice jsou od sebe nejméně 60 dlaždic a nevyužité zůstávají prázdné.
- **Zdroje u startu**: v okruhu 30 dlaždic od hradu je alespoň jedno ložisko kamene, jedna oblast stromů a jedno ložisko železa, pokud to mapa umožňuje.
- **Startovní jednotky**: 20 poddaných u ohniště, žádná vojska.
- **Férovost**: všichni hráči i boti mají stejnou mapu a stejné podmínky.

## Vodní toky
- **Hluboká voda** (řeka, jezero) je neprůchodná pro všechny jednotky i NPC.
- **Mělká voda a kameny** (brody) jsou průchodné pro vojáky a NPC.
- Na vodě nelze stavět. Brody jsou strategická místa, která lze hlídat.

## Náhodné mapy
Každá mapa se generuje náhodně v rámci svého biomu. Níže je popsaný typický layout.

### Mapa 1 – Poušť s řekou
- Řeka protéká mapou od severu k jihu. Uprostřed jsou dva brody.
- Písečné duny a několik skalních masivů.
- Palmy v malých oázách podél řeky.

### Mapa 2 – Oáza u jezera
- Velké jezero uprostřed mapy, z něj vytéká potok směrem na východ.
- Potok má jeden brod na severu.
- Hustá vegetace a palmy kolem jezera.

### Mapa 3 – Skalní rokle
- Skalní masivy ohraničují úzkou rokli, kterou prochází potok.
- Dva brody vedou úzkými průchody mezi skálami.
- Méně stromů, více kamenných zdrojů.

## Přírodní zdroje a ložiska
- **Kámen**: ložiska kamenných žil. Z kamene se staví hradby a opevnění. Těží se v Kamenolomu. Ložisko má zásobu 2000 jednotek.
- **Železo**: ložiska železné rudy na skalnatých místech (rokle, skalní masivy). Každá mapa má alespoň dvě ložiska. Těží se v Železném dole, ložisko má zásobu 1000 jednotek rudy. Z železa jsou lepší hradby a zbraně pro vojáky. Lze ho prodat v Obchodu, stejně jako ostatní suroviny.
- **Obnova ložisek**: vyčerpané ložisko zmizí. Po 3 minutách se na volném místě mapy objeví nové ložisko stejného typu. Místo musí být nejméně 20 dlaždic od všech hradů a nesmí být na vodě. Budova na vyčerpaném místě zůstává stát bez práce a dělníci se uvolní do hradu. Dělník, který nese náklad, ho nejdřív odevzdá. Hráč musí na novém ložisku postavit novou budovu.
- **Dřevo**: oblasti se stromy. Dřevorubec strom pokácí a na jeho místě po náhodné době 30 až 90 sekund vyroste nový strom. Jeden strom dá jeden náklad dřeva (u hráče 10 kusů).

## Fog of War (Mlha války)
- Fog of War je volitelná možnost, kterou hráč zapne při spuštění hry.
- **Neprozkoumaná oblast** je černá a hráč na ní nevidí nic.
- **Prozkoumaná oblast mimo dohled** je šedá a zobrazuje poslední známý stav. Jednotky a stavby na ní nejsou vidět.
- **Dohled**: odhaluje oblast kolem jednotek, budov a strážních věží. Dosah: jednotky 6 dlaždí, budovy 4 dlaždice, strážní věže 10 dlaždí.
