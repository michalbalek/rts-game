# Ovládání a uživatelské rozhraní (HUD)

## Ovládání kamery
- **Posun**: klávesy WASD nebo šipky. Kamera se posouvá také při najetí myší k okraji obrazovky, včetně míst překrytých herními panely. Po vyjetí kurzoru z okna posun pokračuje, dokud se kurzor nevrátí mimo okraj nebo okno neztratí zaměření. Při tažení minimapy se posun myší u okraje pozastaví.
- **Zoom**: kolečko myši.

## Práce s myší
- **Levé tlačítko**: výběr jednotek a budov, potvrzení stavby. Přidržením tažení vybere více jednotek obdélníkem. Dvojklik na vlastní jednotku (nebo Ctrl + klik) vybere všechny vlastní jednotky stejného typu viditelné na obrazovce; se Shiftem je přidá k výběru.
- **Pravé tlačítko**: pohyb a povel jednotkám, zrušení akce. Vybraným poddaným zadáte stavbu pravým kliknutím na vlastní staveniště. Nadále lze použít tlačítko stavby v sekci Stavět v jejich panelu. Ve smíšeném výběru se ke stavbě přiřadí pouze poddaní; vojáci si ponechají své dosavadní rozkazy.
- **Přímá těžba**: vyberte poddané a pravým tlačítkem klikněte na strom nebo ložisko kamene či železa. Těžit začnou pouze poddaní, vojáci si ponechají dosavadní rozkazy. Poddaný s nákladem musí před přeřazením náklad odevzdat.
- **Opevnění**: hradbu vyznačte tažením levého tlačítka. Bránu zamknete nebo otevřete v jejím panelu; blízký nepřítel ji automaticky zavře. Vybrané lučištníky pošlete do hotové vlastní věže pravým kliknutím a z panelu je můžete vysadit.

## Klávesové zkratky (Hotkeys)
- **R**: otočení vybrané budovy o 90° před umístěním. Umístěné budovy se již neotáčejí.
- **Ctrl + 1–9**: uložení skupiny jednotek.
- **1–9**: výběr uložené skupiny.
- **Mezerník**: vycentrování kamery na Královský hrad.
- **Backspace / Home**: přesun kamery na místo posledního ohlášeného útoku.
- **+ / −**: rychlost hry v singleplayeru (0,5×, 1×, 1,5×, 2×, 3×). Používají se fyzické klávesy vpravo od nuly nebo numerická klávesnice, takže fungují na každém rozložení. V multiplayeru běží hra vždy 1×.
- **ESC**: zrušení stavby nebo výběru. Pokud nic není aktivní, otevře herní menu (viz [intro.md](intro.md)).
- **Delete**: býrání vybrané vlastní budovy (po potvrzení).

## Herní panely (HUD)
- **Jazyk** – češtinu nebo angličtinu vyberete v hlavním menu nebo Nastavení. Volba se uloží a přeloží také popisky HUD, nápovědu a hlášky; zkratky a herní pravidla se nemění.
- **Horní lišta**: kompaktní přehled peněz, dřeva, kamene, jídla a železa. Vedle zásob ukazuje obsazenost skladu a sýpky i počet obyvatel vůči kapacitě. Tlačítko Menu otevře herní menu; vedle něj se při změněné rychlosti hry zobrazí její ukazatel. Na užších obrazovkách se zásoby přesunou do druhého řádku, kapacity zůstávají viditelné.
- **Spodní dok**: nabídka staveb v kategoriích suroviny, hospodářství, vojsko a opevnění.
- **Výběrový panel**: informace a příkazy pro vybranou budovu, staveniště nebo jednotky.
- **Minimapa**: přehled celé mapy v pravém dolním rohu, zobrazuje i mlhu války. V režimu stavby ukazuje červeně oblasti, kde nelze stavět (20 bloků od viditelných nepřátel).
- **Hlášení o napadení**: když nepřítel zasáhne vaši jednotku nebo budovu, zazní válečný roh, písař útok ohlásí a místo zabliká na minimapě i v krajině. Další hlášení přijde nejdřív za 15 s, dřív jen při útoku v jiné oblasti (dál než 18 dlaždic, nejméně 4 s po předchozím).
