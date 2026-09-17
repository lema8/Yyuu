/*
 * sky.js — sky, sun, moon, stars, clouds. All pure functions of time t.
 * A "palette" describes the atmosphere of a shot:
 *   { skyTop, skyBot, horizon: {color, alpha, h}, sun: {x,y,r,core,glow,glowR},
 *     moon: {x,y,r}, stars: 0..1, clouds: 0..1 (density/visibility) }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  /* Precomputed star field (deterministic) */
  var STARS = (function () {
    var r = new Rng(7);
    var out = [];
    for (var i = 0; i < 170; i++) {
      out.push({
        x: r.range(0, 1280), y: r.range(0, 430),
        r: r.range(0.5, 1.7),
        tw: r.range(0.5, 2.2), ph: r.range(0, 6.28),
        a: r.range(0.35, 1)
      });
    }
    return out;
  })();

  /* Clouds: puffy blobs, deterministic. Each cloud: {x,y,s,speed,seed} */
  function makeClouds(seed, yMin, yMax, count, sMin, sMax, speed) {
    var r = new Rng(seed);
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push({
        x: r.range(-300, 1600), y: r.range(yMin, yMax),
        s: r.range(sMin, sMax),
        speed: speed * r.range(0.7, 1.3),
        seed: r.int(1, 100000),
        blobs: (function () {
          var b = [];
          var n = r.int(4, 6);
          for (var j = 0; j < n; j++) {
            b.push({ dx: (j - n / 2) * 34 + r.range(-12, 12), dy: r.range(-14, 8), rr: r.range(26, 46) });
          }
          return b;
        })()
      });
    }
    return out;
  }

  function drawCloud(ctx, c, t, W, alpha, color, shadeColor) {
    var x = ((c.x + t * c.speed) % (W + 900) + (W + 900)) % (W + 900) - 450;
    var y = c.y + Math.sin(t * 0.12 + c.seed) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(c.s, c.s * 0.72);
    ctx.setAlpha(alpha);
    // main body
    ctx.beginPath();
    for (var i = 0; i < c.blobs.length; i++) {
      var b = c.blobs[i];
      ctx.moveTo(b.dx + b.rr, b.dy);
      ctx.arc(b.dx, b.dy, b.rr, 0, Math.PI * 2);
    }
    ctx.fill(color);
    // soft flat base
    ctx.beginPath();
    ctx.ellipse(0, 20, 95, 20, 0, 0, Math.PI * 2);
    ctx.fill(color);
    // underside shade
    ctx.setAlpha(alpha * 0.25);
    ctx.beginPath();
    ctx.ellipse(4, 26, 88, 13, 0, 0, Math.PI * 2);
    ctx.fill(shadeColor);
    ctx.restore();
  }

  function drawSky(ctx, pal, t, W, H) {
    // base gradient (overdrawn beyond the frame so zoomed-out cameras
    // never reveal edges)
    ctx.fillRect(-500, -500, W + 1000, H + 1000,
      ctx.linear(0, -500, 0, H + 500, [[0, pal.skyTop], [1, pal.skyBot]]));
    // horizon glow band
    if (pal.horizon) {
      var hh = pal.horizon.h || 260;
      ctx.fillRect(-500, H - hh - 160, W + 1000, hh + 660,
        ctx.linear(0, H - hh - 160, 0, H, [[0, 'rgba(0,0,0,0)'], [1, pal.horizon.color]]));
      // note: alpha of color encodes strength
    }
    // sun
    if (pal.sun) {
      var s = pal.sun;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.glowR, 0, Math.PI * 2);
      ctx.fill(ctx.radial(s.x, s.y, 0, s.x, s.y, s.glowR, [
        [0, s.glow], [0.4, s.glowMid || 'rgba(255,220,150,0.18)'], [1, 'rgba(255,220,150,0)']
      ]));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill(s.core);
    }
    // moon
    if (pal.moon) {
      var m = pal.moon;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 3.4, 0, Math.PI * 2);
      ctx.fill(ctx.radial(m.x, m.y, 0, m.x, m.y, m.r * 3.4, [
        [0, 'rgba(210,225,255,0.28)'], [1, 'rgba(210,225,255,0)']
      ]));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill('#e8eef8');
      // crater hints
      ctx.setAlpha(0.14);
      ctx.beginPath(); ctx.arc(m.x - m.r * 0.3, m.y - m.r * 0.15, m.r * 0.22, 0, Math.PI * 2); ctx.fill('#9fb2d0');
      ctx.beginPath(); ctx.arc(m.x + m.r * 0.35, m.y + m.r * 0.3, m.r * 0.16, 0, Math.PI * 2); ctx.fill('#9fb2d0');
      ctx.setAlpha(1);
    }
    // stars
    if (pal.stars > 0) {
      ctx.setAlpha(1);
      for (var i = 0; i < STARS.length; i++) {
        var st = STARS[i];
        if (st.a > pal.stars * 1.1) continue; // thin field by density
        var tw = 0.55 + 0.45 * Math.sin(t * st.tw + st.ph);
        ctx.setAlpha(pal.stars * st.a * tw);
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill('#eaf2ff');
      }
      ctx.setAlpha(1);
    }
  }

  return { drawSky: drawSky, drawCloud: drawCloud, makeClouds: makeClouds };
});
