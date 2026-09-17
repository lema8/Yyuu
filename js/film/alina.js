/*
 * alina.js — Alina, the main character. THE single source of truth for her
 * look, so she is identical in every shot.
 *
 * Canonical design (side profile, facing right, origin at her feet):
 *   - medium-length dark brown hair, shoulder length
 *   - green jacket, dark slate trousers, brown boots
 *   - friendly, natural face (dot eye, soft cheek)
 *
 * drawAlina(ctx, x, y, s, opts):
 *   opts = {
 *     t:        absolute time (hair sway, etc.)
 *     phase:    walk cycle phase (rad) — advance ~ 9 rad/s for a brisk walk
 *     gait:     0..1  stride energy (tired = smaller)
 *     still:    0..1  blend toward a standing pose
 *     fatigue:  0..1  slump of shoulders/head
 *     facing:   1 = right, -1 = left
 *     look:     head rotation (rad, + = up/forward)
 *     silhouette: 0..1  blend to flat silhouette
 *     silColor: silhouette color (default #1c2430)
 *     rim:      rim-light color (optional, with alpha via rgba)
 *   }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';
  var TAU = Math.PI * 2;

  /* canonical palette */
  var PAL = {
    hair: '#2a211d', hairShine: '#4a3a30',
    skin: '#f3c9a6', skinShade: '#d9a982',
    jacket: '#3e7a4e', jacketDark: '#31603c', jacketLight: '#4d8f5e',
    trouser: '#3a4a5c', trouserDark: '#2f3d4c',
    boot: '#7a4a2b', bootDark: '#5f3820',
    eye: '#26201c'
  };

  function hexToRgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function mix(c1, c2, k) {
    var a = hexToRgb(c1), b = hexToRgb(c2);
    var h = function (n) { return Math.round(n).toString(16).padStart(2, '0'); };
    return '#' + h(a[0] + (b[0] - a[0]) * k) + h(a[1] + (b[1] - a[1]) * k) + h(a[2] + (b[2] - a[2]) * k);
  }

  /* two-bone IK: joint position given anchor A, target B, lengths l1 l2,
   * bend = +1/-1 which side the joint bulges to */
  function ik(ax, ay, bx, by, l1, l2, bend) {
    var dx = bx - ax, dy = by - ay;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    d = Math.min(d, l1 + l2 - 0.5);
    d = Math.max(d, Math.abs(l1 - l2) + 0.5);
    var base = Math.atan2(dy, dx);
    var cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    var angA = Math.acos(Math.max(-1, Math.min(1, cosA)));
    return [ax + l1 * Math.cos(base + bend * angA), ay + l1 * Math.sin(base + bend * angA)];
  }

  function drawAlina(ctx, x, y, s, o) {
    o = o || {};
    var t = o.t || 0;
    var f = o.facing || 1;
    var sil = o.silhouette || 0;
    var silColor = o.silColor || '#1c2430';
    var fatigue = o.fatigue || 0;
    var still = o.still || 0;
    var gait = (o.gait !== undefined ? o.gait : 1) * (1 - 0.22 * fatigue);
    var look = o.look || 0;

    // palette blended toward silhouette
    var P = {};
    for (var k in PAL) P[k] = sil > 0 ? mix(PAL[k], silColor, sil) : PAL[k];
    // under silhouette, darken shades a touch for depth
    var Pshade = {
      skinShade: P.skin, hairShine: P.hair, jacketDark: mix(P.jacket, silColor, Math.min(1, sil * 1.2 + 0.15)),
      trouserDark: P.trouser, bootDark: P.boot
    };

    // walk cycle
    var ph = o.phase || 0;
    var stepR = 12.5 * gait;
    var liftR = 6.5 * gait;
    var bobR = 2.1 * gait;

    function footPos(i) {
      var p = ph + i * Math.PI;
      var wx = stepR * Math.cos(p);
      var wy = -liftR * Math.abs(Math.sin(p));
      // blend to standing
      var nx = i === 0 ? -3.5 : 3.5;
      return [wx * (1 - still) + nx * still, wy * (1 - still)];
    }

    var slump = fatigue * 5;
    var lean = fatigue * 0.10 + 0.02;
    var hipX = 0, hipY = -46 + bobR * 0.5 * (1 + Math.cos(2 * ph)) * (1 - still) - slump * 0.4;
    var shX = 3 + Math.sin(lean) * 12, shY = hipY - 26 + slump * 0.5;
    var headX = shX + 4 + Math.sin(lean) * 4, headY = shY - 11 + slump * 0.25;
    var headR = 10.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * f, s);

    var far = footPos(1), near = footPos(0);
    if (o.sit) { near = [20, -6]; far = [13, -9]; }

    // ================= FAR LEG =================
    (function () {
      var hx = hipX - 1.5, hy = hipY;
      var j = ik(hx, hy, far[0], far[1], 24, 23, -1); // knee back
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(j[0], j[1]);
      ctx.lineTo(far[0], far[1] + 2);
      ctx.strokeStyle = P.trouser;
      ctx.lineWidth = 9;
      ctx.setLineCap("round");
      ctx.stroke();
      // far boot
      ctx.save();
      ctx.translate(far[0], far[1] + 2);
      boot(ctx, P.bootDark);
      ctx.restore();
    })();

    // ================= FAR ARM (behind torso) =================
    (function () {
      var ax = shX - 2.5, ay = shY + 1;
      var swing = Math.sin(ph + Math.PI); // opposite of near leg
      var hxx = o.sit ? shX + 8 : ax + 9 * Math.sin(swing) * (1 - still) + 1 * still;
      var hyy = o.sit ? shY + 25 : ay + 21 + 1.5 * Math.cos(swing) * (1 - still);
      var j = ik(ax, ay, hxx, hyy, 14, 13, 1); // elbow back
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(j[0], j[1]);
      ctx.lineTo(hxx, hyy);
      ctx.strokeStyle = mix(P.jacketDark, '#141d17', 0.45);
      ctx.lineWidth = 6.5;
      ctx.setLineCap("round");
      ctx.stroke();
      // hand
      ctx.beginPath();
      ctx.arc(hxx, hyy, 2.6, 0, TAU);
      ctx.fill(P.skinShade);
    })();

    // ================= HAIR (back mass, behind head/torso top) =================
    var sway = Math.sin(t * 2.7) * 1.6 + Math.sin(t * 4.3 + 1.2) * 1.1;
    var walkSway = Math.sin(ph) * 1.4 * (1 - still) * gait;
    (function () {
      var bx = headX - 2, by = headY;
      ctx.beginPath();
      ctx.moveTo(bx + headR * 0.5, by - headR * 0.95);
      ctx.quadTo(bx - headR * 1.05, by - headR * 1.05, bx - headR * 0.95, by - headR * 0.1);
      ctx.quadTo(bx - headR * 0.9 + sway * 0.4, by + headR * 0.9, bx - headR * 0.55 + sway + walkSway, by + headR * 1.55);
      ctx.quadTo(bx - headR * 0.15 + sway * 0.5, by + headR * 1.2, bx + headR * 0.2, by + headR * 0.35);
      ctx.quadTo(bx + headR * 0.4, by - headR * 0.2, bx + headR * 0.5, by - headR * 0.95);
      ctx.closePath();
      ctx.fill(P.hair);
    })();

    // ================= TORSO / JACKET =================
    (function () {
      ctx.beginPath();
      ctx.moveTo(hipX - 7, hipY + 3);
      ctx.quadTo(hipX - 9.5, hipY - 14, shX - 8, shY + 3);      // back
      ctx.quadTo(shX - 7, shY - 4, shX + 2, shY - 5.5);          // shoulder to neck
      ctx.quadTo(shX + 9, shY - 3.5, shX + 9.5, shY + 4);        // front shoulder
      ctx.quadTo(hipX + 9.5, hipY - 8, hipX + 8, hipY + 2);      // chest to hem
      ctx.quadTo(hipX + 1, hipY + 6.5, hipX - 7, hipY + 3);      // hem
      ctx.closePath();
      ctx.fill(P.jacket);
      // front light edge (sun side)
      ctx.beginPath();
      ctx.moveTo(shX + 9.5, shY + 4);
      ctx.quadTo(hipX + 9.5, hipY - 8, hipX + 8, hipY + 2);
      ctx.quadTo(hipX + 6, hipY + 4, hipX + 4, hipY + 4);
      ctx.quadTo(hipX + 6.5, hipY - 8, shX + 6.5, shY + 4);
      ctx.closePath();
      ctx.fill(P.jacketLight);
      // zipper
      ctx.beginPath();
      ctx.moveTo(shX + 5.5, shY + 3);
      ctx.lineTo(hipX + 5, hipY + 3);
      ctx.stroke('#2c5238', 1.2);
      // collar
      ctx.beginPath();
      ctx.moveTo(shX + 1.5, shY - 5.5);
      ctx.quadTo(shX + 7, shY - 4, shX + 8.5, shY + 1);
      ctx.lineTo(shX + 5, shY + 1.5);
      ctx.quadTo(shX + 3.5, shY - 3, shX + 0.5, shY - 3);
      ctx.closePath();
      ctx.fill(P.jacketDark);
    })();

    // ================= NEAR LEG =================
    (function () {
      var hx = hipX + 1.5, hy = hipY;
      var j = ik(hx, hy, near[0], near[1], 24, 23, -1);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(j[0], j[1]);
      ctx.lineTo(near[0], near[1] + 2);
      ctx.strokeStyle = P.trouserDark;
      ctx.lineWidth = 9;
      ctx.setLineCap("round");
      ctx.stroke();
      ctx.save();
      ctx.translate(near[0], near[1] + 2);
      boot(ctx, P.boot);
      ctx.restore();
    })();

    // ================= HEAD =================
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(-look + fatigue * 0.06);
    // neck
    ctx.beginPath();
    ctx.moveTo(-4, 6);
    ctx.lineTo(5, 6);
    ctx.lineTo(4, 12);
    ctx.lineTo(-3, 12);
    ctx.closePath();
    ctx.fill(P.skinShade);
    // face
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, TAU);
    ctx.fill(P.skin);
    // nose (tiny bump, facing right)
    ctx.beginPath();
    ctx.moveTo(headR * 0.82, -2);
    ctx.quadTo(headR * 1.08, 0.5, headR * 0.8, 2.4);
    ctx.quadTo(headR * 0.72, 1, headR * 0.82, -2);
    ctx.fill(P.skin);
    // front hair over the crown + fringe
    ctx.beginPath();
    ctx.moveTo(headR * 0.92, -headR * 0.42);
    ctx.quadTo(headR * 0.9, -headR * 1.18, -headR * 0.2, -headR * 1.08);
    ctx.quadTo(-headR * 0.75, -headR * 1.0, -headR * 0.92, -headR * 0.3);
    ctx.quadTo(-headR * 0.3, -headR * 0.75, headR * 0.25, -headR * 0.62);
    ctx.quadTo(headR * 0.7, -headR * 0.5, headR * 0.92, -headR * 0.42);
    ctx.closePath();
    ctx.fill(P.hair);
    // shine strand
    if (sil < 0.5) {
      ctx.beginPath();
      ctx.moveTo(headR * 0.55, -headR * 0.92);
      ctx.quadTo(headR * 0.15, -headR * 1.05, -headR * 0.35, -headR * 0.95);
      ctx.stroke(P.hairShine, 1.6);
    }
    // eye
    ctx.beginPath();
    ctx.arc(headR * 0.45, -headR * 0.08, 1.25, 0, TAU);
    ctx.fill(P.eye);
    // gentle brow
    ctx.beginPath();
    ctx.moveTo(headR * 0.28, -headR * 0.3);
    ctx.quadTo(headR * 0.48, -headR * 0.38, headR * 0.64, -headR * 0.3);
    ctx.stroke(mix(P.eye, P.skin, 0.25), 1.1);
    // mouth (small, calm; slightly open smile)
    ctx.beginPath();
    ctx.moveTo(headR * 0.52, headR * 0.42);
    ctx.quadTo(headR * 0.62, headR * 0.5, headR * 0.72, headR * 0.4);
    ctx.stroke('#b5766a', 1.1);
    // cheek
    if (sil < 0.4) {
      ctx.setAlpha(0.35);
      ctx.beginPath();
      ctx.arc(headR * 0.38, headR * 0.16, 2.2, 0, TAU);
      ctx.fill('#f0957f');
      ctx.setAlpha(1);
    }
    ctx.restore();

    // ================= NEAR ARM (in front of torso) =================
    (function () {
      var ax = shX + 2, ay = shY + 1.5;
      var swing = Math.sin(ph); // opposite of near leg
      var hxx = o.sit ? shX + 13 : ax + 9.5 * Math.sin(swing) * (1 - still) + 2 * still;
      var hyy = o.sit ? shY + 24 : ay + 21.5 + 1.5 * Math.cos(swing) * (1 - still);
      var j = ik(ax, ay, hxx, hyy, 14, 13, 1);
      // sleeve (slightly darker than the torso so it reads in front)
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(j[0], j[1]);
      ctx.strokeStyle = P.jacketDark;
      ctx.lineWidth = 7;
      ctx.setLineCap("round");
      ctx.stroke();
      // forearm (jacket sleeve to wrist)
      ctx.beginPath();
      ctx.moveTo(j[0], j[1]);
      ctx.lineTo(hxx, hyy);
      ctx.strokeStyle = P.jacketDark;
      ctx.lineWidth = 6;
      ctx.setLineCap("round");
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hxx, hyy, 2.7, 0, TAU);
      ctx.fill(P.skin);
    })();

    // ================= RIM LIGHT (silhouette mode) =================
    if (o.rim && sil > 0.25) {
      ctx.setAlpha(Math.min(1, sil) * 0.55);
      ctx.beginPath();
      ctx.arc(headX, headY, headR, -1.2 + Math.PI * 0.0, 0.9);
      ctx.stroke(o.rim, 1.6);
      ctx.beginPath();
      ctx.moveTo(shX + 9.5, shY + 4);
      ctx.quadTo(hipX + 9.5, hipY - 8, hipX + 8, hipY + 2);
      ctx.stroke(o.rim, 1.4);
      ctx.setAlpha(1);
    }

    ctx.restore();
  }

  function boot(ctx, color) {
    // local origin at ankle; foot extends +x (forward)
    ctx.beginPath();
    ctx.moveTo(-4.5, -1);
    ctx.quadTo(-5.5, 3, -4.5, 4.5);
    ctx.lineTo(8.5, 4.5);
    ctx.quadTo(11, 4.5, 10.8, 1.5);
    ctx.quadTo(10, -1, 6, -2.5);
    ctx.lineTo(1.5, -3.5);
    ctx.closePath();
    ctx.fill(color);
    // sole
    ctx.beginPath();
    ctx.moveTo(-4.5, 3.4);
    ctx.lineTo(10.8, 3.4);
    ctx.quadTo(11.2, 4.6, 10.4, 4.8);
    ctx.lineTo(-4.4, 4.8);
    ctx.closePath();
    ctx.fill('#2e2119');
  }

  return { drawAlina: drawAlina, ALINA_PAL: PAL };
});
