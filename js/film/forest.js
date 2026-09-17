/*
 * forest.js — procedural parallax forest layers.
 * A "layer" is a precomputed silhouette: an array of path subpaths (trees)
 * sitting on a baseline. Drawn as one path per layer (cheap per frame).
 *
 * Trees: conifers (stacked triangles), rounded canopy (bumpy), pines (tall
 * narrow). Each layer has its own seed so different shots can use different
 * stretches of forest.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  var TAU = Math.PI * 2;

  // build one tree as a subpath (adds to ctx path), rooted at (0,0) baseline
  function coniferTree(ctx, h, w, tiers) {
    tiers = tiers || 3;
    var tw = w;
    for (var i = 0; i < tiers; i++) {
      var ty = -h * (i / tiers) * 0.72;          // tier base y
      var th = h * 0.42;                          // tier height
      var topW = tw * (0.55 + 0.45 * (1 - i / tiers));
      ctx.moveTo(-tw / 2, ty);
      ctx.lineTo(0, ty - th);
      ctx.lineTo(tw / 2, ty);
      ctx.closePath();
      tw = topW * 0.82;
    }
    // trunk
    ctx.moveTo(-w * 0.05, 0);
    ctx.lineTo(-w * 0.05, -h * 0.12);
    ctx.lineTo(w * 0.05, -h * 0.12);
    ctx.lineTo(w * 0.05, 0);
    ctx.closePath();
  }

  // makeForestLayer(seed, opts) -> {trees: [{x, h, w, type}], baseY}
  function makeForestLayer(seed, opts) {
    var r = new Rng(seed);
    var x0 = opts.x0 !== undefined ? opts.x0 : -200;
    var x1 = opts.x1 !== undefined ? opts.x1 : 1500;
    var baseY = opts.baseY;
    var gap = opts.gap || 46;
    var hMin = opts.hMin || 60, hMax = opts.hMax || 160;
    var wScale = opts.wScale || 1;
    var mix = opts.mix || [0.5, 0.5]; // [conifer, canopy]
    var trees = [];
    var x = x0;
    while (x < x1) {
      var type = r.next() < mix[0] ? 'conifer' : 'canopy';
      var h = r.range(hMin, hMax);
      var w = h * (type === 'conifer' ? r.range(0.42, 0.55) : r.range(0.62, 0.8)) * wScale;
      trees.push({ x: x, h: h, w: w, type: type, ph: r.range(0, TAU), sw: r.range(0.5, 1) });
      x += gap * r.range(0.7, 1.5) + w * 0.25;
    }
    return { trees: trees, baseY: baseY, seed: seed };
  }

  // draw one layer; sway: optional {t, t0, amp, cx, spread} for wind shake after impact
  function drawForestLayer(ctx, layer, color, dy, sway) {
    var baseY = layer.baseY + (dy || 0);
    ctx.beginPath();
    for (var i = 0; i < layer.trees.length; i++) {
      var tr = layer.trees[i];
      var ox = 0;
      if (sway) {
        var since = sway.t - sway.t0;
        if (since > 0) {
          var fall = Math.exp(-since * 1.4);
          var prox = Math.exp(-Math.pow((tr.x - sway.cx) / sway.spread, 2));
          ox = Math.sin(since * 5 + tr.ph) * sway.amp * fall * prox * tr.sw;
        }
      }
      ctx.save();
      ctx.translate(tr.x + ox, baseY);
      if (tr.type === 'conifer') {
        coniferTree(ctx, tr.h, tr.w, 3);
      } else {
        // trunk + canopy in one path
        ctx.moveTo(-tr.w * 0.045, 0);
        ctx.lineTo(-tr.w * 0.045, -tr.h * 0.4);
        ctx.lineTo(tr.w * 0.045, -tr.h * 0.4);
        ctx.lineTo(tr.w * 0.045, 0);
        ctx.closePath();
        ctx.moveTo(tr.w * 0.5, -tr.h * 0.62);
        ctx.arc(0, -tr.h * 0.62, tr.w * 0.5, 0, TAU);
        ctx.moveTo(tr.w * 0.34 + -tr.w * 0.38, -tr.h * 0.48);
        ctx.arc(-tr.w * 0.38, -tr.h * 0.48, tr.w * 0.34, 0, TAU);
        ctx.moveTo(tr.w * 0.34 + tr.w * 0.38, -tr.h * 0.48);
        ctx.arc(tr.w * 0.38, -tr.h * 0.48, tr.w * 0.34, 0, TAU);
      }
      ctx.restore();
    }
    ctx.fill(color);
    // ground band under the layer
    ctx.fillRect(-400, baseY, 2100, 260, color);
  }

  return {
    makeForestLayer: makeForestLayer,
    drawForestLayer: drawForestLayer,
    coniferTree: coniferTree
  };
});
