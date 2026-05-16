'use strict';

const PHASES = [
  { name: 'INSPIRA', durMs: 4000, scale: 1.0, freq: 660 },
  { name: 'ESPIRA', durMs: 8000, scale: 0.35, freq: 330 },
];

const els = {
  ball: document.getElementById('ball'),
  phase: document.getElementById('phase'),
  cycles: document.getElementById('cycles'),
  toggle: document.getElementById('toggle'),
};

const state = {
  running: false,
  phaseIdx: 0,
  cycles: 0,
  timeoutId: null,
  audioCtx: null,
  wakeLock: null,
};

function setBall(scale, durMs) {
  els.ball.style.setProperty('--phase-dur', durMs + 'ms');
  els.ball.style.setProperty('--scale', scale);
}

function setPhaseLabel(name) {
  els.phase.textContent = name;
  els.phase.classList.add('active');
}

function beep(freq) {
  if (!state.audioCtx) return;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Envelope: attack 10ms, sustain, release 110ms -- evita il click
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
  const phase = PHASES[idx];
  setPhaseLabel(phase.name);
  setBall(phase.scale, phase.durMs);
  beep(phase.freq);
  state.timeoutId = setTimeout(() => {
    const nextIdx = (idx + 1) % PHASES.length;
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
    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
    });
  } catch (err) {
    // Permesso negato o non disponibile: si prosegue lo stesso.
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
  // AudioContext deve nascere da user gesture (policy autoplay mobile).
  if (!state.audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new Ctx();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
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

// Stato iniziale del pallino
setBall(0.35, 0);

// Registrazione service worker (path relativo per GitHub Pages subfolder)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('SW registration failed:', err && err.message);
    });
  });
}
