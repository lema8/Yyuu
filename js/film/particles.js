/*
 * particles.js — deterministic particle effects. Every effect is a pure
 * function of time t (no state), so seeking/pausing always reproduces the
 * same frame — critical for audio-synced playback.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { Object.assign(root, api); root.Particles = api; }
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  function H(n) { // cheap per-index hash in [0,1)
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* Sparks from the engine strike.
   * opts: {x, y, t0, n, spread (rad around dir), dir, speed0, speed1, grav, life} */
  function drawSparks(ctx, o, t) {
    var age = t - o.t0;
    if (age < 0 || age > o.life) return;
    var n = o.n || 26;
    for (var i = 0; i < n; i++) {
      var a = o.dir + (H(i * 3.1) - 0.5) * o.spread;
      var sp = o.speed0 + H(i * 7.7) * (o.speed1 - o.speed0);
      var life = o.life * (0.5 + 0.5 * H(i * 5.3));
      var lt = age / life;
      if (lt > 1) continue;
      var x = o.x + Math.cos(a) * sp * age;
      var y = o.y + Math.sin(a) * sp * age + 0.5 * (o.grav || 500) * age * age;
      var k = 1 - lt;
      ctx.setAlpha(k * 0.95);
      // short streak
      var vx = Math.cos(a) * sp, vy = Math.sin(a) * sp + (o.grav || 500) * age;
      var vl = Math.sqrt(vx * vx + vy * vy) || 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (vx / vl) * (7 * k + 2), y - (vy / vl) * (7 * k + 2));
      ctx.stroke(i % 3 === 0 ? '#fff6d8' : '#ffb347', 2);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * k + 0.4, 0, Math.PI * 2);
      ctx.fill('#fff2c8');
    }
    ctx.setAlpha(1);
  }

  /* A single growing, fading smoke puff */
  function puff(ctx, x, y, r, alpha, color) {
    if (alpha <= 0.004) return;
    ctx.setAlpha(alpha);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill(color);
  }

  /* Engine smoke trail following a moving source.
   * source(t) -> {x,y}; puffs emitted every dt seconds from t0. */
  function drawSmokeTrail(ctx, o, t) {
    var age = t - o.t0;
    if (age < 0) return;
    var dt = o.dt || 0.09;
    var n = Math.floor(age / dt) + 1;
    var maxAge = o.maxAge || 2.6;
    for (var i = 0; i < n; i++) {
      var bt = o.t0 + i * dt;           // birth time
      var a = t - bt;                    // age of this puff
      if (a > maxAge) continue;
      var s = o.source(bt);
      var u = a / maxAge;
      var x = s.x + (o.windX || 14) * a + H(i * 11.3) * 6 - 3 + Math.sin(a * 2 + i) * 3;
      var y = s.y + (o.windY || -8) * a + H(i * 13.7) * 6 - 3;
      var r = (o.r0 || 5) + a * (o.grow || 14);
      var al = (o.a0 || 0.5) * (1 - u) * (1 - u);
      var dark = o.dark || 0;
      var c = o.color;
      if (!c) {
        var g = Math.round(150 - 70 * u - 40 * dark);
        c = 'rgb(' + g + ',' + g + ',' + (g + 4) + ')';
      }
      puff(ctx, x, y, r, al, c);
    }
    ctx.setAlpha(1);
  }

  /* Dust/smoke plume rising above the forest after the crash. */
  function drawDustPlume(ctx, o, t) {
    var age = t - o.t0;
    if (age < 0) return;
    var n = o.n || 30;
    for (var i = 0; i < n; i++) {
      var bt = i * 0.085;                    // staggered start
      var a = age - bt;
      if (a < 0) continue;
      var life = o.life || 6.5;
      if (a > life) continue;
      var u = a / life;
      var h = H(i * 17.3), h2 = H(i * 23.7), h3 = H(i * 29.1);
      var x = o.x + (h - 0.5) * (30 + 130 * u) * (0.4 + 0.6 * h2);
      var y = o.y - a * (42 + 85 * h3) - Math.sin(u * 3 + i) * 6;
      var r = (14 + 42 * h2) * (0.5 + u * 2.1);
      var al = (o.a0 || 0.55) * (1 - u) * Math.min(1, a * 3);
      var shade = 172 - Math.round(100 * u);
      puff(ctx, x, y, r, al * 0.85, 'rgb(' + shade + ',' + (shade - 6) + ',' + (shade - 16) + ')');
    }
    ctx.setAlpha(1);
  }

  /* Small debris arc: chunks thrown up at impact, falling back. */
  function drawDebris(ctx, o, t) {
    var age = t - o.t0;
    if (age < 0 || age > o.life) return;
    var n = o.n || 14;
    ctx.setAlpha(1);
    for (var i = 0; i < n; i++) {
      var h = H(i * 41.3), h2 = H(i * 47.9);
      var ang = Math.PI * (0.15 + 0.7 * h);           // up-left to up-right
      var sp = o.speed0 + h2 * (o.speed1 - o.speed0);
      var x = o.x + Math.cos(ang) * sp * age;
      var y = o.y - Math.sin(ang) * sp * age + 0.5 * 600 * age * age;
      if (y > o.y + 60) continue;
      var s = 2 + h2 * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(age * (4 + 6 * h) + h2 * 6);
      ctx.beginPath();
      ctx.moveTo(-s, 0); ctx.lineTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s * 0.6);
      ctx.closePath();
      ctx.fill(o.color || '#4a3a28');
      ctx.restore();
    }
  }

  /* Drifting leaves (autumn-ish journey beat). Deterministic. */
  function drawLeaves(ctx, o, t, W) {
    var n = o.n || 7;
    for (var i = 0; i < n; i++) {
      var h = H(i * 61.7), h2 = H(i * 67.3), h3 = H(i * 71.9);
      var speed = o.speed || 26;
      var x = W + 60 - ((t * speed + h * 1600) % (W + 120));
      var y = o.y0 + (h2 * o.yRange) + Math.sin(t * (1.2 + h3) + i * 2) * 14 + t * 4 * (0.5 + 0.5 * h3);
      if (y > o.y0 + o.yRange + 40) y = o.y0 + (y - o.y0 - o.yRange - 40);
      var rot = t * (2 + 3 * h) + i;
      var s = 4 + 3 * h2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, 0.6 + 0.4 * Math.sin(rot * 1.7));
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadTo(s * 0.9, 0, 0, s);
      ctx.quadTo(-s * 0.9, 0, 0, -s);
      ctx.fill(o.color || 'rgba(214,150,60,0.8)');
      ctx.restore();
    }
  }

  /* Fireflies (night beat). */
  function drawFireflies(ctx, o, t) {
    var n = o.n || 9;
    for (var i = 0; i < n; i++) {
      var h = H(i * 83.3), h2 = H(i * 89.7), h3 = H(i * 97.1);
      var x = o.x0 + h * o.xRange + Math.sin(t * (0.4 + 0.5 * h2) + i * 1.7) * 30;
      var y = o.y0 + h2 * o.yRange + Math.cos(t * (0.5 + 0.4 * h3) + i * 2.3) * 18;
      var blink = Math.pow(Math.max(0, Math.sin(t * (1.2 + 1.4 * h) + i * 2.9)), 3);
      if (blink < 0.02) continue;
      ctx.setAlpha(blink * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill('rgba(210,255,150,0.35)');
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill('#eaffb0');
    }
    ctx.setAlpha(1);
  }

  /* Dust motes in light (morning beat). */
  function drawMotes(ctx, o, t) {
    var n = o.n || 24;
    for (var i = 0; i < n; i++) {
      var h = H(i * 101.3), h2 = H(i * 107.7);
      var x = o.x0 + h * o.xRange + Math.sin(t * (0.3 + 0.5 * h2) + i) * 12;
      var y = o.y0 + h2 * o.yRange + Math.cos(t * (0.25 + 0.4 * h) + i * 1.3) * 10;
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + h) + i * 2.1));
      ctx.setAlpha(o.alpha || 0.5);
      ctx.setAlpha((o.alpha || 0.5) * tw * 0.6);
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + 1.3 * h2, 0, Math.PI * 2);
      ctx.fill('#fff6d8');
    }
    ctx.setAlpha(1);
  }

  /* Diagonal god-ray beams through the trees. */
  function drawGodRays(ctx, o, t) {
    var n = o.n || 4;
    for (var i = 0; i < n; i++) {
      var h = H(i * 113.7);
      var drift = Math.sin(t * 0.15 + i * 1.9) * 26;
      var x = o.x0 + i * o.gap + drift;
      var w = o.width * (0.7 + 0.5 * h);
      var al = (o.alpha || 0.1) * (0.7 + 0.3 * Math.sin(t * 0.4 + i * 2.2));
      ctx.setAlpha(1);
      var g = ctx.linear(x, o.y0, x - o.lean * 0.5, o.y1, [
        [0, 'rgba(255,246,214,0)'],
        [0.25, 'rgba(255,246,214,' + (al * 0.5).toFixed(3) + ')'],
        [0.75, 'rgba(255,246,214,' + al.toFixed(3) + ')'],
        [1, 'rgba(255,246,214,0)']
      ]);
      ctx.beginPath();
      ctx.moveTo(x, o.y0);
      ctx.lineTo(x + w, o.y0);
      ctx.lineTo(x + w - o.lean, o.y1);
      ctx.lineTo(x - o.lean, o.y1);
      ctx.closePath();
      ctx.fill(g);
    }
  }

  /* Horizontal drifting fog bands (dawn beat). */
  function drawFogBands(ctx, o, t, W) {
    var n = o.n || 4;
    for (var i = 0; i < n; i++) {
      var h = H(i * 127.3);
      var y = o.y0 + i * o.gap + Math.sin(t * 0.2 + i * 1.4) * 8;
      var off = ((t * (o.speed || 8) * (0.6 + 0.8 * h) + h * 800) % (W + 800)) - 400;
      ctx.setAlpha(1);
      ctx.beginPath();
      for (var k = 0; k < 7; k++) {
        var bx = off + k * 240;
        ctx.moveTo(bx + 190, y);
        ctx.arc(bx, y, 190, 0, Math.PI * 2);
        ctx.moveTo(bx + 160 * 0.7, y + 14);
        ctx.arc(bx + 160, y + 14, 160 * 0.7, 0, Math.PI * 2);
      }
      ctx.fill('rgba(226,238,242,' + (o.alpha || 0.16) + ')');
    }
  }

  /* Cabin chimney smoke: a lazy curling ribbon. */
  function drawChimneySmoke(ctx, o, t) {
    var age = t; // continuous
    var n = 22;
    for (var i = 0; i < n; i++) {
      var bt = i * 0.5;
      var a = age - bt;
      if (a < 0) continue;
      var u = Math.min(1, a / 7);
      var x = o.x + Math.sin(a * 0.9 + i * 0.35) * (6 + 26 * u) + a * 9;
      var y = o.y - a * 22;
      var r = 3 + u * 16;
      var al = 0.3 * (1 - u) * Math.min(1, a * 2);
      puff(ctx, x, y, r, al, o.night ? 'rgba(200,210,230,1)' : 'rgba(235,235,240,1)');
    }
    ctx.setAlpha(1);
  }

  return {
    drawSparks: drawSparks, drawSmokeTrail: drawSmokeTrail, drawDustPlume: drawDustPlume,
    drawDebris: drawDebris, drawLeaves: drawLeaves, drawFireflies: drawFireflies,
    drawMotes: drawMotes, drawGodRays: drawGodRays, drawFogBands: drawFogBands,
    drawChimneySmoke: drawChimneySmoke, puff: puff
  };
});
