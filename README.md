# Breath

PWA minimale per esercizi di respirazione guidata, con pallino animato e beep alle transizioni. Cinque schemi disponibili (4-8 default, 4-7-8, Box, Coherent 5-5, Coherent 6-6) selezionabili dal burger menu.

## Installa sul telefono

1. Apri **https://iyelllove.github.io/breath4-8/** in Chrome (Android) o Safari (iOS).
2. Menu del browser → **Aggiungi a schermata Home**.
3. Apri dall'icona: parte fullscreen come un'app vera.
4. Una volta installata funziona offline.

## Uso

- Tocca il **burger** in alto a sinistra per scegliere lo schema (la scelta resta tra le sessioni).
- Tocca **Start** per avviare il ciclo. **Stop** per fermare.
- Tono acuto = inspira. Tono grave = espira. Silenzio durante hold/pausa.
- Lo schermo non si spegne durante la sessione (Wake Lock API).

### Schemi
| Schema | Tempi | Per cosa |
|---|---|---|
| **4-8** (default) | 4s in · 8s out | Rilassante |
| **4-7-8** | 4s in · 7s hold · 8s out | Anti-ansia, sonno (Andrew Weil) |
| **Box** | 4s in · 4s hold · 4s out · 4s hold | Focus, stress (Navy SEAL) |
| **Coherent 5-5** | 5s in · 5s out | Equilibrio HRV |
| **Coherent 6-6** | 6s in · 6s out | Più rilassato |

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

## Documentazione

- **`CLAUDE.md`** — convenzioni di progetto, ricetta per aggiungere un nuovo preset, contratto stabile di `localStorage`.
- **`docs/ARCHITECTURE.md`** — decisioni tecniche, flusso dati, perché vanilla, gestione service worker / audio / wake lock.
- **`docs/TESTING.md`** — strategia di test, cosa copre ognuno dei 16 test, limiti noti, pattern riusabili.
- **`CHANGELOG.md`** — log delle release allineato alla versione di cache del service worker.
