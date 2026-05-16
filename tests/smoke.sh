#!/usr/bin/env bash
# Smoke test: verifica che il container serva tutti gli asset con i MIME corretti
# e che i file sorgente contengano i marker chiave (versione SW, riferimenti incrociati).
# Esce con codice non-zero al primo errore.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ---- 1) HTTP smoke: status + content-type per ogni asset ----

check_http() {
  local path="$1" expected_status="$2" expected_ct="$3"
  local resp
  resp="$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "${BASE_URL}${path}")"
  local status="${resp%% *}"
  local ct="${resp#* }"
  if [[ "$status" != "$expected_status" ]]; then
    fail "GET ${path} → ${status} (atteso ${expected_status})"
  fi
  if [[ "$ct" != "$expected_ct"* ]]; then
    fail "GET ${path} content-type ${ct} (atteso ${expected_ct}*)"
  fi
  pass "GET ${path} → ${status} ${ct}"
}

echo "▶ HTTP smoke su ${BASE_URL}"
check_http "/"                       200 "text/html"
check_http "/index.html"             200 "text/html"
check_http "/app.js"                 200 "application/javascript"
check_http "/sw.js"                  200 "application/javascript"
check_http "/manifest.webmanifest"   200 "application/manifest+json"
check_http "/icon-192.png"           200 "image/png"
check_http "/icon-512.png"           200 "image/png"
check_http "/icon.svg"               200 "image/svg+xml"

# ---- 2) sw.js DEVE essere no-cache (altrimenti gli update non arrivano sui telefoni) ----

echo "▶ Header cache su sw.js"
cc="$(curl -sS -D - -o /dev/null "${BASE_URL}/sw.js" | awk -F': ' 'tolower($1)=="cache-control" { sub(/\r$/,"",$2); print $2 }')"
if [[ "$cc" != *"no-cache"* ]]; then
  fail "sw.js cache-control = '${cc}' (deve contenere 'no-cache')"
fi
pass "sw.js cache-control = ${cc}"

# ---- 3) sorgenti: marker chiave presenti (regressioni di refactor) ----

echo "▶ Marker nei sorgenti"

grep -q "CACHE = 'breath-v" "${PROJECT_ROOT}/sw.js" \
  || fail "sw.js: manca la costante CACHE = 'breath-v...' (non bumpare la versione = telefoni bloccati su versione vecchia)"
pass "sw.js: costante CACHE versione presente"

grep -q "INSPIRA" "${PROJECT_ROOT}/app.js" && grep -q "ESPIRA" "${PROJECT_ROOT}/app.js" \
  || fail "app.js: mancano i nomi fase INSPIRA/ESPIRA"
pass "app.js: fasi INSPIRA/ESPIRA presenti"

grep -q "durMs: 4000" "${PROJECT_ROOT}/app.js" && grep -q "durMs: 8000" "${PROJECT_ROOT}/app.js" \
  || fail "app.js: durate fasi cambiate (atteso 4000ms / 8000ms)"
pass "app.js: durate 4s / 8s coerenti"

grep -q 'navigator.serviceWorker.register' "${PROJECT_ROOT}/app.js" \
  || fail "app.js: SW non registrato"
pass "app.js: registrazione SW presente"

# ---- 4) Manifest: niente path assoluti (rompono GitHub Pages in sottocartella) ----

echo "▶ Manifest sano per GitHub Pages subfolder"

manifest="$(curl -sS "${BASE_URL}/manifest.webmanifest")"
echo "$manifest" | python3 -c "import json,sys; json.loads(sys.stdin.read())" \
  || fail "manifest.webmanifest: JSON non valido"
pass "manifest: JSON valido"

# start_url e scope NON devono iniziare con "/" (path assoluti rompono sotto /breath4-8/)
start_url="$(echo "$manifest" | python3 -c "import json,sys;print(json.loads(sys.stdin.read()).get('start_url',''))")"
scope="$(echo "$manifest" | python3 -c "import json,sys;print(json.loads(sys.stdin.read()).get('scope',''))")"
[[ "$start_url" != /* ]] || fail "manifest: start_url='${start_url}' è assoluto (rompe GitHub Pages subfolder, usa './')"
[[ "$scope"     != /* ]] || fail "manifest: scope='${scope}' è assoluto (rompe GitHub Pages subfolder, usa './')"
pass "manifest: start_url='${start_url}' scope='${scope}' relativi"

# Le icone referenziate dal manifest devono esistere
icons="$(echo "$manifest" | python3 -c "import json,sys;[print(i['src']) for i in json.loads(sys.stdin.read())['icons']]")"
while IFS= read -r icon; do
  [[ -n "$icon" ]] || continue
  curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/${icon}" | grep -qx 200 \
    || fail "manifest: icona ${icon} non raggiungibile"
  pass "manifest: icona ${icon} raggiungibile"
done <<< "$icons"

# ---- 5) Service worker: file precache devono esistere davvero ----

echo "▶ Service worker precache coerente"

precache_files="$(grep -oE "'[^']+'" "${PROJECT_ROOT}/sw.js" | grep -E "\.(html|js|webmanifest|png|svg)'$|^'\./'" | tr -d "'" | sort -u)"
while IFS= read -r asset; do
  [[ -n "$asset" ]] || continue
  [[ "$asset" == "./" ]] && asset="index.html"  # './' mappa su index
  if [[ ! -f "${PROJECT_ROOT}/${asset}" ]]; then
    fail "sw.js precache referenzia ${asset} ma il file non esiste"
  fi
  pass "sw.js precache: ${asset} esiste"
done <<< "$precache_files"

echo ""
echo "✅ Smoke OK"
