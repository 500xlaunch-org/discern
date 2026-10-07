/* Discern's ring, "Arc": a sine glide up a fifth with an electric shimmer,
 * landing on a glass bell. The one source for every rendering of it: the
 * files in the apps are made from this (tools/ring/render.mjs), so what ships
 * is exactly what was chosen. Graded by severity: the same phrase, lower and
 * softer when it can wait, brighter, faster and repeated as it gets serious. */
(function (root) {
  const LEVELS = {
    LOW:    { shift: -5, gain: 0.7, bright: 0.1, speed: 0.9, times: 1 },
    MEDIUM: { shift: 0,  gain: 0.9, bright: 0.4, speed: 1,   times: 1 },
    HIGH:   { shift: 2,  gain: 1,   bright: 0.7, speed: 1.2, times: 2 },
    SEVERE: { shift: 5,  gain: 1.1, bright: 1,   speed: 1.4, times: 3 },
  };
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function space(ctx, master, wet, time = 0.18) {
    const inp = ctx.createGain(), out = ctx.createGain(); out.gain.value = wet;
    const L = ctx.createDelay(1), R = ctx.createDelay(1); L.delayTime.value = time; R.delayTime.value = time * 1.5;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
    const merger = ctx.createChannelMerger(2);
    inp.connect(L); L.connect(lp); lp.connect(R); R.connect(fb); fb.connect(L);
    L.connect(merger, 0, 0); R.connect(merger, 0, 1); merger.connect(out); out.connect(master);
    inp.connect(master);
    return inp;
  }
  function bell(ctx, dest, t, f, len, peak, ratio, index) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + len);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(dest);
    env(g, t, 0.006, peak, len);
    car.start(t); mod.start(t); car.stop(t + len + 0.05); mod.stop(t + len + 0.05);
  }
  function phrase(ctx, master, t, p) {
    const out = space(ctx, master, 0.3 + p.bright * 0.15);
    const base = 76 + p.shift;
    const s = ctx.createOscillator(), sg = ctx.createGain();
    s.type = "sine"; s.frequency.setValueAtTime(hz(base), t); s.frequency.exponentialRampToValueAtTime(hz(base + 7), t + 0.16 / p.speed);
    s.connect(sg); sg.connect(out); env(sg, t, 0.02, 0.32 * p.gain, 0.32 / p.speed);
    s.start(t); s.stop(t + 0.5);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 6;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2600 + 3200 * p.bright, t + 0.16 / p.speed);
    const eg = ctx.createGain(); f.connect(eg); eg.connect(out); env(eg, t, 0.015, 0.07 * p.gain * (0.6 + p.bright), 0.28 / p.speed);
    for (const d of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = d;
      o.frequency.setValueAtTime(hz(base), t); o.frequency.exponentialRampToValueAtTime(hz(base + 7), t + 0.16 / p.speed);
      o.connect(f); o.start(t); o.stop(t + 0.5);
    }
    bell(ctx, out, t + 0.15 / p.speed, hz(base + 7), 0.75, 0.3 * p.gain, 3.5, 1.6 + p.bright * 1.4);
    bell(ctx, out, t + 0.15 / p.speed, hz(base + 19), 0.5, 0.06 * p.gain, 2, 0.8);
    return 0.55 / p.speed;
  }
  /** Play (or render) the ring for a severity into `master`, starting at `t`.
   * Returns when it ends, in the context's seconds. */
  function ring(ctx, master, severity, t) {
    const p = LEVELS[severity] || LEVELS.MEDIUM;
    for (let i = 0; i < p.times; i++) t += phrase(ctx, master, t, p) + 0.06;
    return t;
  }
  root.DiscernRing = { ring, LEVELS };
})(typeof window !== "undefined" ? window : globalThis);
