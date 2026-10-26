# Projektové instrukce

Při změnách dodržuj [pravidla přispívání](../CONTRIBUTING.md), zejména
[velikost souborů a členění kódu](../CONTRIBUTING.md#velikost-souborů-a-členění-kódu).

- U ručně psaných zdrojových souborů včetně testů a nástrojů cíluj na nejvýše 300 řádků; maximum je 500 řádků včetně komentářů a prázdných řádků.
- Před překročením maxima rozděl soubor podle odpovědností do soudržných modulů. Limit neobcházej zhušťováním kódu ani přesunem všeho do obecného pomocného souboru.
- Uvnitř souboru seskupuj související kód do logických sekcí. Krátké nadpisové komentáře přidávej jen tam, kde členění není zřejmé ze struktury a názvů.
- Existující nadlimitní soubory řeš postupně při souvisejících změnách: odděluj upravovanou odpovědnost, zbytek zbytečně nepřepisuj a soubor dále nezvětšuj. Neprováděj plošný refaktoring bez zadání.
- Při rozdělování zachovej chování, aktualizuj importy a vstupní body a spusť odpovídající existující testy. Ve shrnutí změn uveď případný zbývající nadlimitní soubor.
- Před dokončením změn zdrojového kódu spusť `npm run test:structure`; tato kontrola je také součástí `npm test`.
