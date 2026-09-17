/*
 * smoke.js — app-shell smoke test (jsdom).
 *
 * The sandbox has no browser, so the player is exercised headlessly:
 * index.html is loaded with scripts enabled, the HTMLAudioElement and the
 * canvas 2D context are mocked, and the full Start / Pause / Resume /
 * Restart lifecycle is driven against the real film code.
 *
 * Verifies:
 *   - page loads with zero console errors / uncaught exceptions
 *   - all film modules are wired as browser globals
 *   - canvas backing store is sized with DPR
 *   - poster renders while idle
 *   - Start kicks off audio and animation together
 *   - the master clock is audio.currentTime (time readout follows it)
 *   - Pause freezes, Resume continues, Restart rewinds to 0
 *   - the film ends at Film.END and the end screen appears
 *
 * Run:  node tools/smoke.js        (jsdom must be resolvable)
 */
'use strict';
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

/* ---------------- controllable clock ---------------- */
let nowMs = 1000;

/* ---------------- mock 2D context ---------------- */
function makeMockCtx() {
  const noop = () => {};
  const calls = { paint: 0 };
  return new Proxy({}, {
    get(t, p) {
      if (p === '__calls') return calls;
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (p === 'createPattern') return () => ({});
      if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (p === 'fillRect') return () => { calls.paint++; };
      if (!(p in t)) t[p] = noop;
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

/* ---------------- mock Audio ---------------- */
function makeMockAudioClass() {
  const instances = [];
  class MockAudio {
    constructor(src) {
      this.src = src || '';
      this.preload = '';
      this.currentTime = 0;
      this.duration = 27.8;
      this.paused = true;
      this.ended = false;
      this.playCalls = 0;
      this.pauseCalls = 0;
      this._listeners = {};
      instances.push(this);
    }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    _fire(type) { (this._listeners[type] || []).forEach((f) => f()); }
    play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCalls++; this.paused = true; }
  }
  return { MockAudio, instances };
}

/* ---------------- rAF capture ---------------- */
let rafQueue = [];
let rafId = 0;

function main() {
  console.log('\nAlina — app shell smoke test (jsdom)');
  console.log('========================================');

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn', (...a) => { const s = a.join(' '); if (!/audio start failed/i.test(s)) errors.push('console.warn: ' + s); });

  return JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: false,
    virtualConsole: vc,
    beforeParse(window) {
      window.performance.now = () => nowMs;

      const ctxs = [];
      window.HTMLCanvasElement.prototype.getContext = function () {
        const c = makeMockCtx();
        ctxs.push(c);
        return c;
      };

      const audio = makeMockAudioClass();
      window.Audio = audio.MockAudio;
      window.__mock = { ctxs, audio: audio.instances, errors };

      rafQueue = [];
      window.requestAnimationFrame = (fn) => { rafQueue.push(fn); return ++rafId; };
      window.cancelAnimationFrame = () => { /* flushed manually */ };
    }
  }).then((dom) => new Promise((resolve, reject) => {
    dom.window.addEventListener('error', (e) => errors.push('window.onerror: ' + e.message));
    // wait for scripts to finish loading
    const t = setTimeout(() => reject(new Error('timed out waiting for page load')), 8000);
    dom.window.addEventListener('load', () => { clearTimeout(t); resolve(dom); });
    if (dom.window.document.readyState === 'complete') { clearTimeout(t); resolve(dom); }
  }));
}

function run(dom) {
  const window = dom.window;
  const document = window.document;
  const audio = window.__mock.audio[0];

  function flushFrames(n) {
    for (let i = 0; i < n; i++) {
      const q = rafQueue; rafQueue = [];
      q.forEach((fn) => fn(nowMs));
    }
  }
  function visible(el) { return el && !el.classList.contains('hidden'); }
  const $ = (id) => document.getElementById(id);
  const errors = window.__mock.errors;

  // load: all modules wired
  check('Film global present', typeof window.Film === 'object' && typeof window.Film.renderFrame === 'function');
  check('draw2d global present', typeof window.draw2d === 'object' && typeof window.draw2d.makeCanvasBackend === 'function');
  check('film duration constants sane', window.Film && Math.abs(window.Film.AUDIO_END - 23.02) < 0.01 && window.Film.END > window.Film.AUDIO_END);

  const canvas = $('canvas');
  check('canvas exists', !!canvas);
  check('canvas DPR backing store', canvas.width === 1280 * (window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1));

  check('title screen visible', visible($('title-screen')));
  check('controls hidden initially', !visible($('controls')));
  check('end screen hidden initially', !visible($('end-screen')));

  check('audio created', !!audio);
  check('audio src = audio/voiceover.m4a', audio && audio.src === 'audio/voiceover.m4a', audio && audio.src);

  // poster renders while idle
  flushFrames(2);
  const paintAfterPoster = window.__mock.ctxs[0].__calls.paint;
  check('poster frame painted while idle', paintAfterPoster > 10, 'paint calls=' + paintAfterPoster);

  // ---- START ----
  $('start-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('start plays audio (audio+animation together)', audio.playCalls >= 1);
  check('title hidden after start', !visible($('title-screen')));
  check('controls visible after start', visible($('controls')));
  check('pause button shows Pause', $('pause-label').textContent === 'Pause');
  check('time readout initialised', /0:00 \//.test($('time').textContent), $('time').textContent);

  // master clock: advance the audio, flush, readout follows
  audio.currentTime = 5.0;
  flushFrames(1);
  check('time readout follows audio.currentTime', $('time').textContent.indexOf('0:05 /') === 0, $('time').textContent);
  const p1 = window.__mock.ctxs[0].__calls.paint;
  audio.currentTime = 9.30; // impact
  flushFrames(1);
  check('impact frame rendered', window.__mock.ctxs[0].__calls.paint > p1);

  // ---- PAUSE ----
  $('pause-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('pause pauses audio', audio.paused === true && audio.pauseCalls >= 1);
  check('pause button shows Resume', $('pause-label').textContent === 'Resume');
  const p2 = window.__mock.ctxs[0].__calls.paint;
  flushFrames(3);
  check('no frames rendered while paused', window.__mock.ctxs[0].__calls.paint === p2);

  // ---- RESUME ----
  $('pause-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('resume plays audio again', audio.paused === false && audio.playCalls >= 2);
  check('pause button shows Pause again', $('pause-label').textContent === 'Pause');
  const p3 = window.__mock.ctxs[0].__calls.paint;
  flushFrames(2);
  check('frames render after resume', window.__mock.ctxs[0].__calls.paint > p3);

  audio.currentTime = 17.0;
  flushFrames(1);
  check('time readout after resume follows clock', $('time').textContent.indexOf('0:17 /') === 0, $('time').textContent);

  // ---- RESTART ----
  $('restart-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('restart rewinds audio to 0', audio.currentTime === 0, 'currentTime=' + audio.currentTime);
  check('restart plays', audio.paused === false);
  check('controls still visible after restart', visible($('controls')));
  flushFrames(1);
  check('time readout back at 0:00', $('time').textContent.indexOf('0:00 /') === 0, $('time').textContent);

  // ---- run to the end (voice ends at 23.02, film tail to 27.8) ----
  audio.currentTime = 23.0;
  audio.ended = true;
  audio._fire('ended');
  for (let i = 0; i < 50; i++) { nowMs += 200; flushFrames(1); } // tail wall-clock
  check('film ends at END', !visible($('controls')));
  check('end screen visible at the end', visible($('end-screen')));
  check('time readout shows the end', $('time').textContent.indexOf('0:27 / 0:28') === 0 || $('time').textContent.indexOf('0:28 / 0:28') === 0, $('time').textContent);

  // replay from the end screen
  $('replay-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('replay rewinds to 0', audio.currentTime === 0, 'currentTime=' + audio.currentTime);
  check('replay hides end screen', !visible($('end-screen')));
  check('replay shows controls', visible($('controls')));

  // ---- console errors ----
  check('no console errors / uncaught exceptions', errors.length === 0, (errors || []).slice(0, 3).join(' | '));

  console.log('========================================');
  if (failures === 0) { console.log('ALL CHECKS PASSED'); process.exit(0); }
  else { console.log(failures + ' CHECK(S) FAILED'); process.exit(1); }
}

main().then(run).catch((e) => { console.error('SMOKE CRASH:', e); process.exit(1); });
