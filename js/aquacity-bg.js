/* aquacity-bg.js — Mode 4: green-blue underwater cyber city */
(function (global) {

  var PHI = 1.6180339887;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var AQUA  = [0x00ff88, 0x00ddaa, 0x44ffcc, 0x00ffbb, 0x22eeaa, 0x66ffdd, 0x00cc88];
  var WIN_A = [0x00ff88, 0x00ddcc, 0x22ffaa, 0x44ddff, 0x00ccaa, 0x33eebb, 0x55ffcc];

  var BLOCK    = 140;
  var CAM_Y    = 58;
  var CAM_Z    = 80;
  var LOOK_Y   = 14;
  var LOOK_Z   = -680;
  var CAM_FOV  = 80;
  var ALT_AMP  = 18;
  var ALT_FREQ = 0.009;
  var PAN_AMP  = 95;
  var PAN_FREQ = 0.007;
  var BUBBLE_N = 600;

  var COLS = [
    { x:  -48, n: 12, phOff: 0.00, sz: 'slim'  },
    { x:   48, n: 12, phOff: 0.50, sz: 'slim'  },
    { x: -125, n: 12, phOff: 0.25, sz: 'slim'  },
    { x:  125, n: 12, phOff: 0.75, sz: 'slim'  },
    { x: -215, n: 13, phOff: 0.12, sz: 'mid'   },
    { x:  215, n: 13, phOff: 0.62, sz: 'mid'   },
    { x: -315, n: 12, phOff: 0.37, sz: 'mid'   },
    { x:  315, n: 12, phOff: 0.87, sz: 'mid'   },
    { x: -420, n: 11, phOff: 0.18, sz: 'tower' },
    { x:  420, n: 11, phOff: 0.68, sz: 'tower' },
    { x: -525, n: 10, phOff: 0.44, sz: 'tower' },
    { x:  525, n: 10, phOff: 0.94, sz: 'tower' },
  ];

  var SZ = {
    slim:  { wMin: 10, wMax: 20, hMin: 28, hMax:  95, dMin:  8, dMax: 16 },
    mid:   { wMin: 16, wMax: 34, hMin: 48, hMax: 155, dMin: 12, dMax: 26 },
    tower: { wMin: 22, wMax: 46, hMin: 85, hMax: 235, dMin: 18, dMax: 36 },
  };

  function setAttr(geo, arr3) {
    var buf = arr3 instanceof Float32Array ? arr3 : new Float32Array(arr3);
    var a   = new THREE.BufferAttribute(buf, 3);
    if (geo.setAttribute) geo.setAttribute('position', a);
    else                  geo.addAttribute('position', a);
    return a;
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

    var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x000d10, 1);
    body.position.y = bh / 2;
    grp.add(body);

    // window glow strips
    var numW = 2 + Math.floor(t * 3);
    for (var i = 0; i < numW; i++) {
      var wy = (i + 1) / (numW + 1) * bh;
      var ws = bMesh(new THREE.PlaneGeometry(bw * rnd(0.30, 0.72), rnd(0.5, 1.4)), pick(WIN_A), rnd(0.12, 0.28), true);
      ws.position.set(rnd(-bw * 0.18, bw * 0.18), wy, bd / 2 + 0.05);
      grp.add(ws);
    }

    // bio-glow / seaweed accent on lower face
    if (t > 0.22) {
      var sg = bMesh(new THREE.PlaneGeometry(bw * rnd(0.28, 0.62), rnd(1.0, 3.2)), pick(AQUA), rnd(0.07, 0.16), true);
      sg.position.set(rnd(-bw * 0.18, bw * 0.18), bh * rnd(0.05, 0.28), bd / 2 + 0.05);
      grp.add(sg);
    }

    // horizontal glow band
    if (t > 0.38) {
      var band = bMesh(new THREE.BoxGeometry(bw + 1.2, rnd(0.35, 0.95), 0.2), pick(AQUA), rnd(0.32, 0.60), true);
      band.position.set(0, bh * rnd(0.38, 0.72), bd / 2 + 0.1);
      grp.add(band);
    }

    // glass dome on tower tops
    if (szKey === 'tower' && t > 0.45) {
      var dr = rnd(bw * 0.28, bw * 0.52);
      var dome = bMesh(
        new THREE.SphereGeometry(dr, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.50),
        pick(AQUA), rnd(0.04, 0.10), true
      );
      dome.position.set(0, bh + dr * 0.05, 0);
      grp.add(dome);
    }

    // rooftop beacon
    if (t > 0.55) {
      var rh = rnd(2, 6);
      var rt = bMesh(new THREE.BoxGeometry(0.55, rh, 0.55), pick(AQUA), 0.82, true);
      rt.position.set(0, bh + rh / 2, 0);
      grp.add(rt);
    }

    return { grp: grp, bh: bh };
  }

  /* ═══════════════════════════════════════════════════════ */
  function AquaCityBg(container) {
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
    this._ren.setClearColor(0x000d10, 1);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 0.9;

    this._sc = new THREE.Scene();
    this._sc.fog = new THREE.Fog(0x001510, 30, 1100);

    this._cam = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 1, 2000);
    this._cam.position.set(0, CAM_Y, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z));

    this._iv     = 0;
    this._target = 0;
    this._time   = 0;
    this._pool   = [];
    this._weeds  = [];
    this._shafts = [];
    this._bubbleAttr  = null;
    this._bubbleSpeeds = null;

    this._composer    = null;
    this._useComposer = false;
    try {
      if (typeof POSTPROCESSING !== 'undefined') {
        var bloom = new POSTPROCESSING.BloomEffect({
          luminanceThreshold: 0.0,
          luminanceSmoothing: 0.5,
          resolutionScale: 0.75,
          intensity: 1.8,
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

    this._sc.add(new THREE.AmbientLight(0x003322, 0.5));
    var dl = new THREE.DirectionalLight(0x00ffaa, 0.08);
    dl.position.set(0, 500, 0);
    this._sc.add(dl);

    this._build();
    window.addEventListener('resize', this._resize.bind(this));
  }

  AquaCityBg.prototype._build = function () {
    this._makeFloor();
    this._makeCity();
    this._makeBubbles();
    this._makeLightShafts();
    this._makeSeaweed();
  };

  AquaCityBg.prototype._makeFloor = function () {
    var sc = this._sc;

    var gnd = bMesh(new THREE.PlaneGeometry(6000, 5000), 0x000a0c, 1);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, -2, -600);
    sc.add(gnd);

    // deep water haze planes
    [
      [0x003322, 0.24, 6000, 200,  42, -1000],
      [0x001a10, 0.18, 4000, 100,  22,  -700],
      [0x002211, 0.14, 6000, 600, 160, -1200],
    ].forEach(function (g) {
      var m = bMesh(new THREE.PlaneGeometry(g[2], g[3]), g[0], g[1], true);
      m.material.side = THREE.DoubleSide;
      m.position.set(0, g[4], g[5]);
      sc.add(m);
    });

    // seafloor grid
    var pts = [];
    for (var i = 0; i <= 16; i++) {
      var x0 = -200 + (i / 16) * 400;
      pts.push(x0, 0.2, 120,  x0 * 0.02, 0.2, -900);
    }
    for (var j = 0; j < 18; j++) {
      var z  = 100 - j * 55;
      var sp = Math.max(3, 200 * Math.max(0, (100 - z) / 1000));
      pts.push(-sp, 0.2, z,  sp, 0.2, z);
    }
    var lgeo = new THREE.BufferGeometry();
    setAttr(lgeo, pts);
    sc.add(new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
      color: 0x004433, transparent: true, opacity: 0.26,
    })));
  };

  AquaCityBg.prototype._makeCity = function () {
    var sc   = this._sc;
    var pool = this._pool;

    COLS.forEach(function (col) {
      var cycleLen = col.n * BLOCK;
      var startZ   = -(col.phOff * cycleLen);
      var xJitter  = col.sz === 'slim' ? 8 : (col.sz === 'mid' ? 13 : 20);
      var xBase    = col.x;

      for (var i = 0; i < col.n; i++) {
        var t   = (i * PHI) % 1;
        var z0  = startZ - i * BLOCK + rnd(-BLOCK * 0.20, BLOCK * 0.20);
        var blt = makeBuilding(col.sz, t);
        blt.grp.position.set(xBase + (Math.random() * 2 - 1) * xJitter, 0, z0);
        sc.add(blt.grp);
        pool.push({ grp: blt.grp, cycleLen: cycleLen, xBase: xBase, xJitter: xJitter });
      }
    });

    // distant static skyline
    for (var s = 0; s < 40; s++) {
      var t2   = (s * PHI) % 1;
      var side = s % 2 === 0 ? -1 : 1;
      var sx   = side * (240 + t2 * 340);
      var sz2  = -500 - t2 * 600;
      var bw2  = 14 + t2 * 55;
      var bh2  = 45 + t2 * 240;
      var bod  = bMesh(new THREE.BoxGeometry(bw2, bh2, 12), 0x000c10, 1);
      bod.position.set(sx, bh2 / 2, sz2);
      sc.add(bod);
    }
  };

  AquaCityBg.prototype._makeBubbles = function () {
    var N   = BUBBLE_N;
    var pts = new Float32Array(N * 3);
    var spd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      pts[i * 3]     = rnd(-420, 420);
      pts[i * 3 + 1] = rnd(-10, 210);
      pts[i * 3 + 2] = rnd(-950, 110);
      spd[i]         = rnd(2.5, 13);
    }
    var geo  = new THREE.BufferGeometry();
    var attr = setAttr(geo, pts);
    this._bubbleAttr   = attr;
    this._bubbleSpeeds = spd;
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x44ffcc, size: 1.2, sizeAttenuation: true,
      transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  };

  AquaCityBg.prototype._makeLightShafts = function () {
    var sc   = this._sc;
    var defs = [
      { x:  60, z:  -220, h: 300, w: 18, col: 0x00cc88, op: 0.042 },
      { x: -85, z:  -420, h: 350, w: 14, col: 0x00aa66, op: 0.032 },
      { x: 145, z:  -620, h: 280, w: 20, col: 0x00dd99, op: 0.048 },
      { x: -55, z:  -820, h: 400, w: 16, col: 0x00bb77, op: 0.038 },
      { x: 200, z: -1020, h: 320, w: 22, col: 0x00cc88, op: 0.030 },
    ];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(d.w, d.h),
        new THREE.MeshBasicMaterial({
          color: d.col, transparent: true, opacity: d.op,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      );
      m.rotation.x = -0.12;
      m.position.set(d.x, d.h / 2 + 20, d.z);
      sc.add(m);
      this._shafts.push({ mesh: m, base: d.op, phase: Math.random() * Math.PI * 2 });
    }
  };

  AquaCityBg.prototype._makeSeaweed = function () {
    var sc = this._sc;
    for (var i = 0; i < 32; i++) {
      var t    = (i * PHI) % 1;
      var side = i % 2 === 0 ? -1 : 1;
      var x    = side * (18 + t * 115);
      var z    = -90 - t * 580;
      var h    = rnd(8, 28);
      var w    = bMesh(
        new THREE.PlaneGeometry(rnd(1.4, 3.8), h),
        pick(AQUA), rnd(0.11, 0.26), true
      );
      w.material.side = THREE.DoubleSide;
      w.position.set(x, h / 2, z);
      sc.add(w);
      this._weeds.push({ mesh: w, ox: x, phase: t * Math.PI * 2, spd: rnd(0.55, 1.45) });
    }
  };

  AquaCityBg.prototype.show = function () { this._canvas.style.opacity = '1'; };
  AquaCityBg.prototype.hide = function () { this._canvas.style.opacity = '0'; };

  AquaCityBg.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, v));
  };

  AquaCityBg.prototype.tick = function (dt) {
    this._time += dt;
    var iv = this._iv;
    this._iv += (this._target - iv) * Math.min(dt * (this._target > iv ? 2.5 : 0.85), 1);
    iv = this._iv;

    var speed = 12 + iv * 145;
    var camZ  = this._cam.position.z;
    var t     = this._time;

    var drift = Math.sin(t * PAN_FREQ) * PAN_AMP;
    var alt   = Math.sin(t * ALT_FREQ) * ALT_AMP;
    this._cam.position.set(drift * 0.20, CAM_Y + alt - iv * 8, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(drift * 0.38, LOOK_Y + alt * 0.24, LOOK_Z - iv * 38));
    this._cam.fov = CAM_FOV + iv * 8;
    this._cam.updateProjectionMatrix();

    // scroll city
    this._pool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 200) {
        p.grp.position.z -= p.cycleLen;
        p.grp.position.x = p.xBase + (Math.random() * 2 - 1) * p.xJitter;
      }
    });

    // bubbles rise
    var arr = this._bubbleAttr.array;
    var spd = this._bubbleSpeeds;
    for (var i = 0; i < BUBBLE_N; i++) {
      arr[i * 3 + 1] += spd[i] * dt;
      if (arr[i * 3 + 1] > 260) {
        arr[i * 3 + 1] = -12;
        arr[i * 3]     = rnd(-420, 420);
        arr[i * 3 + 2] = rnd(-950, 110);
      }
    }
    this._bubbleAttr.needsUpdate = true;

    // seaweed sway
    this._weeds.forEach(function (w) {
      w.mesh.position.x = w.ox + Math.sin(t * w.spd + w.phase) * 2.4;
      w.mesh.rotation.z = Math.sin(t * w.spd * 0.7 + w.phase) * 0.14;
    });

    // light shaft pulse
    this._shafts.forEach(function (s) {
      s.mesh.material.opacity = s.base * (0.55 + 0.45 * Math.sin(t * 0.38 + s.phase));
    });

    if (this._useComposer) this._composer.render(dt);
    else this._ren.render(this._sc, this._cam);
  };

  AquaCityBg.prototype._resize = function () {
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._cam.aspect = window.innerWidth / window.innerHeight;
    this._cam.updateProjectionMatrix();
    if (this._useComposer) this._composer.setSize(window.innerWidth, window.innerHeight);
  };

  global.AquaCityBg = AquaCityBg;

}(window));
