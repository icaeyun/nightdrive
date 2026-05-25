/* cityscape.js — Mode 1: Dark purple/lime neon cyber city + HK green variation
   High-quality Three.js: window-grid shaders, wet-ground reflection, rain,
   light shafts, multi-layer glow, animated neon, HK district event          */
(function (global) {

  var PHI = 1.6180339887;
  function rnd(a, b)  { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  /* Window grid material — ONE plane per face, shader handles grid+flicker  */
  function makeWinGrid(col, nx, ny, op, ph) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Color(col) },
        uOp:  { value: op },
        uG:   { value: new THREE.Vector2(nx, ny) },
        uT:   { value: 0 },
        uPh:  { value: ph },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uCol; uniform float uOp,uT,uPh; uniform vec2 uG;',
        'varying vec2 vUv;',
        'float rnd(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }',
        'void main(){',
        '  vec2 id=floor(vUv*uG); vec2 cell=fract(vUv*uG);',
        '  float r=rnd(id+uPh);',
        '  if(r>0.76){ gl_FragColor=vec4(0.); return; }',    /* dark window */
        '  float fl=sin(uT*(0.7+r*3.5)+r*6.28)*0.5+0.5;',   /* flicker */
        '  float dim=0.50+0.50*step(0.10,fl);',
        '  vec2 br=vec2(0.13,0.10);',
        '  float mask=step(br.x,cell.x)*step(cell.x,1.-br.x)',
        '            *step(br.y,cell.y)*step(cell.y,1.-br.y);',
        '  gl_FragColor=vec4(uCol*dim, mask*uOp*dim);',
        '}'
      ].join('\n'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  /* Wet ground reflection — procedural ripple ShaderMaterial */
  function makeGroundRefl(c1, c2) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uC1: { value: new THREE.Color(c1) },
        uC2: { value: new THREE.Color(c2) },
        uT:  { value: 0 },
      },
      vertexShader: [
        'varying vec2 vWX;',
        'void main(){',
        '  vec4 wp=modelMatrix*vec4(position,1.);',
        '  vWX=wp.xz;',
        '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uC1,uC2; uniform float uT;',
        'varying vec2 vWX;',
        'float h(float n){ return fract(sin(n)*43758.5); }',
        'float ns(vec2 p){',
        '  vec2 i=floor(p); vec2 f=fract(p);',
        '  f=f*f*(3.-2.*f);',
        '  float n=i.x+i.y*57.;',
        '  return mix(mix(h(n),h(n+1.),f.x),mix(h(n+57.),h(n+58.),f.x),f.y);',
        '}',
        'void main(){',
        '  float cd=length(vec2(cameraPosition.x,cameraPosition.z)-vWX);',
        '  float fade=max(0.,1.-cd/260.); fade=fade*fade*fade;',
        '  vec2 p=vWX/20.;',
        '  float n1=ns(p+vec2(uT*.06,0.));',
        '  float n2=ns(p*2.2-vec2(0.,uT*.05));',
        '  float n=n1*n2*2.8;',
        '  vec3 col=mix(uC1,uC2,sin(vWX.x*.045+uT*.22)*.5+.5);',
        '  gl_FragColor=vec4(col*n, n*fade*.38);',
        '}'
      ].join('\n'),
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
  }

  function setPos(geo, flat) {
    var a = new THREE.BufferAttribute(new Float32Array(flat), 3);
    if (geo.setAttribute) geo.setAttribute('position', a);
    else                  geo.addAttribute('position', a);
    return a;
  }
  function bMesh(geo, col, op, add) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col, transparent: !!(op < 1 || add), opacity: op !== undefined ? op : 1,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !add,
    }));
  }

  /* Neon stripe with multi-layer glow ─ core + inner glow + outer glow    */
  function neonBand(grp, w, h, col, px, py, pz, pulseArr) {
    var mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var core = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mat);
    core.position.set(px, py, pz);
    grp.add(core);
    var g1 = bMesh(new THREE.PlaneGeometry(w * 1.8, h * 3.5), col, 0.18, true);
    g1.position.set(px, py, pz + 0.25);
    grp.add(g1);
    var g2 = bMesh(new THREE.PlaneGeometry(w * 3.5, h * 7.0), col, 0.06, true);
    g2.position.set(px, py, pz + 0.55);
    grp.add(g2);
    if (pulseArr) pulseArr.push({ mat: mat, base: 1.0,
      freq: 0.6 + Math.random() * 2.5, ph: Math.random() * 6.28 });
    return mat;
  }

  /* Colour palettes */
  var WIN_MAIN = [0xcc44ff, 0xaa22ff, 0x99ff22, 0xbbff44, 0x22ccff, 0x55aaff, 0xff44cc];
  var WIN_HK   = [0x00ff88, 0x22ff55, 0x88ff00, 0x00ffcc, 0x44ff44, 0x66ff22];
  var NEON     = [0xcc00ff, 0x99ff00, 0x00ffcc, 0xff00cc, 0x4400ff, 0x00aaff, 0x88ff22];

  /* ════════════════════════════════════════════════════════ */
  function CityScape(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;';
    container.appendChild(canvas);

    this._ren = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.setClearColor(0x00010a, 1);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.0;

    this._sc = new THREE.Scene();
    this._sc.fog = new THREE.Fog(0x00010a, 55, 1700);

    this._cam = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.5, 2200);
    this._cam.position.set(0, 14, 60);
    this._cam.lookAt(0, 8, -300);

    /* Bloom */
    this._useComposer = false;
    this._composer = null;
    try {
      if (typeof POSTPROCESSING !== 'undefined') {
        var bloom = new POSTPROCESSING.BloomEffect({
          luminanceThreshold: 0.0, luminanceSmoothing: 0.45,
          resolutionScale: 0.65, intensity: 2.2,
        });
        var rp = new POSTPROCESSING.RenderPass(this._sc, this._cam);
        var ep = new POSTPROCESSING.EffectPass(this._cam, bloom);
        ep.renderToScreen = true;
        this._composer = new POSTPROCESSING.EffectComposer(this._ren);
        this._composer.addPass(rp); this._composer.addPass(ep);
        this._useComposer = true;
      }
    } catch (e) {}

    this._iv         = 0;
    this._target     = 0;
    this._time       = 0;
    this._pool       = [];
    this._streaks    = [];
    this._winMats    = [];    /* window-grid ShaderMaterials for time update */
    this._pulseNeons = [];   /* pulsing neon materials */
    this._hkPool     = [];
    this._hkHaze     = [];
    this._groundMat  = null;
    this._rain       = null;
    this._rainData   = [];

    this._build();
    window.addEventListener('resize', this._resize.bind(this));
  }

  CityScape.prototype._build = function () {
    this._makeAtmosphere();
    this._makeGround();
    this._makeStars();
    this._makeDust();
    this._makeDistantSkyline();
    this._makeSideBuildings(-1);
    this._makeSideBuildings( 1);
    this._makeHKDistrict();
    this._makeHKHaze();
    this._makeStreaks();
    this._makeRain();
    this._makeLightShafts();
  };

  /* ── Atmosphere — 12 layered purple/indigo haze planes ─ */
  CityScape.prototype._makeAtmosphere = function () {
    var sc = this._sc;
    var layers = [
      [0x1a0055, 0.42, 6000, 320,  65, -660],
      [0x220066, 0.28, 5000, 160,  38, -540],
      [0x0a0030, 0.34, 6000,1000, 220, -1000],
      [0x003311, 0.18, 3200,  50,  13, -370],  /* faint lime horizon */
      [0x001a44, 0.25, 4200,  78,  52, -510],
      [0x330011, 0.24, 6000,  24,  16, -450],
      [0x110044, 0.40, 8000,1200, 280,-1250],
      [0x0d0040, 0.20, 6000, 550, 160, -820],
      [0x200060, 0.16, 7000, 800, 350,-1500],
      [0x050030, 0.28, 8000, 200,  90, -900],
      [0x002244, 0.14, 4000,  40,  20, -600],
      [0x1a0050, 0.12, 5000, 100,  30, -700],
    ];
    layers.forEach(function (l) {
      var m = bMesh(new THREE.PlaneGeometry(l[2], l[3]), l[0], l[1], true);
      m.material.side = THREE.DoubleSide;
      m.position.set(0, l[4], l[5]);
      sc.add(m);
    });
  };

  /* ── Ground — dark base + purple grid + wet reflection ── */
  CityScape.prototype._makeGround = function () {
    /* Dark floor */
    var gnd = bMesh(new THREE.PlaneGeometry(4800, 3500), 0x00010a, 1);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, 0, -400);
    this._sc.add(gnd);

    /* Purple perspective grid */
    var pts = [], N = 20;
    for (var i = 0; i <= N; i++) {
      var x0 = -140 + (i / N) * 280;
      pts.push(x0, 0.18, 82,  x0 * 0.020, 0.18, -800);
    }
    for (var j = 0; j < 26; j++) {
      var z  = 72 - j * 36;
      var sp = Math.max(2, 150 * Math.max(0, (82 - z) / 880));
      pts.push(-sp, 0.18, z,  sp, 0.18, z);
    }
    var lgeo = new THREE.BufferGeometry(); setPos(lgeo, pts);
    this._sc.add(new THREE.LineSegments(lgeo,
      new THREE.LineBasicMaterial({ color: 0x220055, transparent: true, opacity: 0.65 })
    ));

    /* Purple road centerline glow */
    var lane = bMesh(new THREE.PlaneGeometry(26, 800), 0x5500ff, 0.07, true);
    lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.4, -270);
    this._sc.add(lane);

    /* Wet ground reflection shader */
    this._groundMat = makeGroundRefl(0xcc44ff, 0x99ff22);
    var refl = new THREE.Mesh(new THREE.PlaneGeometry(4800, 3500), this._groundMat);
    refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.22, -400);
    this._sc.add(refl);

    /* Scattered puddle glows */
    for (var p = 0; p < 18; p++) {
      var px = rnd(-160, 160), pz = rnd(-500, 60);
      var pg = bMesh(new THREE.PlaneGeometry(rnd(4, 18), rnd(4, 18)),
        pick([0xcc00ff, 0x99ff00, 0x00ccff]), rnd(0.04, 0.10), true);
      pg.rotation.x = -Math.PI / 2; pg.position.set(px, 0.1, pz);
      this._sc.add(pg);
    }
  };

  /* ── Stars ────────────────────────────────────────────── */
  CityScape.prototype._makeStars = function () {
    var N = 1400, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-1600, 1600), rnd(30, 850), rnd(-1600, -10));
    var geo = new THREE.BufferGeometry(); setPos(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x8855cc, size: 1.4, sizeAttenuation: true,
      transparent: true, opacity: 0.48,
    })));
  };

  /* ── Floating neon dust particles ─────────────────────── */
  CityScape.prototype._makeDust = function () {
    var N = 600, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-260, 260), rnd(0, 95), rnd(-750, 120));
    var geo = new THREE.BufferGeometry(); setPos(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaa44ff, size: 0.72, sizeAttenuation: true,
      transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  };

  /* ── Distant static skyline ──────────────────────────── */
  CityScape.prototype._makeDistantSkyline = function () {
    var sc = this._sc;
    for (var i = 0; i < 130; i++) {
      var t    = (i * PHI) % 1;
      var side = (i % 2 === 0) ? -1 : 1;
      var x    = side * (50 + t * 420);
      var z    = -310 - t * 500;
      var bw   = 3 + t * 36;
      var bh   = 12 + t * 280;
      var bd   = 3 + t * 28;

      var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x010209, 1);
      body.position.set(x, bh / 2, z); sc.add(body);

      /* Window stripe on face */
      if (t > 0.30) {
        var wm = makeWinGrid(pick(WIN_MAIN), Math.max(2, Math.floor(bw / 1.8)),
          Math.max(3, Math.floor(bh / 3.0)), 0.22 + t * 0.18, t);
        var wp = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.85, bh * 0.90), wm);
        wp.position.set(x, bh / 2, z + (side > 0 ? -bd / 2 - 0.05 : bd / 2 + 0.05));
        sc.add(wp);
        this._winMats.push(wm);
      }

      /* Beacon */
      if (t > 0.50) {
        var bkCol = t > 0.80 ? 0x99ff00 : (t > 0.65 ? 0xcc00ff : 0xff0044);
        sc.add(Object.assign(bMesh(new THREE.BoxGeometry(0.55, 2.8, 0.55), bkCol, 1),
          { position: new THREE.Vector3(x, bh + 1.3, z) }));
      }

      /* Neon horizon band */
      if (t > 0.58 && bh > 80) {
        var nc = t > 0.76 ? 0x99ff00 : 0xcc00ff;
        var nb = bMesh(new THREE.BoxGeometry(bw + 1.0, 0.4, 0.1), nc, 0.65, true);
        nb.position.set(x, bh * rnd(0.3, 0.72), z + (side > 0 ? -bd / 2 : bd / 2));
        sc.add(nb);
      }
    }
  };

  /* ── Scrolling side buildings — main pool ────────────── */
  CityScape.prototype._makeSideBuildings = function (side) {
    var sc = this._sc, wm = this._winMats, pn = this._pulseNeons;

    for (var i = 0; i < 56; i++) {
      var t   = (i * PHI) % 1;
      var row = i % 4;
      var xB  = side * (24 + row * 26 + t * 24);
      var z0  = -860 + i * (1020 / 56);
      var bw  = 8 + t * 36;
      var bh  = 12 + t * 140;
      var bd  = 7 + t * 34;
      var fZ  = bd / 2 + 0.1;

      var grp = new THREE.Group();

      /* Building body */
      grp.add(Object.assign(
        bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x010309, 1),
        { position: new THREE.Vector3(0, bh / 2, 0) }
      ));

      /* Setback upper section */
      if (t > 0.48 && bh > 60) {
        var sbH = bh * rnd(0.20, 0.44);
        var sbW = bw * rnd(0.50, 0.76);
        grp.add(Object.assign(
          bMesh(new THREE.BoxGeometry(sbW, sbH, bd * 0.75), 0x010208, 1),
          { position: new THREE.Vector3(rnd(-bw * 0.08, bw * 0.08), bh - sbH / 2, 0) }
        ));
      }

      /* Front face — window grid shader (one plane covers whole face) */
      var cols = Math.max(2, Math.floor(bw / 2.0));
      var rows = Math.max(3, Math.floor(bh / 3.0));
      var wgm  = makeWinGrid(pick(WIN_MAIN), cols, rows, 0.38 + t * 0.22, t + i);
      var wgp  = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.88, bh * 0.94), wgm);
      wgp.position.set(0, bh / 2, fZ);
      grp.add(wgp); wm.push(wgm);

      /* Side face windows — smaller grid */
      var scols = Math.max(2, Math.floor(bd / 2.5));
      var srows = Math.max(2, Math.floor(bh / 4.0));
      var swgm  = makeWinGrid(pick(WIN_MAIN), scols, srows, 0.20 + t * 0.15, t + i + 5);
      var sideX = side > 0 ? -bw / 2 - 0.08 : bw / 2 + 0.08;
      var swgp  = new THREE.Mesh(new THREE.PlaneGeometry(bd * 0.88, bh * 0.90), swgm);
      swgp.rotation.y = Math.PI / 2;
      swgp.position.set(sideX, bh / 2, 0);
      grp.add(swgp); wm.push(swgm);

      /* Main horizontal neon band + glow layers */
      if (t > 0.28) {
        var nc = t > 0.70 ? 0x99ff00 : (t > 0.48 ? 0xcc00ff : 0x00ccff);
        neonBand(grp, bw + 1.6, 0.28 + t * 0.5, nc,
          rnd(-bw * 0.05, bw * 0.05), rnd(bh * 0.18, bh * 0.85), fZ, pn);
      }
      if (t > 0.58) {
        neonBand(grp, bw + 1.4, 0.22, pick(NEON),
          rnd(-bw * 0.05, bw * 0.05), rnd(bh * 0.08, bh * 0.38), fZ, null);
      }
      if (t > 0.76 && bh > 80) {
        neonBand(grp, bw * rnd(0.5, 0.9), 0.30, pick(NEON),
          rnd(-bw * 0.1, bw * 0.1), rnd(bh * 0.60, bh * 0.95), fZ, pn);
      }

      /* Vertical neon edge tube */
      if (t > 0.42) {
        var eg = new THREE.BufferGeometry();
        var ex = side > 0 ? -bw / 2 : bw / 2;
        var ez = side > 0 ? -bd / 2 : bd / 2;
        var lH = bh * (0.28 + t * 0.62);
        setPos(eg, [ex, bh - lH, ez,  ex, bh, ez]);
        grp.add(new THREE.Line(eg, new THREE.LineBasicMaterial({
          color: t > 0.68 ? 0x99ff22 : 0x8800ff, transparent: true, opacity: 0.32 + t * 0.50,
        })));
      }

      /* Neon sign cluster */
      if (t > 0.62 && bh > 40) {
        var ns = Math.floor(1 + t * 4);
        for (var s = 0; s < ns; s++) {
          var st = (s * PHI + i) % 1;
          var sw = rnd(1.2, 5.0), sh = rnd(0.4, 1.8);
          neonBand(grp, sw, sh, pick(NEON),
            rnd(-bw / 2 + sw, bw / 2 - sw),
            rnd(bh * 0.20, bh * 0.92),
            fZ + 0.12, null);
        }
      }

      /* Rooftop antenna beacon */
      if (t > 0.46) {
        var rCol = t > 0.80 ? 0x99ff00 : (t > 0.64 ? 0xff0055 : 0xcc00ff);
        grp.add(Object.assign(
          bMesh(new THREE.BoxGeometry(0.50, 2.8, 0.50), rCol, 0.92, true),
          { position: new THREE.Vector3(rnd(-bw / 4, bw / 4), bh + 1.4, 0) }
        ));
      }

      grp.position.set(xB, 0, z0);
      sc.add(grp);
      this._pool.push({ grp: grp, row: row });
    }
  };

  /* ── HK Green District ────────────────────────────────── */
  CityScape.prototype._makeHKDistrict = function () {
    var sc = this._sc, hp = this._hkPool, wm = this._winMats;
    for (var i = 0; i < 48; i++) {
      var t    = (i * PHI) % 1;
      var side = (i % 2 === 0) ? -1 : 1;
      var row  = i % 3;
      var xB   = side * (20 + row * 24 + t * 22);
      var z0   = -880 + i * (1020 / 48);
      var bw   = 5 + t * 22, bh = 8 + t * 72, bd = 5 + t * 20;
      var fZ   = bd / 2 + 0.08;
      var grp  = new THREE.Group();

      grp.add(Object.assign(
        bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x010905, 1),
        { position: new THREE.Vector3(0, bh / 2, 0) }
      ));

      /* Green window grid */
      var gm = makeWinGrid(pick(WIN_HK), Math.max(2, Math.floor(bw / 1.6)),
        Math.max(3, Math.floor(bh / 2.5)), 0.48 + t * 0.28, t + i + 88);
      var gp = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.88, bh * 0.92), gm);
      gp.position.set(0, bh / 2, fZ);
      grp.add(gp); wm.push(gm);

      /* Dense green neon sign strips */
      var ns = Math.floor(3 + t * 6);
      for (var s = 0; s < ns; s++) {
        var sc2 = t > 0.55 ? 0x00ff88 : (t > 0.30 ? 0x44ff00 : 0x00ffcc);
        neonBand(grp, rnd(0.8, bw * 0.88), rnd(0.3, 1.1), sc2,
          rnd(-bw / 2 + 1, bw / 2 - 1),
          rnd(bh * 0.10, bh * 0.94),
          fZ + 0.1, null);
      }

      /* Green vertical edge */
      if (t > 0.28) {
        var eg = new THREE.BufferGeometry();
        var ex = side > 0 ? -bw / 2 : bw / 2;
        var ez = side > 0 ? -bd / 2 : bd / 2;
        setPos(eg, [ex, 0, ez,  ex, bh, ez]);
        grp.add(new THREE.Line(eg, new THREE.LineBasicMaterial({
          color: 0x00ff88, transparent: true, opacity: 0.65,
        })));
      }

      if (t > 0.45) {
        grp.add(Object.assign(
          bMesh(new THREE.BoxGeometry(0.42, 1.9, 0.42), 0x00ff88, 0.88, true),
          { position: new THREE.Vector3(0, bh + 0.95, 0) }
        ));
      }

      grp.position.set(xB, 0, z0); grp.visible = false;
      sc.add(grp); hp.push({ grp: grp });
    }
  };

  /* ── HK Haze planes ───────────────────────────────────── */
  CityScape.prototype._makeHKHaze = function () {
    var sc = this._sc, hr = this._hkHaze;
    function addH(col, maxOp, w, h, y, z) {
      var m = bMesh(new THREE.PlaneGeometry(w, h), col, 0, true);
      m.material.side = THREE.DoubleSide; m.position.set(0, y, z); sc.add(m);
      hr.push({ mat: m.material, maxOp: maxOp });
    }
    addH(0x003300, 0.30, 7000, 800,  95, -560);
    addH(0x004400, 0.22, 7000, 400,  38, -340);
    addH(0x002200, 0.18, 7000, 220,  12, -200);
    /* Green ground glow */
    var gg = bMesh(new THREE.PlaneGeometry(4800, 3500), 0x003300, 0, true);
    gg.rotation.x = -Math.PI / 2; gg.position.set(0, 0.35, -400); sc.add(gg);
    hr.push({ mat: gg.material, maxOp: 0.18 });
  };

  /* ── Speed streaks ────────────────────────────────────── */
  CityScape.prototype._makeStreaks = function () {
    var sc = this._sc;
    for (var i = 0; i < 52; i++) {
      var t = (i * PHI) % 1, side = (i % 2 === 0) ? -1 : 1;
      var col = t > 0.66 ? 0x99ff22 : (t > 0.40 ? 0xcc00ff : 0x22aaff);
      var mat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 15 + t * 220), mat);
      var x = side * (12 + t * 88), y = 1.0 + t * 32, z = -65 + t * 310;
      mesh.position.set(x, y, z);
      sc.add(mesh);
      this._streaks.push({ mesh: mesh, x: x, y: y, z: z, phase: t });
    }
  };

  /* ── Rain (CPU-updated LineSegments) ─────────────────── */
  CityScape.prototype._makeRain = function () {
    var count = 320;
    var pos   = new Float32Array(count * 6);
    var geo   = new THREE.BufferGeometry();
    if (geo.setAttribute) geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    else                  geo.addAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.LineBasicMaterial({ color: 0x8899cc, transparent: true, opacity: 0.18 });
    this._rain = new THREE.LineSegments(geo, mat);
    this._sc.add(this._rain);
    for (var i = 0; i < count; i++) {
      this._rainData.push({
        x: rnd(-130, 130), y: rnd(-2, 82), z: rnd(-30, 90),
        spd: rnd(18, 38), len: rnd(1.2, 3.8),
      });
    }
  };

  /* ── Light shafts (diagonal additive planes) ─────────── */
  CityScape.prototype._makeLightShafts = function () {
    var sc = this._sc;
    var defs = [
      { col: 0x8800ff, op: 0.06, w: 3.0, h: 300, x:  -60, y: 120, z: -400, ry: 0.18 },
      { col: 0x66ff00, op: 0.05, w: 2.5, h: 280, x:   80, y: 110, z: -550, ry: -0.22 },
      { col: 0x0055ff, op: 0.05, w: 2.0, h: 260, x: -140, y:  90, z: -350, ry: 0.08 },
      { col: 0xcc00ff, op: 0.05, w: 2.5, h: 320, x:  160, y: 100, z: -480, ry: -0.12 },
    ];
    defs.forEach(function (d) {
      var m = bMesh(new THREE.PlaneGeometry(d.w, d.h), d.col, d.op, true);
      m.material.side = THREE.DoubleSide;
      m.position.set(d.x, d.y, d.z); m.rotation.y = d.ry;
      sc.add(m);
    });
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
    var T     = this._time;

    /* Ground shader */
    if (this._groundMat) this._groundMat.uniforms.uT.value = T;

    /* Window grid shaders */
    var wms = this._winMats;
    for (var wi = 0, wl = wms.length; wi < wl; wi++) wms[wi].uniforms.uT.value = T;

    /* Scroll main pool */
    this._pool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 120)
        p.grp.position.z = camZ - 860 - Math.random() * 130 - p.row * 85;
    });

    /* HK district cycle (65 s, active 12 s) */
    var cycle = T % 65, hkPhase = 0;
    if (cycle > 20 && cycle < 32) hkPhase = Math.sin((cycle - 20) / 12 * Math.PI);

    var hkVis = hkPhase > 0.01;
    this._hkPool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 120) p.grp.position.z -= 1020;
      p.grp.visible = hkVis;
    });
    this._hkHaze.forEach(function (h) { h.mat.opacity = h.maxOp * hkPhase; });

    /* Rain (only when visible) */
    if (this._rain) {
      var pos = this._rain.geometry.attributes.position.array;
      this._rainData.forEach(function (r, i) {
        r.y -= r.spd * dt;
        if (r.y < -3) { r.y = 82; r.x = rnd(-130, 130); r.z = rnd(-30, 90); }
        pos[i * 6]     = r.x; pos[i * 6 + 1] = r.y;     pos[i * 6 + 2] = r.z;
        pos[i * 6 + 3] = r.x; pos[i * 6 + 4] = r.y - r.len; pos[i * 6 + 5] = r.z;
      });
      this._rain.geometry.attributes.position.needsUpdate = true;
      this._rain.material.opacity = 0.10 + hkPhase * 0.14;
    }

    /* Pulsing neon signs */
    this._pulseNeons.forEach(function (p) {
      p.mat.opacity = 0.55 + 0.45 * (Math.sin(T * p.freq + p.ph) * 0.5 + 0.5);
    });

    /* Camera gentle drift */
    var drift = Math.sin(T * 0.07) * 10;
    this._cam.fov        = 72 + iv * 14;
    this._cam.position.x = drift * 0.28;
    this._cam.position.y = 14 - iv * 4.5;
    this._cam.lookAt(drift * 0.55, 7 - iv * 3, -300);
    this._cam.updateProjectionMatrix();

    /* Streaks */
    this._streaks.forEach(function (s) {
      if (iv < 0.015) { s.mesh.material.opacity = 0; return; }
      var cyc = (T * (0.52 + s.phase * 2.0) + s.phase * 6.5) % 1;
      s.mesh.material.opacity = iv * (0.06 + s.phase * 0.24) *
        Math.pow(Math.sin(cyc * Math.PI), 0.6);
      s.mesh.position.z = s.z + (cyc - 0.5) * 380 * iv;
    });

    if (this._useComposer) this._composer.render(dt);
    else this._ren.render(this._sc, this._cam);
  };

  CityScape.prototype._resize = function () {
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._cam.aspect = window.innerWidth / window.innerHeight;
    this._cam.updateProjectionMatrix();
    if (this._useComposer) this._composer.setSize(window.innerWidth, window.innerHeight);
  };

  global.CityScape = CityScape;
}(window));
