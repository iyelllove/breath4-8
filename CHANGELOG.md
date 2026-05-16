# Changelog

Tutti i cambi user-visible al progetto.
Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni allineate al `CACHE` del service worker in `sw.js` (versione cache = release).

## [Unreleased]

### Added
- Test e2e per gli edge case di `localStorage`: contratto chiave `breath.preset`, fallback su preset key invalido, app funzionante con storage indisponibile (Safari iOS private mode / quota piena). (commit `e99a34d`)

## [v2] — 2026-05-16

### Added
- Burger menu in alto a sinistra che apre un drawer fullscreen con i 5 schemi disponibili.
- Schemi: **4-8** (default, rilassante), **4-7-8** (Andrew Weil, anti-ansia/sonno), **Box 4-4-4-4** (Navy SEAL, focus), **Coherent 5-5** (HRV), **Coherent 6-6** (più rilassato).
- Fasi di hold/pausa silenziose (`freq: 0`): il beep arriva solo all'inizio di inspira ed espira.
- Persistenza della scelta in `localStorage` (chiave `breath.preset`). Reload mantiene la scelta.
- Cambio preset durante una sessione attiva: stoppa la sessione per un riavvio pulito.
- Test e2e estesi a 13 totali: drawer open/close, default selezionato, ciclo 4-7-8 con TRATTIENI, ciclo Box con 4 fasi, switch-while-running, persistenza tra reload.

### Changed
- Cache service worker bumpata a `breath-v2`. I telefoni installati ricevono l'update al prossimo apertura online.
- README e CLAUDE.md aggiornati con la tabella degli schemi e le note sui preset.

## [v1] — 2026-05-16

### Added
- PWA installabile (manifest + service worker cache-first) per esercizio di respirazione **4s inspira / 8s espira** continuo.
- Pallino centrale che cresce/decresce sincronizzato con la fase; beep WebAudio (660 Hz inspira, 330 Hz espira).
- Wake Lock API per impedire lo spegnimento dello schermo durante la sessione.
- Setup Docker (`nginx:alpine` + `docker-compose.yml`) per sviluppo locale con bind mount.
- Smoke test (`tests/smoke.sh`): assertion HTTP, MIME types, `no-cache` su `sw.js`, marker nei sorgenti, manifest sano per GitHub Pages subfolder, file di precache esistenti.
- E2E Playwright (`tests/e2e/breath.spec.js`): 7 test che coprono caricamento senza errori console, registrazione SW, ciclo completo 12 s, beep emessi con frequenze attese, Start/Stop.
- GitHub Actions workflow (`.github/workflows/test.yml`) per smoke + E2E su ogni push/PR a `main`. Pendente del primo push: richiede PAT con scope `workflow`.
- Icone PWA 192×192 e 512×512 generate da `icon.svg`.
- Deploy su GitHub Pages → `https://iyelllove.github.io/breath4-8/`.
