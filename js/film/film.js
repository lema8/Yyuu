/*
 * film.js — the master timeline. A pure function of time t (seconds of
 * audio playback): given t, decides which shot(s) are visible and renders
 * them, with crossfades, camera moves, and the post pass.
 *
 * Narration (from the voiceover, word timestamps verified with ASR):
 *   0.03–6.0   "One day there was a plane in the sky with a girl called Alina inside."
 *   7.03–15.0  "A bird flew into the engine, making the plane fly down and crashing into the forest."
 *              (impact lands on "engine" ≈ 8.8–9.5; crash lands on "into the forest" ≈ 13.4–15.0)
 *   15.03–23.0 "Walking through the forest for several days, until Alina could find help."
 *   audio ends 23.02 — the final shot holds and fades out to THE END.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { Object.assign(root, api); root.Film = api; }
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  var W = 1280, H = 720;
  var TAU = Math.PI * 2;
  var E = Easings.E;
  var P = Particles;

  /* ---------------------------------------------------------------- */
  /* helpers                                                           */
  /* ---------------------------------------------------------------- */

  // wrap ctx so every setAlpha call is multiplied by `a` (for crossfades)
  function withAlpha(ctx, a) {
    return new Proxy(ctx, {
      get: function (t, k) {
        var v = t[k];
        if (k === 'setAlpha') return function (x) { t.setAlpha(x * a); };
        if (typeof v === 'function') return v.bind(t);
        return v;
      }
    });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // full-screen flash that covers the frame even under camera transforms
  function bigFlash(ctx, a) {
    if (a <= 0) return;
    ctx.setAlpha(Math.min(1, a));
    ctx.fillRect(-3000, -3000, W + 6000, H + 6000, '#ffffff');
    ctx.setAlpha(1);
  }

  /* ---------------------------------------------------------------- */
  /* SHOT 1a — the flight (0.00 – 4.60)                               */
  /* "One day there was a plane in the sky..."                         */
  /* ---------------------------------------------------------------- */
  var S1A_CLOUDS_FAR = makeClouds(11, 90, 300, 5, 0.5, 0.85, 9);
  var S1A_CLOUDS_MID = makeClouds(12, 170, 440, 4, 0.85, 1.25, 18);
  var S1A_CLOUDS_NEAR = makeClouds(13, 330, 560, 3, 1.35, 1.9, 32);

  function planePos1a(t) {
    return { x: 640 + t * 22, y: 330 + 7 * Math.sin(t * 0.7), rot: 0.02 * Math.sin(t * 0.5) };
  }

  function shot1a(ctx, t) {
    var pal = {
      skyTop: '#7cc4ef', skyBot: '#eaf7fd',
      sun: { x: 240, y: 150, r: 34, glowR: 270, core: '#fff6cf', glow: 'rgba(255,244,200,0.6)' }
    };
    drawSky(ctx, pal, t, W, H);

    var c;
    for (c = 0; c < S1A_CLOUDS_FAR.length; c++) drawCloud(ctx, S1A_CLOUDS_FAR[c], t, W, 0.75, '#ffffff', '#c9dcea');
    for (c = 0; c < S1A_CLOUDS_MID.length; c++) drawCloud(ctx, S1A_CLOUDS_MID[c], t, W, 0.85, '#ffffff', '#c2d8e8');

    // distant flock (life)
    drawFlock(ctx, t, 1120 - t * 42, 205 + Math.sin(t * 0.4) * 8, 4, 0.55, '#4a5a6e');

    var pp = planePos1a(t);
    // contrail
    ctx.setAlpha(0.16);
    ctx.beginPath();
    ctx.moveTo(pp.x - 10, pp.y + 26);
    ctx.lineTo(pp.x - 560, pp.y + 34);
    ctx.stroke('#ffffff', 3);
    ctx.setAlpha(0.05);
    ctx.beginPath();
    ctx.moveTo(pp.x - 10, pp.y + 26);
    ctx.lineTo(pp.x - 560, pp.y + 34);
    ctx.stroke('#ffffff', 10);
    ctx.setAlpha(1);

    drawPlane(ctx, pp.x, pp.y, 1.0, pp.rot, {});

    for (c = 0; c < S1A_CLOUDS_NEAR.length; c++) drawCloud(ctx, S1A_CLOUDS_NEAR[c], t, W, 0.9, '#ffffff', '#b8d2e4');
  }

  /* ---------------------------------------------------------------- */
  /* SHOT 1b — cabin interior (4.60 – 7.15)                            */
  /* "...with a girl called Alina inside."                             */
  /* ---------------------------------------------------------------- */
  function shot1b(ctx, t) {
    // cabin back wall
    ctx.fillRect(0, 0, W, H, ctx.linear(0, 0, 0, H, [[0, '#414c5a'], [1, '#5a6774']]));
    // floor
    ctx.fillRect(0, 648, W, H - 648, '#39434f');
    ctx.setAlpha(0.3);
    ctx.fillRect(0, 648, W, 5, '#2b333d');
    ctx.setAlpha(1);
    // ceiling band
    ctx.fillRect(0, 0, W, 130, '#2e3843');
    // ceiling ribs
    ctx.setAlpha(0.25);
    for (var i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(120 + i * 200, 0);
      ctx.lineTo(150 + i * 200, 130);
      ctx.stroke('#242d37', 10);
    }
    ctx.setAlpha(1);
    // reading light
    ctx.beginPath();
    ctx.arc(320, 118, 70, 0, TAU);
    ctx.fill(ctx.radial(320, 118, 0, 320, 118, 70, [[0, 'rgba(255,220,150,0.5)'], [1, 'rgba(255,220,150,0)']]));
    ctx.beginPath();
    ctx.arc(320, 122, 7, 0, TAU);
    ctx.fill('#ffe2a8');

    // ---- window ----
    var wx = 900, wy = 180, ww = 290, wh = 330;
    ctx.beginPath();
    ctx.rect(wx - 14, wy - 14, ww + 28, wh + 28);
    ctx.fill('#2a3440');
    // glass + everything outside it, clipped to the glass pane
    ctx.save();
    ctx.clip(wx, wy, ww, wh, 42);
    ctx.fillRoundRect(wx, wy, ww, wh, 42, '#bfe3f5');
    ctx.fillRect(wx, wy + wh * 0.45, ww, wh * 0.55, ctx.linear(0, wy + wh * 0.4, 0, wy + wh, [[0, 'rgba(191,227,245,0)'], [1, '#e8f6fd']]));
    // cloud outside the window (relative motion)
    var cx = wx + ww - ((t * 46) % (ww + 500)) + 250;
    ctx.save();
    ctx.translate(cx, wy + 170);
    ctx.scale(0.9, 0.65);
    ctx.setAlpha(0.95);
    ctx.beginPath();
    var bl = [[-60, 0, 40], [-20, -14, 48], [30, -8, 44], [62, 4, 36]];
    for (var b = 0; b < bl.length; b++) {
      ctx.moveTo(bl[b][0] + bl[b][2], bl[b][1]);
      ctx.arc(bl[b][0], bl[b][1], bl[b][2], 0, TAU);
    }
    ctx.fill('#ffffff');
    ctx.restore();
    // wing hint outside
    ctx.setAlpha(0.5);
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh - 20);
    ctx.lineTo(wx + ww, wy + wh - 70);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.lineTo(wx, wy + wh);
    ctx.closePath();
    ctx.fill('#dfe8ee');
    ctx.setAlpha(1);
    // foreshadowing bird outside the window (t 6.1–6.8)
    if (t > 6.05 && t < 6.85) {
      var bt = (t - 6.05) / 0.8;
      drawBird(ctx, wx + ww + 40 - bt * (ww + 120), wy + 120 + Math.sin(bt * 9) * 10, 0.62,
        t * 26, '#37424e', { facing: -1 });
    }
    ctx.restore(); // end glass clip
    // window frame highlight
    ctx.setAlpha(0.35);
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.stroke('#8fa8bc', 3);
    ctx.setAlpha(1);

    // ---- seat ----
    ctx.fillRoundRect(330, 320, 300, 330, 34, '#4a5c72');          // back
    ctx.setAlpha(0.14);
    ctx.fillRoundRect(352, 344, 256, 280, 26, '#000000');          // inset
    ctx.setAlpha(1);
    ctx.fillRoundRect(462, 322, 92, 54, 20, '#3e4f63');            // headrest
    ctx.fillRoundRect(306, 552, 368, 140, 28, '#54677e');          // cushion
    ctx.setAlpha(0.2);
    ctx.fillRoundRect(306, 552, 368, 26, 14, '#000000');           // cushion top shade
    ctx.setAlpha(1);
    ctx.fillRoundRect(282, 462, 66, 190, 22, '#40526a');           // armrest (near)

    // ---- Alina, seated at the window ----
    var bobY = 2.2 * Math.sin(t * 2.1) + 1.0 * Math.sin(t * 3.3);
    var look = 0.10 + 0.045 * Math.sin(t * 0.8) + (t > 5.0 && t < 6.2 ? 0.05 * Math.sin((t - 5.0) * 2.2) : 0);
    drawAlina(ctx, 488, 646 + bobY, 2.5, {
      t: t, sit: true, facing: 1, look: look, fatigue: 0, phase: 0
    });

    // sunbeam from the window
    ctx.setAlpha(0.05);
    ctx.beginPath();
    ctx.moveTo(wx, wy + 40);
    ctx.lineTo(wx + ww, wy);
    ctx.lineTo(700, 640);
    ctx.lineTo(430, 700);
    ctx.closePath();
    ctx.fill('#fff2cf');
    ctx.setAlpha(1);
  }

  /* ---------------------------------------------------------------- */
  /* SHOT 2a — the bird strike (7.15 – 9.70)                          */
  /* "A bird flew into the engine..."  (impact ≈ 9.30)                */
  /* ---------------------------------------------------------------- */
  var IMPACT = 9.30;

  function planePos2a(t) {
    var x = 430 + (t - 7.15) * 16;
    var y = 300 + 42 * E.inOutCubic(prog(t, IMPACT, 9.7));
    var rot = -0.14 * E.inOutCubic(prog(t, IMPACT, 9.7));
    return { x: x, y: y, rot: rot };
  }
  function enginePos2a(t) { var p = planePos2a(t); return { x: p.x + 30, y: p.y + 28 }; }

  function shot2a(ctx, t) {
    var pal = {
      skyTop: '#86bfe6', skyBot: '#e6f3fa',
      sun: { x: 1060, y: 130, r: 30, glowR: 240, core: '#fff6cf', glow: 'rgba(255,244,200,0.5)' }
    };
    drawSky(ctx, pal, t, W, H);
    var far = makeClouds(31, 120, 380, 4, 0.7, 1.1, 26);
    for (var c = 0; c < far.length; c++) drawCloud(ctx, far[c], t, W, 0.7, '#ffffff', '#c6dae9');
    var low = makeClouds(33, 470, 640, 4, 0.6, 1.0, 11);
    for (var c2 = 0; c2 < low.length; c2++) drawCloud(ctx, low[c2], t, W, 0.35, '#f2f8fc', '#d3e2ec');

    var pp = planePos2a(t);

    // smoke from the struck engine (starts at impact)
    if (t > IMPACT + 0.06) {
      P.drawSmokeTrail(ctx, {
        t0: IMPACT + 0.06, source: function (tt) { return enginePos2a(tt); },
        dt: 0.07, r0: 4, grow: 13, maxAge: 2.2, a0: 0.5, dark: 0.7, windX: 30, windY: -6
      }, t);
    }

    // engine fire + impact flash
    var fire = E.outCubic(prog(t, IMPACT, IMPACT + 0.35));
    var flashA = t > IMPACT ? Math.max(0, 1 - (t - IMPACT) / 0.18) : 0;
    drawPlane(ctx, pp.x, pp.y, 1.0, pp.rot, { engineFire: fire, flash: flashA });

    // the bird, converging on the engine (drawn last: strikes the near side)
    if (t < IMPACT) {
      var u = E.inCubic(prog(t, 7.22, IMPACT));
      var bx = lerp(1250, pp.x + 30, u);
      var by = lerp(235, pp.y + 28, u) + 25 * Math.sin(u * Math.PI) * (1 - u * 0.4);
      drawBird(ctx, bx, by, 1.5, t * (15 + u * 14), '#2c3138', { facing: -1 });
    }

    // sparks
    P.drawSparks(ctx, {
      x: pp.x + 32, y: pp.y + 28, t0: IMPACT, n: 30, dir: Math.PI, spread: 2.2,
      speed0: 120, speed1: 420, grav: 620, life: 0.65
    }, t);

    // global flash
    if (flashA > 0) bigFlash(ctx, flashA * 0.3);
  }

  /* ---------------------------------------------------------------- */
  /* SHOT 2b — loss of control (9.70 – 12.60)                         */
  /* "...making the plane fly down..."                                 */
  /* ---------------------------------------------------------------- */
  var S2B_T0 = 9.70, S2B_T1 = 12.60;
  function s2bPath(u) {
    // cubic bezier: B(u) = (1-u)^3 p0 + 3(1-u)^2 u p1 + 3(1-u) u^2 p2 + u^3 p3
    // dive continues to the RIGHT (continuity with shots 1a/2a)
    var p0 = [-120, 120], p1 = [340, 330], p2 = [780, 340], p3 = [1400, 650];
    var a = 1 - u;
    var x = a * a * a * p0[0] + 3 * a * a * u * p1[0] + 3 * a * u * u * p2[0] + u * u * u * p3[0];
    var y = a * a * a * p0[1] + 3 * a * a * u * p1[1] + 3 * a * u * u * p2[1] + u * u * u * p3[1];
    // derivative for rotation
    var dx = 3 * a * a * (p1[0] - p0[0]) + 6 * a * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]);
    var dy = 3 * a * a * (p1[1] - p0[1]) + 6 * a * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1]);
    return { x: x, y: y, rot: Math.atan2(dy, dx) };
  }

  var S2B_FOREST = (function () {
    // bumpy canopy silhouette across the bottom
    var pts = [];
    var r = new Rng(55);
    for (var x = -100; x <= 1400; x += 40) {
      pts.push([x, 700 - r.range(20, 90)]);
    }
    return pts;
  })();

  function shot2b(ctx, t) {
    var pal = {
      skyTop: '#7fb2d9', skyBot: '#dceef7',
      sun: { x: 1080, y: 120, r: 28, glowR: 220, core: '#fff6cf', glow: 'rgba(255,244,200,0.4)' }
    };
    drawSky(ctx, pal, t, W, H);
    // fast clouds = speed
    var far = makeClouds(41, 100, 460, 5, 0.7, 1.2, 150);
    for (var c = 0; c < far.length; c++) drawCloud(ctx, far[c], t, W, 0.55, '#ffffff', '#c6dae9');

    var u = prog(t, S2B_T0, S2B_T1);
    var pp = s2bPath(u);

    // smoke ribbon (dark, thick, fused)
    P.drawSmokeTrail(ctx, {
      t0: S2B_T0, source: function (tt) {
        var uu = prog(tt, S2B_T0, S2B_T1);
        var q = s2bPath(uu);
        // offset toward the struck engine (front side, plane faces right)
        return { x: q.x + 16, y: q.y + 14 };
      },
      dt: 0.038, r0: 9, grow: 30, maxAge: 3.2, a0: 0.34, dark: 1, windX: 14, windY: -3
    }, t);

    drawPlane(ctx, pp.x, pp.y, 0.85, pp.rot, { engineFire: 0.9 });

    // forest edge rising at the bottom
    var top = 720 - 130 * E.outCubic(prog(t, 10.9, S2B_T1));
    ctx.beginPath();
    ctx.moveTo(-100, H + 40);
    ctx.lineTo(S2B_FOREST[0][0], S2B_FOREST[0][1] - (700 - top));
    for (var i = 1; i < S2B_FOREST.length; i++) {
      ctx.lineTo(S2B_FOREST[i][0], S2B_FOREST[i][1] - (700 - top));
    }
    ctx.lineTo(1400, H + 40);
    ctx.closePath();
    ctx.fill('#26382a');
  }

  /* ---------------------------------------------------------------- */
  /* SHOT 2c — the crash, distant (12.60 – 16.30)                     */
  /* "...and crashing into the forest."  (impact ≈ 14.10)             */
  /* ---------------------------------------------------------------- */
  var CRASH = 14.10;
  var S2C_FAR = makeForestLayer(71, { baseY: 500, hMin: 90, hMax: 190, gap: 60, mix: [0.7, 0.3] });
  var S2C_MID = makeForestLayer(72, { baseY: 585, hMin: 130, hMax: 250, gap: 66, mix: [0.55, 0.45] });
  var S2C_NEAR = makeForestLayer(73, { baseY: 685, hMin: 190, hMax: 330, gap: 80, mix: [0.45, 0.55] });

  function s2cPlane(u) {
    var x = lerp(1180, 545, u) + Math.sin(u * 5) * 14 * (1 - u);
    var y = lerp(60, 565, u * u * 0.55 + u * 0.45);
    var rot = -0.9 * u - 0.15;
    return { x: x, y: y, rot: rot };
  }

  function shot2c(ctx, t) {
    var pal = {
      skyTop: '#89a7c4', skyBot: '#e2ebf2',
      horizon: { color: 'rgba(210,220,228,0.55)', h: 180 }
    };
    drawSky(ctx, pal, t, W, H);
    var far = makeClouds(51, 90, 300, 4, 0.8, 1.3, 12);
    for (var c = 0; c < far.length; c++) drawCloud(ctx, far[c], t, W, 0.5, '#ffffff', '#c4d2dd');

    // far forest
    drawForestLayer(ctx, S2C_FAR, 'rgba(122,148,124,0.6)', 0, null);

    // the plane descending (between far and mid layers)
    var u = prog(t, 12.6, 13.95);
    if (t < 14.05) {
      var pp = s2cPlane(u);
      P.drawSmokeTrail(ctx, {
        t0: 12.6, source: function (tt) {
          var uu = prog(tt, 12.6, 13.95);
          var q = s2cPlane(uu);
          return { x: q.x + 14, y: q.y + 16 };
        },
        dt: 0.05, r0: 5, grow: 16, maxAge: 2.4, a0: 0.5, dark: 1, windX: 20
      }, t);
      drawPlane(ctx, pp.x, pp.y, 0.5, pp.rot, { engineFire: 0.8 });
    }

    // mid forest (plane disappears behind it)
    drawForestLayer(ctx, S2C_MID, '#3c5844', 0, { t: t, t0: CRASH, amp: 9, cx: 545, spread: 280 });

    // near forest
    drawForestLayer(ctx, S2C_NEAR, '#24382a', 0, { t: t, t0: CRASH, amp: 12, cx: 545, spread: 240 });

    // impact effects (drawn in front: the screen flash must not be covered)
    if (t >= CRASH) {
      // flash
      var fa = Math.max(0, 1 - (t - CRASH) / 0.22);
      if (fa > 0) {
        ctx.setAlpha(fa);
        ctx.beginPath();
        ctx.arc(545, 552, 40 + (1 - fa) * 90, 0, TAU);
        ctx.fill(ctx.radial(545, 552, 0, 545, 552, 130, [
          [0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(255,235,190,0.6)'], [1, 'rgba(255,220,160,0)']
        ]));
        ctx.setAlpha(1);
        bigFlash(ctx, fa * 0.24);
      }
      P.drawDustPlume(ctx, { x: 545, y: 535, t0: CRASH + 0.05, n: 30, life: 6.5, a0: 0.5 }, t);
      P.drawDebris(ctx, { x: 545, y: 545, t0: CRASH, n: 15, speed0: 120, speed1: 300, life: 1.6, color: '#3a2d1f' }, t);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Journey shots (15.8 – 27.8) — "Walking through the forest..."    */
  /* ---------------------------------------------------------------- */

  // prebuilt forest layers per journey beat (different seeds = different places)
  var J_LAYERS = {
    J1: {
      far: makeForestLayer(91, { baseY: 545, hMin: 120, hMax: 240, gap: 58, mix: [0.75, 0.25], x0: -260, x1: 1640 }),
      mid: makeForestLayer(92, { baseY: 625, hMin: 170, hMax: 300, gap: 70, mix: [0.5, 0.5], x0: -260, x1: 1640 }),
      near: makeForestLayer(93, { baseY: 740, hMin: 260, hMax: 420, gap: 110, mix: [0.4, 0.6], x0: -300, x1: 1700 })
    },
    J2: {
      far: makeForestLayer(96, { baseY: 545, hMin: 120, hMax: 240, gap: 58, mix: [0.5, 0.5], x0: -260, x1: 1640 }),
      mid: makeForestLayer(97, { baseY: 625, hMin: 170, hMax: 300, gap: 70, mix: [0.45, 0.55], x0: -260, x1: 1640 }),
      near: makeForestLayer(98, { baseY: 740, hMin: 260, hMax: 420, gap: 110, mix: [0.35, 0.65], x0: -300, x1: 1700 })
    },
    J3: {
      far: makeForestLayer(99, { baseY: 545, hMin: 130, hMax: 250, gap: 56, mix: [0.7, 0.3], x0: -260, x1: 1640 }),
      mid: makeForestLayer(94, { baseY: 625, hMin: 180, hMax: 310, gap: 66, mix: [0.6, 0.4], x0: -260, x1: 1640 }),
      near: makeForestLayer(95, { baseY: 745, hMin: 270, hMax: 430, gap: 105, mix: [0.5, 0.5], x0: -300, x1: 1700 })
    },
    J4: {
      far: makeForestLayer(96, { baseY: 545, hMin: 120, hMax: 230, gap: 62, mix: [0.2, 0.8], x0: -260, x1: 1640 }),
      mid: makeForestLayer(97, { baseY: 625, hMin: 160, hMax: 290, gap: 74, mix: [0.15, 0.85], x0: -260, x1: 1640 }),
      near: makeForestLayer(98, { baseY: 745, hMin: 250, hMax: 420, gap: 120, mix: [0.1, 0.9], x0: -300, x1: 1700 })
    }
  };

  // Alina walk across the journey: x from x0 to x1 over [t0,t1]
  function walkAlina(ctx, t, o) {
    var u = prog(t, o.t0, o.t1);
    var x = lerp(o.x0, o.x1, u);
    var y = (typeof o.groundY === 'function') ? o.groundY(x) : (o.groundY || 660);
    var phase = (t - o.t0) * (o.speed || 9.5) * (1 - 0.3 * (o.fatigue || 0));
    drawAlina(ctx, x, y, o.s || 1.1, {
      t: t, phase: phase, facing: 1,
      gait: o.gait !== undefined ? o.gait : 1 - 0.25 * (o.fatigue || 0),
      fatigue: o.fatigue || 0, still: o.still || 0,
      look: o.look || 0,
      silhouette: o.sil || 0, silColor: o.silColor || '#1c2430',
      rim: o.rim
    });
    // contact shadow
    ctx.setAlpha(0.22 * (1 - (o.sil || 0) * 0.5));
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 26 * (o.s || 1.1), 6 * (o.s || 1.1), 0, 0, TAU);
    ctx.fill(o.shadowColor || 'rgba(20,30,20,1)');
    ctx.setAlpha(1);
  }

  function journeyBase(ctx, pal, layers, groundColor, t) {
    drawSky(ctx, pal, t, W, H);
    drawForestLayer(ctx, layers.far, pal.far, 0, null);
    // ground
    ctx.fillRect(0, 640, W, H - 640, groundColor);
    drawForestLayer(ctx, layers.mid, pal.mid, 0, null);
  }

  /* J1 — bright morning (16.30 – 18.30) "Walking through the forest" */
  function shotJ1(ctx, t) {
    var pal = { skyTop: '#c4e4c8', skyBot: '#f4f8e6', far: 'rgba(128,164,122,0.55)', mid: '#4c7250' };
    journeyBase(ctx, pal, J_LAYERS.J1, '#3a5a38', t);
    P.drawGodRays(ctx, { x0: 180, gap: 300, y0: -40, y1: 700, width: 110, lean: 190, n: 4, alpha: 0.11 }, t);
    P.drawMotes(ctx, { x0: 120, xRange: 1000, y0: 120, yRange: 460, n: 26, alpha: 0.5 }, t);
    // a bird in the canopy
    drawBird(ctx, 900 - (t - 16.3) * 90, 170 + Math.sin(t * 1.6) * 12, 0.5, t * 11, '#54606e', { facing: -1 });
    walkAlina(ctx, t, { t0: 16.45, t1: 18.25, x0: 300, x1: 480, groundY: 668, s: 1.15, fatigue: 0.05 });
    drawForestLayer(ctx, J_LAYERS.J1.near, '#26412c', 0, null);
    grade(ctx, W, H, 'rgba(255,244,200,0.05)', 1);
  }

  /* J2 — late afternoon gold (18.30 – 19.50) "for several..." */
  function shotJ2(ctx, t) {
    var pal = {
      skyTop: '#f2bd6d', skyBot: '#ffe9b8',
      sun: { x: 1080, y: 420, r: 30, glowR: 300, core: '#ffdf9a', glow: 'rgba(255,210,130,0.55)' },
      far: 'rgba(154,118,66,0.5)', mid: '#68502f'
    };
    journeyBase(ctx, pal, J_LAYERS.J2, '#4c3c22', t);
    P.drawLeaves(ctx, { n: 8, y0: 140, yRange: 520, speed: 30, color: 'rgba(216,152,64,0.85)' }, t, W);
    // long shadows
    ctx.setAlpha(0.22);
    ctx.beginPath();
    ctx.ellipse(390, 676, 90, 10, 0, 0, TAU);
    ctx.fill('rgba(40,25,8,1)');
    ctx.setAlpha(1);
    walkAlina(ctx, t, { t0: 18.42, t1: 19.42, x0: 290, x1: 460, groundY: 668, s: 1.15, fatigue: 0.3, shadowColor: 'rgba(40,25,8,1)' });
    drawForestLayer(ctx, J_LAYERS.J2.near, '#33271a', 0, null);
    grade(ctx, W, H, 'rgba(255,150,50,0.09)', 1);
  }

  /* J3a — sunset (19.50 – 20.35) "...several days" */
  function shotJ3a(ctx, t) {
    var pal = {
      skyTop: '#d95f36', skyBot: '#ffc077',
      sun: { x: 990, y: 480, r: 46, glowR: 360, core: '#ffcf8a', glow: 'rgba(255,170,90,0.6)', glowMid: 'rgba(255,140,70,0.3)' },
      far: 'rgba(96,48,58,0.55)', mid: '#43293a'
    };
    journeyBase(ctx, pal, J_LAYERS.J3, '#2a1d20', t);
    walkAlina(ctx, t, {
      t0: 19.55, t1: 20.3, x0: 280, x1: 430, groundY: 668, s: 1.15,
      fatigue: 0.45, sil: 0.8, silColor: '#241420', rim: 'rgba(255,170,90,0.9)', shadowColor: 'rgba(30,10,10,1)'
    });
    drawForestLayer(ctx, J_LAYERS.J3.near, '#1a1016', 0, null);
    grade(ctx, W, H, 'rgba(255,90,30,0.10)', 1);
  }

  /* J3b — night (20.35 – 21.25) */
  function shotJ3b(ctx, t) {
    var pal = {
      skyTop: '#101830', skyBot: '#2c3c60',
      moon: { x: 1000, y: 150, r: 26 }, stars: 1,
      far: 'rgba(28,38,58,0.6)', mid: '#121b2b'
    };
    journeyBase(ctx, pal, J_LAYERS.J3, '#0b1322', t);
    P.drawFireflies(ctx, { n: 10, x0: 100, xRange: 1050, y0: 560, yRange: 120 }, t);
    walkAlina(ctx, t, {
      t0: 20.4, t1: 21.2, x0: 300, x1: 470, groundY: 668, s: 1.15,
      fatigue: 0.5, sil: 1, silColor: '#0e1522', rim: 'rgba(170,195,240,0.75)', shadowColor: 'rgba(0,0,10,1)'
    });
    drawForestLayer(ctx, J_LAYERS.J3.near, '#080d16', 0, null);
    grade(ctx, W, H, 'rgba(40,60,130,0.08)', 1);
  }

  /* J4 — dawn fog, new forest (21.25 – 22.45) "until Alina..." */
  function shotJ4(ctx, t) {
    var pal = {
      skyTop: '#b6cdd6', skyBot: '#e8f1f2',
      far: 'rgba(138,164,164,0.5)', mid: '#54706a'
    };
    journeyBase(ctx, pal, J_LAYERS.J4, '#3d544a', t);
    P.drawFogBands(ctx, { y0: 330, gap: 130, n: 4, alpha: 0.14, speed: 10 }, t, W);
    P.drawMotes(ctx, { x0: 150, xRange: 950, y0: 200, yRange: 400, n: 18, alpha: 0.3 }, t);
    walkAlina(ctx, t, {
      t0: 21.35, t1: 22.35, x0: 430, x1: 570, groundY: 668, s: 1.3,
      fatigue: 0.65, look: 0.07, shadowColor: 'rgba(25,40,35,1)'
    });
    P.drawFogBands(ctx, { y0: 470, gap: 150, n: 3, alpha: 0.2, speed: 14 }, t, W);
    drawForestLayer(ctx, J_LAYERS.J4.near, '#28403a', 0, null);
    grade(ctx, W, H, 'rgba(190,215,225,0.07)', 1);
  }

  /* J5 — the ridge and the cabin (22.45 – 27.8) "...could find help." */
  var J5_LEFT = makeForestLayer(131, { baseY: 700, hMin: 220, hMax: 420, gap: 90, mix: [0.5, 0.5], x0: -300, x1: 620 });
  var J5_RIGHT = makeForestLayer(132, { baseY: 690, hMin: 200, hMax: 380, gap: 90, mix: [0.5, 0.5], x0: 980, x1: 1700 });
  var J5_HILLS = (function () {
    var pts = [];
    for (var x = 700; x <= 1200; x += 50) {
      pts.push([x, 560 - 40 * Math.sin((x - 700) / 160) - 14 * Math.sin((x - 700) / 47)]);
    }
    return pts;
  })();

  function j5groundY(x) {
    // ridge: rising slope toward the right opening
    return 690 - 120 * prog(x, 300, 1100);
  }

  function drawCabin(ctx, x, y, s, t, glowPulse) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // warm halo
    var gp = 0.85 + 0.15 * Math.sin(t * 1.7) + (glowPulse || 0);
    ctx.beginPath();
    ctx.arc(6, -26, 95 * gp, 0, TAU);
    ctx.fill(ctx.radial(6, -26, 0, 6, -26, 110, [
      [0, 'rgba(255,205,120,' + (0.4 * gp).toFixed(3) + ')'],
      [0.5, 'rgba(255,180,90,' + (0.16 * gp).toFixed(3) + ')'],
      [1, 'rgba(255,160,70,0)']
    ]));
    // body
    ctx.fillRect(-34, -44, 72, 44, '#5a4632');
    // log lines
    ctx.setAlpha(0.25);
    for (var i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-34, -44 + i * 9);
      ctx.lineTo(38, -44 + i * 9);
      ctx.stroke('#3c2f20', 1.4);
    }
    ctx.setAlpha(1);
    // roof
    ctx.beginPath();
    ctx.moveTo(-42, -44);
    ctx.lineTo(2, -74);
    ctx.lineTo(46, -44);
    ctx.closePath();
    ctx.fill('#3a2e22');
    // chimney
    ctx.fillRect(22, -78, 11, 26, '#4a3b2c');
    P.drawChimneySmoke(ctx, { x: 28, y: -80, night: true }, t);
    // door
    ctx.fillRect(-24, -26, 16, 26, '#33291d');
    // windows (warm)
    var wg = 'rgba(255,214,130,1)';
    ctx.fillRect(2, -30, 13, 11, wg);
    ctx.fillRect(20, -30, 13, 11, wg);
    // window cross bars
    ctx.setAlpha(0.5);
    ctx.strokeRect(2, -30, 13, 11, '#4a3b2c', 1.2);
    ctx.strokeRect(20, -30, 13, 11, '#4a3b2c', 1.2);
    ctx.setAlpha(1);
    ctx.restore();
  }

  function shotJ5(ctx, t) {
    var pal = {
      skyTop: '#3d4b78', skyBot: '#e09a6a', stars: 0.25,
      horizon: { color: 'rgba(255,170,100,0.5)', h: 200 }
    };
    drawSky(ctx, pal, t, W, H);

    // valley: far hills + cabin
    ctx.beginPath();
    ctx.moveTo(660, 620);
    for (var i = 0; i < J5_HILLS.length; i++) ctx.lineTo(J5_HILLS[i][0], J5_HILLS[i][1]);
    ctx.lineTo(1200, 620);
    ctx.closePath();
    ctx.fill('#41527a');
    drawCabin(ctx, 940, 545, 0.62, t, 0.25 * prog(t, 22.9, 24.4));

    // ground / ridge
    ctx.beginPath();
    ctx.moveTo(0, 700);
    for (var gx = 0; gx <= 1280; gx += 64) ctx.lineTo(gx, j5groundY(gx));
    ctx.lineTo(1280, 760); ctx.lineTo(0, 760);
    ctx.closePath();
    ctx.fill('#2e4440');
    // grass tufts hint
    ctx.setAlpha(0.35);
    var rr = new Rng(141);
    for (var gi = 0; gi < 40; gi++) {
      var gxx = rr.range(0, 1280);
      var gy = j5groundY(gxx) + 4;
      ctx.beginPath();
      ctx.moveTo(gxx, gy);
      ctx.quadTo(gxx + 3, gy - 9, gxx + 6, gy);
      ctx.stroke('#4a6b5e', 2);
    }
    ctx.setAlpha(1);

    // Alina climbs the ridge, stops, and looks at the light
    var walkU = prog(t, 22.5, 23.45);
    var ax = lerp(480, 665, walkU);
    var ay = j5groundY(ax);
    var still = E.inOutCubic(prog(t, 23.45, 23.95));
    var look = 0.05 + 0.14 * E.inOutCubic(prog(t, 23.7, 24.5));
    var phase = (t - 22.5) * 8.6;
    drawAlina(ctx, ax, ay, 1.28, {
      t: t, phase: phase, facing: 1, gait: 0.8, fatigue: 0.7,
      still: still, look: look, silhouette: 0.35, silColor: '#241c28',
      rim: 'rgba(255,190,120,0.6)'
    });
    ctx.setAlpha(0.25);
    ctx.beginPath();
    ctx.ellipse(ax, ay + 5, 27, 6, 0, 0, TAU);
    ctx.fill('rgba(10,20,18,1)');
    ctx.setAlpha(1);

    // framing forest
    drawForestLayer(ctx, J5_LEFT, '#22342f', 0, null);
    drawForestLayer(ctx, J5_RIGHT, '#1f312c', 0, null);

    grade(ctx, W, H, 'rgba(90,80,130,0.06)', 1);
  }

  function FONTS() {
    if (typeof window !== 'undefined' && window.FONTS) return window.FONTS();
    if (typeof globalThis !== 'undefined' && globalThis.FONTS) return globalThis.FONTS();
    return { serif: 'DejaVu Serif', sans: 'DejaVu Sans' };
  }

  /* ---------------------------------------------------------------- */
  /* master render                                                     */
  /* ---------------------------------------------------------------- */

  var SHOTS = [
    { t0: 0.00, t1: 4.60, render: shot1a },
    { t0: 4.60, t1: 7.15, render: shot1b, fade: 0.45 },
    { t0: 7.15, t1: 9.70, render: shot2a },
    { t0: 9.70, t1: 12.60, render: shot2b },
    { t0: 12.60, t1: 16.30, render: shot2c },
    { t0: 16.30, t1: 18.30, render: shotJ1, fade: 0.5 },
    { t0: 18.30, t1: 19.50, render: shotJ2, fade: 0.32 },
    { t0: 19.50, t1: 20.35, render: shotJ3a, fade: 0.3 },
    { t0: 20.35, t1: 21.25, render: shotJ3b, fade: 0.3 },
    { t0: 21.25, t1: 22.45, render: shotJ4, fade: 0.34 },
    { t0: 22.45, t1: 27.8, render: shotJ5, fade: 0.4 }
  ];

  var CAMS = {
    shot1a: [[0, { x: 630, y: 372, z: 0.98, r: 0 }],
             [3.0, { x: 664, y: 352, z: 1.05, r: 0, e: 'smooth' }],
             [4.6, { x: 716, y: 334, z: 1.2, r: 0, e: 'inOutCubic' }]],
    shot1b: [[4.6, { x: 640, y: 380, z: 1.02, r: 0 }],
             [7.15, { x: 655, y: 372, z: 1.06, r: 0, e: 'smooth' }]],
    shot2a: [[7.15, { x: 620, y: 352, z: 1.0, r: 0 }],
             [9.3, { x: 660, y: 350, z: 1.07, r: 0, e: 'smooth' }],
             [9.7, { x: 700, y: 356, z: 1.1, r: -0.03, e: 'inOutCubic' }]],
    shot2b: [[9.7, { x: 480, y: 360, z: 0.96, r: 0 }],
             [12.6, { x: 830, y: 430, z: 0.98, r: 0.04, e: 'smooth' }]],
    shot2c: [[12.6, { x: 640, y: 430, z: 1.0, r: 0 }],
             [16.3, { x: 590, y: 420, z: 1.08, r: 0, e: 'smooth' }]],
    shotJ1: [[16.3, { x: 600, y: 430, z: 1.0, r: 0 }],
             [18.3, { x: 660, y: 436, z: 1.0, r: 0, e: 'smooth' }]],
    shotJ2: [[18.3, { x: 600, y: 430, z: 1.02, r: 0 }],
             [19.5, { x: 655, y: 436, z: 1.03, r: 0, e: 'smooth' }]],
    shotJ3a: [[19.5, { x: 600, y: 430, z: 1.03, r: 0 }],
              [20.35, { x: 645, y: 440, z: 1.05, r: 0, e: 'smooth' }]],
    shotJ3b: [[20.35, { x: 610, y: 430, z: 1.0, r: 0 }],
              [21.25, { x: 655, y: 436, z: 1.02, r: 0, e: 'smooth' }]],
    shotJ4: [[21.25, { x: 620, y: 440, z: 1.1, r: 0 }],
             [22.45, { x: 680, y: 452, z: 1.12, r: 0, e: 'smooth' }]],
    shotJ5: [[22.45, { x: 640, y: 470, z: 1.0, r: 0 }],
             [25.4, { x: 880, y: 486, z: 1.18, r: 0, e: 'inOutCubic' }],
             [27.8, { x: 935, y: 500, z: 1.24, r: 0, e: 'smooth' }]]
  };

  var SHAKES = {
    shot2a: [{ t0: IMPACT, amp: 15, rot: 0.012, freq: 26, dur: 3.2 }],
    shot2b: [{ t0: S2B_T0, amp: 4, rot: 0.004, freq: 20, dur: 2.4 }],
    shot2c: [{ t0: CRASH, amp: 9, rot: 0.008, freq: 22, dur: 3.0 }]
  };

  function shotKeyOf(i) { return 'shot' + SHOTS[i].t0.toFixed(0) + SHOTS[i].t1.toFixed(0); }

  // map shot index -> camera/shake key
  var SHOT_CAM_KEYS = ['shot1a', 'shot1b', 'shot2a', 'shot2b', 'shot2c', 'shotJ1', 'shotJ2', 'shotJ3a', 'shotJ3b', 'shotJ4', 'shotJ5'];

  function renderShot(ctx, i, t) {
    var s = SHOTS[i];
    var cam = camAt(CAMS[SHOT_CAM_KEYS[i]], t);
    var sh = shakeAt(SHAKES[SHOT_CAM_KEYS[i]], t);
    applyCamera(ctx, W, H, cam, sh);
    s.render(ctx, t);
    endCamera(ctx);
  }

  function renderFrame(ctx, t, opts) {
    opts = opts || {};
    // black base so camera gaps (zoom-out) never show stale/blank pixels
    ctx.fillRect(0, 0, W, H, '#000');
    // find the active shot
    var cur = -1;
    for (var k = SHOTS.length - 1; k >= 0; k--) {
      if (t >= SHOTS[k].t0) { cur = k; break; }
    }
    if (cur < 0) { // before start: hold first frame
      ctx.fillRect(0, 0, W, H, '#000');
      return;
    }
    if (t >= SHOTS[SHOTS.length - 1].t1) {
      // hold last state: J5 at its end (black + THE END)
      renderShot(ctx, SHOTS.length - 1, SHOTS[SHOTS.length - 1].t1);
    } else {
      // crossfade: shot i fades IN over the previous shot during
      // [t0 - fade, t0]
      var next = cur + 1;
      if (next < SHOTS.length && SHOTS[next].fade &&
          t >= SHOTS[next].t0 - SHOTS[next].fade && t < SHOTS[next].t0) {
        renderShot(ctx, cur, t);
        var a = E.inOutCubic(prog(t, SHOTS[next].t0 - SHOTS[next].fade, SHOTS[next].t0));
        renderShot(withAlpha(ctx, a), next, t);
      } else {
        renderShot(ctx, cur, t);
      }
    }

    // global post (screen space — camera-independent)
    vignette(ctx, W, H, 0.34);
    letterbox(ctx, W, H, 1);
    // opening fade-in from black
    fade(ctx, W, H, 1 - E.outCubic(prog(t, 0, 0.9)));
    // final fade to black + THE END
    var fadeA = E.inOutCubic(prog(t, 25.6, 26.9));
    if (fadeA > 0) fade(ctx, W, H, fadeA);
    var endA = E.outCubic(prog(t, 27.0, 27.6));
    if (endA > 0) {
      ctx.setAlpha(endA * 0.9);
      ctx.text('THE END', W / 2, 386, {
        size: 42, family: FONTS().serif, weight: 400, color: '#d8cfc0',
        align: 'middle', baseline: 'middle', spacing: 10
      });
      ctx.setAlpha(1);
    }
    // film grain (canvas only)
    if (!opts.noGrain) grain(ctx, W, H, t, 0.05);
  }

  // Poster frame for the title screen (J5, cabin glow, before the fade)
  function posterT(nowSec) { return 24.55 + 0.12 * Math.sin(nowSec * 0.18); }

  return {
    W: W, H: H,
    AUDIO_END: 23.02,
    END: 27.8,
    renderFrame: renderFrame,
    posterT: posterT,
    shotCount: SHOTS.length
  };
});
