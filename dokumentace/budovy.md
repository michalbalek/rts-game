# Budovy a architektura

## Základní pravidla výstavby

### Mřížkový systém a uchycení (Grid Snapping)
- **Přesná mřížka a rozměry**: Každá budova zabírá přesně definovanou plochu na herní mřížce (např. 1×1, 2×2, 3×3 nebo 4×4 bloky).
- **Pevně daná velikost (Footprint)**: Každá budova má svou pevně definovanou šířku a délku v celočíselných jednotkách dlaždic ($W \times H$).
- **Uchycení na mřížku (Snap to Grid)**: Umístění budovy se automaticky přichytává k celočíselným souřadnicím dlaždic. Není možné umístit budovu „mezi“ bloky.
- **Výchozí izometrická orientace (45°)**: Všechny budovy jsou výchozím způsobem vykreslovány i kolizně orientovány pod fixním úhlem 45 stupňů v souladu s celou herní mapou. Základna každé budovy na mřížce tvoří izometrický kosočtverec/polygon.
- **Stavební okruh**: Stavba je povolena pouze v okruhu **100 bloků** od královského hradu (Donjonu).
- **Kolize a terén**: 
  - Žádné dvě budovy se nesmí překrývat.
  - Dlaždice pod budovou musí být volné (přírodní zdroje jako stromy či kameny se při stavbě vyčistí, nebo je stavba přímo vyžaduje jako kamenolom).

---

## Seznam a detailní popis budov

### 1. Královský hrad / Donjon
- **Velikost na mřížce**: 3×3 bloky
<!-- Vzhled, funkce, výroba jednotek, kapacita -->

### 2. Kasárna
- **Velikost na mřížce**: 2×2 bloky
<!-- Vzhled, výcvik jednotek, zbrojnice -->

### 3. Dřevorubec
- **Velikost na mřížce**: 1×1 bloky
<!-- Vzhled, těžba, animace pracovníků -->

### 4. Kamenolom
- **Velikost na mřížce**: 3×3 bloky
<!-- Vzhled, umístění na skále, těžba pískovce -->

### 5. Jabloňový sad
- **Velikost na mřížce**: 4×4 bloky
<!-- Vzhled, zavlažování, sklizeň jídla -->

---

### Další plánované budovy
<!-- Např. Hradby (1×1), Strážní věže (1×1 nebo 2×2), Sýpka (3×3), Zbrojnice (2×2), Tržiště (3×3)... -->
