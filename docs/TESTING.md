# Testing

Strategia di test del progetto. Per il flusso di esecuzione e i comandi vedi `README.md`; qui c'è il **cosa testiamo, come, e dove sono i buchi**.

## Strategia a due livelli

Due suite separate, lanciabili indipendentemente:

| Livello | Tool | Tempo | Cosa cattura |
|---|---|---|---|
| **Smoke** | bash + curl + grep | ~1 s | Risposta HTTP/MIME, header `no-cache` su `sw.js`, marker chiave nei sorgenti, JSON validità manifest, precache coerente. Catch della maggior parte delle rotture da refactor o config nginx. |
| **E2E** | Playwright Chromium headless | ~40 s | Comportamento runtime reale: SW si registra, audio context viene creato, beep con frequenze attese, timing del ciclo, persistenza localStorage, edge case (storage indisponibile). |

I due livelli sono complementari: lo smoke gira anche in 1 secondo (utile come pre-commit hook), Playwright è lento ma cattura il comportamento del JS in un browser vero.

Entrambi girano automaticamente in CI tramite `.github/workflows/test.yml`.

## Suite smoke (`tests/smoke.sh`)

Ogni assertion ha un fail message che spiega **perché** rompe (es. "non bumpare la versione = telefoni bloccati su versione vecchia"). Macro-aree:

1. **HTTP & MIME** — 7 endpoint, status 200, content-type atteso. Cattura nginx misconfigurato o file rinominati.
2. **`sw.js` no-cache** — il browser non deve cachare il SW, altrimenti gli update non arrivano sui telefoni installati.
3. **Marker nei sorgenti** — grep di stringhe che, se sparissero, indicherebbero un refactor pericoloso:
   - Costante `CACHE = 'breath-v...'` in `sw.js`
   - Fasi `INSPIRA` / `ESPIRA` in `app.js`
   - Durate `durMs: 4000` / `durMs: 8000` (lockano il default 4-8)
   - `navigator.serviceWorker.register` in `app.js`
   - Tutti i 5 preset key (`'4-8'`, `'4-7-8'`, `'box'`, `'coh-5'`, `'coh-6'`)
   - `DEFAULT_PRESET = '4-8'`
   - `id="burger"` e `id="drawer"` in `index.html`
4. **Manifest sano per GitHub Pages subfolder** — `start_url` e `scope` non assoluti (un `/` davanti romperebbe la versione `/breath4-8/`).
5. **Precache coerente** — ogni file referenziato in `sw.js` deve esistere su disco. Cattura il classico "ho rinominato il file ma non aggiornato la lista".

## Suite Playwright (`tests/e2e/breath.spec.js`)

16 test organizzati in 3 describe block.

### `Breath PWA` (7 test) — core funzionale

1. Pagina carica senza errori console critici.
2. Manifest raggiungibile, JSON valido, icone effettivamente reachable.
3. Service worker si registra entro 10 s.
4. `sw.js` servito con `Cache-Control` contenente `no-cache`.
5. Start → fase INSPIRA, `AudioContext` creato, primo beep emesso a 660 Hz, pallino a `--scale: 1.0`.
6. Dopo 12 s un ciclo completo: contatore = 1, beep emessi includono sia 660 (inspira) che 330 (espira).
7. Stop ferma il loop, resetta UI (label "PRONTO", bottone "Start", contatore intatto a 0).

### `Preset picker (burger menu)` (6 test) — feature drawer

1. Burger apre il drawer, 5 preset visibili, `4-8` ha `aria-current="true"`.
2. Chiusura via X funziona, `aria-hidden` torna a `true`.
3. Selezione **4-7-8** → hint aggiornato, ciclo ha 3 fasi `INSPIRA → TRATTIENI → ESPIRA`, frequenze emesse sono solo 660 e 330 (nessun beep durante TRATTIENI).
4. Selezione **Box** → hint aggiornato, ciclo ha 4 fasi `INSPIRA → TRATTIENI → ESPIRA → PAUSA`.
5. Switch durante una sessione attiva → la sessione si ferma e UI torna a "PRONTO" / "Start".
6. Scelta persiste tra reload (localStorage scrittura/lettura nel flusso reale).

### `localStorage edge cases` (3 test) — defensive

1. **Contratto chiave** — dopo una selezione, `localStorage.getItem('breath.preset')` restituisce esattamente il key atteso. Locca il contratto: rinominare la chiave senza migration romperebbe questo test.
2. **Valore non valido** — pre-popola `localStorage['breath.preset']` con un key inesistente. L'app deve cadere sul default `4-8` senza errori. Copre lo scenario "ho rimosso un preset in una release futura, gli utenti che l'avevano salvato devono ricevere il default".
3. **Storage indisponibile** — mocka `Storage.prototype.getItem` e `.setItem` per lanciare. L'app deve partire col default, lo switch dei preset deve continuare a funzionare in-memory, una sessione deve poter partire. Nessun pageerror non gestito. Copre Safari iOS private mode, quota piena, storage disabilitato.

## Pattern di test riutilizzabili

### AudioContext spy

Per verificare che i beep partano davvero (non solo che il codice "sembri eseguirlo"), iniettiamo prima del caricamento della pagina uno `SpyCtx` che incrementa contatori e cattura le frequenze:

```js
async function instrumentAudio(page) {
  await page.addInitScript(() => {
    const audio = { contexts: 0, beeps: 0, frequencies: [] };
    window.__audio = audio;
    const RealCtx = window.AudioContext || window.webkitAudioContext;
    class SpyCtx extends RealCtx {
      constructor() { super(); audio.contexts += 1; }
      createOscillator() {
        const osc = super.createOscillator();
        const origStart = osc.start.bind(osc);
        osc.start = function (when) {
          audio.beeps += 1;
          audio.frequencies.push(osc.frequency.value);
          return origStart(when);
        };
        return osc;
      }
    }
    window.AudioContext = SpyCtx;
    window.webkitAudioContext = SpyCtx;
  });
}
```

Poi nel test: `const audio = await page.evaluate(() => window.__audio)` e si fa assert su `audio.beeps`, `audio.frequencies`.

### Console spy

```js
function attachConsoleSpy(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}
```

Filtriamo warning innocui (es. `wakeLock` non disponibile in headless) con un regex prima dell'assert finale.

### Storage failure simulation

```js
await context.addInitScript(() => {
  const blow = () => { throw new Error('Storage disabled'); };
  Object.defineProperty(Storage.prototype, 'getItem', { value: blow, configurable: true });
  Object.defineProperty(Storage.prototype, 'setItem', { value: blow, configurable: true });
});
```

Da usare **solo** in test specifici per gli edge case: nei test "normali" l'override del prototype romperebbe il setup di Playwright stesso.

## Limitazioni note

Cose che **non** testiamo (per scelta o impossibilità tecnica):

- **Comportamento iOS Safari** — Playwright supporta WebKit ma alcune feature (wake lock, install prompt PWA) sono comunque diverse da Safari iOS reale. Test manuale su device.
- **Install prompt PWA** — Chrome lo offre quando il manifest è valido e l'app è stata visitata almeno 2 volte. Non automatizzabile in modo affidabile.
- **Wake Lock effettivo** — l'API è callable in headless (lo testiamo implicitamente: nessun crash), ma "lo schermo non si spegne" non è osservabile da Playwright. Solo manuale.
- **Audio percepito** — verifichiamo che gli oscillator partano con le frequenze attese; non possiamo verificare che il suono esca davvero dagli altoparlanti.
- **Cross-tab sync** — non rilevante per una PWA single-page.
- **Comportamento offline reale** — il SW si registra in test, ma il "scollego la rete e riapro l'app" è verificabile solo manualmente (DevTools → Offline ↔ Reload).

## Come aggiungere un test

1. **Smoke**: aggiungi una nuova `pass` / `fail` in `tests/smoke.sh`. Spiega *perché* fallirebbe nel messaggio di errore.
2. **E2E**: aggiungi un `test('descrizione', async ({ page }) => { ... })` nel describe block giusto. Usa le helper esistenti (`instrumentAudio`, `attachConsoleSpy`) quando applicabile.
3. Esegui `npm test` localmente prima di committare.
4. Aggiungi una riga al `CHANGELOG.md` se il test copre un nuovo edge case di rilievo.
