/*
 * capture.js — offline frame capture harness (Node).
 *
 * Renders film frames through the SVG backend of draw2d.js and rasterizes
 * them with @resvg/resvg-js, so the visuals can be inspected without a
 * browser. Usage:
 *
 *   node tools/capture.js [t1 t2 t3 ...]   # times in seconds (default: sweep)
 *   node tools/capture.js --sweep 0.25     # every 0.25s across the film
 *
 * Requires: npm install @resvg/resvg-js  (used only by this tool)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function req(p) { return require(path.join(ROOT, p)); }

// wire up globals the way the browser <script> order would:
// each UMD module does Object.assign(root, api) (plus named namespaces).
const draw2d = req('js/engine/draw2d.js');
Object.assign(globalThis, req('js/engine/rng.js'));        // Rng, hash1
const easingMod = req('js/engine/easing.js');
Object.assign(globalThis, easingMod); globalThis.Easings = easingMod;
Object.assign(globalThis, req('js/film/sky.js'));
Object.assign(globalThis, req('js/film/forest.js'));
const particlesMod = req('js/film/particles.js');
globalThis.Particles = particlesMod; Object.assign(globalThis, particlesMod);
Object.assign(globalThis, req('js/film/bird.js'));
Object.assign(globalThis, req('js/film/alina.js'));
Object.assign(globalThis, req('js/film/plane.js'));
Object.assign(globalThis, req('js/film/camera.js'));
Object.assign(globalThis, req('js/film/post.js'));
const Film = req('js/film/film.js');

let Resvg = null;
try {
  Resvg = require('@resvg/resvg-js').Resvg;
} catch (e) {
  console.error('install deps first:  npm install @resvg/resvg-js');
  process.exit(1);
}

const OUT = process.env.CAPTURE_OUT || path.join(ROOT, 'tools', 'captures');
fs.mkdirSync(OUT, { recursive: true });

function capture(t, out) {
  const b = draw2d.makeSVGBackend(Film.W, Film.H);
  Film.renderFrame(b, t, { noGrain: true });
  const svg = b.finish();
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 960 },
    font: { loadSystemFonts: true }
  }).render().asPng();
  fs.writeFileSync(out, png);
  return out;
}

const args = process.argv.slice(2);
if (args[0] === '--sweep') {
  const step = parseFloat(args[1] || '0.25');
  const n = Math.ceil(Film.END / step);
  for (let i = 0; i <= n; i++) {
    const t = Math.min(Film.END, i * step);
    const f = path.join(OUT, 't' + t.toFixed(2).padStart(5, '0') + '.png');
    capture(t, f);
    process.stdout.write('\r' + (t / 1000 * 1000).toFixed(3) + 's');
  }
  console.log('\ndone: ' + (n + 1) + ' frames -> ' + OUT);
} else if (args.length) {
  for (const a of args) {
    const t = parseFloat(a);
    const f = path.join(OUT, 't' + t.toFixed(2).padStart(5, '0') + '.png');
    capture(t, f);
    console.log(f);
  }
} else {
  console.log('usage: node tools/capture.js [--sweep step | t1 t2 ...]');
}
