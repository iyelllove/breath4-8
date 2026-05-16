'use strict';

// Frequenze beep: alto su inspira, basso su espira, silenzio (0) durante hold.
const FREQ_INHALE = 660;
const FREQ_EXHALE = 330;

const PRESETS = {
  '4-8': {
    label: '4-8',
    desc: 'Inspira 4 · espira 8 (rilassante, default)',
    tempo: '4s in · 8s out',
    phases: [
      { name: 'INSPIRA', durMs: 4000, scale: 1.0, freq: FREQ_INHALE },
      { name: 'ESPIRA',  durMs: 8000, scale: 0.35, freq: FREQ_EXHALE },
    ],
  },
  '4-7-8': {
    label: '4-7-8',
    desc: 'Anti-ansia · sonno (Andrew Weil)',
    tempo: '4s in · 7s hold · 8s out',
    phases: [
      { name: 'INSPIRA',   durMs: 4000, scale: 1.0,  freq: FREQ_INHALE },
      { name: 'TRATTIENI', durMs: 7000, scale: 1.0,  freq: 0 },
      { name: 'ESPIRA',    durMs: 8000, scale: 0.35, freq: FREQ_EXHALE },
    ],
  },
  'box': {
    label: 'Box (4-4-4-4)',
    desc: 'Focus · stress (Navy SEAL)',
    tempo: '4s in · 4s hold · 4s out · 4s hold',
    phases: [
      { name: 'INSPIRA',   durMs: 4000, scale: 1.0,  freq: FREQ_INHALE },
      { name: 'TRATTIENI', durMs: 4000, scale: 1.0,  freq: 0 },
      { name: 'ESPIRA',    durMs: 4000, scale: 0.35, freq: FREQ_EXHALE },
      { name: 'PAUSA',     durMs: 4000, scale: 0.35, freq: 0 },
    ],
  },
  'coh-5': {
    label: 'Coherent 5-5',
    desc: 'Equilibrio HRV · ~6 respiri/min',
    tempo: '5s in · 5s out',
    phases: [
      { name: 'INSPIRA', durMs: 5000, scale: 1.0,  freq: FREQ_INHALE },
      { name: 'ESPIRA',  durMs: 5000, scale: 0.35, freq: FREQ_EXHALE },
    ],
  },
  'coh-6': {
    label: 'Coherent 6-6',
    desc: 'Più rilassato · 5 respiri/min',
    tempo: '6s in · 6s out',
    phases: [
      { name: 'INSPIRA', durMs: 6000, scale: 1.0,  freq: FREQ_INHALE },
      { name: 'ESPIRA',  durMs: 6000, scale: 0.35, freq: FREQ_EXHALE },
    ],
  },
};

const DEFAULT_PRESET = '4-8';
const STORAGE_KEY = 'breath.preset';

const els = {
  ball: document.getElementById('ball'),
  phase: document.getElementById('phase'),
  cycles: document.getElementById('cycles'),
  toggle: document.getElementById('toggle'),
  hint: document.getElementById('hint'),
  burger: document.getElementById('burger'),
  drawer: document.getElementById('drawer'),
  drawerClose: document.getElementById('drawer-close'),
  presets: document.getElementById('presets'),
};

const state = {
  running: false,
  presetKey: loadPreset(),
  phaseIdx: 0,
  cycles: 0,
  timeoutId: null,
  audioCtx: null,
  wakeLock: null,
};

function loadPreset() {
  try {
    const k = localStorage.getItem(STORAGE_KEY);
    if (k && PRESETS[k]) return k;
  } catch (_) { /* private mode etc. */ }
  return DEFAULT_PRESET;
}

function savePreset(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch (_) {}
}

function currentPreset() { return PRESETS[state.presetKey]; }

function setBall(scale, durMs) {
  els.ball.style.setProperty('--phase-dur', durMs + 'ms');
  els.ball.style.setProperty('--scale', scale);
}

function setPhaseLabel(name) {
  els.phase.textContent = name;
  els.phase.classList.add('active');
}

function beep(freq) {
  if (!state.audioCtx || !freq) return;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
  gain.gain.setValueAtTime(0.25, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function runPhase(idx) {
  if (!state.running) return;
  const phases = currentPreset().phases;
  const phase = phases[idx];
  setPhaseLabel(phase.name);
  setBall(phase.scale, phase.durMs);
  beep(phase.freq);
  state.timeoutId = setTimeout(() => {
    const nextIdx = (idx + 1) % phases.length;
    if (nextIdx === 0) {
      state.cycles += 1;
      els.cycles.textContent = state.cycles;
    }
    state.phaseIdx = nextIdx;
    runPhase(nextIdx);
  }, phase.durMs);
}

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (err) {
    console.warn('Wake lock non disponibile:', err && err.message);
  }
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.running && !state.wakeLock) {
    acquireWakeLock();
  }
});

function start() {
  if (state.running) return;
  if (!state.audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new Ctx();
  }
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  state.running = true;
  state.phaseIdx = 0;
  state.cycles = 0;
  els.cycles.textContent = '0';
  els.toggle.textContent = 'Stop';
  els.toggle.classList.add('running');
  acquireWakeLock();
  runPhase(0);
}

function stop() {
  state.running = false;
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
  els.toggle.textContent = 'Start';
  els.toggle.classList.remove('running');
  els.phase.textContent = 'PRONTO';
  els.phase.classList.remove('active');
  setBall(0.35, 600);
  releaseWakeLock();
}

els.toggle.addEventListener('click', () => {
  state.running ? stop() : start();
});

// ── Drawer / preset picker ─────────────────────────────

function renderPresets() {
  els.presets.innerHTML = '';
  for (const [key, p] of Object.entries(PRESETS)) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset';
    btn.setAttribute('role', 'option');
    btn.setAttribute('data-preset', key);
    if (key === state.presetKey) btn.setAttribute('aria-current', 'true');
    btn.innerHTML = `
      <div class="preset-head">
        <span class="preset-label"></span>
        <span class="preset-check" aria-hidden="true">✓</span>
      </div>
      <span class="preset-desc"></span>
      <span class="preset-tempo"></span>
    `;
    btn.querySelector('.preset-label').textContent = p.label;
    btn.querySelector('.preset-desc').textContent = p.desc;
    btn.querySelector('.preset-tempo').textContent = p.tempo;
    btn.addEventListener('click', () => selectPreset(key));
    li.appendChild(btn);
    els.presets.appendChild(li);
  }
}

function openDrawer() {
  els.drawer.classList.add('open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.burger.setAttribute('aria-expanded', 'true');
  // focus sul preset corrente per accessibilità
  const current = els.presets.querySelector('[aria-current="true"]');
  if (current) current.focus();
}

function closeDrawer() {
  els.drawer.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.burger.setAttribute('aria-expanded', 'false');
  els.burger.focus();
}

function selectPreset(key) {
  if (!PRESETS[key]) return;
  if (state.running) stop();
  state.presetKey = key;
  savePreset(key);
  updateHint();
  // aggiorna i marker aria-current
  for (const btn of els.presets.querySelectorAll('.preset')) {
    if (btn.getAttribute('data-preset') === key) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  }
  closeDrawer();
}

function updateHint() {
  els.hint.innerHTML = `<strong></strong> · `;
  els.hint.querySelector('strong').textContent = currentPreset().label;
  els.hint.append(currentPreset().tempo);
}

els.burger.addEventListener('click', openDrawer);
els.drawerClose.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.drawer.classList.contains('open')) closeDrawer();
});

renderPresets();
updateHint();
setBall(0.35, 0);

// ── Service worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('SW registration failed:', err && err.message);
    });
  });
}
