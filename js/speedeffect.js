/* speedeffect.js — Lusion-inspired acceleration overlay (Canvas 2D) */

(function (global) {

  var PHI = 1.6180339887;

  function SpeedLayer(container) {
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = [
      'position:fixed', 'inset:0', 'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:22', 'mix-blend-mode:screen',
    ].join(';');
    container.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    this._intensity = 0;    // 0 = parked, 1 = full speed
    this._target    = 0;
    this._t         = 0;

    this._beams   = this._makeBeams(18);
    this._streaks = this._makeStreaks(22);
    this._rails   = this._makeRails(6);
    this._rings   = this._makeRings(5);

    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }

  /* ── Factory helpers ─────────────────────────────── */
  SpeedLayer.prototype._makeBeams = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var phase = (i * PHI) % 1;
      arr.push({
        angle:  (phase - 0.5) * Math.PI * 1.6,
        speed:  0.55 + phase * 0.7,
        len:    0.18 + phase * 0.28,
        width:  0.5  + phase * 1.0,
        alpha:  0.08 + phase * 0.14,
        offset: phase,
      });
    }
    return arr;
  };

  SpeedLayer.prototype._makeStreaks = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var phase = (i * PHI) % 1;
      arr.push({
        y:     0.05 + phase * 0.90,
        speed: 1.2  + phase * 2.4,
        len:   0.06 + phase * 0.14,
        width: 0.6  + phase * 0.8,
        alpha: 0.06 + phase * 0.10,
        side:  (i % 2 === 0) ? 1 : -1,
        offset: phase,
      });
    }
    return arr;
  };

  SpeedLayer.prototype._makeRails = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      arr.push({
        spread: 0.06 + t * 0.30,
        alpha:  0.15 - t * 0.12,
        width:  1.2  - t * 0.8,
      });
    }
    return arr;
  };

  SpeedLayer.prototype._makeRings = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var phase = (i * PHI) % 1;
      arr.push({
        radius: 0.08 + phase * 0.36,
        speed:  0.18 + phase * 0.26,
        alpha:  0.12 - phase * 0.09,
        offset: phase,
      });
    }
    return arr;
  };

  /* ── Public API ──────────────────────────────────── */
  SpeedLayer.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, v));
  };

  SpeedLayer.prototype.tick = function (dt) {
    var lerpRate = this._target > this._intensity ? 1.8 : 0.9;
    this._intensity += (this._target - this._intensity) * Math.min(dt * lerpRate, 1);
    this._t += dt;

    if (this._intensity < 0.003) {
      this._clear();
      return;
    }
    this._draw();
  };

  SpeedLayer.prototype.resize = function () {
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  };

  /* ── Drawing ─────────────────────────────────────── */
  SpeedLayer.prototype._clear = function () {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  };

  SpeedLayer.prototype._draw = function () {
    var ctx = this._ctx;
    var W   = this._canvas.width;
    var H   = this._canvas.height;
    var iv  = this._intensity;
    var t   = this._t;

    ctx.clearRect(0, 0, W, H);

    var vpX = W * 0.5;
    var vpY = H * 0.48;

    /* ── Radial beams from vanishing point ─────────── */
    this._beams.forEach(function (b) {
      var phase = (t * b.speed + b.offset) % 1;
      var ang   = b.angle;
      var dist  = phase * Math.max(W, H) * 1.6;
      var x0    = vpX + Math.cos(ang) * dist * (1 - b.len);
      var y0    = vpY + Math.sin(ang) * dist * (1 - b.len);
      var x1    = vpX + Math.cos(ang) * dist;
      var y1    = vpY + Math.sin(ang) * dist;

      var grad = ctx.createLinearGradient(x0, y0, x1, y1);
      var a    = b.alpha * iv * (1 - phase * 0.6);
      grad.addColorStop(0, 'rgba(80,140,220,' + a + ')');
      grad.addColorStop(1, 'rgba(40,90,180,0)');

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = b.width * iv;
      ctx.stroke();
    });

    /* ── Horizontal side streaks ────────────────────── */
    this._streaks.forEach(function (s) {
      var sy   = s.y * H;
      var phase = (t * s.speed + s.offset) % 1;
      var lenPx = s.len * W;
      var edgeX = s.side > 0 ? 0 : W;
      var x0, x1;
      if (s.side > 0) {
        x0 = phase * (W * 0.42) - lenPx;
        x1 = x0 + lenPx;
      } else {
        x0 = W - phase * (W * 0.42);
        x1 = x0 - lenPx;
      }

      var a    = s.alpha * iv;
      var grad = ctx.createLinearGradient(x0, sy, x1, sy);
      if (s.side > 0) {
        grad.addColorStop(0, 'rgba(60,120,200,0)');
        grad.addColorStop(1, 'rgba(80,150,240,' + a + ')');
      } else {
        grad.addColorStop(0, 'rgba(80,150,240,' + a + ')');
        grad.addColorStop(1, 'rgba(60,120,200,0)');
      }

      ctx.beginPath();
      ctx.moveTo(x0, sy);
      ctx.lineTo(x1, sy);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = s.width * iv;
      ctx.stroke();
    });

    /* ── Perspective rail contours from VP ─────────── */
    this._rails.forEach(function (r) {
      var xSpread = r.spread * W;
      var a       = r.alpha * iv;

      /* Left rail */
      var grad = ctx.createLinearGradient(vpX, vpY, vpX - xSpread, H);
      grad.addColorStop(0, 'rgba(100,160,255,0)');
      grad.addColorStop(0.3, 'rgba(80,140,230,' + a + ')');
      grad.addColorStop(1, 'rgba(60,110,200,0)');
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(vpX - xSpread, H);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = r.width * iv;
      ctx.stroke();

      /* Right rail */
      var gradR = ctx.createLinearGradient(vpX, vpY, vpX + xSpread, H);
      gradR.addColorStop(0, 'rgba(100,160,255,0)');
      gradR.addColorStop(0.3, 'rgba(80,140,230,' + a + ')');
      gradR.addColorStop(1, 'rgba(60,110,200,0)');
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(vpX + xSpread, H);
      ctx.strokeStyle = gradR;
      ctx.lineWidth   = r.width * iv;
      ctx.stroke();
    });

    /* ── Depth rings (ellipses expanding from VP) ───── */
    this._rings.forEach(function (r) {
      var phase = (t * r.speed + r.offset) % 1;
      var rx    = phase * W * 0.55;
      var ry    = phase * H * 0.22;
      var a     = r.alpha * iv * (1 - phase);

      ctx.beginPath();
      ctx.ellipse(vpX, vpY + H * 0.1, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(70,130,210,' + a + ')';
      ctx.lineWidth   = 0.8 * iv;
      ctx.stroke();
    });

    /* ── Center tunnel glow ─────────────────────────── */
    var glowR = Math.max(W, H) * 0.32 * iv;
    var glow  = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, glowR);
    glow.addColorStop(0, 'rgba(50,110,220,' + (0.10 * iv) + ')');
    glow.addColorStop(0.4, 'rgba(20,60,160,' + (0.04 * iv) + ')');
    glow.addColorStop(1, 'rgba(5,15,50,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(vpX, vpY, glowR, 0, Math.PI * 2);
    ctx.fill();
  };

  global.SpeedLayer = SpeedLayer;

}(window));
