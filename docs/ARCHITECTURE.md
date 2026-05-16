# Architettura

Documento di riferimento per chi modifica il progetto. Per il "cosa" leggi `CLAUDE.md`; qui spiego il "perché" e il "come funziona dentro".

## Sintesi

Una **PWA statica** che gira interamente nel browser: nessun backend, nessun build step, nessun framework. Cinque file sorgente (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `nginx.conf`) servono da `nginx:alpine` in Docker per lo sviluppo e da GitHub Pages in produzione.

```
┌──────────────────────────────────────────────────────────┐
│ Browser                                                  │
│                                                          │
│   index.html ─┬─ inline CSS (tema scuro, animazioni)     │
│               └─ <script src="app.js">                   │
│                                                          │
│   app.js                                                 │
│     ├─ PRESETS          (5 schemi di respirazione)       │
│     ├─ state            (presetKey, running, audioCtx…)  │
│     ├─ runPhase()       (loop fasi via setTimeout)       │
│     ├─ beep()           (WebAudio: osc + gain envelope)  │
│     ├─ wakeLock         (impedisce screen off)           │
│     └─ drawer + LS      (selezione preset persistita)    │
│                                                          │
│   sw.js                 (cache-first, breath-v2)         │
└──────────────────────────────────────────────────────────┘
                ▲                              ▲
                │ HTTPS                        │ install:
                │                              │ "Aggiungi a Home"
       GitHub Pages prod          ◄────────────┘
       https://iyelllove.github.io/breath4-8/
```

## Decisioni tecniche e perché

### Vanilla, zero dipendenze a runtime

Per un'app di questa dimensione (~300 righe di JS, una sola view) un framework introdurrebbe più complessità del problema che risolve. Niente bundler significa:
- Aggiornamenti = `git push`. Niente "build broken" in CI.
- Tempo di partenza istantaneo sul telefono (nessun JS framework da scaricare).
- Service worker semplice: cachi i file così come sono.
- Onboarding zero per chi legge il codice tra 6 mesi.

Le **devDeps** (Playwright) sono escluse dall'immagine Docker via `.dockerignore` e ignorate da git via `.gitignore`. Il runtime resta veramente zero-dep.

### Service worker: cache-first, versione manuale

Strategia in `sw.js`:
- **Install:** precache della "app shell" (HTML, JS, manifest, icone). Lista esplicita in `ASSETS`.
- **Activate:** elimina tutte le cache con un nome diverso dalla corrente.
- **Fetch:** restituisce dalla cache se presente, altrimenti fetch + cache opportunistico.

Versione: **`CACHE = 'breath-v<N>'`**. Va bumpata a mano ad ogni modifica di file statici, altrimenti i telefoni installati restano sulla versione precedente in eterno (l'attivazione di una nuova cache è triggata dal nome diverso). Lo smoke test verifica che la costante esista; non può verificare che sia stata **incrementata** rispetto alla precedente — quello tocca a chi committa.

Trade-off accettato: gli update richiedono **due aperture online** sul telefono (la prima scarica il nuovo SW, la seconda lo attiva). È la conseguenza del modello SW di registrazione + activation, non un bug.

### Path tutti relativi

L'app vive in `/breath4-8/` su GitHub Pages, non alla root del dominio. Path assoluti come `/app.js` o `/sw.js` rompono perché punterebbero a `https://iyelllove.github.io/app.js` (404). Usiamo sempre:
- `<script src="app.js">` (relativo)
- `navigator.serviceWorker.register('sw.js')` (relativo)
- `manifest.webmanifest`: `start_url: "./"`, `scope: "./"`
- Service worker: `ASSETS` con voci come `'./'`, `'index.html'`, `'app.js'`

Lo smoke test lockera`start_url` e `scope` su valori non-assoluti.

### Audio sintetizzato a runtime

`beep(freq)` crea un `OscillatorNode` con envelope (`attack 10 ms → sustain 40 ms → release 110 ms`) per evitare il "click" dei segnali a onda quadra. Vantaggi:
- Nessun file audio da caricare (cache più piccola, offline gratis).
- Cambiare i toni = cambiare una costante (`FREQ_INHALE`, `FREQ_EXHALE`).
- Niente DRM/copyright.

**Limite noto:** `AudioContext` su mobile **deve** essere creato dentro un user gesture (policy autoplay). Lo creiamo nel click handler di **Start**, non a load. Questo è il motivo per cui non si può "partire automaticamente" l'esercizio al boot.

### Wake Lock

`navigator.wakeLock.request('screen')` impedisce lo spegnimento dello schermo durante la sessione. Trattato come **best effort**:
- Disponibile solo su Chrome Android (e desktop). iOS Safari non lo supporta — viene ignorato senza errore.
- Viene **rilasciato dal sistema** quando l'app va in background. Lo riacquisiamo su `visibilitychange` quando torna visibile.
- Se il permesso è negato, l'app prosegue senza wake lock (warn in console).

### State management

Un singolo oggetto `state` con tutto dentro: `running`, `presetKey`, `phaseIdx`, `cycles`, `timeoutId`, `audioCtx`, `wakeLock`. Niente reattività automatica: le mutazioni di UI sono esplicite (`els.cycles.textContent = ...`).

Per un'app a una sola view è sufficiente. Quando/se la complessità crescerà, il punto naturale di rottura sarà introdurre uno store osservabile o passare a un mini-framework (preact, lit).

### Loop fasi via `setTimeout` ricorsivo

`runPhase(idx)` schedula sé stesso con `setTimeout(durMs)` per la fase successiva. Funziona bene quando l'app è visibile. **Limite noto**: in background Android throttla `setTimeout` a ~1 Hz e il timing va a farsi benedire. Mitigazioni possibili (non implementate, sarebbero over-engineering per ora):
- Scheduling con `audioCtx.currentTime + offset` su oscillatori pre-istanziati (Web Audio ha un clock proprio non throttled).
- Usare `requestAnimationFrame` insieme a un orologio interno (`performance.now()`) per ricalibrare al rientro.

Per l'uso previsto (sessione a schermo acceso + wake lock) non è un problema reale.

### Persistenza preset in localStorage

Chiave **`breath.preset`** (contratto stabile, vedi `CLAUDE.md`). Tutto è racchiuso in `try/catch` perché `localStorage` può lanciare in:
- Safari iOS private mode (`setItem` lancia `QuotaExceededError`).
- Quota piena.
- Storage disabilitato dall'utente.

Se la lettura fallisce → default `'4-8'`. Se la scrittura fallisce → l'app continua a funzionare in-memory per la sessione corrente, l'utente perde solo la persistenza. Sia il fallback che il graceful degradation sono coperti dai test in `tests/e2e/breath.spec.js` → describe `localStorage edge cases`.

## Deploy e CI

- **Locale:** `docker compose up` → `nginx:alpine` con bind-mount su tutti i file statici (modifiche live, basta refresh).
- **Produzione:** GitHub Pages serve la branch `main`. Niente CDN custom, niente build step.
- **CI:** `.github/workflows/test.yml` builda il container e gira smoke + Playwright su ogni push/PR. Il workflow file **non è ancora committato** sul remote — richiede un PAT con scope `workflow` per essere pushato (vedi `CLAUDE.md`).

## Stato attuale (snapshot)

- Cache SW: `breath-v2`
- Test totali: 16 (smoke + 16 Playwright tests, vedi `docs/TESTING.md`)
- Release pubblicata: v2 (burger menu + 5 preset)
- Branch: `main`, repo `iyelllove/breath4-8`
