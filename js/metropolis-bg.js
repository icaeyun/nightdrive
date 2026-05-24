/* metropolis-bg.js — Mode 2: elevated dark neon cyber-city (purple/gold/pink) */
(function (global) {

  var PHI = 1.6180339887;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var NEON = [0xff2090, 0xcc00ff, 0xffaa00, 0x00ddff, 0xff6600, 0xaa00ff, 0xff0066, 0x6633ff, 0xff44aa, 0xdd00cc];
  var WIN  = [0xffcc88, 0xffaacc, 0xaa88ff, 0x88ccff, 0xffd060, 0xee99ff, 0xff88bb];

  var BLOCK   = 155;
  var CAM_Y   = 190;
  var CAM_Z   = 110;
  var LOOK_Y  = 38;
  var LOOK_Z  = -840;
  var CAM_FOV = 76;
  var ALT_AMP = 52;
  var ALT_FREQ = 0.014;
  var PAN_AMP  = 185;
  var PAN_FREQ = 0.010;

  var COLS = [
    { x:  -42, n: 13, phOff: 0.00, sz: 'slim'  },
    { x:   42, n: 13, phOff: 0.50, sz: 'slim'  },
    { x: -108, n: 14, phOff: 0.25, sz: 'slim'  },
    { x:  108, n: 14, phOff: 0.75, sz: 'slim'  },
    { x: -195, n: 14, phOff: 0.12, sz: 'mid'   },
    { x:  195, n: 14, phOff: 0.62, sz: 'mid'   },
    { x: -295, n: 13, phOff: 0.37, sz: 'mid'   },
    { x:  295, n: 13, phOff: 0.87, sz: 'mid'   },
    { x: -400, n: 12, phOff: 0.18, sz: 'tower' },
    { x:  400, n: 12, phOff: 0.68, sz: 'tower' },
    { x: -510, n: 11, phOff: 0.44, sz: 'tower' },
    { x:  510, n: 11, phOff: 0.94, sz: 'tower' },
    { x: -625, n: 10, phOff: 0.31, sz: 'mega'  },
    { x:  625, n: 10, phOff: 0.81, sz: 'mega'  },
  ];

  var SZ = {
    slim:  { wMin: 12, wMax: 22, hMin: 40,  hMax: 130, dMin: 10, dMax: 18 },
    mid:   { wMin: 18, wMax: 38, hMin: 70,  hMax: 200, dMin: 14, dMax: 30 },
    tower: { wMin: 24, wMax: 50, hMin: 120, hMax: 300, dMin: 20, dMax: 40 },
    mega:  { wMin: 40, wMax: 80, hMin: 200, hMax: 450, dMin: 30, dMax: 60 },
  };

  function setAttr(geo, pts) {
    var a = new THREE.BufferAttribute(new Float32Array(pts), 3);
    if (geo.setAttribute) geo.setAttribute('position', a);
    else                  geo.addAttribute('position', a);
  }

  function bMesh(geo, col, op, add) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col,
      transparent: op < 1 || !!add,
      opacity: op !== undefined ? op : 1,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !add,
    }));
  }

  function makeBuilding(szKey, t) {
    var sz  = SZ[szKey];
    var bw  = rnd(sz.wMin, sz.wMax);
    var bh  = rnd(sz.hMin, sz.hMax);
    var bd  = rnd(sz.dMin, sz.dMax);
    var grp = new THREE.Group();

    var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x030008, 1);
    body.position.y = bh / 2;
    grp.add(body);

    // front window rows
    var numStrips = 2 + Math.floor(t * 3);
    for (var i = 0; i < numStrips; i++) {
      var wy = (i + 1) / (numStrips + 1) * bh;
      var st = bMesh(new THREE.PlaneGeometry(bw * rnd(0.35, 0.82), rnd(0.6, 1.8)), pick(WIN), rnd(0.14, 0.32), true);
      st.position.set(rnd(-bw * 0.15, bw * 0.15), wy, bd / 2 + 0.05);
      grp.add(st);
    }

    // horizontal neon casino band
    if (t > 0.28) {
      var nc = pick(NEON);
      var band = bMesh(new THREE.BoxGeometry(bw + 1.8, rnd(0.4, 1.2), 0.2), nc, rnd(0.50, 0.90), true);
      band.position.set(0, bh * rnd(0.38, 0.72), bd / 2 + 0.1);
      grp.add(band);
    }
    if (t > 0.52) {
      var band2 = bMesh(new THREE.BoxGeometry(bw + 1.8, rnd(0.3, 0.7), 0.2), pick(NEON), rnd(0.38, 0.65), true);
      band2.position.set(0, bh * rnd(0.12, 0.28), bd / 2 + 0.1);
      grp.add(band2);
    }

    // vertical neon edge stripe
    if (t > 0.58) {
      var side = Math.random() > 0.5 ? 1 : -1;
      var ve = bMesh(new THREE.BoxGeometry(0.4, bh * rnd(0.38, 0.82), 0.2), pick(NEON), rnd(0.32, 0.58), true);
      ve.position.set(side * (bw / 2 - 0.2), bh * 0.5, bd / 2 + 0.08);
      grp.add(ve);
    }

    // large billboard on towers / mega
    if ((szKey === 'tower' || szKey === 'mega') && t > 0.60) {
      var bw2 = rnd(bw * 0.38, bw * 0.82);
      var bh2 = rnd(10, 32);
      var bill = bMesh(new THREE.PlaneGeometry(bw2, bh2), pick(NEON), rnd(0.07, 0.18), true);
      bill.position.set(rnd(-bw * 0.12, bw * 0.12), bh * rnd(0.48, 0.82), bd / 2 + 0.5);
      grp.add(bill);
    }

    // rooftop antennae
    if (t > 0.48) {
      var rh = rnd(3, 9);
      var ant = bMesh(new THREE.BoxGeometry(0.5, rh, 0.5), t > 0.78 ? pick(NEON) : 0xff0033, 0.88, true);
      ant.position.set(rnd(-bw * 0.22, bw * 0.22), bh + rh / 2, 0);
      grp.add(ant);
    }

    return { grp: grp, bh: bh };
  }

  /* ═══════════════════════════════════════════════════════ */
  function MetropolisBg(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    canvas.style.opacity = '0';
    container.appendChild(canvas);

    this._canvas = canvas;

    this._ren = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.setClearColor(0x050010, 1);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.0;

    this._sc  = new THREE.Scene();
    this._sc.fog = new THREE.Fog(0x080018, 60, 2500);

    this._cam = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 1, 3200);
    this._cam.position.set(0, CAM_Y, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z));

    this._iv     = 0;
    this._target = 0;
    this._time   = 0;
    this._pool   = [];
    this._lasers = [];

    this._composer    = null;
    this._useComposer = false;
    try {
      if (typeof POSTPROCESSING !== 'undefined') {
        var bloom = new POSTPROCESSING.BloomEffect({
          luminanceThreshold: 0.0,
          luminanceSmoothing: 0.5,
          resolutionScale: 0.75,
          intensity: 2.2,
        });
        var rPass = new POSTPROCESSING.RenderPass(this._sc, this._cam);
        var ePass = new POSTPROCESSING.EffectPass(this._cam, bloom);
        ePass.renderToScreen = true;
        this._composer = new POSTPROCESSING.EffectComposer(this._ren);
        this._composer.addPass(rPass);
        this._composer.addPass(ePass);
        this._useComposer = true;
      }
    } catch (e) {}

    this._sc.add(new THREE.AmbientLight(0x1a0040, 0.55));
    var dl = new THREE.DirectionalLight(0x9966ff, 0.12);
    dl.position.set(0, 400, 300);
    this._sc.add(dl);

    this._build();
    window.addEventListener('resize', this._resize.bind(this));
  }

  MetropolisBg.prototype._build = function () {
    this._makeStars();
    this._makeAtmosphere();
    this._makeGround();
    this._makeCity();
    this._makeLasers();
  };

  MetropolisBg.prototype._makeStars = function () {
    var N = 1100, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-2200, 2200), rnd(60, 1100), rnd(-2200, -10));
    var geo = new THREE.BufferGeometry();
    setAttr(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcc99ff, size: 1.8, sizeAttenuation: true,
      transparent: true, opacity: 0.42,
    })));
  };

  MetropolisBg.prototype._makeAtmosphere = function () {
    var sc = this._sc;
    function add(col, op, w, h, y, z) {
      var m = bMesh(new THREE.PlaneGeometry(w, h), col, op, true);
      m.material.side = THREE.DoubleSide;
      m.position.set(0, y, z);
      sc.add(m);
    }
    add(0x330066, 0.28, 8000, 320,  85, -1200);
    add(0x550033, 0.16, 6000, 100,  50, -900);
    add(0x0d0035, 0.26, 8000, 950, 260, -1600);
    add(0x7700bb, 0.18, 130,  200,  85, -650);
    add(0x220044, 0.16, 8000,  22,   5, -800);
  };

  MetropolisBg.prototype._makeGround = function () {
    var gnd = bMesh(new THREE.PlaneGeometry(6000, 5000), 0x020006, 1);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, -1, -800);
    this._sc.add(gnd);

    var pts = [];
    for (var i = 0; i <= 20; i++) {
      var x0 = -320 + (i / 20) * 640;
      pts.push(x0, 0.3, 200,  x0 * 0.01, 0.3, -1500);
    }
    for (var j = 0; j < 24; j++) {
      var z  = 200 - j * 70;
      var sp = Math.max(4, 320 * Math.max(0, (200 - z) / 1500));
      pts.push(-sp, 0.3, z,  sp, 0.3, z);
    }
    var lgeo = new THREE.BufferGeometry();
    setAttr(lgeo, pts);
    this._sc.add(new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
      color: 0x330066, transparent: true, opacity: 0.32,
    })));
  };

  MetropolisBg.prototype._makeCity = function () {
    var sc   = this._sc;
    var pool = this._pool;

    COLS.forEach(function (col) {
      var cycleLen = col.n * BLOCK;
      var startZ   = -(col.phOff * cycleLen);
      var xJitter  = col.sz === 'slim' ? 8 : (col.sz === 'mid' ? 14 : 22);
      var xBase    = col.x;

      for (var i = 0; i < col.n; i++) {
        var t   = (i * PHI) % 1;
        var z0  = startZ - i * BLOCK + rnd(-BLOCK * 0.22, BLOCK * 0.22);
        var built = makeBuilding(col.sz, t);
        built.grp.position.set(xBase + (Math.random() * 2 - 1) * xJitter, 0, z0);
        sc.add(built.grp);
        pool.push({ grp: built.grp, cycleLen: cycleLen, xBase: xBase, xJitter: xJitter });
      }
    });

    // distant static skyline
    for (var s = 0; s < 64; s++) {
      var t2   = (s * PHI) % 1;
      var side = s % 2 === 0 ? -1 : 1;
      var sx   = side * (320 + t2 * 420);
      var sz2  = -650 - t2 * 850;
      var bw2  = 20 + t2 * 85;
      var bh2  = 80 + t2 * 370;
      var bod  = bMesh(new THREE.BoxGeometry(bw2, bh2, 14), 0x020008, 1);
      bod.position.set(sx, bh2 / 2, sz2);
      sc.add(bod);
      if (t2 > 0.48) {
        var nc = pick(NEON);
        var bd2 = bMesh(new THREE.BoxGeometry(bw2 + 2, 0.8, 0.3), nc, t2 * 0.5, true);
        bd2.position.set(sx, bh2 * 0.7, sz2 + 7.1);
        sc.add(bd2);
      }
    }
  };

  MetropolisBg.prototype._makeLasers = function () {
    var sc   = this._sc;
    var defs = [
      { col: 0xff00cc, op: 0.10, w: 1.5, len: 2000, y: 180, z:  -800, spd: 0.020, rng: 0.60, ph: 0.0 },
      { col: 0xaa00ff, op: 0.08, w: 1.2, len: 2200, y: 260, z: -1100, spd: 0.015, rng: 0.75, ph: 2.1 },
      { col: 0xffaa00, op: 0.07, w: 1.0, len: 1800, y: 215, z:  -700, spd: 0.026, rng: 0.50, ph: 3.7 },
      { col: 0x6633ff, op: 0.07, w: 1.4, len: 2400, y: 320, z: -1400, spd: 0.013, rng: 0.82, ph: 1.4 },
    ];
    for (var i = 0; i < defs.length; i++) {
      var d   = defs[i];
      var geo = new THREE.PlaneGeometry(d.w, d.len);
      var mat = new THREE.MeshBasicMaterial({
        color: d.col, transparent: true, opacity: d.op,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      var mesh = new THREE.Mesh(geo, mat);
      var grp  = new THREE.Group();
      mesh.position.z = -d.len / 2;
      grp.add(mesh);
      grp.position.set(0, d.y, d.z);
      sc.add(grp);
      this._lasers.push({ grp: grp, speed: d.spd, range: d.rng, phase: d.ph });
    }
  };

  MetropolisBg.prototype.show = function () { this._canvas.style.opacity = '1'; };
  MetropolisBg.prototype.hide = function () { this._canvas.style.opacity = '0'; };

  MetropolisBg.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, v));
  };

  MetropolisBg.prototype.tick = function (dt) {
    this._time += dt;
    var iv = this._iv;
    this._iv += (this._target - iv) * Math.min(dt * (this._target > iv ? 2.5 : 0.85), 1);
    iv = this._iv;

    var speed = 28 + iv * 320;
    var camZ  = this._cam.position.z;
    var t     = this._time;
    var self  = this;

    var drift = Math.sin(t * PAN_FREQ) * PAN_AMP;
    var alt   = Math.sin(t * ALT_FREQ) * ALT_AMP;
    this._cam.position.set(drift * 0.26, CAM_Y + alt - iv * 14, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(drift * 0.52, LOOK_Y + alt * 0.32, LOOK_Z - iv * 58));
    this._cam.fov = CAM_FOV + iv * 10;
    this._cam.updateProjectionMatrix();

    this._pool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 250) {
        p.grp.position.z -= p.cycleLen;
        p.grp.position.x = p.xBase + (Math.random() * 2 - 1) * p.xJitter;
      }
    });

    this._lasers.forEach(function (l) {
      l.grp.rotation.y = Math.sin(t * l.speed + l.phase) * l.range;
    });

    if (this._useComposer) this._composer.render(dt);
    else this._ren.render(this._sc, this._cam);
  };

  MetropolisBg.prototype._resize = function () {
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._cam.aspect = window.innerWidth / window.innerHeight;
    this._cam.updateProjectionMatrix();
    if (this._useComposer) this._composer.setSize(window.innerWidth, window.innerHeight);
  };

  global.MetropolisBg = MetropolisBg;

}(window));
