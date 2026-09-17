/* Easing + interpolation helpers. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { Object.assign(root, api); root.Easings = api; }
})(typeof self !== 'undefined' ? self : globalThis, function () {

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function clamp01(x) { return clamp(x, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // normalized progress of t inside [a, b], clamped 0..1
  function prog(t, a, b) { return clamp01((t - a) / (b - a)); }

  var E = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inQuint: function (t) { return t * t * t * t * t; },
    inOutQuint: function (t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inExpo: function (t) { return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); },
    inOutExpo: function (t) {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    smooth: function (t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  };

  // sample a keyframe track [[time, value], ...] (value may be number or object with 'v')
  function trackValue(track, t) {
    if (t <= track[0][0]) return track[0][1];
    for (var i = 1; i < track.length; i++) {
      if (t <= track[i][0]) {
        var p = track[i - 1][0], v1 = track[i - 1][1];
        var q = track[i][0], v2 = track[i][1];
        var u = (t - p) / (q - p);
        if (typeof v1 === 'number') return lerp(v1, v2, u);
        // object track: lerp numeric fields; 'e' on the TARGET keyframe
        // names the easing for the incoming segment
        var ease = E.smooth;
        if (typeof v2 === 'object' && v2.e && E[v2.e]) ease = E[v2.e];
        var uu = ease(u);
        var out = {};
        for (var k in v1) { if (k !== 'e') out[k] = lerp(v1[k], v2[k], uu); }
        return out;
      }
    }
    return track[track.length - 1][1];
  }

  return {
    clamp: clamp, clamp01: clamp01, lerp: lerp, prog: prog,
    E: E, trackValue: trackValue,
    // convenience: value of an eased progress
    ease: function (t, fn) { return fn(clamp01(t)); }
  };
});
