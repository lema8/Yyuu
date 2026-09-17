/*
 * camera.js — keyframed camera (position, zoom, rotation) + decaying shake.
 * All motion is a pure function of time t.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  /*
   * track: [[t, {x, y, z, r, e?}], ...]
   * e: easing name from E (applied to segment progress)
   */
  function camAt(track, t) {
    return Easings.trackValue(track, t);
  }

  /*
   * shake: [{t0, amp, rot, freq, dur}]
   * returns {dx, dy, dr}
   */
  function shakeAt(shakes, t) {
    var dx = 0, dy = 0, dr = 0;
    if (!shakes) return { dx: dx, dy: dy, dr: dr };
    for (var i = 0; i < shakes.length; i++) {
      var s = shakes[i];
      var a = t - s.t0;
      if (a < 0 || a > (s.dur || 3)) continue;
      var env = Math.exp(-a * 2.6);
      var f = s.freq || 22;
      dx += Math.sin(a * f) * s.amp * env;
      dy += Math.cos(a * f * 0.83 + 1.7) * s.amp * 0.8 * env;
      dr += Math.sin(a * f * 0.61 + 0.8) * (s.rot || s.amp * 0.004) * env;
    }
    return { dx: dx, dy: dy, dr: dr };
  }

  /*
   * Apply camera to ctx: world coords are 1280x720 space; camera target
   * (x,y) is the world point that lands in the screen center.
   */
  function applyCamera(ctx, W, H, cam, shake) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.z, cam.z);
    ctx.rotate((cam.r || 0) + (shake ? shake.dr : 0));
    ctx.translate(-(cam.x + (shake ? shake.dx : 0)), -(cam.y + (shake ? shake.dy : 0)));
  }
  function endCamera(ctx) { ctx.restore(); }

  return { camAt: camAt, shakeAt: shakeAt, applyCamera: applyCamera, endCamera: endCamera };
});
