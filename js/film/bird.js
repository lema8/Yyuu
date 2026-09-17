/* bird.js — a small starling-style bird with a 2-phase flap. Pure vector. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';
  var TAU = Math.PI * 2;

  /*
   * drawBird(ctx, x, y, s, flap, color, opts)
   *  flap: phase in radians (wing angle = sin(flap))
   *  facing: 1 = right, -1 = left
   */
  function drawBird(ctx, x, y, s, flap, color, opts) {
    opts = opts || {};
    var f = opts.facing || 1;
    var wa = Math.sin(flap) * 0.95;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * f, s);
    // tail
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-17, -4 + Math.sin(flap * 0.5) * 1.5);
    ctx.lineTo(-15, 1.5);
    ctx.lineTo(-17, 5);
    ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill(color);
    // body
    ctx.beginPath();
    ctx.moveTo(12, -1.5);           // beak tip area
    ctx.quadTo(4, -6.5, -6, -3);
    ctx.quadTo(-10, 0, -6, 3.5);
    ctx.quadTo(4, 6, 12, 1);
    ctx.closePath();
    ctx.fill(color);
    // beak
    ctx.beginPath();
    ctx.moveTo(11, -1);
    ctx.lineTo(16, 0.5);
    ctx.lineTo(11, 2);
    ctx.closePath();
    ctx.fill(opts.beak || '#e8a33d');
    // far wing (behind, darker)
    ctx.save();
    ctx.translate(-1, -2);
    ctx.rotate(-wa * 0.8 - 0.25);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadTo(-14, -10, -22, -6);
    ctx.quadTo(-12, 2, 0, 1.5);
    ctx.closePath();
    ctx.fill(darken(color, 0.75));
    ctx.restore();
    // near wing
    ctx.save();
    ctx.translate(0, -1);
    ctx.rotate(wa);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadTo(-15, -13, -26, -9);
    ctx.quadTo(-13, 2, 0, 2);
    ctx.closePath();
    ctx.fill(color);
    ctx.restore();
    // eye
    ctx.beginPath();
    ctx.arc(7.5, -1.8, 0.9, 0, TAU);
    ctx.fill('#101010');
    ctx.restore();
  }

  function darken(color, k) {
    // accepts #rrggbb
    if (color && color[0] === '#' && color.length === 7) {
      var r = Math.round(parseInt(color.substr(1, 2), 16) * k);
      var g = Math.round(parseInt(color.substr(3, 2), 16) * k);
      var b = Math.round(parseInt(color.substr(5, 2), 16) * k);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return color;
  }

  /* A small flock crossing the sky (ambience). */
  function drawFlock(ctx, t, baseX, baseY, n, s, color) {
    n = n || 4;
    for (var i = 0; i < n; i++) {
      var off = i * 34;
      var x = baseX - off - (i % 2) * 14;
      var y = baseY + Math.sin(i * 1.7) * 16 + Math.sin(t * 1.1 + i) * 4;
      drawBird(ctx, x, y, s * (1 - i * 0.12), t * (9 + i * 0.7), i === 0 ? color : darken(color, 0.85 - i * 0.06), { facing: 1 });
    }
  }

  return { drawBird: drawBird, drawFlock: drawFlock, darken: darken };
});
