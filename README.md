# Breath 4/8

PWA minimale per esercizi di respirazione **4s inspira / 8s espira**, con pallino animato e beep alle transizioni.

## Installa sul telefono

1. Apri **https://iyelllove.github.io/breath4-8/** in Chrome (Android) o Safari (iOS).
2. Menu del browser → **Aggiungi a schermata Home**.
3. Apri dall'icona: parte fullscreen come un'app vera.
4. Una volta installata funziona offline.

## Uso

- Tocca **Start** per avviare il ciclo.
- Il pallino cresce in 4 secondi (inspira) e decresce in 8 secondi (espira).
- Tono acuto = inspira. Tono grave = espira.
- Tocca **Stop** per fermare.
- Lo schermo non si spegne durante la sessione (Wake Lock API).

## Dev locale

```bash
docker compose up
# → http://localhost:8000
```

Modifiche a HTML/JS/CSS sono live-reload-ready: bind mount, basta `Ctrl+R` nel browser.

## Test

```bash
npm install                # solo la prima volta (devDeps: Playwright)
npx playwright install chromium

npm run smoke              # bash + curl: status, MIME, marker sorgente (~1s)
npm run test:e2e           # Playwright headless: SW, ciclo, beep, no errori
npm test                   # smoke + e2e
```

CI: `.github/workflows/test.yml` esegue smoke + Playwright su ogni push e PR verso `main`.

## Deploy

`git push` su `main` → GitHub Pages pubblica automaticamente su https://iyelllove.github.io/breath4-8/.

**Importante:** quando cambi i file statici, bumpa la costante `CACHE` in `sw.js` (`breath-v1` → `breath-v2`) altrimenti i telefoni già installati restano sulla versione vecchia.

## Stack

Vanilla HTML/CSS/JS. Niente framework. Niente npm. Niente build.
