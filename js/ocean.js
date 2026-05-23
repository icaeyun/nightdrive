/* OceanPanel — Canvas 2D side ocean with parallax layers.
   Simulates a coastal night drive: near water rushes by fast,
   distant horizon barely moves.  */

const OCEAN_MODES = {
  moonlit: {
    skyTop:      '#01060e',
    skyBottom:   '#040e1c',
    horizonGlow: '#143050',
    oceanDeep:   '#030c18',
    oceanMid:    '#061424',
    waveBase:    '#081c30',
    waveHighlight: '#3a7099',
    reflection:  '#2a5878',
    rail:        '#1a3a52',
    speedMult:   1.0,
  },
  metropolis: {
    skyTop:      '#030110',
    skyBottom:   '#080418',
    horizonGlow: '#240c50',
    oceanDeep:   '#060310',
    oceanMid:    '#0d0820',
    waveBase:    '#100a28',
    waveHighlight: '#6030b8',
    reflection:  '#4a20a0',
    rail:        '#28104a',
    speedMult:   1.25,
  },
  cyber: {
    skyTop:      '#010308',
    skyBottom:   '#020810',
    horizonGlow: '#062040',
    oceanDeep:   '#020508',
    oceanMid:    '#040a14',
    waveBase:    '#060e1c',
    waveHighlight: '#1858b8',
    reflection:  '#0e3a90',
    rail:        '#081c38',
    speedMult:   1.55,
  },
  midnight: {
    skyTop:      '#010204',
    skyBottom:   '#020406',
    horizonGlow: '#05080e',
    oceanDeep:   '#020408',
    oceanMid:    '#03060a',
    waveBase:    '#040810',
    waveHighlight: '#142030',
    reflection:  '#0e1828',
    rail:        '#081018',
    speedMult:   0.55,
  },
};

class OceanPanel {
  constructor(canvas, side) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.side   = side; // 'left' | 'right'
    this.t      = 0;
    this.mode   = 'moonlit';
    this.musicOn = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.round(r.width  || window.innerWidth  * 0.4);
    this.canvas.height = Math.round(r.height || window.innerHeight);
  }

  setMode(mode)       { this.mode    = mode; }
  setMusicOn(on)      { this.musicOn = on;   }

  /* Call from rAF with delta-time in seconds */
  tick(dt) {
    const m  = OCEAN_MODES[this.mode] || OCEAN_MODES.moonlit;
    const sp = m.speedMult * (this.musicOn ? 1.45 : 1.0);
    this.t  += dt * sp;
    this._draw(m, sp);
  }

  _draw(m, sp) {
    const ctx  = this.ctx;
    const w    = this.canvas.width;
    const h    = this.canvas.height;
    if (!w || !h) return;

    const t     = this.t;
    const left  = this.side === 'left';
    const horizY = h * 0.30;

    /* 1. Deep background gradient */
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0,    m.skyTop);
    bg.addColorStop(0.22, m.skyBottom);
    bg.addColorStop(0.55, m.oceanDeep);
    bg.addColorStop(1,    m.oceanMid);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* 2. Horizon glow — radiates from the inner edge towards horizon */
    const innerX = left ? w : 0;
    const hg = ctx.createRadialGradient(innerX, horizY, 0, innerX, horizY, w * 1.4);
    hg.addColorStop(0,   m.horizonGlow + 'aa');
    hg.addColorStop(0.4, m.horizonGlow + '30');
    hg.addColorStop(1,   'transparent');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h * 0.55);

    /* 3. Wave layers at 3 depth bands (far → near) */
    //    Each band: faster speed, higher amplitude, brighter color
    this._waveBand(ctx, w, h, m.waveBase,      t, 0.06,  0.35, 0.55,  1.5, 0.025, 0.28);
    this._waveBand(ctx, w, h, m.waveBase,      t, 0.18,  0.52, 0.74,  3.0, 0.018, 0.40);
    this._waveBand(ctx, w, h, m.waveHighlight, t, 0.55,  0.70, 0.92,  4.5, 0.012, 0.14);

    /* 4. Reflection streaks — fast vertical lines moving sideways */
    this._reflections(ctx, w, h, m, t, sp, left);

    /* 5. Near rail glow at the inner edge */
    this._rail(ctx, w, h, m, t, left);

    /* 6. Inner-edge fade (blends with road) */
    const fade = ctx.createLinearGradient(
      left ? w - 1 : 0, 0,
      left ? w * 0.52 : w * 0.48, 0
    );
    fade.addColorStop(0, 'rgba(0,0,0,0.96)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  }

  _waveBand(ctx, w, h, color, t, speed, yStart, yEnd, amp, freq, alpha) {
    const layers = 3;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < layers; i++) {
      const frac  = i / layers;
      const baseY = h * (yStart + (yEnd - yStart) * frac);
      const phase = t * speed * (1 + frac * 0.4) + i * 2.1;

      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= w; x += 5) {
        const y = baseY
          + Math.sin(x * freq        + phase)               * amp
          + Math.sin(x * freq * 2.3  + phase * 1.4)         * amp * 0.35
          + Math.sin(x * freq * 0.6  + phase * 0.7 + 1.1)   * amp * 0.2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _reflections(ctx, w, h, m, t, sp, left) {
    const count  = 14;
    const yTop   = h * 0.28;
    const yBot   = h * 0.96;

    for (let i = 0; i < count; i++) {
      /* proximity 0 = far ocean edge, 1 = near road edge */
      const prox = left
        ? (i / count)           // left panel: high-index = inner (right) = near road
        : (1 - i / count);

      const baseX      = (i / count) * w;
      const streakSpd  = sp * (0.3 + prox * 3.5);
      const phaseOff   = (i * 0.41 + i * i * 0.07) % 1;

      /* Move the streak across the canvas */
      let sx = left
        ? (baseX + t * streakSpd * 28) % w
        : w - ((w - baseX + t * streakSpd * 28) % w);

      const ySpan = yTop + (1 - prox) * (yBot - yTop) * 0.35;
      const yEnd  = ySpan + (prox * 0.55 + 0.12) * (yBot - ySpan);

      const pulseAlpha = (0.06 + prox * 0.35) *
        (0.5 + 0.5 * Math.sin((phaseOff + t * streakSpd * 0.4) * Math.PI * 2));

      const sg = ctx.createLinearGradient(0, ySpan, 0, yEnd);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.25, m.reflection);
      sg.addColorStop(0.75, m.reflection);
      sg.addColorStop(1,    'transparent');

      ctx.globalAlpha = pulseAlpha;
      ctx.strokeStyle = sg;
      ctx.lineWidth   = 0.7 + prox * 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, ySpan);
      ctx.lineTo(sx, yEnd);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _rail(ctx, w, h, m, t, left) {
    const x      = left ? w - 1.5 : 1.5;
    const flicker = 0.55 + Math.sin(t * 6.1) * 0.12 + Math.sin(t * 17.3) * 0.06;

    const rg = ctx.createLinearGradient(0, 0, 0, h);
    rg.addColorStop(0,    'transparent');
    rg.addColorStop(0.08, m.rail + 'cc');
    rg.addColorStop(0.45, m.waveHighlight + 'ee');
    rg.addColorStop(0.80, m.waveHighlight + '55');
    rg.addColorStop(1,    'transparent');

    ctx.globalAlpha = flicker;
    ctx.strokeStyle = rg;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
