# Alina — status report

**State: COMPLETE and self-tested.** A finished animated short (27.8 s, 16:9) that plays
the provided voiceover with a synchronized, auto-advancing cinematic, with Start /
Pause / Resume / Restart controls.

## How to watch

```bash
# any static server from the repo root, e.g.:
python3 -m http.server 8000
# open http://localhost:8000
```

Click **Start** — audio and animation start together. `Space` = play/pause, `R` = restart.
The last ~5 s (fade to THE END) play after the voice finishes.

## Story beats vs. narration (audio is the master clock)

| Time  | Narration (ASR-verified)                                   | Visual |
|-------|------------------------------------------------------------|--------|
| 0.0–7.0   | "One day there was a plane in the sky with a girl called Alina inside." | Plane exterior in day sky (0–4.6), crossfade to cabin: Alina (dark hair, green jacket, brown boots) at the window, clouds drifting past (4.6–7.15). A bird flies past the window at 6.1–6.85 as foreshadow. |
| 7.0–15.0  | "A bird flew into the engine, making the plane fly down and crashing into the forest." | Bird converges from the right, **impact on "engine" at 9.30** (sparks, flash, smoke) → uncontrolled dive with a fused smoke ribbon (9.7–12.6, camera follows) → distant crash into a layered forest at **14.10** (flash, debris, dust plume, trees shake; not graphic). |
| 15.0–23.0 | "Walking through the forest for several days until Alina could find help." | Montage with changing light/location: day (16.3) → warm afternoon (18.3) → sunset (19.5) → starry night (20.35) → cold morning (21.25); Alina's gait slows and her posture tires while her design stays identical. |
| 22.45–27.8 | (voice ends 23.02) | J5: dawn ridge, Alina walks to the edge, stops, and a slow reveal brings out the **warm ranger-cabin light** across the valley; fade to black, "THE END". |

Timing is derived from the actual audio: `audio.currentTime` drives a single
`renderFrame(t)` pure function (no `setTimeout` scene timers). Word timestamps were
confirmed with whisper (impact ≈ "into the engine" 8.0–9.5, crash ≈ "into the forest"
13.35–15.0).

## Architecture

```
index.html          app shell (12:1, canvas + overlays + controls)
css/style.css       player chrome (title, end screen, auto-dimming controls)
js/app.js           player: audio.currentTime master clock, rAF loop,
                    Start/Pause/Resume/Restart, tail clock after the voice ends
js/engine/
  rng.js            seeded RNG (deterministic frames)
  easing.js         easing curves + keyframe track evaluation
  draw2d.js         abstract 2D API with two backends:
                    CanvasBackend (production) / SVGBackend (test capture)
js/film/
  sky.js forest.js  palettes, sun, clouds, layered parallax tree silhouettes
  particles.js      smoke ribbons, sparks, debris, dust plumes
  bird.js plane.js  character/vehicle painters (consistent livery)
  alina.js          Alina: rig + walk/sit poses, fatigue, silhouette shading
  camera.js         keyframed camera (pan/zoom/rotate) + impact shake
  post.js           vignette, letterbox, grade, fades, flashes, grain
  film.js           the 11-shot master timeline (crossfades, all beats above)
audio/voiceover.m4a the provided voiceover (23.02 s)
tools/
  capture.js        Node harness: renders any t via SVGBackend → resvg → PNG
  captures/         57-frame 0.5 s sweep (visual regression baseline)
  smoke.js          jsdom test of the full player lifecycle
```

Key design point: the film only talks to `draw2d.js`, so what the browser canvas draws
and what the offline SVG capture draws are the same vector scene — the PNG sweep is a
faithful stand-in for a browser (this sandbox has no browser; all browser CDNs blocked).

## Test results

1. **Frame sweep** — `node tools/capture.js --sweep 0.5` → 57 PNGs, all render clean
   (no missing assets, no throw). Reviewed: exterior, cabin, bird, impact flash, dive,
   crash + dust, all five journey beats, cabin reveal, fade, THE END.
2. **Player smoke test** — `node tools/smoke.js` (jsdom, mocked audio + 2D context) →
   **35/35 checks pass**, including: start kicks off audio+animation together, time
   readout follows `audio.currentTime`, pause freezes, resume continues, restart
   rewinds to 0, film ends at 27.8 s, replay works, zero console errors.

## Bugs found & fixed during self-testing (highlights)

- Crossfade alpha leak & invisible forest in captures → SVG backend rewrote to a frame
  tree: paths keep the user-space of the command they were issued in (canvas semantics),
  groups serialize at `finish()`; save/restore now restore alpha/cap/join.
- Paths built across several nested groups (forest trees) → per-frame path segments.
- Zoomed-out camera revealed frame edges → sky overdraw + black base pass.
- Crash flash hidden behind the near forest layer → impact effects drawn in front.
- Final fade + THE END drawn in world space while the camera pans → moved to screen
  space in the master post pass.
- UMD wrappers didn't expose `Film`/`draw2d` namespaced globals → fixed; the jsdom test
  caught it.
- Restart-from-playing no-op; time readout showing poster time while idle; tail clock
  anchor on the flaky `audio.ended` flag → all fixed in `js/app.js`.

## Remaining known limits

- `resvg` capture ≈ browser rendering but not pixel-identical (font metrics, grain
  skipped in captures). Grain, shake and motion look best live.
- No real-browser run was possible in this sandbox (all browser CDNs blocked); the live
  preview in Arena is the real-browser check — click Start and confirm audio sync.
