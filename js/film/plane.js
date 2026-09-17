/*
 * plane.js — a stylized passenger airliner (side view, nose to the right).
 * Origin = fuselage center. Length ~230 units at s=1.
 *
 * opts: {
 *   bellyShade, livery (tail color), windowLight (bool: interior lit),
 *   engineFire (0..1 glow), flash (0..1 impact flash at engine)
 * }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';
  var TAU = Math.PI * 2;

  function drawPlane(ctx, x, y, s, rot, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);

    var BODY = '#f4f7fa', BELLY = '#c9d4dd', DARK = '#2a3540';
    var LIVERY = opts.livery || '#2e8b8b';

    // --- far wing (sliver above fuselage, behind) ---
    ctx.beginPath();
    ctx.moveTo(26, -8);
    ctx.lineTo(-18, -30);
    ctx.lineTo(-34, -26);
    ctx.lineTo(6, -8);
    ctx.closePath();
    ctx.fill('#dbe4ec');

    // --- tail (vertical stabilizer + horizontal) ---
    ctx.beginPath();
    ctx.moveTo(-62, -6);
    ctx.quadTo(-78, -52, -96, -58);
    ctx.lineTo(-112, -56);
    ctx.quadTo(-104, -30, -98, -8);
    ctx.closePath();
    ctx.fill(BODY);
    // tail livery band
    ctx.beginPath();
    ctx.moveTo(-88, -57);
    ctx.lineTo(-112, -56);
    ctx.quadTo(-106, -36, -101, -20);
    ctx.lineTo(-84, -26);
    ctx.closePath();
    ctx.fill(LIVERY);
    // little bird logo on the tail (foreshadows the strike)
    ctx.save();
    ctx.translate(-99, -40);
    ctx.scale(0.5, 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadTo(6, -6, 13, -3);
    ctx.quadTo(6, -1, 0, 1);
    ctx.closePath();
    ctx.fill('#ffffff');
    ctx.restore();
    // horizontal stabilizer
    ctx.beginPath();
    ctx.moveTo(-70, -10);
    ctx.lineTo(-118, -22);
    ctx.lineTo(-124, -16);
    ctx.lineTo(-80, -4);
    ctx.closePath();
    ctx.fill('#e3ebf1');

    // --- fuselage ---
    ctx.beginPath();
    ctx.moveTo(-104, -4);
    ctx.quadTo(-110, -14, -84, -17);      // tail cone
    ctx.lineTo(58, -17);                   // top
    ctx.quadTo(92, -15, 106, -2);          // nose top
    ctx.quadTo(110, 2, 104, 6);            // nose bottom
    ctx.quadTo(88, 14, 58, 14);            // nose to belly
    ctx.lineTo(-84, 14);                   // belly
    ctx.quadTo(-104, 10, -104, -4);
    ctx.closePath();
    ctx.fill(BODY);

    // belly shade
    ctx.beginPath();
    ctx.moveTo(-100, 4);
    ctx.quadTo(-80, 12, 20, 13.4);
    ctx.lineTo(58, 13.4);
    ctx.quadTo(90, 12, 102, 5);
    ctx.quadTo(92, 12, 58, 14);
    ctx.lineTo(-84, 14);
    ctx.quadTo(-102, 10, -100, 4);
    ctx.closePath();
    ctx.fill(BELLY);

    // livery stripe along the fuselage
    ctx.beginPath();
    ctx.moveTo(-100, -2);
    ctx.lineTo(104, -2);
    ctx.quadTo(108, 1, 103, 3);
    ctx.lineTo(-100, 3);
    ctx.closePath();
    ctx.fill(LIVERY);

    // cockpit windows
    ctx.beginPath();
    ctx.moveTo(86, -14);
    ctx.lineTo(100, -7);
    ctx.lineTo(88, -6);
    ctx.lineTo(79, -12);
    ctx.closePath();
    ctx.fill(DARK);

    // passenger windows
    var wx0 = -78, wx1 = 66;
    for (var i = 0; i < 11; i++) {
      var wx = wx0 + (wx1 - wx0) * (i / 10);
      ctx.beginPath();
      if (opts.windowLight) {
        ctx.arc(wx, -8, 3.4, 0, TAU);
        ctx.fill('rgba(255,225,150,0.25)');
        ctx.arc(wx, -8, 2.3, 0, TAU);
        ctx.fill('#ffe9b0');
      } else {
        ctx.arc(wx, -8, 2.3, 0, TAU);
        ctx.fill('#8fa3b5');
      }
    }

    // --- near wing ---
    ctx.beginPath();
    ctx.moveTo(34, 4);
    ctx.lineTo(-24, 34);
    ctx.lineTo(-44, 31);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fill('#e8eff5');

    // --- engine under the wing ---
    ctx.save();
    ctx.translate(6, 27);
    // pylon
    ctx.beginPath();
    ctx.moveTo(-4, -12); ctx.lineTo(6, -12); ctx.lineTo(10, -4); ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill('#b9c6d1');
    // nacelle
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(18, -8);
    ctx.quadTo(26, -8, 26, 0);
    ctx.quadTo(26, 8, 18, 8);
    ctx.lineTo(-26, 8);
    ctx.quadTo(-32, 8, -32, 0);
    ctx.quadTo(-32, -8, -26, -8);
    ctx.closePath();
    ctx.fill('#eef3f7');
    // intake lip (front = right side, facing flight direction)
    ctx.beginPath();
    ctx.arc(25, 0, 8, -Math.PI / 2, Math.PI / 2);
    ctx.fill('#39434d');
    ctx.beginPath();
    ctx.arc(25, 0, 5.6, -Math.PI / 2, Math.PI / 2);
    ctx.fill('#141a20');
    // fire glow inside the intake after the strike
    if (opts.engineFire > 0) {
      var f = opts.engineFire;
      ctx.setAlpha(f);
      ctx.beginPath();
      ctx.arc(27, 0, 15, 0, TAU);
      ctx.fill(ctx.radial(27, 0, 0, 27, 0, 15, [
        [0, 'rgba(255,240,200,0.95)'],
        [0.35, 'rgba(255,150,60,0.8)'],
        [1, 'rgba(255,90,30,0)']
      ]));
      ctx.setAlpha(1);
    }
    // impact flash
    if (opts.flash > 0) {
      var fr = 30 + (1 - opts.flash) * 55;
      ctx.setAlpha(opts.flash);
      ctx.beginPath();
      ctx.arc(25, 0, fr, 0, TAU);
      ctx.fill(ctx.radial(25, 0, 0, 25, 0, fr, [
        [0, 'rgba(255,255,255,0.98)'],
        [0.4, 'rgba(255,220,150,0.75)'],
        [1, 'rgba(255,200,120,0)']
      ]));
      ctx.setAlpha(1);
    }
    ctx.restore();

    ctx.restore();
  }

  return { drawPlane: drawPlane };
});
