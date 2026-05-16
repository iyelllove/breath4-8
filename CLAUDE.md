# Breath — PWA di respirazione 4/8

App PWA installabile (HTML/CSS/JS vanilla, niente framework, niente build step).
Ciclo: 4s inspira / 8s espira, continuo. Beep WebAudio + pallino animato.

## Stack
- Vanilla JS + CSS inline (zero dipendenze, zero build)
- Service worker per offline (cache `breath-v<N>` — incrementare ad ogni release in `sw.js`)
- `nginx:alpine` in Docker per dev locale
- Hosting produzione: GitHub Pages su https://github.com/iyelllove/breath4-8

## Comandi
- `docker compose up` → http://localhost:8000
- `git push` → auto-deploy su https://iyelllove.github.io/breath4-8/

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

## Note tecniche
- `AudioContext` va creato dentro un user gesture (la policy autoplay mobile blocca il suono altrimenti). Lo creiamo nel handler del bottone Start.
- `wakeLock` viene rilasciato quando l'app va in background; lo riacquisiamo su `visibilitychange`.
- Su Android in LAN HTTP, il service worker NON si registra (richiede HTTPS o `localhost`). Per test offline reali usare GitHub Pages.
