# Breath — PWA di respirazione

App PWA installabile (HTML/CSS/JS vanilla, niente framework, niente build step).
Beep WebAudio + pallino animato. Default: 4s inspira / 8s espira (modificabile dal burger menu).

## Schemi supportati (`PRESETS` in `app.js`)
- `4-8` (default) — rilassante, 2 fasi
- `4-7-8` — Andrew Weil, anti-ansia/sonno, 3 fasi (inspira/trattieni/espira)
- `box` — Navy SEAL, 4 fasi simmetriche (inspira/trattieni/espira/pausa)
- `coh-5` — Coherent breathing, ~6 respiri/min
- `coh-6` — Coherent breathing più rilassato, 5 respiri/min

Le fasi di hold/pausa hanno `freq: 0` → silenzio (il beep arriva solo all'inizio delle fasi attive). Il pallino mantiene la posizione corrente.

### Contratto stabile — localStorage

La chiave **`breath.preset`** contiene il key del preset selezionato (`'4-8'`, `'4-7-8'`, `'box'`, `'coh-5'`, `'coh-6'`). **Non rinominare la chiave senza una migration**: utenti con la vecchia chiave perderebbero la preferenza in silenzio. Test che la lockano: `tests/e2e/breath.spec.js` → describe `localStorage edge cases`.

## Stack
- **Runtime:** vanilla JS + CSS inline, **zero dipendenze a runtime**, zero build
- Service worker per offline (cache `breath-v<N>` — incrementare ad ogni release in `sw.js`)
- `nginx:alpine` in Docker per dev locale
- Hosting produzione: GitHub Pages su https://github.com/iyelllove/breath4-8
- **Test (dev-only):** Playwright + bash smoke. Le devDeps in `package.json` non finiscono dentro l'immagine Docker (escluse via `.dockerignore`)

## Comandi
- `docker compose up` → http://localhost:8000
- `npm test` → smoke + E2E (richiede container attivo o lo avvia via Playwright `webServer`)
- `npm run smoke` → solo smoke (curl + grep sui sorgenti, ~1s)
- `npm run test:e2e` → solo Playwright headless Chromium
- `git push` → auto-deploy su https://iyelllove.github.io/breath4-8/ + esecuzione CI (`.github/workflows/test.yml`)

## Convenzioni
- Niente framework, niente bundler, niente npm a runtime. Restare vanilla.
- **Bumpare la cache** del service worker ad ogni modifica di file statici (attualmente `breath-v2` in `sw.js`). Senza bump i telefoni installati restano sulla versione vecchia.
- Path tutti relativi (`./`, `manifest.webmanifest`, `sw.js`, ...) — l'app vive in `/breath4-8/` non alla root del dominio.
- Niente Gina workflow su questo repo.
- Audio: oscillatori WebAudio sintetizzati al volo, niente file audio.
- Tema scuro, evitare elementi che disturbano (animazioni veloci, colori saturi).

## Come aggiungere un nuovo preset

1. Aggiungi una entry in `PRESETS` dentro `app.js` con `label`, `desc`, `tempo` e l'array `phases` (ogni fase: `name`, `durMs`, `scale`, `freq` — usa `0` per le fasi di hold).
2. Aggiungi il key alla lista del loop in `tests/smoke.sh` (la riga `for key in "'4-8'" ... ; do`).
3. Bumpa `CACHE` in `sw.js` (`breath-v2` → `breath-v3`) altrimenti i telefoni installati non vedono il nuovo preset.
4. Se il preset ha fasi nuove (es. un nome di fase mai usato), aggiungi un test e2e che verifica la sequenza completa, sul modello di `selezione Box: 4 fasi inclusa PAUSA` in `tests/e2e/breath.spec.js`.
5. Aggiorna la tabella in `README.md` e la lista in questo file.
6. Aggiungi voce al `CHANGELOG.md`.

## File chiave
- `index.html` — markup + CSS inline (tutta la presentazione qui)
- `app.js` — stato + loop fasi + beep + wake lock + registrazione SW
- `sw.js` — cache-first, costante `CACHE` da bumpare
- `manifest.webmanifest` — PWA manifest, path relativi
- `nginx.conf` — MIME corretto per `.webmanifest`, no-cache su `sw.js`
- `tests/smoke.sh` — assertion HTTP + grep su sorgenti (versione SW, path relativi, MIME, presenza dei 5 preset)
- `tests/e2e/breath.spec.js` — Playwright: 16 test (PWA core, preset picker, localStorage edge cases). Dettagli in `docs/TESTING.md`.
- `.github/workflows/test.yml` — CI: builda container, smoke + E2E ad ogni push/PR. **NOTA:** attualmente untracked in locale, va pushato con un PAT che abbia scope `workflow`.
- `docs/ARCHITECTURE.md` — decisioni tecniche, flusso dati, motivazioni dei tradeoff
- `docs/TESTING.md` — strategia di test, cosa copre ognuno, limitazioni note
- `CHANGELOG.md` — release log per cambi user-visible

## Note tecniche
- `AudioContext` va creato dentro un user gesture (la policy autoplay mobile blocca il suono altrimenti). Lo creiamo nel handler del bottone Start.
- `wakeLock` viene rilasciato quando l'app va in background; lo riacquisiamo su `visibilitychange`.
- Su Android in LAN HTTP, il service worker NON si registra (richiede HTTPS o `localhost`). Per test offline reali usare GitHub Pages.
