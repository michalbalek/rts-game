# Přispívání do projektu

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
