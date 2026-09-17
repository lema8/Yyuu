/*
 * post.js — cinematic post pass: letterbox, vignette, grade wash, fades,
 * flashes, film grain (canvas-only).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  var BAR = 78; // letterbox bar height (720 -> 564 image, ~2.27:1)

  function letterbox(ctx, W, H, a) {
    a = a === undefined ? 1 : a;
    ctx.setAlpha(a);
    ctx.fillRect(0, 0, W, BAR, '#000000');
    ctx.fillRect(0, H - BAR, W, BAR, '#000000');
    ctx.setAlpha(1);
  }

  function vignette(ctx, W, H, strength) {
    var s = strength === undefined ? 0.34 : strength;
    var cx = W / 2, cy = H / 2;
    var r = Math.sqrt(W * W + H * H) * 0.62;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill(ctx.radial(cx, cy, r * 0.55, cx, cy, r, [
      [0, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,' + s.toFixed(3) + ')']
    ]));
  }

  // soft color wash over the whole image (cheap grade)
  function grade(ctx, W, H, color, alpha) {
    if (!color || !alpha) return;
    ctx.setAlpha(alpha);
    ctx.fillRect(0, 0, W, H, color);
    ctx.setAlpha(1);
  }

  function fade(ctx, W, H, a) {
    if (a <= 0) return;
    ctx.setAlpha(Math.min(1, a));
    ctx.fillRect(0, 0, W, H, '#000000');
    ctx.setAlpha(1);
  }

  function flash(ctx, W, H, a) {
    if (a <= 0) return;
    ctx.setAlpha(Math.min(1, a));
    ctx.fillRect(0, 0, W, H, '#ffffff');
    ctx.setAlpha(1);
  }

  /* film grain — canvas-only (skipped in SVG capture, negligible visually) */
  var grainCanvases = null;
  function ensureGrain() {
    if (grainCanvases || typeof document === 'undefined') return null;
    grainCanvases = [];
    for (var i = 0; i < 3; i++) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var g = c.getContext('2d');
      var img = g.createImageData(256, 256);
      for (var j = 0; j < img.data.length; j += 4) {
        var v = (Math.random() * 255) | 0;
        img.data[j] = v; img.data[j + 1] = v; img.data[j + 2] = v;
        img.data[j + 3] = 22;
      }
      g.putImageData(img, 0, 0);
      grainCanvases.push(c);
    }
    return grainCanvases;
  }

  function grain(ctx, W, H, t, strength) {
    if (!strength) return;
    var gs = ensureGrain();
    if (!gs) return;
    var c = ctx.ctx; // native canvas ctx (only real for canvas backend)
    if (!c || !c.createPattern) return;
    var g = gs[Math.floor(t * 24) % 3];
    var ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
    c.save();
    c.globalAlpha = strength;
    var pat = c.createPattern(g, 'repeat');
    c.translate(-ox, -oy);
    c.fillStyle = pat;
    c.fillRect(0, 0, W + 256, H + 256);
    c.restore();
  }

  return {
    BAR: BAR,
    letterbox: letterbox, vignette: vignette, grade: grade,
    fade: fade, flash: flash, grain: grain
  };
});
