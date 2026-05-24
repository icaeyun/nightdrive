/* synthcity-bg.js — Mode 3: SynthCity-faithful neon city background.
   Rebuilt to match the original SynthCity web demo as closely as possible.
   Uses all SynthCity assets, exact lighting/fog/bloom values, and the same
   building/material/emissive setup from the reference source. */

(function (global) {
  'use strict';

  var ASSET_BASE = 'references/synthcity/assets/';

  /* ── Scene constants from SynthCity reference ───────────────
     Player.js: player_height=250, camera_fov=80
     index.js:  fog color=0x12122a, start=0, end=2700
                AmbientLight(0x1b2c80, 0.5)
                DirectionalLight(0x8b79ff, 0.1)
                toneMappingExposure=1.0
                bloom: threshold=0, strength=7, radius=1           */

  var CAM_Y    = 200;   /* elevated spectator view near SynthCity player_height */
  var CAM_Z    = 100;   /* slightly behind scene origin */
  var LOOK_Y   = 50;    /* gentle downward pitch toward city floor */
  var LOOK_Z   = -900;  /* far look depth */
  var CAM_FOV  = 78;    /* SynthCity uses 80; 78 gives slight cinematic crop */

  var BLOCK    = 152;   /* SynthCity cityBlockSize(128) + roadWidth(24) */
  var ROAD_W   = 24;

  /* ── Minimal OBJ parser (handles v/vt/vn/f, fan-triangulates quads) ── */
  function parseOBJ(text) {
    var verts = [], uvs = [], norms = [];
    var outPos = [], outUV = [], outNorm = [];
    var lines = text.split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line || line[0] === '#') continue;
      var tok = line.split(/\s+/);
      var type = tok[0];
      if (type === 'v') {
        verts.push(+tok[1], +tok[2], +tok[3]);
      } else if (type === 'vt') {
        uvs.push(+tok[1], +tok[2]);
      } else if (type === 'vn') {
        norms.push(+tok[1], +tok[2], +tok[3]);
      } else if (type === 'f') {
        var face = [];
        for (var fi = 1; fi < tok.length; fi++) {
          var p = tok[fi].split('/');
          face.push([+p[0]-1, p[1]?(+p[1]-1):-1, p[2]?(+p[2]-1):-1]);
        }
        for (var k = 1; k < face.length - 1; k++) {
          var tri = [face[0], face[k], face[k+1]];
          for (var ti = 0; ti < 3; ti++) {
            var vi = tri[ti][0]*3, ui = tri[ti][1]*2, ni = tri[ti][2]*3;
            outPos.push(verts[vi], verts[vi+1], verts[vi+2]);
            if (tri[ti][1] >= 0 && uvs.length)  outUV.push(uvs[ui], uvs[ui+1]);
            if (tri[ti][2] >= 0 && norms.length) outNorm.push(norms[ni], norms[ni+1], norms[ni+2]);
          }
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    function attr(name, arr, n) {
      var buf = new THREE.Float32BufferAttribute(arr, n);
      if (geo.setAttribute) geo.setAttribute(name, buf);
      else                  geo.addAttribute(name, buf);
    }
    attr('position', outPos, 3);
    if (outNorm.length) attr('normal', outNorm, 3);
    if (outUV.length)   attr('uv',     outUV,   2);
    return geo;
  }

  function loadOBJ(path) {
    return fetch(path).then(function (r) { return r.text(); }).then(parseOBJ);
  }

  /* ── SynthCityBg ──────────────────────────────────────────── */
  function SynthCityBg(container) {

    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'z-index:1;pointer-events:none;opacity:0;transition:opacity 0.65s ease;';
    container.appendChild(this._canvas);

    /* Renderer — exact SynthCity renderer config */
    this._ren = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.0;   /* SynthCity exact */

    /* Scene — SynthCity night */
    this._sc = new THREE.Scene();
    /* SynthCity fog: start=0 (applies immediately from camera, creating deep
       atmospheric haze). Far=2200 slightly shorter than SynthCity's 2700 to
       keep the city readable from our fixed elevated camera position. */
    this._sc.fog = new THREE.Fog(0x12122a, 0, 2200);
    this._sc.background = new THREE.Color(0x12122a);

    /* Camera — SynthCity spectator elevation */
    this._cam = new THREE.PerspectiveCamera(
      CAM_FOV, window.innerWidth / window.innerHeight, 1, 2800
    );
    this._cam.position.set(0, CAM_Y, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z));

    /* Lights — exact SynthCity night environment values.
       No extra point lights: SynthCity uses only ambient + directional +
       building emissive windows for the main scene illumination. */
    this._sc.add(new THREE.AmbientLight(0x1b2c80, 0.5));
    var sun = new THREE.DirectionalLight(0x8b79ff, 0.1);
    sun.position.set(1, 0.5, 0.25);
    this._sc.add(sun);

    /* Post-processing bloom.
       SynthCity uses UnrealBloomPass strength=7. We're using the bundled
       POSTPROCESSING BloomEffect — intensity=2.5 approximates that look. */
    this._composer    = null;
    this._useComposer = false;
    try {
      var comp  = new POSTPROCESSING.EffectComposer(this._ren);
      var rp    = new POSTPROCESSING.RenderPass(this._sc, this._cam);
      rp.renderToScreen = false;
      var bloom = new POSTPROCESSING.BloomEffect({
        luminanceThreshold: 0.0,
        luminanceSmoothing: 0.025,
        resolutionScale:    0.75,
        intensity:          2.5,
      });
      var bp = new POSTPROCESSING.EffectPass(this._cam, bloom);
      bp.renderToScreen = true;
      comp.addPass(rp);
      comp.addPass(bp);
      this._composer    = comp;
      this._useComposer = true;
    } catch (e) {
      console.warn('SynthCityBg: bloom unavailable.', e);
    }

    this._iv      = 0;
    this._target  = 0;
    this._time    = 0;
    this._pool    = [];
    this._models  = {};
    this._mats    = {};
    this._texs    = {};
    this._pending = 0;
    this._built   = false;

    this._buildAtmosphere();
    this._loadAssets();
    window.addEventListener('resize', this._resize.bind(this));
  }

  /* ── Public API ─────────────────────────────────────────────── */
  SynthCityBg.prototype.show = function () { this._canvas.style.opacity = '1'; };
  SynthCityBg.prototype.hide = function () { this._canvas.style.opacity = '0'; };
  SynthCityBg.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, +v || 0));
  };

  SynthCityBg.prototype.tick = function (dt) {
    this._time += dt;
    var iv = this._iv;
    this._iv += (this._target - iv) * Math.min(dt * (this._target > iv ? 2.5 : 0.85), 1);
    iv = this._iv;

    var speed = 18 + iv * 180;
    var camZ  = this._cam.position.z;

    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      p.grp.position.z += speed * dt;
      if (p.grp.position.z > camZ + 220) {
        p.grp.position.z -= p.cycleLen;
      }
    }

    this._cam.fov = CAM_FOV + iv * 5;
    this._cam.position.y = CAM_Y - iv * 12;
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z - iv * 50));
    this._cam.updateProjectionMatrix();

    if (this._useComposer) {
      this._composer.render(dt);
    } else {
      this._ren.render(this._sc, this._cam);
    }
  };

  SynthCityBg.prototype._resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this._ren.setSize(w, h);
    if (this._composer) this._composer.setSize(w, h);
    this._cam.aspect = w / h;
    this._cam.updateProjectionMatrix();
  };

  /* ── Atmosphere ─────────────────────────────────────────────── */
  SynthCityBg.prototype._buildAtmosphere = function () {
    var sc = this._sc;

    /* Star field above the horizon */
    var N = 900, spts = [];
    for (var i = 0; i < N; i++) {
      spts.push(
        (Math.random() - 0.5) * 3600,
        CAM_Y + 40 + Math.random() * 500,
        -200 - Math.random() * 2000
      );
    }
    var sgeo = new THREE.BufferGeometry();
    if (sgeo.setAttribute) sgeo.setAttribute('position', new THREE.Float32BufferAttribute(spts, 3));
    else                   sgeo.addAttribute('position',  new THREE.Float32BufferAttribute(spts, 3));
    sc.add(new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0x8899cc, size: 1.6, sizeAttenuation: true,
      transparent: true, opacity: 0.40
    })));

    /* Horizon atmospheric glow — indigo haze where city meets sky */
    function band(col, op, w, h, y, z) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        })
      );
      m.position.set(0, y, z);
      sc.add(m);
    }
    band(0x0a1640, 0.40, 7000, 380,  90, -1800);
    band(0x05102a, 0.28, 6000, 180,  60, -1400);
    /* Ground-level city ambient glow — subtle emissive wash from below */
    band(0x030a1e, 0.25, 4000, 500,   4, -1000);
  };

  /* ── Asset loading: all SynthCity models + textures ──────────── */
  SynthCityBg.prototype._loadAssets = function () {
    var self = this;
    var loader = new THREE.TextureLoader();
    this._pending = 0;

    function done() {
      self._pending--;
      if (self._pending <= 0 && !self._built) {
        self._built = true;
        self._buildMaterials();
        self._buildGround();
        self._buildCity();
      }
    }

    function tex(key, file, repeat) {
      self._pending++;
      var t = loader.load(ASSET_BASE + 'textures/' + file, done, undefined, done);
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.anisotropy = 8;
      self._texs[key] = t;
    }

    function obj(key, file) {
      self._pending++;
      loadOBJ(ASSET_BASE + 'models/' + file)
        .then(function (geo) { self._models[key] = geo; done(); })
        .catch(function ()   { done(); });
    }

    /* Ground */
    tex('gnd',    'ground.jpg',    true);
    tex('gnd_em', 'ground_em.jpg', true);

    /* Mega building */
    tex('mega',    'mega_building_01.jpg',    true);
    tex('mega_em', 'mega_building_01_em.jpg', true);

    /* All 10 building texture sets (base + emissive) */
    for (var i = 1; i <= 10; i++) {
      var id = (i < 10 ? '0' : '') + i;
      tex('b' + i,       'building_' + id + '.jpg',    true);
      tex('b' + i + 'e', 'building_' + id + '_em.jpg', true);
    }

    /* Small ads (5) + large ads (5) */
    for (var j = 1; j <= 5; j++) {
      var jid = (j < 10 ? '0' : '') + j;
      tex('ad' + j,  'ads_' + jid + '.jpg');
      tex('adl' + j, 'ads_large_' + jid + '.jpg');
    }

    /* Building models: 3 variants per type, types s_01 through s_05 */
    for (var t = 1; t <= 5; t++) {
      for (var v = 1; v <= 3; v++) {
        (function(tt, vv) {
          obj('s' + tt + '_' + vv, 's_0' + tt + '_0' + vv + '.obj');
        }(t, v));
      }
    }

    /* All 6 mega buildings */
    for (var m = 1; m <= 6; m++) {
      (function(mm) {
        var mid = (mm < 10 ? '0' : '') + mm;
        obj('mega' + mm, 'mega_' + mid + '.obj');
      }(m));
    }

    /* Ad OBJ models: for s_01–s_03 (2 each), s_04 and s_05 (4 each) */
    obj('ads01_1', 'ads_s_01_01.obj'); obj('ads01_2', 'ads_s_01_02.obj');
    obj('ads02_1', 'ads_s_02_01.obj'); obj('ads02_2', 'ads_s_02_02.obj');
    obj('ads03_1', 'ads_s_03_01.obj'); obj('ads03_2', 'ads_s_03_02.obj');
    for (var ai = 1; ai <= 4; ai++) {
      (function(a) {
        obj('ads04_' + a, 'ads_s_04_0' + a + '.obj');
        obj('ads05_' + a, 'ads_s_05_0' + a + '.obj');
      }(ai));
    }

    /* Topper ornaments: 12 variants */
    for (var tp = 1; tp <= 12; tp++) {
      (function(t2) {
        var tpid = (t2 < 10 ? '0' : '') + t2;
        obj('tp' + t2, 'topper_' + tpid + '.obj');
      }(tp));
    }
  };

  /* ── Materials — matching SynthCity AssetManager exactly ────── */
  SynthCityBg.prototype._buildMaterials = function () {
    var t = this._texs, m = this._mats;

    /* Ground — SynthCity: emissiveIntensity=0.2 night */
    m.gnd = new THREE.MeshPhongMaterial({
      map: t.gnd,
      emissive: 0x0090ff,
      emissiveMap: t.gnd_em,
      emissiveIntensity: 0.20,
      shininess: 0
    });

    /* Mega building */
    m.mega = new THREE.MeshPhongMaterial({
      map: t.mega,
      emissive: 0xffffff,
      emissiveMap: t.mega_em,
      emissiveIntensity: 1.5,
      shininess: 1
    });

    /* 10 building materials with random HSL emissive hue —
       exactly as SynthCity: new Color("hsl("+(Math.random()*360)+", 100%, 95%)")
       One random hue per texture set, consistent across all instances. */
    for (var i = 1; i <= 10; i++) {
      var hue = Math.floor(Math.random() * 360);
      m['b' + i] = new THREE.MeshPhongMaterial({
        map: t['b' + i],
        emissive: new THREE.Color('hsl(' + hue + ',100%,95%)'),
        emissiveMap: t['b' + i + 'e'],
        emissiveIntensity: 1.5,   /* SynthCity buildingWindowsEmissiveIntensity */
        shininess: 0
      });
    }

    /* Ad materials — additive blending, SynthCity adsEmissiveIntensity=0.1 */
    function adMat(emTex) {
      return new THREE.MeshPhongMaterial({
        emissive: 0xffffff,
        emissiveMap: emTex,
        emissiveIntensity: 0.1,
        blending: THREE.AdditiveBlending,
        fog: false,
        side: THREE.DoubleSide,
        transparent: false
      });
    }
    for (var j = 1; j <= 5; j++) {
      m['ad' + j]  = adMat(t['ad' + j]);
      m['adl' + j] = adMat(t['adl' + j]);
    }
  };

  /* ── Ground plane with tiled SynthCity ground texture ─────── */
  SynthCityBg.prototype._buildGround = function () {
    var sc  = this._sc;
    var gndMat = this._mats.gnd || new THREE.MeshBasicMaterial({ color: 0x020510 });

    /* Ground plane tiled to match SynthCity block grid */
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), gndMat);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, 0, -1200);
    if (this._texs.gnd) {
      var rpts = 4000 / BLOCK;
      this._texs.gnd.repeat.set(rpts, rpts);
      this._texs.gnd_em.repeat.set(rpts, rpts);
    }
    sc.add(gnd);

    /* City block grid lines — SynthCity block boundaries */
    var gpts = [], mpts = [];
    var xB = 10, zB = 20;
    var z0 = 500, z1 = -(zB * BLOCK);
    for (var xi = -xB; xi <= xB; xi++) {
      var lx = xi * BLOCK;
      gpts.push(lx, 0.8, z0, lx, 0.8, z1);
    }
    for (var zi = 0; zi <= zB; zi++) {
      var lz = z0 - zi * BLOCK;
      gpts.push(-xB * BLOCK, 0.8, lz, xB * BLOCK, 0.8, lz);
    }
    /* Major cross streets every 2 blocks */
    for (var xi2 = -xB; xi2 <= xB; xi2 += 2) {
      var mx = xi2 * BLOCK;
      mpts.push(mx, 1.2, z0, mx, 1.2, z1);
    }
    for (var zi2 = 0; zi2 <= zB; zi2 += 2) {
      var mz = z0 - zi2 * BLOCK;
      mpts.push(-xB * BLOCK, 1.2, mz, xB * BLOCK, 1.2, mz);
    }
    function mkLines(pts, color, opacity) {
      var geo = new THREE.BufferGeometry();
      if (geo.setAttribute) geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      else                  geo.addAttribute('position',  new THREE.Float32BufferAttribute(pts, 3));
      sc.add(new THREE.LineSegments(geo,
        new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity })
      ));
    }
    mkLines(gpts, 0x060f24, 0.45);
    mkLines(mpts, 0x0b1e3e, 0.60);

    /* Forward corridor glow — subtle trace of the nightdrive route */
    var routeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 3200),
      new THREE.MeshBasicMaterial({
        color: 0x002299, transparent: true, opacity: 0.055,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    routeMesh.rotation.x = -Math.PI / 2;
    routeMesh.position.set(0, 0.4, -1100);
    sc.add(routeMesh);
  };

  /* ── City building pool — wide grid matching SynthCity layout ── */
  SynthCityBg.prototype._buildCity = function () {
    var self   = this;
    var sc     = this._sc;
    var models = this._models;
    var mats   = this._mats;

    function rnd(a, b)  { return a + Math.random() * (b - a); }
    function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

    /* Fallback building mat */
    var fallbackMat = new THREE.MeshBasicMaterial({ color: 0x020510 });

    /* Get a random building model for a given type group */
    function getModel(keys) {
      for (var attempt = 0; attempt < keys.length * 2; attempt++) {
        var k = pick(keys);
        if (models[k]) return models[k];
      }
      return null;
    }

    /* Random building material from 1–10 */
    function getBldMat() {
      var idx = Math.floor(Math.random() * 10) + 1;
      return mats['b' + idx] || fallbackMat;
    }

    /* Random ad material */
    function getAdMat(large) {
      var idx = Math.floor(Math.random() * 5) + 1;
      return large ? (mats['adl' + idx] || fallbackMat) : (mats['ad' + idx] || fallbackMat);
    }

    /* Model key groups for each building type */
    var SMALL_KEYS  = ['s1_1','s1_2','s1_3','s2_1','s2_2','s2_3','s3_1','s3_2','s3_3'];
    var BIG_KEYS    = ['s4_1','s4_2','s4_3'];
    var TOWER_KEYS  = ['s5_1','s5_2','s5_3'];
    var MEGA_KEYS   = ['mega1','mega2','mega3','mega4','mega5','mega6'];
    var AD_S_KEYS   = ['ads01_1','ads01_2','ads02_1','ads02_2','ads03_1','ads03_2'];
    var AD_B_KEYS   = ['ads04_1','ads04_2','ads04_3','ads04_4'];
    var AD_T_KEYS   = ['ads05_1','ads05_2','ads05_3','ads05_4'];
    var TOPPER_KEYS = (function() {
      var k = [];
      for (var tp = 1; tp <= 12; tp++) k.push('tp' + tp);
      return k;
    }());

    /* ── Column definitions — wide city grid ──────────────────
       20 columns at SynthCity sub-block x-positions: blocks at
       ±BLOCK*{0..5} with sub-offsets of 32 and 96 within each block.
       Inner columns: small/medium buildings (more visible, closer)
       Outer columns: big/tower buildings (recede into fog)          */
    var COLS = [
      /* Left side — inner to outer */
      { x: -56,  keys: SMALL_KEYS, n: 16, large: false },
      { x: -120, keys: SMALL_KEYS, n: 16, large: false },
      { x: -208, keys: SMALL_KEYS, n: 15, large: false },
      { x: -272, keys: SMALL_KEYS, n: 15, large: false },
      { x: -360, keys: BIG_KEYS,   n: 14, large: false },
      { x: -424, keys: BIG_KEYS,   n: 14, large: false },
      { x: -512, keys: BIG_KEYS,   n: 13, large: true  },
      { x: -576, keys: BIG_KEYS,   n: 13, large: true  },
      { x: -664, keys: TOWER_KEYS, n: 12, large: true  },
      { x: -728, keys: TOWER_KEYS, n: 12, large: true  },
      /* Right side — inner to outer */
      { x:   56, keys: SMALL_KEYS, n: 16, large: false },
      { x:  120, keys: SMALL_KEYS, n: 16, large: false },
      { x:  208, keys: SMALL_KEYS, n: 15, large: false },
      { x:  272, keys: SMALL_KEYS, n: 15, large: false },
      { x:  360, keys: BIG_KEYS,   n: 14, large: false },
      { x:  424, keys: BIG_KEYS,   n: 14, large: false },
      { x:  512, keys: BIG_KEYS,   n: 13, large: true  },
      { x:  576, keys: BIG_KEYS,   n: 13, large: true  },
      { x:  664, keys: TOWER_KEYS, n: 12, large: true  },
      { x:  728, keys: TOWER_KEYS, n: 12, large: true  },
    ];

    COLS.forEach(function (col) {
      var isOuter  = Math.abs(col.x) > 450;
      var isTower  = col.keys === TOWER_KEYS;

      /* Z cycle length: span enough to fill deep view without gaps */
      var spacing  = BLOCK * 0.85;  /* slightly tighter than full block */
      var cycleLen = col.n * spacing;

      for (var i = 0; i < col.n; i++) {
        var geo = getModel(col.keys);
        if (!geo) continue;

        /* X varies slightly within the column — matches SynthCity block scatter */
        var xOff = col.x + rnd(-18, 18);

        /* Distribute evenly across the z cycle with a small per-building offset */
        var z = (CAM_Z + 100) - (i / col.n) * cycleLen + rnd(-15, 15);

        /* Scale: SynthCity uses 0.75+(noise*0.45) ≈ 0.75–1.20 for small,
           1.0+(noise*0.5) ≈ 1.0–1.5 for big buildings */
        var scale = isTower ? rnd(1.0, 1.6) : (isOuter ? rnd(0.9, 1.5) : rnd(0.75, 1.3));
        var rot   = Math.floor(Math.random() * 4) * Math.PI / 2;

        var grp = new THREE.Group();

        /* Main building body */
        var body = new THREE.Mesh(geo, getBldMat());
        body.scale.set(1, scale, 1);
        body.rotation.y = rot;
        grp.add(body);

        /* Ad OBJ attached to building (~45% of buildings, matching SynthCity rate) */
        if (Math.random() < 0.45) {
          var adKeys = col.keys === TOWER_KEYS ? AD_T_KEYS :
                       (col.keys === BIG_KEYS  ? AD_B_KEYS : AD_S_KEYS);
          var adGeo  = getModel(adKeys);
          if (adGeo) {
            var adMesh = new THREE.Mesh(adGeo, getAdMat(col.large));
            adMesh.scale.set(1, scale, 1);
            adMesh.rotation.y = -rot;  /* counter-rotate to face random direction */
            grp.add(adMesh);
          }
        }

        /* Topper ornament on tall buildings (rare, ~5%) */
        if (isTower && Math.random() < 0.05) {
          var tpGeo = getModel(TOPPER_KEYS);
          if (tpGeo) {
            var tpMesh = new THREE.Mesh(tpGeo, getAdMat(true));
            var buildingH = 190 * scale;  /* SynthCity topper y: 190*scale */
            tpMesh.position.y = buildingH;
            var ts = 0.8 + Math.random();
            tpMesh.scale.set(ts, ts, ts);
            grp.add(tpMesh);
          }
        }

        grp.position.set(xOff, 0, z);
        sc.add(grp);
        self._pool.push({ grp: grp, cycleLen: cycleLen });
      }
    });

    /* ── Mega buildings — static distant landmarks ────────────
       16 placements scattered across z=-600 to z=-2200, ±200–700 x.
       Static (no scrolling) so they anchor the deep skyline.         */
    var megaSlots = [
      [-220, -700],  [ 260, -850],  [-480, -650],  [ 500, -750],
      [-340, -1000], [ 380, -1100], [-600, -900],  [ 620, -1050],
      [-180, -1300], [ 240, -1450], [-520, -1200], [ 540, -1350],
      [-420, -1700], [ 460, -1850], [-650, -1500], [ 680, -1600],
    ];

    megaSlots.forEach(function (pos) {
      var geo = getModel(MEGA_KEYS);
      if (!geo) return;
      var scale = rnd(0.8, 1.4);  /* SynthCity mega scale: 0.75+(noise*0.25) */
      var grp   = new THREE.Group();
      var mesh  = new THREE.Mesh(geo, mats.mega || fallbackMat);
      mesh.scale.set(1, scale, 1);
      mesh.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      grp.add(mesh);

      /* Large ad on ~75% of mega buildings */
      if (Math.random() < 0.75) {
        var adGeo = getModel(AD_T_KEYS);
        if (adGeo) {
          var adMesh = new THREE.Mesh(adGeo, getAdMat(true));
          adMesh.scale.set(1, scale, 1);
          grp.add(adMesh);
        }
      }

      grp.position.set(pos[0] + rnd(-30, 30), 0, pos[1]);
      sc.add(grp);
      /* Mega buildings are static — they don't scroll */
    });
  };

  /* ── Export ──────────────────────────────────────────────────── */
  global.SynthCityBg = SynthCityBg;

}(window));
