# Breath — PWA di respirazione 4/8

App PWA installabile (HTML/CSS/JS vanilla, niente framework, niente build step).
Ciclo: 4s inspira / 8s espira, continuo. Beep WebAudio + pallino animato.

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
- Niente framework, niente bundler, niente npm. Restare vanilla.
- Bumpare la cache del service worker (`breath-v1` → `breath-v2` in `sw.js`) ad ogni modifica di file statici, altrimenti i telefoni installati non vedono l'update.
- Path tutti relativi (`./`, `manifest.webmanifest`, `sw.js`, ...) — l'app vive in `/breath4-8/` non alla root del dominio.
- Niente Gina workflow su questo repo.
- Audio: oscillatori WebAudio sintetizzati al volo, niente file audio.
- Tema scuro, evitare elementi che disturbano (animazioni veloci, colori saturi).

## File chiave
- `index.html` — markup + CSS inline (tutta la presentazione qui)
- `app.js` — stato + loop fasi + beep + wake lock + registrazione SW
- `sw.js` — cache-first, costante `CACHE` da bumpare
- `manifest.webmanifest` — PWA manifest, path relativi
- `nginx.conf` — MIME corretto per `.webmanifest`, no-cache su `sw.js`
- `tests/smoke.sh` — assertion HTTP + grep su sorgenti (versione SW, path relativi, MIME)
- `tests/e2e/breath.spec.js` — Playwright: SW registrato, ciclo completo a 12s, beep emessi, no errori console
- `.github/workflows/test.yml` — CI: builda container, smoke + E2E ad ogni push/PR

## Note tecniche
- `AudioContext` va creato dentro un user gesture (la policy autoplay mobile blocca il suono altrimenti). Lo creiamo nel handler del bottone Start.
- `wakeLock` viene rilasciato quando l'app va in background; lo riacquisiamo su `visibilitychange`.
- Su Android in LAN HTTP, il service worker NON si registra (richiede HTTPS o `localhost`). Per test offline reali usare GitHub Pages.
