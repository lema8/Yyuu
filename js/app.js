/*
 * app.js — player shell for the short.
 *
 * The audio element is the master clock: every rendered frame is a pure
 * function of audio.currentTime (no timers drive scene timing). The last
 * seconds after the voice ends (the fade to THE END) continue on the wall
 * clock, anchored to the instant the audio ended.
 *
 * Controls: Start (title), Pause/Resume, Restart.
 */
(function () {
  'use strict';

  /* ---------------- canvas ---------------- */
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  // render at native device resolution, capped at 2x for performance
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Film.W * dpr;
  canvas.height = Film.H * dpr;
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;

  var backend = draw2d.makeCanvasBackend(ctx);
  var END = Film.END, AUDIO_END = Film.AUDIO_END;

  /* ---------------- ui refs ---------------- */
  var titleScreen = document.getElementById('title-screen');
  var endScreen = document.getElementById('end-screen');
  var controls = document.getElementById('controls');
  var startBtn = document.getElementById('start-btn');
  var replayBtn = document.getElementById('replay-btn');
  var pauseBtn = document.getElementById('pause-btn');
  var restartBtn = document.getElementById('restart-btn');
  var pauseIcon = document.getElementById('pause-icon');
  var pauseLabel = document.getElementById('pause-label');
  var timeEl = document.getElementById('time');

  /* ---------------- audio (master clock) ---------------- */
  var audio = new Audio();
  audio.preload = 'auto';
  audio.src = 'audio/voiceover.m4a';

  audio.addEventListener('ended', function () {
    if (audioEndAt === null) audioEndAt = performance.now();
  });
  audio.addEventListener('error', function () {
    var hint = document.querySelector('#title-screen .hint');
    if (hint) hint.textContent = 'audio could not load — check audio/voiceover.m4a';
  });

  /* ---------------- state ---------------- */
  // idle | playing | paused | ended
  var state = 'idle';
  var rafId = 0;
  var audioEndAt = null;   // wall-clock instant the voice finished (tail anchor)
  var tailPausedAt = null; // wall-clock instant we paused inside the tail
  var dimTimer = 0;

  function fmt(t) {
    t = Math.max(0, Math.round(t));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // current film time in seconds. Master clock is the audio position; the
  // last few seconds (after the voice ends) run on the wall clock anchored
  // to audioEndAt. audioEndAt !== null is the unambiguous "in the tail"
  // signal (it is cleared by every start/restart).
  function filmTime() {
    if (audioEndAt !== null) {
      var t = AUDIO_END + (performance.now() - audioEndAt) / 1000;
      return Math.min(END, t);
    }
    return Math.min(END, audio.currentTime);
  }

  function paint(t) {
    Film.renderFrame(backend, t, {});
    timeEl.textContent = fmt(t) + ' / ' + fmt(END);
  }

  /* ---------------- playback loop ---------------- */
  function loop() {
    if (state !== 'playing') return;
    var t = filmTime();
    paint(t);
    if (t >= END) { finish(); return; }
    rafId = requestAnimationFrame(loop);
  }

  // gentle animated poster while on the title screen (readout stays at 0:00)
  function posterLoop() {
    if (state !== 'idle') return;
    Film.renderFrame(backend, Film.posterT(performance.now() / 1000), {});
    timeEl.textContent = '0:00 / ' + fmt(END);
    rafId = requestAnimationFrame(posterLoop);
  }

  function playAudio() {
    // during the visual tail (after the voice ended) there is nothing to
    // play — but a restart/replay has reset the anchor, so play normally
    if (audio.ended && audioEndAt !== null) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function (err) {
      console.warn('Alina: audio start failed —', err && err.name || err);
    });
  }

  function startPlayback() {
    if (state === 'playing') return;
    if (state === 'ended') {
      try { audio.currentTime = 0; } catch (e) { /* ignore */ }
      audioEndAt = null;
      tailPausedAt = null;
    }
    playAudio();
    state = 'playing';
    titleScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    controls.classList.remove('hidden');
    setPauseUI(true);
    wakeControls();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function pausePlayback() {
    if (state !== 'playing') return;
    audio.pause();
    if (audioEndAt !== null) tailPausedAt = performance.now();
    state = 'paused';
    cancelAnimationFrame(rafId);
    setPauseUI(false);
    controls.classList.remove('dim');
  }

  function resumePlayback() {
    if (state !== 'paused') return;
    if (tailPausedAt !== null) {
      audioEndAt += performance.now() - tailPausedAt;
      tailPausedAt = null;
    }
    playAudio();
    state = 'playing';
    setPauseUI(true);
    wakeControls();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function restartPlayback() {
    cancelAnimationFrame(rafId);
    audio.pause();
    try { audio.currentTime = 0; } catch (e) { /* ignore */ }
    audioEndAt = null;
    tailPausedAt = null;
    state = 'paused'; // so startPlayback re-arms instead of no-oping
    startPlayback();
  }

  function finish() {
    state = 'ended';
    paint(END);
    controls.classList.add('hidden');
    endScreen.classList.remove('hidden');
  }

  function setPauseUI(playing) {
    pauseIcon.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;';
    pauseLabel.textContent = playing ? 'Pause' : 'Resume';
  }

  /* ---------------- controls chrome (auto-dim) ---------------- */
  function scheduleDim() {
    controls.classList.remove('dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(function () {
      if (state === 'playing') controls.classList.add('dim');
    }, 2600);
  }
  function wakeControls() { scheduleDim(); }

  /* ---------------- events ---------------- */
  startBtn.addEventListener('click', startPlayback);
  replayBtn.addEventListener('click', startPlayback);
  restartBtn.addEventListener('click', restartPlayback);
  pauseBtn.addEventListener('click', function () {
    if (state === 'playing') pausePlayback();
    else if (state === 'paused') resumePlayback();
  });

  document.addEventListener('pointermove', function () {
    if (state === 'playing') scheduleDim();
  });
  document.addEventListener('pointerdown', function () {
    if (state === 'playing') scheduleDim();
  });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'idle' || state === 'ended') startPlayback();
      else if (state === 'playing') pausePlayback();
      else if (state === 'paused') resumePlayback();
    } else if (e.code === 'KeyR' && state !== 'idle') {
      restartPlayback();
    }
  });

  /* ---------------- go ---------------- */
  rafId = requestAnimationFrame(posterLoop);
})();
