/*
 * draw2d.js — a small abstract 2D vector drawing API with two backends:
 *   - CanvasBackend: renders to an HTMLCanvas 2D context (production, 60fps)
 *   - SVGBackend:    renders to an SVG document string (for offline frame
 *                    capture with resvg in the Node test harness)
 *
 * The film code only uses this API, so frames captured in tests are faithful
 * to what the browser shows. Keep this API minimal and 1:1 between backends.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { Object.assign(root, api); root.draw2d = api; }
})(typeof self !== 'undefined' ? self : globalThis, function () {

  'use strict';

  function rgba(r, g, b, a) {
    a = Math.max(0, Math.min(1, a));
    var h = function (n) { return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0'); };
    if (a >= 0.9999) return '#' + h(r) + h(g) + h(b);
    return 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + a.toFixed(3) + ')';
  }

  /* ------------------------------------------------------------------ */
  /* Canvas backend                                                      */
  /* ------------------------------------------------------------------ */
  function CanvasBackend(ctx) {
    this.ctx = ctx;
    this._alpha = 1;
  }
  CanvasBackend.prototype = {
    save: function () { this.ctx.save(); },
    restore: function () { this.ctx.restore(); },
    translate: function (x, y) { this.ctx.translate(x, y); },
    scale: function (x, y) { this.ctx.scale(x, y); },
    rotate: function (r) { this.ctx.rotate(r); },
    transform: function (a, b, c, d, e, f) { this.ctx.transform(a, b, c, d, e, f); },
    beginPath: function () { this.ctx.beginPath(); },
    moveTo: function (x, y) { this.ctx.moveTo(x, y); },
    lineTo: function (x, y) { this.ctx.lineTo(x, y); },
    quadTo: function (cx, cy, x, y) { this.ctx.quadraticCurveTo(cx, cy, x, y); },
    cubicTo: function (c1x, c1y, c2x, c2y, x, y) { this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y); },
    arc: function (cx, cy, r, a0, a1, ccw) { this.ctx.arc(cx, cy, r, a0, a1, !!ccw); },
    ellipse: function (cx, cy, rx, ry, a0, a1) { this.ctx.ellipse(cx, cy, rx, ry, 0, a0, a1); },
    rect: function (x, y, w, h) { this.ctx.rect(x, y, w, h); },
    closePath: function () { this.ctx.closePath(); },
    fillRect: function (x, y, w, h, style) {
      this._paint(style); this.ctx.fillRect(x, y, w, h);
    },
    strokeRect: function (x, y, w, h, style, width) {
      this._stroke(style, width); this.ctx.strokeRect(x, y, w, h);
    },
    fillRoundRect: function (x, y, w, h, r, style) {
      this.beginPath(); this._roundRectPath(x, y, w, h, r); this.fill(style);
    },
    _roundRectPath: function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y); this.quadTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r); this.quadTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h); this.quadTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r); this.quadTo(x, y, x + r, y);
      this.closePath();
    },
    // clip subsequent drawing to a rounded rect (released by the next restore)
    clip: function (x, y, w, h, r) {
      this.beginPath();
      this._roundRectPath(x, y, w, h, r);
      this.ctx.clip();
    },
    _paint: function (style) {
      this.ctx.fillStyle = (style && style.kind === 'grad') ? style.native : style;
    },
    _stroke: function (style, width) {
      this.ctx.strokeStyle = (style && style.kind === 'grad') ? style.native : style;
      this.ctx.lineWidth = width || 1;
    },
    fill: function (style) { this._paint(style); this.ctx.fill(); },
    stroke: function (style, width) { this._stroke(style, width); this.ctx.stroke(); },
    setLineCap: function (c) { this.ctx.lineCap = c; },
    setLineJoin: function (j) { this.ctx.lineJoin = j; },
    setAlpha: function (a) { this._alpha = a; this.ctx.globalAlpha = a; },
    getAlpha: function () { return this._alpha; },
    linear: function (x0, y0, x1, y1, stops) {
      var g = this.ctx.createLinearGradient(x0, y0, x1, y1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return { kind: 'grad', native: g };
    },
    radial: function (cx, cy, r0, cx2, cy2, r1, stops) {
      var g = this.ctx.createRadialGradient(cx, cy, r0, cx2, cy2, r1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return { kind: 'grad', native: g };
    },
    text: function (str, x, y, opts) {
      opts = opts || {};
      var c = this.ctx;
      c.font = (opts.weight || 400) + ' ' + opts.size + 'px ' + (opts.family || 'sans-serif');
      c.textAlign = opts.align || 'left';
      c.textBaseline = opts.baseline || 'alphabetic';
      c.fillStyle = (opts.color && opts.color.kind === 'grad') ? opts.color.native : (opts.color || '#fff');
      c.fillText(str, x, y);
    }
  };

  /* ------------------------------------------------------------------ */
  /* SVG backend                                                         */
  /* ------------------------------------------------------------------ */
  function r2(n) { return Math.round(n * 100) / 100; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function styleRef(style) { return (style && style.kind === 'grad') ? style.ref : style; }

  // parse '#rrggbb' / '#rgb' / 'rgb(...)' / 'rgba(...)' / 'transparent'
  function parseColor(s) {
    s = String(s).trim();
    if (s === 'transparent') return { color: '#000000', alpha: 0 };
    var m;
    if ((m = s.match(/^#([0-9a-f]{3})$/i))) {
      return { color: '#' + m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2], alpha: 1 };
    }
    if ((m = s.match(/^#([0-9a-f]{6})$/i))) return { color: m[0].toLowerCase(), alpha: 1 };
    if ((m = s.match(/^rgba?\(([^)]+)\)$/i))) {
      var p = m[1].split(/[\s,]+/).map(parseFloat);
      var h = function (n) { return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0'); };
      return { color: '#' + h(p[0]) + h(p[1]) + h(p[2]), alpha: p.length > 3 ? p[3] : 1 };
    }
    return { color: s, alpha: 1 };
  }
  // emit a <stop> with explicit stop-opacity (resvg ignores alpha in rgba() stop-color)
  function stopTag(t, color) {
    var c = parseColor(color);
    return '<stop offset="' + t + '" stop-color="' + c.color + '" stop-opacity="' + c.alpha + '"/>';
  }

  // A frame is a node in the pending document tree. Elements are appended
  // to the CURRENT frame (canvas: the transform/user-space active when the
  // command is issued). The tree is only serialized at finish(), which lets
  // paths be emitted into frames that have already been closed
  // (canvas semantics: a path built under a translate keeps that translate
  // even if fill() happens after the group is restored).
  function SVGBackend(w, h) {
    this.W = w; this.H = h;
    this.defs = [];
    this.rootFrame = { kids: [], isSave: false, attrs: '', alpha: 1, cap: 'butt', join: 'miter' };
    this.frames = [this.rootFrame];
    this.alpha = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.gid = 0;
    this.d = '';
    this.segments = [];
    this.segFrame = null;
  }
  SVGBackend.prototype = {
    _cur: function () { return this.frames[this.frames.length - 1]; },
    _push: function (s) { this._cur().kids.push(s); },
    _openGroup: function (attrs, isSave) {
      var f = {
        kids: [], isSave: !!isSave, attrs: attrs,
        alpha: this.alpha, cap: this.lineCap, join: this.lineJoin
      };
      this._cur().kids.push(f);
      this.frames.push(f);
    },
    save: function () {
      this._openGroup('opacity="' + this.alpha.toFixed(3) + '"' +
        (this.lineCap !== 'butt' ? ' stroke-linecap="' + this.lineCap + '"' : '') +
        (this.lineJoin !== 'miter' ? ' stroke-linejoin="' + this.lineJoin + '"' : ''), true);
    },
    // mirror canvas semantics: restore closes transform groups until it pops
    // the most recent save() group, and restores alpha/cap/join
    restore: function () {
      if (this.frames.length === 1) return;
      var popped = null;
      while (this.frames.length > 1) {
        var frame = this.frames.pop();
        if (frame.isSave) { popped = frame; break; }
      }
      if (popped) {
        this.alpha = popped.alpha;
        this.lineCap = popped.cap;
        this.lineJoin = popped.join;
      }
    },
    translate: function (x, y) { this._openGroup('transform="translate(' + r2(x) + ' ' + r2(y) + ')"'); },
    scale: function (x, y) { this._openGroup('transform="scale(' + r2(x) + ' ' + r2(y) + ')"'); },
    rotate: function (r) { this._openGroup('transform="rotate(' + r2(r * 57.29577951308232) + ')"'); },
    transform: function (a, b, c, d, e, f) {
      this._openGroup('transform="matrix(' + r2(a) + ' ' + r2(b) + ' ' + r2(c) + ' ' + r2(d) + ' ' + r2(e) + ' ' + r2(f) + ')"');
    },
    beginPath: function () {
      this.d = '';
      this.segments = [];
      this.segFrame = null;
      this._segCheck();
    },
    // a path may be built across several (nested) groups — canvas records
    // each command in the user space active when it was issued. We mirror
    // that by splitting the path into per-frame segments at emit time.
    _segCheck: function () {
      var f = this.frames[this.frames.length - 1];
      if (this.segFrame !== f) {
        if (this.d) this.segments.push({ frame: this.segFrame, d: this.d });
        this.d = '';
        this.segFrame = f;
      }
    },
    // emit one <path> per segment into the frame where it was built
    _emitPaths: function (attrs) {
      if (this.d) { this.segments.push({ frame: this.segFrame, d: this.d }); this.d = ''; }
      for (var i = 0; i < this.segments.length; i++) {
        var seg = this.segments[i];
        seg.frame.kids.push('<path d="' + seg.d + '" ' + attrs + '/>');
      }
      this.segments = [];
      this.segFrame = null;
    },
    moveTo: function (x, y) { this._segCheck(); this.d += 'M' + r2(x) + ' ' + r2(y); },
    lineTo: function (x, y) { this._segCheck(); this.d += 'L' + r2(x) + ' ' + r2(y); },
    quadTo: function (cx, cy, x, y) { this._segCheck(); this.d += 'Q' + r2(cx) + ' ' + r2(cy) + ' ' + r2(x) + ' ' + r2(y); },
    cubicTo: function (c1x, c1y, c2x, c2y, x, y) { this._segCheck(); this.d += 'C' + r2(c1x) + ' ' + r2(c1y) + ' ' + r2(c2x) + ' ' + r2(c2y) + ' ' + r2(x) + ' ' + r2(y); },
    rect: function (x, y, w, h) {
      this._segCheck();
      this.d += 'M' + r2(x) + ' ' + r2(y) + 'L' + r2(x + w) + ' ' + r2(y) +
        'L' + r2(x + w) + ' ' + r2(y + h) + 'L' + r2(x) + ' ' + r2(y + h) + 'Z';
    },
    closePath: function () { this._segCheck(); this.d += 'Z'; },
    arc: function (cx, cy, rad, a0, a1, ccw) {
      this._segCheck();
      var TWO = Math.PI * 2;
      var delta = a1 - a0;
      if (!ccw && delta < 0) delta += TWO;
      if (ccw && delta > 0) delta -= TWO;
      var sweep = ccw ? 0 : 1;
      var x0 = cx + rad * Math.cos(a0), y0 = cy + rad * Math.sin(a0);
      var full = Math.abs(Math.abs(delta) - TWO) < 1e-6;
      if (full) {
        var xm = cx - rad * Math.cos(a0), ym = cy - rad * Math.sin(a0);
        this.d += 'M' + r2(x0) + ' ' + r2(y0) +
          'A' + r2(rad) + ' ' + r2(rad) + ' 0 1 ' + sweep + ' ' + r2(xm) + ' ' + r2(ym) +
          'A' + r2(rad) + ' ' + r2(rad) + ' 0 1 ' + sweep + ' ' + r2(x0) + ' ' + r2(y0);
        return;
      }
      var large = Math.abs(delta) > Math.PI ? 1 : 0;
      var x1 = cx + rad * Math.cos(a1), y1 = cy + rad * Math.sin(a1);
      this.d += 'M' + r2(x0) + ' ' + r2(y0) + 'A' + r2(rad) + ' ' + r2(rad) + ' 0 ' + large + ' ' + sweep + ' ' + r2(x1) + ' ' + r2(y1);
    },
    ellipse: function (cx, cy, rx, ry, a0, a1) {
      this._segCheck();
      var TWO = Math.PI * 2;
      var delta = a1 - a0;
      if (delta < 0) delta += TWO;
      var x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
      var full = Math.abs(delta - TWO) < 1e-6;
      if (full) {
        var xm = cx - rx * Math.cos(a0), ym = cy - ry * Math.sin(a0);
        this.d += 'M' + r2(x0) + ' ' + r2(y0) +
          'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 1 ' + r2(xm) + ' ' + r2(ym) +
          'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 1 ' + r2(x0) + ' ' + r2(y0);
        return;
      }
      var large = delta > Math.PI ? 1 : 0;
      var x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
      this.d += 'M' + r2(x0) + ' ' + r2(y0) + 'A' + r2(rx) + ' ' + r2(ry) + ' 0 ' + large + ' 1 ' + r2(x1) + ' ' + r2(y1);
    },
    fill: function (style) {
      this._emitPaths('fill="' + styleRef(style) + '" opacity="' + this.alpha.toFixed(3) + '"');
    },
    stroke: function (style, width) {
      var extra = (this.lineCap !== 'butt' ? ' stroke-linecap="' + this.lineCap + '"' : '') +
        (this.lineJoin !== 'miter' ? ' stroke-linejoin="' + this.lineJoin + '"' : '');
      this._emitPaths('fill="none" stroke="' + styleRef(style) + '" stroke-width="' + (width || 1) + '"' + extra + ' opacity="' + this.alpha.toFixed(3) + '"');
    },
    fillRect: function (x, y, w, h, style) {
      this._push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" fill="' + styleRef(style) + '" opacity="' + this.alpha.toFixed(3) + '"/>');
    },
    strokeRect: function (x, y, w, h, style, width) {
      this._push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" fill="none" stroke="' + styleRef(style) + '" stroke-width="' + (width || 1) + '" opacity="' + this.alpha.toFixed(3) + '"/>');
    },
    fillRoundRect: function (x, y, w, h, rad, style) {
      this._push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" rx="' + r2(rad) + '" fill="' + styleRef(style) + '" opacity="' + this.alpha.toFixed(3) + '"/>');
    },
    // clip subsequent drawing to a rounded rect; the clip group is closed
    // by the matching restore()
    clip: function (x, y, w, h, r) {
      var id = 'cp' + (++this.gid);
      this.defs.push('<clipPath id="' + id + '"><rect x="' + r2(x) + '" y="' + r2(y) +
        '" width="' + r2(w) + '" height="' + r2(h) + '" rx="' + r2(Math.min(r || 0, w / 2, h / 2)) + '"/></clipPath>');
      this._openGroup('clip-path="url(#' + id + ')"');
    },
    setLineCap: function (c) { this.lineCap = c; },
    setLineJoin: function (j) { this.lineJoin = j; },
    setAlpha: function (a) { this.alpha = a; },
    getAlpha: function () { return this.alpha; },
    linear: function (x0, y0, x1, y1, stops) {
      var id = 'lg' + (++this.gid);
      this.defs.push('<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + r2(x0) + '" y1="' + r2(y0) + '" x2="' + r2(x1) + '" y2="' + r2(y1) + '">' +
        stops.map(function (s) { return stopTag(s[0], s[1]); }).join('') + '</linearGradient>');
      return { kind: 'grad', ref: 'url(#' + id + ')' };
    },
    radial: function (cx, cy, r0, cx2, cy2, r1, stops) {
      var id = 'rg' + (++this.gid);
      this.defs.push('<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="' + r2(cx) + '" cy="' + r2(cy) + '" r="' + r2(r1) +
        '" fx="' + r2(cx2) + '" fy="' + r2(cy2) + '" fr="' + r2(Math.max(0, r0)) + '">' +
        stops.map(function (s) { return stopTag(s[0], s[1]); }).join('') + '</radialGradient>');
      return { kind: 'grad', ref: 'url(#' + id + ')' };
    },
    text: function (str, x, y, opts) {
      opts = opts || {};
      var fill = styleRef(opts.color || '#ffffff');
      var anchor = opts.align === 'middle' ? 'middle' : (opts.align === 'right' ? 'end' : 'start');
      var baseline = opts.baseline === 'middle' ? 'central' : 'alphabetic';
      var ls = opts.spacing ? ' letter-spacing="' + opts.spacing + '"' : '';
      this._push('<text x="' + r2(x) + '" y="' + r2(y) + '" font-family="' + String(opts.family || 'DejaVu Sans').replace(/"/g, '&quot;') +
        '" font-size="' + opts.size + '" font-weight="' + (opts.weight || 400) + '" fill="' + fill + '"' + ls +
        ' text-anchor="' + anchor + '" dominant-baseline="' + baseline + '" opacity="' + this.alpha.toFixed(3) + '">' +
        esc(str) + '</text>');
    },
    finish: function () {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + this.W + '" height="' + this.H + '" viewBox="0 0 ' + this.W + ' ' + this.H + '">' +
        '<defs>' + this.defs.join('') + '</defs>' + _serialize(this.rootFrame) + '</svg>';
    }
  };

  function _serialize(frame) {
    var out = '';
    for (var i = 0; i < frame.kids.length; i++) {
      var k = frame.kids[i];
      if (typeof k === 'string') out += k;
      else out += '<g ' + k.attrs + '>' + _serialize(k) + '</g>';
    }
    return out;
  }

  function makeCanvasBackend(ctx) { return new CanvasBackend(ctx); }
  function makeSVGBackend(w, h) { return new SVGBackend(w, h); }

  return {
    makeCanvasBackend: makeCanvasBackend,
    makeSVGBackend: makeSVGBackend,
    rgba: rgba
  };
});
