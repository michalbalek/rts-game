# Přispívání do projektu

## Velikost souborů a členění kódu

Pravidla platí pro ručně psané zdrojové soubory klienta, serveru, testů a nástrojů, zejména JavaScript, CSS a HTML. Nevztahují se na generované soubory, externí závislosti, lock soubory, datové podklady ani dokumentaci.

### Limit velikosti

- **Cíl: nejvýše 300 řádků na soubor.** Při přibližování k této hranici zvažte, zda soubor stále řeší jednu soudržnou odpovědnost.
- **Maximum: 500 řádků na soubor.** Počítají se všechny řádky včetně komentářů a prázdných řádků; závěrečný znak nového řádku se nepočítá jako další prázdný řádek.
- Nové a upravované soubory musí limit splnit, s přechodným postupem pro existující nadlimitní soubory popsaným níže. Před překročením maxima rozdělte odpovědnosti do menších souborů.
- Limit neobcházejte minifikací, odstraňováním užitečných komentářů a mezer ani slučováním příkazů na jeden řádek. Čitelnost má přednost před umělým snížením počtu řádků.

### Moduly a sekce

- Každý modul má mít jasnou odpovědnost a výstižný název. Oddělujte například vykreslování, vstup, síťovou komunikaci a herní pravidla, nikoli mechanicky každých několik set řádků.
- Související kód uvnitř souboru uspořádejte do logických sekcí: například importy, konstanty, inicializace a funkce seskupené podle účelu. U tříd držte související metody u sebe.
- Krátké nadpisové komentáře používejte pouze pro významné celky, pokud jejich účel není zřejmý z názvů a struktury. V CSS členění veďte podle komponent či oblastí rozhraní, v HTML podle významových částí stránky.
- Sekce nenahrazují rozdělení nadlimitního souboru. Nevytvářejte ani množství drobných souborů bez vlastní odpovědnosti nebo jeden obecný pomocný modul, do kterého se jen přesune původní problém.
- Zachovejte stávající modulový systém a směr závislostí; nevytvářejte cyklické importy.

### Postupné zavádění a ověření

Existující soubory nad 500 řádků není nutné rozdělit plošně při zavedení pravidla. Při související úpravě oddělte upravovanou odpovědnost do menšího modulu a původní soubor dále nezvětšujte. Nesouvisející části nepřepisujte jen kvůli limitu; případný zbývající nadlimitní soubor výslovně uveďte ve shrnutí změn.

Při rozdělování zachovejte veřejná rozhraní a chování hry, aktualizujte všechny dotčené importy, odkazy na skripty či styly a případnou dokumentaci. Před dokončením spusťte kontrolu velikosti `npm run test:structure` a odpovídající existující testy (`npm run test:client`, `npm run test:sim`, `npm run test:rooms` nebo `npm run test:commit` podle změny). Pokud změna zasahuje více oblastí, použijte `npm test`; úpravy HTML a CSS navíc ověřte v prohlížeči.

Automatická kontrola [tools/test-structure.js](tools/test-structure.js) je součástí `npm test`. Rekurzivně kontroluje ručně psané soubory `.js`, `.mjs`, `.cjs`, `.css` a `.html` v adresářích `client`, `server` a `tools`, vynechává `node_modules` a při překročení 500 řádků selže s cestou a počtem řádků. Případné budoucí generované soubory ukládejte odděleně a před jejich zařazením upravte rozsah kontroly. Stejné zásady pro práci asistenta obsahují [projektové instrukce Copilotu](.github/copilot-instructions.md).

### Orientace v rozděleném kódu

- [Klientské styly](client/css/) načítá vstupní [style.css](client/css/style.css) pomocí importů podle oblastí rozhraní. Jejich pořadí zachovává původní kaskádu; pravidla pro responzivitu se načítají poslední.
- [Simulace](client/js/sim/), [vykreslování a zvuk](client/js/engine/) a [herní rozhraní](client/js/game/) obsahují moduly podle odpovědností. Při dalších úpravách měňte příslušný modul, nikoli pouze vstupní soubor.
- Serverový [správce místností](server/src/rooms.js) zajišťuje přiřazování a přihlášení hráčů a zachovává exporty `Room` a `RoomManager`. [Room](server/src/room.js) řeší připojení a lobby, navazující [RoomMatch](server/src/room-match.js) životní cyklus rozehrané hry a [konfigurace](server/src/room-config.js) společné limity a časování.
- Vstupní testovací příkazy zůstávají v [package.json](package.json). Nové testy přidávejte k odpovídající oblasti; nerozšiřujte jeden soubor nad limit.

## Commity

Zprávy commitů se řídí [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Nové commity musí tomuto formátu odpovídat. Existující historii nepřepisujeme.

### Formát

```text
typ(rozsah)!: krátký popis

Volitelné tělo zprávy s podrobnostmi.

Volitelné zápatí, např. BREAKING CHANGE: co se změnilo
```

- **Typ** je povinný a píše se malými písmeny. Povolené typy:

  | Typ | Použití |
  |---|---|
  | `feat` | nová funkce nebo chování pro hráče |
  | `fix` | oprava chyby |
  | `docs` | změna pouze v dokumentaci |
  | `style` | jen formátování bez vlivu na chování (změny vzhledu v CSS patří do `feat` nebo `fix`) |
  | `refactor` | úprava kódu bez nové funkce a bez opravy chyby |
  | `perf` | zrychlení nebo nižší paměťová náročnost |
  | `test` | přidání nebo úprava testů |
  | `build` | sestavení, závislosti, `package.json` |
  | `ci` | konfigurace CI |
  | `chore` | ostatní údržba, např. `.gitignore` |
  | `revert` | vrácení dřívějšího commitu |

- **Rozsah** je volitelný, malými písmeny, v kulatých závorkách: `feat(ekonomika): …`. Označuje část projektu, například `sim`, `client` nebo `server`.
- **`!`** za typem nebo rozsahem označuje nekompatibilní změnu (breaking change). Stejný význam má zápatí `BREAKING CHANGE: …`.
- **Popis** je povinný a následuje po dvojtečce a jedné mezeře. Nesmí být prázdný.
- **Předmět** (první řádek) má nejvýše 72 znaků.
- **Tělo** a **zápatí** jsou volitelné. Od předmětu je odděluje prázdný řádek.

### Příklady

```text
feat(sim): přidat sklad surovin
fix(ui): opravit přetékání hlášek v postranním panelu
docs: doplnit popis mlhy války
feat(net)!: změnit formát zpráv mezi klientem a serverem
```

### Výjimky

Git sám vytváří některé zprávy. Kontrola je přeskakuje: `Merge …`, `Revert "…"`, `fixup! …`, `squash! …` a `amend! …`.

## Kontrola zpráv (Git hook)

Kontrolu provádí hook [`.githooks/commit-msg`](.githooks/commit-msg) a validátor [`tools/check-commit-msg.js`](tools/check-commit-msg.js). Nemá žádné závislosti, vyžaduje jen Node.js.

Hook je potřeba jednou aktivovat v každém klonu repozitáře:

```bash
git config core.hooksPath .githooks
```

Na Linuxu a macOS musí mít hook spustitelný bit. Pokud git hlásí, že hook byl ignorován, nastavte ho:

```bash
chmod +x .githooks/commit-msg
```

- Ruční kontrola zprávy: `node tools/check-commit-msg.js <soubor-se-zprávou>`
- Testy validátoru: `npm run test:commit` (součástí `npm test`)
- Vypnutí kontroly v klonu: `git config --unset core.hooksPath`
- Jednorázové obejití: `git commit --no-verify` (používejte jen výjimečně)
