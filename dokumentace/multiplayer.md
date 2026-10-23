# Multiplayer a síťová architektura

## Koncept
Multiplayer je určen pro až 4 hráče na jednom serveru. Hráč je automaticky přiřazen na některý dostupný server.

## Síťový model a synchronizace
- **Architektura**: autoritativní server. Server je jediný zdroj pravdy o stavu hry, klienti posílají jen příkazy (pohyb, stavba) a vykreslují stav.
- **Komunikace**: WebSockets, obousměrné spojení klient–server pro všechny herní zprávy.
- **Herní ticky**: server simuluje hru pevným krokem 20 ticků za sekundu. Klienti stav interpolují mezi ticky, aby pohyb byl plynulý.
- **Validace**: server ověřuje každý příkaz (dosah, peníze, volné dlaždice) a neplatný příkaz odmítne.
- **Synchronizace stavu**: po ticku se posílají jen změny. Při připojení nebo znovupřipojení dostane klient celý snímek stavu.

## Lobby a párování hráčů
- Každý hráč má svůj nick.
- Na jednom serveru je až 4 hráči.
- **Barvy**: každému hráči se automaticky přidělí barva podle pořadí připojení.
- **Týmy**: nejsou, každý hraje sám za sebe.
- **Pozice**: každý hráč obsadí jednu ze 4 startovních pozic mapy. Multiplayer nemá boty, všechny pozice patří hráčům.
- **Mlha války**: výchozí vypnuta. Když je zapnuta, platí pro každého hráče zvlášť. Hráči nesdílí viditelnost ani informace o cizích jednotkách.
- **Mapa a kapitál**: server vybere náhodnou mapu z dostupných a startovní kapitál Střední. Hráči je nemohou měnit.
- **Start hry**: hra začne 20 s poté, co jsou v lobby aspoň 2 hráči. Hráči, kteří se připojí během odpočtu, se přidají.
- **Připojení do rozehrané hry**: není možné. Nový hráč čeká v lobby na další start.

## Řešení odpojení a latence
- **Detekce**: heartbeat každé 2 s. Bez odpovědi 10 s se hráč považuje za odpojeného.
- **Znovupřipojení**: klient se vrací pomocí tokenu uloženého v prohlížeči. Má 120 s na návrat do rozehrané hry.
- **Během výpadku**: jednotky a budovy odpojeného hráče zůstávají na mapě, ale nereagují na příkazy. Hra pokračuje.
- **Po vypršení limitu**: hráč je z hry vyřazen a jeho majetek zůstává na mapě jako neutrální.
- **Latence**: příkazy se zpracují na nejbližším ticku serveru. Klient zobrazí náhled akce okamžitě, a pokud se výsledek od serveru liší, stav se opraví.

## Konec hry
- **Vítězství**: hra končí, když zbývá jediný hráč s hradem. Server zobrazí výsledky (čas, zničené budovy, počet jednotek).
- **Nový start**: po 30 s se všichni hráči vrátí do lobby a server spustí novou hru.
- **Odchod během hry**: hráč, který odejde dobrovolně, prohrává okamžitě.
