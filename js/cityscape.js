/* cityscape.js — Three.js cinematic cyber-city background */
(function (global) {

  var PHI = 1.6180339887;
  var WIN_COLORS = [0xffaa44, 0xffcc66, 0x44ccff, 0x88ddff, 0xeef8ff, 0xbb66ff, 0xff4499, 0xff8844];

  function rnd(a, b)  { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  function setPos(geo, flat) {
    var a = new THREE.BufferAttribute(new Float32Array(flat), 3);
    if (geo.setAttribute) geo.setAttribute('position', a);
    else                  geo.addAttribute('position', a);
    return a;
  }

  function bMesh(geo, col, op, add, ds) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color:       col,
      transparent: !!(op < 1 || add),
      opacity:     op !== undefined ? op : 1,
      blending:    add  ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite:  !add,
      side:        ds   ? THREE.DoubleSide      : THREE.FrontSide,
    }));
  }

  /* ────────────────────────────────────────────────────── */
  function CityScape(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;';
    container.appendChild(canvas);

    this._ren = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.setClearColor(0x00020c, 1);

    this._sc = new THREE.Scene();

    this._cam = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.5, 2500
    );
    this._cam.position.set(0, 14, 60);
    this._cam.lookAt(new THREE.Vector3(0, 8, -300));

    this._iv      = 0;
    this._target  = 0;
    this._time    = 0;
    this._pool    = [];
    this._streaks = [];

    this._build();
    window.addEventListener('resize', this._resize.bind(this));
  }

  CityScape.prototype._build = function () {
    this._makeStars();
    this._makeHorizon();
    this._makeGround();
    this._makeDistantSkyline();
    this._makeSideBuildings(-1);
    this._makeSideBuildings( 1);
    this._makeStreaks();
  };

  /* ── Stars ────────────────────────────────────────────── */
  CityScape.prototype._makeStars = function () {
    var N = 800, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-1400, 1400), rnd(30, 700), rnd(-1200, -10));
    var geo = new THREE.BufferGeometry();
    setPos(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x99bbdd, size: 1.6, sizeAttenuation: true,
      transparent: true, opacity: 0.52,
    })));
  };

  /* ── Horizon / city-sky atmospheric glow ─────────────── */
  CityScape.prototype._makeHorizon = function () {
    var sc = this._sc;
    function add(col, op, w, h, y, z) {
      var m = bMesh(new THREE.PlaneGeometry(w, h), col, op, true, true);
      m.position.set(0, y, z);
      sc.add(m);
    }
    add(0x002244, 0.26, 6000, 200,  52, -640);
    add(0x331100, 0.18, 5000,  80,  30, -600);
    add(0x0d0035, 0.22, 6000, 700, 180, -780);
    add(0x0055bb, 0.34,   60, 110,  50, -530);
    add(0x001133, 0.42, 6000,  16,  20, -510);
    add(0x003322, 0.10, 1000, 200,  40, -400);
  };

  /* ── Ground with perspective grid ────────────────────── */
  CityScape.prototype._makeGround = function () {
    var gnd = bMesh(new THREE.PlaneGeometry(4000, 3000), 0x010208, 1);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, 0, -400);
    this._sc.add(gnd);

    var pts = [];
    var N = 14;
    for (var i = 0; i <= N; i++) {
      var x0 = -120 + (i / N) * 240;
      var x1 = x0 * 0.025;
      pts.push(x0, 0.2, 80,  x1, 0.2, -620);
    }
    for (var j = 0; j < 18; j++) {
      var z  = 70 - j * 44;
      var sp = Math.max(2, 120 * Math.max(0, (80 - z) / 700));
      pts.push(-sp, 0.2, z,  sp, 0.2, z);
    }
    var lgeo = new THREE.BufferGeometry();
    setPos(lgeo, pts);
    this._sc.add(new THREE.LineSegments(lgeo,
      new THREE.LineBasicMaterial({ color: 0x071828, transparent: true, opacity: 0.42 })
    ));

    var lane = bMesh(new THREE.PlaneGeometry(20, 600), 0x0033aa, 0.06, true, false);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.5, -230);
    this._sc.add(lane);
  };

  /* ── Distant static skyline ───────────────────────────── */
  CityScape.prototype._makeDistantSkyline = function () {
    var sc = this._sc;
    for (var i = 0; i < 80; i++) {
      var t    = (i * PHI) % 1;
      var side = (i % 2 === 0) ? -1 : 1;
      var x    = side * (80 + t * 320);
      var z    = -260 - t * 340;
      var bw   = 5 + t * 26;
      var bh   = 20 + t * 200;
      var bd   = 5 + t * 22;

      var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x010309, 1);
      body.position.set(x, bh / 2, z);
      sc.add(body);

      if (t > 0.60) {
        var bk = bMesh(new THREE.BoxGeometry(0.7, 3.0, 0.7), 0xff1600, 1);
        bk.position.set(x, bh + 1.4, z);
        sc.add(bk);
      }

      var numW = Math.floor(t * 16);
      for (var w = 0; w < numW; w++) {
        var wt  = (w * PHI) % 1;
        var win = bMesh(new THREE.BoxGeometry(0.75, 1.1, 0.1), pick(WIN_COLORS), 0.50 + wt * 0.38);
        win.position.set(
          x + rnd(-bw / 2 + 1, bw / 2 - 1),
          rnd(4, bh - 5),
          z + (side > 0 ? -bd / 2 - 0.1 : bd / 2 + 0.1)
        );
        sc.add(win);
      }
    }
  };

  /* ── Scrolling side building pool ─────────────────────── */
  CityScape.prototype._makeSideBuildings = function (side) {
    var sc = this._sc;
    for (var i = 0; i < 44; i++) {
      var t   = (i * PHI) % 1;
      var row = i % 3;
      var xB  = side * (32 + row * 22 + t * 18);
      var z0  = -740 + i * (920 / 44);
      var bw  = 8 + t * 30;
      var bh  = 12 + t * 105;
      var bd  = 7 + t * 28;

      var grp = new THREE.Group();

      var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x010408, 1);
      body.position.y = bh / 2;
      grp.add(body);

      var fZ    = side > 0 ? -bd / 2 - 0.08 : bd / 2 + 0.08;
      var numW  = Math.floor(6 + t * 26);
      for (var j = 0; j < numW; j++) {
        var jt  = (j * PHI) % 1;
        var wsz = 0.42 + jt * 1.5;
        var win = bMesh(new THREE.BoxGeometry(wsz, wsz * 1.7, 0.08), pick(WIN_COLORS), 0.68 + jt * 0.30);
        win.position.set(
          rnd(-bw / 2 + 1, bw / 2 - 1),
          rnd(1.5, bh - 1.5),
          fZ
        );
        grp.add(win);
      }

      var sideX = side > 0 ? bw / 2 + 0.08 : -bw / 2 - 0.08;
      var numSW = Math.floor(t * 10);
      for (var sw = 0; sw < numSW; sw++) {
        var swt = (sw * PHI) % 1;
        var swz = 0.38 + swt * 1.2;
        var swin = bMesh(new THREE.BoxGeometry(0.08, swz * 1.6, swz), pick(WIN_COLORS), 0.45 + swt * 0.30);
        swin.position.set(sideX, rnd(2, bh - 2), rnd(-bd / 2 + 1, bd / 2 - 1));
        grp.add(swin);
      }

      if (t > 0.70) {
        var nc = t > 0.87 ? 0x00ffaa : (t > 0.78 ? 0xff0055 : 0x0099ff);
        var stripe = bMesh(new THREE.BoxGeometry(bw + 1.2, 0.30 + t, 0.15), nc, 0.62, true);
        stripe.position.set(0, rnd(bh * 0.25, bh * 0.80), fZ - (side > 0 ? 0.1 : -0.1));
        grp.add(stripe);
      }

      if (t > 0.45) {
        var lH  = bh * (0.28 + t * 0.60);
        var lg  = new THREE.BufferGeometry();
        var ex  = side > 0 ? -bw / 2 : bw / 2;
        var ez  = side > 0 ? -bd / 2 : bd / 2;
        setPos(lg, [ex, bh - lH, ez,  ex, bh, ez]);
        grp.add(new THREE.Line(lg,
          new THREE.LineBasicMaterial({ color: 0x1155cc, transparent: true, opacity: 0.25 + t * 0.38 })
        ));
      }

      if (t > 0.82) {
        var rCol = t > 0.92 ? 0xff1800 : 0x00ccff;
        var rtop = bMesh(new THREE.BoxGeometry(0.6, 2.4, 0.6), rCol, 1);
        rtop.position.set(rnd(-bw / 4, bw / 4), bh + 1.2, 0);
        grp.add(rtop);
      }

      grp.position.set(xB, 0, z0);
      sc.add(grp);
      this._pool.push({ grp: grp, row: row });
    }
  };

  /* ── Speed streaks ────────────────────────────────────── */
  CityScape.prototype._makeStreaks = function () {
    var sc = this._sc;
    for (var i = 0; i < 36; i++) {
      var t    = (i * PHI) % 1;
      var side = (i % 2 === 0) ? -1 : 1;
      var x    = side * (16 + t * 70);
      var y    = 1.2 + t * 24;
      var z    = -80 + t * 260;
      var len  = 18 + t * 180;

      var mat  = new THREE.MeshBasicMaterial({
        color: 0x55aaff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, len), mat);
      mesh.position.set(x, y, z);
      sc.add(mesh);
      this._streaks.push({ mesh: mesh, x: x, y: y, z: z, phase: t });
    }
  };

  /* ── Public API ───────────────────────────────────────── */
  CityScape.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, v));
  };

  CityScape.prototype.tick = function (dt) {
    this._time += dt;
    var iv = this._iv;

    this._iv += (this._target - iv) * Math.min(dt * (this._target > iv ? 2.5 : 0.85), 1);
    iv = this._iv;

    var speed = 24 + iv * 280;
    var camZ  = this._cam.position.z;

    this._pool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 110) {
        p.grp.position.z = camZ - 720 - Math.random() * 120 - p.row * 80;
      }
    });

    this._cam.fov      = 70 + iv * 16;
    this._cam.position.y = 14 - iv * 4.5;
    this._cam.lookAt(new THREE.Vector3(0, 7 - iv * 3, -300));
    this._cam.updateProjectionMatrix();

    var t = this._time;
    this._streaks.forEach(function (s) {
      if (iv < 0.015) { s.mesh.material.opacity = 0; return; }
      var cyc = (t * (0.50 + s.phase * 2.0) + s.phase * 6.5) % 1;
      s.mesh.material.opacity = iv * (0.06 + s.phase * 0.22) *
        Math.pow(Math.sin(cyc * Math.PI), 0.6);
      s.mesh.position.z = s.z + (cyc - 0.5) * 340 * iv;
    });

    this._ren.render(this._sc, this._cam);
  };

  CityScape.prototype._resize = function () {
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._cam.aspect = window.innerWidth / window.innerHeight;
    this._cam.updateProjectionMatrix();
  };

  global.CityScape = CityScape;

}(window));
