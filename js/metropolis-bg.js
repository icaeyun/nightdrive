/* metropolis-bg.js — Mode 2: Golden Macau luxury cyber metropolis
   Max-quality Three.js: window-grid shaders, wet-ground gold reflection, gold rain,
   light shafts, multi-layer neon glow, grand casino/hotel architecture           */
(function (global) {

  var PHI = 1.6180339887;
  function rnd(a, b)  { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ── Window grid material — ONE plane per face, shader handles grid+flicker ── */
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
        '  if(r>0.72){ gl_FragColor=vec4(0.); return; }',    /* dark window */
        '  float fl=sin(uT*(0.6+r*3.0)+r*6.28)*0.5+0.5;',   /* flicker */
        '  float dim=0.52+0.48*step(0.12,fl);',
        '  vec2 br=vec2(0.12,0.09);',
        '  float mask=step(br.x,cell.x)*step(cell.x,1.-br.x)',
        '            *step(br.y,cell.y)*step(cell.y,1.-br.y);',
        /* warm gold tint variation per window */
        '  float tint=rnd(id+uPh+0.5);',
        '  vec3 c=uCol*mix(0.72,1.0,tint);',
        '  gl_FragColor=vec4(c*dim, mask*uOp*dim);',
        '}'
      ].join('\n'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  /* ── Wet ground reflection — warm gold/amber procedural ripple ─────────── */
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
        '  float fade=max(0.,1.-cd/380.); fade=fade*fade*fade;',
        '  vec2 p=vWX/24.;',
        '  float n1=ns(p+vec2(uT*.05,0.));',
        '  float n2=ns(p*2.0-vec2(0.,uT*.04));',
        '  float n=n1*n2*3.2;',
        '  vec3 col=mix(uC1,uC2,sin(vWX.x*.038+uT*.18)*.5+.5);',
        '  gl_FragColor=vec4(col*n, n*fade*.45);',
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

  /* ── Multi-layer neon band — core + inner glow + outer glow ──────────────── */
  function neonBand(grp, w, h, col, px, py, pz, pulseArr) {
    var mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var core = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mat);
    core.position.set(px, py, pz);
    grp.add(core);
    var g1 = bMesh(new THREE.PlaneGeometry(w * 1.9, h * 3.8), col, 0.18, true);
    g1.position.set(px, py, pz + 0.28);
    grp.add(g1);
    var g2 = bMesh(new THREE.PlaneGeometry(w * 3.8, h * 7.5), col, 0.065, true);
    g2.position.set(px, py, pz + 0.60);
    grp.add(g2);
    if (pulseArr) pulseArr.push({ mat: mat, base: 1.0,
      freq: 0.5 + Math.random() * 2.0, ph: Math.random() * 6.28 });
    return mat;
  }

  /* ── Colour palettes ─────────────────────────────────────────────────────── */
  var WIN_GOLD = [0xffcc44, 0xffe080, 0xffd060, 0xffaa30,
                  0xffb840, 0xffc860, 0xffe8a0, 0xffa020,
                  0xffd700, 0xffcf60, 0xffdc58, 0xffe04a];
  var NEON     = [0xffbb00, 0xff9900, 0xffcc44, 0xffa020,
                  0xff7700, 0xffe080, 0xdda000, 0xffcc88,
                  0xffd700, 0xff8c00, 0xffc200, 0xffaa44,
                  0xff6600, 0xffdd22, 0xffb300];

  /* ── Layout constants ────────────────────────────────────────────────────── */
  var BLOCK    = 175;
  var CAM_Y    = 200;
  var CAM_Z    = 120;
  var LOOK_Y   = 42;
  var LOOK_Z   = -900;
  var CAM_FOV  = 74;
  var ALT_AMP  = 48;
  var ALT_FREQ = 0.012;
  var PAN_AMP  = 210;
  var PAN_FREQ = 0.009;

  var COLS = [
    { x:  -45, n: 13, phOff: 0.00, sz: 'slim'  },
    { x:   45, n: 13, phOff: 0.50, sz: 'slim'  },
    { x: -115, n: 14, phOff: 0.25, sz: 'slim'  },
    { x:  115, n: 14, phOff: 0.75, sz: 'slim'  },
    { x: -210, n: 14, phOff: 0.12, sz: 'mid'   },
    { x:  210, n: 14, phOff: 0.62, sz: 'mid'   },
    { x: -320, n: 13, phOff: 0.37, sz: 'mid'   },
    { x:  320, n: 13, phOff: 0.87, sz: 'mid'   },
    { x: -440, n: 12, phOff: 0.18, sz: 'tower' },
    { x:  440, n: 12, phOff: 0.68, sz: 'tower' },
    { x: -570, n: 11, phOff: 0.44, sz: 'tower' },
    { x:  570, n: 11, phOff: 0.94, sz: 'tower' },
    { x: -710, n: 10, phOff: 0.31, sz: 'mega'  },
    { x:  710, n: 10, phOff: 0.81, sz: 'mega'  },
    { x: -870, n:  9, phOff: 0.55, sz: 'mega'  },
    { x:  870, n:  9, phOff: 0.05, sz: 'mega'  },
  ];

  var SZ = {
    slim:  { wMin: 14, wMax: 26, hMin: 45,  hMax: 160, dMin: 12, dMax: 22 },
    mid:   { wMin: 22, wMax: 48, hMin: 90,  hMax: 260, dMin: 18, dMax: 38 },
    tower: { wMin: 30, wMax: 65, hMin: 160, hMax: 380, dMin: 24, dMax: 50 },
    mega:  { wMin: 55, wMax:100, hMin: 280, hMax: 580, dMin: 40, dMax: 75 },
  };

  /* ════════════════════════════════════════════════════════════════════════════ */
  function MetropolisBg(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    canvas.style.opacity = '0';
    container.appendChild(canvas);
    this._canvas = canvas;

    this._ren = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.setClearColor(0x080400, 1);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.1;

    this._sc = new THREE.Scene();
    this._sc.fog = new THREE.Fog(0x0c0600, 60, 2800);

    this._cam = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 1, 3600);
    this._cam.position.set(0, CAM_Y, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z));

    /* Bloom — warm gold, strong */
    this._useComposer = false;
    this._composer    = null;
    try {
      if (typeof POSTPROCESSING !== 'undefined') {
        var bloom = new POSTPROCESSING.BloomEffect({
          luminanceThreshold: 0.0, luminanceSmoothing: 0.50,
          resolutionScale: 0.72, intensity: 2.8,
        });
        var rp = new POSTPROCESSING.RenderPass(this._sc, this._cam);
        var ep = new POSTPROCESSING.EffectPass(this._cam, bloom);
        ep.renderToScreen = true;
        this._composer = new POSTPROCESSING.EffectComposer(this._ren);
        this._composer.addPass(rp); this._composer.addPass(ep);
        this._useComposer = true;
      }
    } catch (e) {}

    this._sc.add(new THREE.AmbientLight(0x3a1a00, 0.60));
    var dl = new THREE.DirectionalLight(0xffcc44, 0.18);
    dl.position.set(200, 600, 200);
    this._sc.add(dl);

    this._iv          = 0;
    this._target      = 0;
    this._time        = 0;
    this._pool        = [];
    this._lasers      = [];
    this._winMats     = [];
    this._pulseNeons  = [];
    this._groundMat   = null;
    this._rain        = null;
    this._rainData    = [];
    this._spotlights  = [];

    this._build();
    window.addEventListener('resize', this._resize.bind(this));
  }

  MetropolisBg.prototype._build = function () {
    this._makeAtmosphere();
    this._makeGround();
    this._makeStars();
    this._makeDust();
    this._makeDistantSkyline();
    this._makeCity();
    this._makeLasers();
    this._makeLightShafts();
    this._makeRain();
  };

  /* ── Atmosphere — 14 warm gold haze layers ───────────────────────────────── */
  MetropolisBg.prototype._makeAtmosphere = function () {
    var sc = this._sc;
    var layers = [
      [0x5a2800, 0.32, 8000,  380,  95, -1400],   /* main horizon gold glow */
      [0x3d1500, 0.22, 6000,  140,  55,  -950],   /* amber mid-sky band */
      [0x100800, 0.30, 8000, 1100, 300, -1800],   /* deep warm sky fill */
      [0x8c4400, 0.22,  180,  240,  95,  -680],   /* gold column left */
      [0x402000, 0.20, 8000,   28,   8,  -850],   /* champagne horizon line */
      [0x240e00, 0.24, 8000,  700, 200, -1200],   /* warm upper haze */
      [0x6a3000, 0.18, 8000,   60,  22,  -620],   /* bright horizon edge */
      [0x1a0900, 0.35, 8000,  500, 140, -1050],   /* deep warm band */
      [0x4a1e00, 0.12, 4000,   90,  35,  -520],   /* mid haze strip */
      [0x2c1000, 0.28, 8000,  900, 260, -1350],   /* sky upper fill */
      [0x7a3800, 0.10, 2400,  160,  75,  -480],   /* near column shimmer */
      [0x380f00, 0.14, 6000,  300, 120,  -880],   /* mid-distance haze */
      [0x180600, 0.20, 8000,  200,  80,  -700],   /* faint ground haze */
      [0x5c2200, 0.08, 3600,   50,  18,  -420],   /* near amber glimmer */
    ];
    layers.forEach(function (l) {
      var m = bMesh(new THREE.PlaneGeometry(l[2], l[3]), l[0], l[1], true);
      m.material.side = THREE.DoubleSide;
      m.position.set(0, l[4], l[5]);
      sc.add(m);
    });
  };

  /* ── Ground — dark warm base + gold grid + wet gold reflection ──────────── */
  MetropolisBg.prototype._makeGround = function () {
    /* Dark floor */
    var gnd = bMesh(new THREE.PlaneGeometry(7000, 6000), 0x050200, 1);
    gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -1, -900);
    this._sc.add(gnd);

    /* Gold perspective grid */
    var pts = [], N = 22;
    for (var i = 0; i <= N; i++) {
      var x0 = -360 + (i / N) * 720;
      pts.push(x0, 0.3, 220,  x0 * 0.01, 0.3, -1600);
    }
    for (var j = 0; j < 26; j++) {
      var z  = 220 - j * 70;
      var sp = Math.max(4, 360 * Math.max(0, (220 - z) / 1820));
      pts.push(-sp, 0.3, z,  sp, 0.3, z);
    }
    var lgeo = new THREE.BufferGeometry(); setPos(lgeo, pts);
    this._sc.add(new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
      color: 0x4a2000, transparent: true, opacity: 0.42,
    })));

    /* Gold road centerline glow */
    var lane = bMesh(new THREE.PlaneGeometry(28, 1800), 0xffaa00, 0.06, true);
    lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.5, -700);
    this._sc.add(lane);

    /* Wet ground gold reflection shader */
    this._groundMat = makeGroundRefl(0xffcc44, 0xff8800);
    var refl = new THREE.Mesh(new THREE.PlaneGeometry(7000, 6000), this._groundMat);
    refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.22, -900);
    this._sc.add(refl);

    /* Scattered gold puddle glows */
    for (var p = 0; p < 24; p++) {
      var px = rnd(-280, 280), pz = rnd(-900, 80);
      var pg = bMesh(new THREE.PlaneGeometry(rnd(5, 22), rnd(5, 22)),
        pick([0xffcc00, 0xff9900, 0xffaa44, 0xffd700]), rnd(0.05, 0.12), true);
      pg.rotation.x = -Math.PI / 2; pg.position.set(px, 0.1, pz);
      this._sc.add(pg);
    }
  };

  /* ── Stars — warm gold tint ──────────────────────────────────────────────── */
  MetropolisBg.prototype._makeStars = function () {
    var N = 1200, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-2400, 2400), rnd(80, 1200), rnd(-2400, -10));
    var geo = new THREE.BufferGeometry(); setPos(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffd080, size: 1.6, sizeAttenuation: true,
      transparent: true, opacity: 0.38,
    })));
  };

  /* ── Gold dust particles ─────────────────────────────────────────────────── */
  MetropolisBg.prototype._makeDust = function () {
    var N = 800, pts = [];
    for (var i = 0; i < N; i++)
      pts.push(rnd(-380, 380), rnd(0, 320), rnd(-1100, 160));
    var geo = new THREE.BufferGeometry(); setPos(geo, pts);
    this._sc.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffcc44, size: 0.85, sizeAttenuation: true,
      transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  };

  /* ── Distant static mega-towers ─────────────────────────────────────────── */
  MetropolisBg.prototype._makeDistantSkyline = function () {
    var sc = this._sc, wm = this._winMats;
    for (var i = 0; i < 90; i++) {
      var t    = (i * PHI) % 1;
      var side = (i % 2 === 0) ? -1 : 1;
      var x    = side * (50 + t * 560);
      var z    = -350 - t * 700;
      var bw   = 6 + t * 80;
      var bh   = 20 + t * 520;
      var bd   = 5 + t * 55;

      var body = bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x060300, 1);
      body.position.set(x, bh / 2, z); sc.add(body);

      /* Wide podium on large distant towers */
      if (t > 0.55 && bh > 180) {
        var podW = bw * rnd(1.3, 1.9);
        var podH = bh * rnd(0.06, 0.14);
        var pod  = bMesh(new THREE.BoxGeometry(podW, podH, bd * 1.4), 0x070300, 1);
        pod.position.set(x, podH / 2, z); sc.add(pod);
      }

      /* Gold window grid on face */
      if (t > 0.30) {
        var wm2 = makeWinGrid(pick(WIN_GOLD), Math.max(2, Math.floor(bw / 2.2)),
          Math.max(3, Math.floor(bh / 4.0)), 0.20 + t * 0.20, t + i * 0.5);
        var wp = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.82, bh * 0.88), wm2);
        wp.position.set(x, bh / 2, z + (side > 0 ? -bd / 2 - 0.05 : bd / 2 + 0.05));
        sc.add(wp); wm.push(wm2);
      }

      /* Gold neon band */
      if (t > 0.40) {
        var grpD = new THREE.Group();
        grpD.position.set(x, 0, z);
        neonBand(grpD, bw + 2, 0.6 + t * 0.8, pick(NEON),
          0, bh * rnd(0.35, 0.78), bd / 2 + 0.1, null);
        if (t > 0.65) {
          neonBand(grpD, bw + 1.5, 0.4, pick(NEON),
            0, bh * rnd(0.08, 0.30), bd / 2 + 0.1, null);
        }
        sc.add(grpD);
      }

      /* Crown glow beacon */
      if (t > 0.58) {
        var bk = bMesh(new THREE.BoxGeometry(0.7, 4.0, 0.7), pick(NEON), 0.88, true);
        bk.position.set(x, bh + 2.0, z); sc.add(bk);
      }
    }
  };

  /* ── Scrolling city — grand casino/hotel columns ─────────────────────────── */
  MetropolisBg.prototype._makeCity = function () {
    var sc = this._sc, wm = this._winMats, pn = this._pulseNeons, pool = this._pool;

    COLS.forEach(function (col) {
      var cycleLen = col.n * BLOCK;
      var startZ   = -(col.phOff * cycleLen);
      var xJitter  = col.sz === 'slim' ? 9 : (col.sz === 'mid' ? 16 : 24);
      var xBase    = col.x;
      var sz       = SZ[col.sz];

      for (var i = 0; i < col.n; i++) {
        var t   = (i * PHI) % 1;
        var z0  = startZ - i * BLOCK + rnd(-BLOCK * 0.18, BLOCK * 0.18);
        var bw  = rnd(sz.wMin, sz.wMax);
        var bh  = rnd(sz.hMin, sz.hMax);
        var bd  = rnd(sz.dMin, sz.dMax);
        var fZ  = bd / 2 + 0.1;
        var grp = new THREE.Group();

        /* Main body — dark warm */
        grp.add(Object.assign(
          bMesh(new THREE.BoxGeometry(bw, bh, bd), 0x060300, 1),
          { position: new THREE.Vector3(0, bh / 2, 0) }
        ));

        /* Hotel/casino wide podium base */
        if ((col.sz === 'tower' || col.sz === 'mega') && t > 0.30) {
          var podW = bw * rnd(1.35, 1.85);
          var podH = bh * rnd(0.07, 0.17);
          var podD = bd * rnd(1.3, 1.6);
          grp.add(Object.assign(
            bMesh(new THREE.BoxGeometry(podW, podH, podD), 0x070300, 1),
            { position: new THREE.Vector3(0, podH / 2, 0) }
          ));
          /* Podium edge neon band */
          if (t > 0.48) {
            neonBand(grp, podW + 1.2, 0.22, pick(NEON), 0, podH, fZ * (podD / bd), pn);
          }
        }

        /* Setback upper tower */
        if (col.sz === 'mega' && t > 0.50) {
          var sbW = bw * rnd(0.44, 0.64);
          var sbH = bh * rnd(0.22, 0.42);
          var sbD = bd * rnd(0.58, 0.75);
          grp.add(Object.assign(
            bMesh(new THREE.BoxGeometry(sbW, sbH, sbD), 0x060300, 1),
            { position: new THREE.Vector3(rnd(-bw * 0.06, bw * 0.06), bh - sbH / 2, 0) }
          ));
          /* Setback face window grid */
          var sbm = makeWinGrid(pick(WIN_GOLD),
            Math.max(2, Math.floor(sbW / 2.0)), Math.max(3, Math.floor(sbH / 3.5)),
            0.38 + t * 0.20, t + i + 22);
          var sbp = new THREE.Mesh(new THREE.PlaneGeometry(sbW * 0.84, sbH * 0.90), sbm);
          sbp.position.set(0, bh - sbH / 2, sbD / 2 + 0.08);
          grp.add(sbp); wm.push(sbm);
        }

        /* Front face — gold window grid shader */
        var cols = Math.max(2, Math.floor(bw / 2.2));
        var rows = Math.max(3, Math.floor(bh / 3.5));
        var wgm  = makeWinGrid(pick(WIN_GOLD), cols, rows, 0.40 + t * 0.24, t + i);
        var wgp  = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.86, bh * 0.92), wgm);
        wgp.position.set(0, bh / 2, fZ);
        grp.add(wgp); wm.push(wgm);

        /* Side face window grid */
        var scols = Math.max(2, Math.floor(bd / 2.8));
        var srows = Math.max(2, Math.floor(bh / 4.5));
        var swgm  = makeWinGrid(pick(WIN_GOLD), scols, srows, 0.22 + t * 0.15, t + i + 7);
        var sideX = col.x < 0 ? bw / 2 + 0.08 : -bw / 2 - 0.08;
        var swgp  = new THREE.Mesh(new THREE.PlaneGeometry(bd * 0.86, bh * 0.88), swgm);
        swgp.rotation.y = Math.PI / 2;
        swgp.position.set(sideX, bh / 2, 0);
        grp.add(swgp); wm.push(swgm);

        /* Main horizontal gold neon band + glow */
        if (t > 0.22) {
          var nc = t > 0.72 ? 0xffd700 : (t > 0.46 ? 0xffaa00 : 0xff9900);
          neonBand(grp, bw + 2.0, 0.30 + t * 0.55, nc,
            rnd(-bw * 0.04, bw * 0.04), rnd(bh * 0.20, bh * 0.80), fZ, pn);
        }
        if (t > 0.48) {
          neonBand(grp, bw + 1.6, 0.22, pick(NEON),
            rnd(-bw * 0.04, bw * 0.04), rnd(bh * 0.08, bh * 0.32), fZ, null);
        }
        if (t > 0.70 && bh > 120) {
          neonBand(grp, bw * rnd(0.5, 0.92), 0.32, pick(NEON),
            rnd(-bw * 0.08, bw * 0.08), rnd(bh * 0.55, bh * 0.94), fZ, pn);
        }

        /* Vertical gold edge line */
        if (t > 0.40) {
          var eg = new THREE.BufferGeometry();
          var ex = col.x < 0 ? bw / 2 : -bw / 2;
          var ez = col.x < 0 ? bd / 2 : -bd / 2;
          var lH = bh * (0.30 + t * 0.60);
          setPos(eg, [ex, bh - lH, ez,  ex, bh, ez]);
          grp.add(new THREE.Line(eg, new THREE.LineBasicMaterial({
            color: pick([0xffcc00, 0xff8800, 0xffa020]), transparent: true,
            opacity: 0.35 + t * 0.48,
          })));
        }

        /* Large gold billboard / signage */
        if ((col.sz === 'tower' || col.sz === 'mega') && t > 0.52) {
          var bw3  = rnd(bw * 0.40, bw * 0.84);
          var bh3  = rnd(14, 44);
          var bill = bMesh(new THREE.PlaneGeometry(bw3, bh3), pick(NEON), rnd(0.10, 0.24), true);
          bill.position.set(rnd(-bw * 0.12, bw * 0.12), bh * rnd(0.50, 0.86), fZ + 0.7);
          grp.add(bill);
          /* Billboard inner glow */
          var billG = bMesh(new THREE.PlaneGeometry(bw3 * 2.2, bh3 * 2.5),
            pick(NEON), 0.06, true);
          billG.position.set(rnd(-bw * 0.12, bw * 0.12), bh * rnd(0.50, 0.86), fZ + 1.0);
          grp.add(billG);
        }

        /* Crown / ornate topper */
        if ((col.sz === 'tower' || col.sz === 'mega') && t > 0.60) {
          var crW = bw * rnd(0.28, 0.52);
          var crH = rnd(9, 26);
          var cr  = bMesh(new THREE.BoxGeometry(crW, crH, crW * 0.55), pick(NEON), 0.75, true);
          cr.position.set(0, bh + crH / 2, 0);
          grp.add(cr);
          /* Crown glow ring */
          var crG = bMesh(new THREE.PlaneGeometry(crW * 2.8, crH * 1.8), pick(NEON), 0.08, true);
          crG.position.set(0, bh + crH / 2, bd / 2 + 0.2);
          grp.add(crG);
        }

        /* Neon sign cluster on facade */
        if (t > 0.58 && bh > 50) {
          var ns = Math.floor(2 + t * 5);
          for (var s = 0; s < ns; s++) {
            var sw = rnd(1.4, 5.5), sh = rnd(0.5, 2.0);
            neonBand(grp, sw, sh, pick(NEON),
              rnd(-bw / 2 + sw, bw / 2 - sw),
              rnd(bh * 0.18, bh * 0.90),
              fZ + 0.14, null);
          }
        }

        /* Rooftop antenna / spire */
        if (t > 0.42) {
          var rCol = t > 0.78 ? 0xffcc00 : (t > 0.62 ? 0xff6600 : 0xff3300);
          grp.add(Object.assign(
            bMesh(new THREE.BoxGeometry(0.55, rnd(5, 14), 0.55), rCol, 0.88, true),
            { position: new THREE.Vector3(rnd(-bw / 5, bw / 5), bh + 4, 0) }
          ));
        }

        grp.position.set(xBase + (Math.random() * 2 - 1) * xJitter, 0, z0);
        sc.add(grp);
        pool.push({ grp: grp, cycleLen: cycleLen, xBase: xBase, xJitter: xJitter });
      }
    });
  };

  /* ── Casino laser sweeps — gold/amber ────────────────────────────────────── */
  MetropolisBg.prototype._makeLasers = function () {
    var sc = this._sc;
    var defs = [
      { col: 0xffcc00, op: 0.13, w: 2.0, len: 2400, y: 200, z:  -900, spd: 0.022, rng: 0.65, ph: 0.0 },
      { col: 0xff9900, op: 0.10, w: 1.6, len: 2600, y: 290, z: -1200, spd: 0.016, rng: 0.80, ph: 2.1 },
      { col: 0xffc840, op: 0.09, w: 1.3, len: 2000, y: 240, z:  -750, spd: 0.028, rng: 0.52, ph: 3.7 },
      { col: 0xffaa00, op: 0.09, w: 1.8, len: 2800, y: 360, z: -1550, spd: 0.014, rng: 0.88, ph: 1.4 },
      { col: 0xffe060, op: 0.08, w: 1.1, len: 1800, y: 160, z:  -600, spd: 0.032, rng: 0.45, ph: 5.2 },
      { col: 0xffd700, op: 0.08, w: 1.4, len: 2200, y: 420, z: -1100, spd: 0.019, rng: 0.72, ph: 4.0 },
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

  /* ── Gold god rays — vertical light shafts ───────────────────────────────── */
  MetropolisBg.prototype._makeLightShafts = function () {
    var sc = this._sc;
    var defs = [
      { col: 0xffcc00, op: 0.07, w: 4.0, h: 380, x: -70,  y: 150, z: -480, ry:  0.16 },
      { col: 0xff9900, op: 0.06, w: 3.5, h: 340, x:  90,  y: 140, z: -620, ry: -0.20 },
      { col: 0xffd700, op: 0.06, w: 3.0, h: 320, x: -160, y: 120, z: -420, ry:  0.09 },
      { col: 0xffaa44, op: 0.05, w: 3.2, h: 360, x:  180, y: 130, z: -540, ry: -0.13 },
      { col: 0xffe060, op: 0.05, w: 2.5, h: 280, x: -240, y: 100, z: -380, ry:  0.22 },
      { col: 0xffcc44, op: 0.05, w: 2.8, h: 300, x:  260, y: 110, z: -460, ry: -0.18 },
    ];
    defs.forEach(function (d) {
      var m = bMesh(new THREE.PlaneGeometry(d.w, d.h), d.col, d.op, true);
      m.material.side = THREE.DoubleSide;
      m.position.set(d.x, d.y, d.z); m.rotation.y = d.ry;
      sc.add(m);
      /* glow halo for each shaft */
      var halo = bMesh(new THREE.PlaneGeometry(d.w * 3.5, d.h * 0.5), d.col, d.op * 0.5, true);
      halo.material.side = THREE.DoubleSide;
      halo.position.set(d.x, d.y * 0.28, d.z); halo.rotation.y = d.ry;
      sc.add(halo);
    });
  };

  /* ── Gold rain — fine amber drizzle ─────────────────────────────────────── */
  MetropolisBg.prototype._makeRain = function () {
    var count = 280;
    var pos   = new Float32Array(count * 6);
    var geo   = new THREE.BufferGeometry();
    if (geo.setAttribute) geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    else                  geo.addAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.LineBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.14 });
    this._rain = new THREE.LineSegments(geo, mat);
    this._sc.add(this._rain);
    for (var i = 0; i < count; i++) {
      this._rainData.push({
        x: rnd(-320, 320), y: rnd(-4, 320), z: rnd(-80, 180),
        spd: rnd(14, 30), len: rnd(1.0, 3.2),
      });
    }
  };

  /* ── Public API ──────────────────────────────────────────────────────────── */
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

    var speed = 28 + iv * 340;
    var camZ  = this._cam.position.z;
    var T     = this._time;

    /* Ground gold reflection shader */
    if (this._groundMat) this._groundMat.uniforms.uT.value = T;

    /* Window grid shaders */
    var wms = this._winMats;
    for (var wi = 0, wl = wms.length; wi < wl; wi++) wms[wi].uniforms.uT.value = T;

    /* Pulsing neons */
    var pns = this._pulseNeons;
    for (var pi = 0, pl = pns.length; pi < pl; pi++) {
      var pn = pns[pi];
      pn.mat.opacity = pn.base * (0.72 + 0.28 * Math.sin(T * pn.freq + pn.ph));
    }

    /* Camera sway */
    var drift = Math.sin(T * PAN_FREQ) * PAN_AMP;
    var alt   = Math.sin(T * ALT_FREQ) * ALT_AMP;
    this._cam.position.set(drift * 0.24, CAM_Y + alt - iv * 16, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(drift * 0.50, LOOK_Y + alt * 0.30, LOOK_Z - iv * 65));
    this._cam.fov = CAM_FOV + iv * 12;
    this._cam.updateProjectionMatrix();

    /* Scroll city pool */
    this._pool.forEach(function (p) {
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 280) {
        p.grp.position.z -= p.cycleLen;
        p.grp.position.x = p.xBase + (Math.random() * 2 - 1) * p.xJitter;
      }
    });

    /* Casino laser sweeps */
    this._lasers.forEach(function (l) {
      l.grp.rotation.y = Math.sin(T * l.speed + l.phase) * l.range;
    });

    /* Gold rain update */
    if (this._rain) {
      var pos = this._rain.geometry.attributes.position.array;
      var rd  = this._rainData;
      for (var ri = 0; ri < rd.length; ri++) {
        var r = rd[ri];
        r.y -= r.spd * dt;
        if (r.y < -4) {
          r.y = 320 + Math.random() * 80;
          r.x = rnd(-320, 320); r.z = rnd(-80, 180);
        }
        var base = ri * 6;
        pos[base]     = r.x; pos[base + 1] = r.y;       pos[base + 2] = r.z;
        pos[base + 3] = r.x; pos[base + 4] = r.y - r.len; pos[base + 5] = r.z;
      }
      this._rain.geometry.attributes.position.needsUpdate = true;
      this._rain.material.opacity = 0.10 + iv * 0.18;
    }

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
