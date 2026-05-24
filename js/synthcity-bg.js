/* synthcity-bg.js v5 — Mode 3: SynthCity neon city, full atmosphere.
   - Slow cinematic altitude oscillation + horizontal city drift
   - Flying vehicles (SynthCity car models)
   - Sweeping laser beam effects
   - Holographic lane markers (replaces flat blue plane)
   - Spotlight search beams from tall buildings
   - Smoke rising from building tops
   - Wider inner city, staggered pool phases to break repetition */

(function (global) {
  'use strict';

  var ASSET_BASE = 'references/synthcity/assets/';

  /* ── Scene constants ─────────────────────────────────────────────
     SynthCity reference: player_height=250, fov=80
     fog: color=0x12122a, start=0, end=2700
     AmbientLight(0x1b2c80, 0.5) / DirectionalLight(0x8b79ff, 0.1)
     toneMappingExposure=1.0 / bloom threshold=0, strength=7        */

  var CAM_Y    = 300;   /* baseline altitude (range: ~60 – 540) */
  var CAM_Z    = 100;
  var LOOK_Y   = 45;
  var LOOK_Z   = -900;
  var CAM_FOV  = 78;
  var BLOCK    = 152;
  var ROAD_W   = 24;

  /* Cinematic motion parameters */
  var ALT_AMP  = 240;    /* altitude swing ±240 units → 60 (street) to 540 (high sky) */
  var ALT_FREQ = 0.010;  /* ~630 s per full cycle ≈ 10 min: 5 min rise, 5 min descent */
  var PAN_AMP  = 210;    /* X-drift swing ±210 units  */
  var PAN_FREQ = 0.011;  /* ~570 s per full cycle      */

  /* ── Minimal OBJ parser ──────────────────────────────────────── */
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

  /* ── SynthCityBg ─────────────────────────────────────────────── */
  function SynthCityBg(container) {

    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'z-index:1;pointer-events:none;opacity:0;transition:opacity 0.65s ease;';
    container.appendChild(this._canvas);

    this._ren = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.0;

    this._sc = new THREE.Scene();
    this._sc.fog = new THREE.Fog(0x12122a, 0, 2200);
    this._sc.background = new THREE.Color(0x12122a);

    this._cam = new THREE.PerspectiveCamera(
      CAM_FOV, window.innerWidth / window.innerHeight, 1, 2800
    );
    this._cam.position.set(0, CAM_Y, CAM_Z);
    this._cam.lookAt(new THREE.Vector3(0, LOOK_Y, LOOK_Z));

    /* Lights — exact SynthCity night values */
    this._sc.add(new THREE.AmbientLight(0x1b2c80, 0.5));
    var sun = new THREE.DirectionalLight(0x8b79ff, 0.1);
    sun.position.set(1, 0.5, 0.25);
    this._sc.add(sun);

    /* Bloom */
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
      console.warn('SynthCityBg: bloom fallback.', e);
    }

    /* State */
    this._iv       = 0;
    this._target   = 0;
    this._time     = 0;
    this._pool     = [];   /* scrolling city objects */
    this._aircraft = [];   /* flying vehicles */
    this._lasers   = [];   /* sweeping laser beams */
    this._smokes   = [];   /* smoke rising from buildings */
    this._models   = {};
    this._mats     = {};
    this._texs     = {};
    this._pending  = 0;
    this._built    = false;

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

  /* ── Tick ───────────────────────────────────────────────────── */
  SynthCityBg.prototype.tick = function (dt) {
    this._time += dt;
    var iv = this._iv;
    this._iv += (this._target - iv) * Math.min(dt * (this._target > iv ? 2.5 : 0.85), 1);
    iv = this._iv;

    /* ── Cinematic camera motion ──────────────────────────────
       Two independent sine waves create a complex, non-repeating
       flight path through the city. Camera drifts laterally while
       slowly gaining/losing altitude — like a real autopilot route. */
    var drift  = Math.sin(this._time * PAN_FREQ) * PAN_AMP;
    var alt    = Math.sin(this._time * ALT_FREQ) * ALT_AMP;
    var camX   = drift * 0.28;
    var camY   = CAM_Y + alt - iv * 12;
    this._cam.position.set(camX, camY, CAM_Z);
    /* When high, look further ahead and steeper down so the city
       fills the frame rather than disappearing below the horizon. */
    var lookFarZ = LOOK_Z - Math.max(0, alt) * 0.65 - iv * 50;
    this._cam.lookAt(new THREE.Vector3(
      drift,
      LOOK_Y + alt * 0.42,
      lookFarZ
    ));
    this._cam.fov = CAM_FOV + iv * 5 + Math.max(0, alt) * 0.035;
    this._cam.updateProjectionMatrix();

    var speed = 18 + iv * 180;
    var camZ  = this._cam.position.z;
    var self  = this;

    /* ── Building + holo + spotlight pool ───────────────────── */
    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      p.grp.position.z += speed * dt;

      if (p.grp.position.z > camZ + 220) {
        p.grp.position.z -= p.cycleLen;
        /* Re-scatter X on each cycle to break exact repetition */
        if (p.xBase !== undefined) {
          p.grp.position.x = p.xBase + (Math.random() * 2 - 1) * p.xJitter;
        }
      }

      /* Spotlight — lookAt camera + oscillate */
      if (p.spot) {
        p.spotRstep += 0.012;
        p.spot.lookAt(self._cam.position);
        p.spot.rotation.x += Math.cos(p.spotRstep) * 0.008;
      }

      /* Smoke — lookAt camera + slow rotate */
      if (p.smoke) {
        p.smokeRstep += 0.003;
        p.smoke.lookAt(self._cam.position);
        p.smoke.rotation.x += Math.cos(p.smokeRstep) * 0.005;
      }
    }

    /* ── Flying aircraft ─────────────────────────────────────── */
    for (var ai = 0; ai < this._aircraft.length; ai++) {
      var a = this._aircraft[ai];
      a.grp.position.x = a.ox + Math.sin(self._time * a.xf + a.ph) * a.xa;
      a.grp.position.y = a.oy + Math.sin(self._time * a.yf + a.ph * 1.4) * a.ya;
      a.grp.position.z += (speed * 0.55) * dt;  /* aircraft slower than city */
      if (a.grp.position.z > camZ + 300) a.grp.position.z -= a.cycle;
      /* Bank angle based on lateral velocity direction */
      a.grp.rotation.z = Math.cos(self._time * a.xf + a.ph) * 0.20;
    }

    /* ── Laser sweep ─────────────────────────────────────────── */
    for (var li = 0; li < this._lasers.length; li++) {
      var l = this._lasers[li];
      l.grp.rotation.y = Math.sin(self._time * l.speed + l.phase) * l.range;
    }

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

    /* Stars — dense field above the city horizon */
    var N = 1000, spts = [];
    for (var i = 0; i < N; i++) {
      spts.push(
        (Math.random() - 0.5) * 3600,
        CAM_Y + 50 + Math.random() * 550,
        -150 - Math.random() * 2100
      );
    }
    var sgeo = new THREE.BufferGeometry();
    if (sgeo.setAttribute) sgeo.setAttribute('position', new THREE.Float32BufferAttribute(spts, 3));
    else                   sgeo.addAttribute('position',  new THREE.Float32BufferAttribute(spts, 3));
    sc.add(new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0x8899cc, size: 1.7, sizeAttenuation: true,
      transparent: true, opacity: 0.42
    })));

    /* Additional faint distant stars deeper in the sky */
    var N2 = 600, spts2 = [];
    for (var j = 0; j < N2; j++) {
      spts2.push(
        (Math.random() - 0.5) * 5000,
        CAM_Y + 120 + Math.random() * 800,
        -400 - Math.random() * 2400
      );
    }
    var sgeo2 = new THREE.BufferGeometry();
    if (sgeo2.setAttribute) sgeo2.setAttribute('position', new THREE.Float32BufferAttribute(spts2, 3));
    else                    sgeo2.addAttribute('position',  new THREE.Float32BufferAttribute(spts2, 3));
    sc.add(new THREE.Points(sgeo2, new THREE.PointsMaterial({
      color: 0x6677aa, size: 1.2, sizeAttenuation: true,
      transparent: true, opacity: 0.28
    })));

    /* Horizon glow bands — city atmosphere at the skyline */
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
    band(0x0c1a44, 0.42, 7000, 360,  88, -1900);
    band(0x060e28, 0.30, 6000, 160,  58, -1500);
    band(0x03081c, 0.22, 5000, 550,   5, -1100);

    /* Volumetric city floor glow — light rising from the neon streets */
    band(0x050c22, 0.18, 4000, 400,  22, -800);
  };

  /* ── Asset loading ──────────────────────────────────────────── */
  SynthCityBg.prototype._loadAssets = function () {
    var self   = this;
    var loader = new THREE.TextureLoader();
    this._pending = 0;

    function done() {
      self._pending--;
      if (self._pending <= 0 && !self._built) {
        self._built = true;
        self._buildMaterials();
        self._buildGround();
        self._buildCity();
        self._buildAircraft();
        self._buildLasers();
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

    /* All 10 building texture sets */
    for (var i = 1; i <= 10; i++) {
      var id = (i < 10 ? '0' : '') + i;
      tex('b' + i,       'building_' + id + '.jpg',    true);
      tex('b' + i + 'e', 'building_' + id + '_em.jpg', true);
    }

    /* Ad textures */
    for (var j = 1; j <= 5; j++) {
      var jid = (j < 10 ? '0' : '') + j;
      tex('ad' + j,  'ads_' + jid + '.jpg');
      tex('adl' + j, 'ads_large_' + jid + '.jpg');
    }

    /* Traffic car textures — used for flying vehicles */
    tex('cars',    'cars.jpg',    false);
    tex('cars_em', 'cars_em.jpg', false);

    /* Smoke textures */
    tex('smoke1', 'smoke_01.jpg'); tex('smoke2', 'smoke_02.jpg'); tex('smoke3', 'smoke_03.jpg');

    /* Spotlight textures */
    tex('spot1', 'spotlight_01.jpg'); tex('spot2', 'spotlight_02.jpg');
    tex('spot3', 'spotlight_03.jpg'); tex('spot4', 'spotlight_04.jpg');

    /* Building models: all 3 variants per type s_01–s_05 */
    for (var t = 1; t <= 5; t++) {
      for (var v = 1; v <= 3; v++) {
        (function (tt, vv) {
          obj('s' + tt + '_' + vv, 's_0' + tt + '_0' + vv + '.obj');
        }(t, v));
      }
    }

    /* All 6 mega building models */
    for (var m = 1; m <= 6; m++) {
      (function (mm) {
        var mid = (mm < 10 ? '0' : '') + mm;
        obj('mega' + mm, 'mega_' + mid + '.obj');
      }(m));
    }

    /* Ad OBJ models */
    obj('ads01_1', 'ads_s_01_01.obj'); obj('ads01_2', 'ads_s_01_02.obj');
    obj('ads02_1', 'ads_s_02_01.obj'); obj('ads02_2', 'ads_s_02_02.obj');
    obj('ads03_1', 'ads_s_03_01.obj'); obj('ads03_2', 'ads_s_03_02.obj');
    for (var ai = 1; ai <= 4; ai++) {
      (function (a) {
        obj('ads04_' + a, 'ads_s_04_0' + a + '.obj');
        obj('ads05_' + a, 'ads_s_05_0' + a + '.obj');
      }(ai));
    }

    /* Topper models */
    for (var tp = 1; tp <= 12; tp++) {
      (function (t2) {
        var tpid = (t2 < 10 ? '0' : '') + t2;
        obj('tp' + t2, 'topper_' + tpid + '.obj');
      }(tp));
    }

    /* Traffic car models for aircraft */
    for (var ci = 1; ci <= 8; ci++) {
      (function (c) {
        var cid = (c < 10 ? '0' : '') + c;
        obj('car' + c, 'car_' + cid + '.obj');
      }(ci));
    }

    /* Spotlight model */
    obj('spot_geo', 'spotlight.obj');
  };

  /* ── Materials ─────────────────────────────────────────────── */
  SynthCityBg.prototype._buildMaterials = function () {
    var t = this._texs, m = this._mats;

    m.gnd = new THREE.MeshPhongMaterial({
      map: t.gnd, emissive: 0x0090ff, emissiveMap: t.gnd_em,
      emissiveIntensity: 0.20, shininess: 0
    });

    m.mega = new THREE.MeshPhongMaterial({
      map: t.mega, emissive: 0xffffff, emissiveMap: t.mega_em,
      emissiveIntensity: 1.5, shininess: 1
    });

    /* 10 building materials — random HSL emissive hue, SynthCity exact */
    for (var i = 1; i <= 10; i++) {
      var hue = Math.floor(Math.random() * 360);
      m['b' + i] = new THREE.MeshPhongMaterial({
        map: t['b' + i],
        emissive: new THREE.Color('hsl(' + hue + ',100%,95%)'),
        emissiveMap: t['b' + i + 'e'],
        emissiveIntensity: 1.5,
        shininess: 0
      });
    }

    /* Ad materials */
    function adMat(emTex) {
      return new THREE.MeshPhongMaterial({
        emissive: 0xffffff, emissiveMap: emTex, emissiveIntensity: 0.1,
        blending: THREE.AdditiveBlending, fog: false,
        side: THREE.DoubleSide, transparent: false
      });
    }
    for (var j = 1; j <= 5; j++) {
      m['ad' + j]  = adMat(t['ad' + j]);
      m['adl' + j] = adMat(t['adl' + j]);
    }

    /* Flying cars — SynthCity traffic material */
    m.cars = new THREE.MeshPhongMaterial({
      map: t.cars, emissive: 0xffffff, emissiveMap: t.cars_em,
      emissiveIntensity: 1.2, side: THREE.DoubleSide, shininess: 20
    });

    /* Smoke — billboard planes with alpha map */
    for (var si = 1; si <= 3; si++) {
      m['smoke' + si] = new THREE.MeshPhongMaterial({
        alphaMap: t['smoke' + si], color: 0xffffff, shininess: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        opacity: 0.25
      });
    }

    /* Spotlights — light cone planes */
    for (var spi = 1; spi <= 4; spi++) {
      m['spot' + spi] = new THREE.MeshPhongMaterial({
        alphaMap: t['spot' + spi], color: 0xffffff, shininess: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        opacity: 0.55
      });
    }
  };

  /* ── Ground ─────────────────────────────────────────────────── */
  SynthCityBg.prototype._buildGround = function () {
    var sc  = this._sc;
    var gndMat = this._mats.gnd || new THREE.MeshBasicMaterial({ color: 0x020510 });

    /* Large ground plane tiled with SynthCity ground texture */
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), gndMat);
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, 0, -1200);
    if (this._texs.gnd) {
      var rpts = 4000 / BLOCK;
      this._texs.gnd.repeat.set(rpts, rpts);
      this._texs.gnd_em.repeat.set(rpts, rpts);
    }
    sc.add(gnd);

    /* City block grid lines */
    var gpts = [], mpts = [];
    var xB = 10, zB = 20, z0 = 500, z1 = -(zB * BLOCK);
    for (var xi = -xB; xi <= xB; xi++) {
      gpts.push(xi * BLOCK, 0.8, z0, xi * BLOCK, 0.8, z1);
    }
    for (var zi = 0; zi <= zB; zi++) {
      gpts.push(-xB * BLOCK, 0.8, z0 - zi * BLOCK, xB * BLOCK, 0.8, z0 - zi * BLOCK);
    }
    for (var xi2 = -xB; xi2 <= xB; xi2 += 2) {
      mpts.push(xi2 * BLOCK, 1.2, z0, xi2 * BLOCK, 1.2, z1);
    }
    for (var zi2 = 0; zi2 <= zB; zi2 += 2) {
      mpts.push(-xB * BLOCK, 1.2, z0 - zi2 * BLOCK, xB * BLOCK, 1.2, z0 - zi2 * BLOCK);
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

    /* ── Holographic lane markers (replaces flat plane)
       Thin cyan LineSegments rectangles spaced along the route.
       These give the holographic waypoint/route-gate feel.
       They scroll in the main pool like buildings.                  */
    var GATE_W  = 26;   /* gate width — road corridor */
    var GATE_H  = 34;   /* gate height */
    var GATE_CL = 18 * 130;  /* cycle length: 18 gates × 130 units */
    var gateMat = new THREE.LineBasicMaterial({
      color: 0x00d8ff, transparent: true, opacity: 0.45
    });
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff, transparent: true, opacity: 0.03,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    });

    for (var gi = 0; gi < 18; gi++) {
      var gz = (CAM_Z + 100) - gi * 130;
      var ggrp = new THREE.Group();

      /* Rectangular frame (4 line segments) */
      var gpts2 = [
        -GATE_W/2, 0,      0,   GATE_W/2, 0,      0,
         GATE_W/2, 0,      0,   GATE_W/2, GATE_H, 0,
         GATE_W/2, GATE_H, 0,  -GATE_W/2, GATE_H, 0,
        -GATE_W/2, GATE_H, 0,  -GATE_W/2, 0,      0,
      ];
      var fgeo = new THREE.BufferGeometry();
      if (fgeo.setAttribute) fgeo.setAttribute('position', new THREE.Float32BufferAttribute(gpts2, 3));
      else                   fgeo.addAttribute('position',  new THREE.Float32BufferAttribute(gpts2, 3));
      ggrp.add(new THREE.LineSegments(fgeo, gateMat));

      /* Inner corner accents (shorter lines at corners for holographic look) */
      var corner = 6;
      var cpts = [
        -GATE_W/2, 0, 0,       -GATE_W/2 + corner, 0, 0,
         GATE_W/2, 0, 0,        GATE_W/2 - corner, 0, 0,
        -GATE_W/2, GATE_H, 0,  -GATE_W/2, GATE_H - corner, 0,
         GATE_W/2, GATE_H, 0,   GATE_W/2, GATE_H - corner, 0,
      ];
      var cgeo = new THREE.BufferGeometry();
      if (cgeo.setAttribute) cgeo.setAttribute('position', new THREE.Float32BufferAttribute(cpts, 3));
      else                   cgeo.addAttribute('position',  new THREE.Float32BufferAttribute(cpts, 3));
      ggrp.add(new THREE.LineSegments(cgeo,
        new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.70 })
      ));

      /* Faint fill plane for volumetric hologram feel */
      var fplane = new THREE.Mesh(new THREE.PlaneGeometry(GATE_W, GATE_H), glowMat);
      fplane.position.y = GATE_H / 2;
      ggrp.add(fplane);

      ggrp.position.set(0, 0, gz);
      sc.add(ggrp);
      this._pool.push({ grp: ggrp, cycleLen: GATE_CL });
    }
  };

  /* ── City building pool ─────────────────────────────────────── */
  SynthCityBg.prototype._buildCity = function () {
    var self    = this;
    var sc      = this._sc;
    var models  = this._models;
    var mats    = this._mats;

    function rnd(a, b)  { return a + Math.random() * (b - a); }
    function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

    var fallbackMat = new THREE.MeshBasicMaterial({ color: 0x020510 });

    function getModel(keys) {
      for (var a = 0; a < keys.length * 2; a++) {
        var k = pick(keys);
        if (models[k]) return models[k];
      }
      return null;
    }
    function getBldMat() {
      return mats['b' + (Math.floor(Math.random() * 10) + 1)] || fallbackMat;
    }
    function getAdMat(large) {
      var idx = Math.floor(Math.random() * 5) + 1;
      return large ? (mats['adl' + idx] || fallbackMat) : (mats['ad' + idx] || fallbackMat);
    }
    function getSmokeMat() {
      return mats['smoke' + (Math.floor(Math.random() * 3) + 1)] || fallbackMat;
    }
    function getSpotMat() {
      return mats['spot' + (Math.floor(Math.random() * 4) + 1)] || fallbackMat;
    }

    var SMALL_KEYS  = ['s1_1','s1_2','s1_3','s2_1','s2_2','s2_3','s3_1','s3_2','s3_3'];
    var BIG_KEYS    = ['s4_1','s4_2','s4_3'];
    var TOWER_KEYS  = ['s5_1','s5_2','s5_3'];
    var MEGA_KEYS   = ['mega1','mega2','mega3','mega4','mega5','mega6'];
    var AD_S_KEYS   = ['ads01_1','ads01_2','ads02_1','ads02_2','ads03_1','ads03_2'];
    var AD_B_KEYS   = ['ads04_1','ads04_2','ads04_3','ads04_4'];
    var AD_T_KEYS   = ['ads05_1','ads05_2','ads05_3','ads05_4'];
    var TOPPER_KEYS = (function () {
      var k = []; for (var tp = 1; tp <= 12; tp++) k.push('tp' + tp); return k;
    }());

    /* ── Column layout ──────────────────────────────────────────
       22 columns: innermost at ±36 (fills the center dark void),
       through to ±728 (receding into fog at the far edges).
       Columns are staggered by different initial z-offsets so
       each column is at a different phase — no cross-column
       synchronization visible in the loop.                        */
    var COLS = [
      /* NEW innermost — fills dark center gap */
      { x:  -36, keys: SMALL_KEYS, n: 14, large: false, phOff: 0.00 },
      { x:   36, keys: SMALL_KEYS, n: 14, large: false, phOff: 0.50 },
      /* Inner */
      { x:  -80, keys: SMALL_KEYS, n: 16, large: false, phOff: 0.25 },
      { x:   80, keys: SMALL_KEYS, n: 16, large: false, phOff: 0.75 },
      { x: -160, keys: SMALL_KEYS, n: 16, large: false, phOff: 0.12 },
      { x:  160, keys: SMALL_KEYS, n: 16, large: false, phOff: 0.62 },
      { x: -240, keys: SMALL_KEYS, n: 15, large: false, phOff: 0.37 },
      { x:  240, keys: SMALL_KEYS, n: 15, large: false, phOff: 0.87 },
      /* Mid */
      { x: -340, keys: BIG_KEYS,   n: 14, large: false, phOff: 0.18 },
      { x:  340, keys: BIG_KEYS,   n: 14, large: false, phOff: 0.68 },
      { x: -440, keys: BIG_KEYS,   n: 13, large: false, phOff: 0.44 },
      { x:  440, keys: BIG_KEYS,   n: 13, large: false, phOff: 0.94 },
      /* Outer */
      { x: -540, keys: BIG_KEYS,   n: 13, large: true,  phOff: 0.31 },
      { x:  540, keys: BIG_KEYS,   n: 13, large: true,  phOff: 0.81 },
      { x: -640, keys: TOWER_KEYS, n: 12, large: true,  phOff: 0.06 },
      { x:  640, keys: TOWER_KEYS, n: 12, large: true,  phOff: 0.56 },
      { x: -740, keys: TOWER_KEYS, n: 11, large: true,  phOff: 0.43 },
      { x:  740, keys: TOWER_KEYS, n: 11, large: true,  phOff: 0.93 },
    ];

    COLS.forEach(function (col) {
      var isTower  = col.keys === TOWER_KEYS;
      var isBig    = col.keys === BIG_KEYS;
      var spacing  = BLOCK * 0.88;
      var cycleLen = col.n * spacing;

      /* Phase offset: stagger each column's starting z so they
         don't all reset/repeat at the same moment.              */
      var phaseStart = col.phOff * cycleLen;

      for (var i = 0; i < col.n; i++) {
        var geo = getModel(col.keys);
        if (!geo) continue;

        var xJitter = 20;
        var xPos    = col.x + rnd(-xJitter, xJitter);

        /* Distribute z with phase offset so columns are out of sync */
        var z = (CAM_Z + 100) - phaseStart - (i / col.n) * cycleLen + rnd(-12, 12);

        var scale = isTower ? rnd(1.0, 1.7) :
                    (isBig  ? rnd(0.9, 1.6) : rnd(0.75, 1.35));
        var rot   = Math.floor(Math.random() * 4) * Math.PI / 2;

        var grp = new THREE.Group();
        var entry = { grp: grp, cycleLen: cycleLen, xBase: col.x, xJitter: xJitter };

        /* Building body */
        var body = new THREE.Mesh(geo, getBldMat());
        body.scale.set(1, scale, 1);
        body.rotation.y = rot;
        grp.add(body);

        /* Ad OBJ (~45% of buildings) */
        if (Math.random() < 0.45) {
          var adKeys = col.keys === TOWER_KEYS ? AD_T_KEYS :
                       (col.keys === BIG_KEYS  ? AD_B_KEYS : AD_S_KEYS);
          var adGeo  = getModel(adKeys);
          if (adGeo) {
            var adMesh = new THREE.Mesh(adGeo, getAdMat(col.large));
            adMesh.scale.set(1, scale, 1);
            adMesh.rotation.y = -rot;
            grp.add(adMesh);
          }
        }

        /* Topper ornament (rare, tall buildings) */
        if (isTower && Math.random() < 0.06) {
          var tpGeo = getModel(TOPPER_KEYS);
          if (tpGeo) {
            var tpMesh = new THREE.Mesh(tpGeo, getAdMat(true));
            tpMesh.position.y = 190 * scale;
            var ts = 0.8 + Math.random();
            tpMesh.scale.set(ts, ts, ts);
            grp.add(tpMesh);
          }
        }

        /* Spotlight (~6% on tall+big, outer columns) */
        if ((isTower || isBig) && col.large && Math.random() < 0.06 && models.spot_geo) {
          var spotScale = 10 + Math.random() * 10;
          var spotMesh = new THREE.Mesh(models.spot_geo, getSpotMat());
          spotMesh.position.set(
            (Math.random() > 0.5 ? 1 : -1) * 8,
            150 * scale,
            0
          );
          spotMesh.scale.set(spotScale, spotScale, spotScale);
          grp.add(spotMesh);
          entry.spot      = spotMesh;
          entry.spotRstep = Math.random() * 7;
        }

        /* Smoke puff (~4% on buildings) */
        if (Math.random() < 0.04) {
          var smokeGeo = new THREE.PlaneGeometry(64, 64);
          var smokeMesh = new THREE.Mesh(smokeGeo, getSmokeMat());
          var smokeS = 0.5 + Math.random() * 1.2;
          smokeMesh.position.set(
            (Math.random() - 0.5) * 20,
            200 * scale,
            (Math.random() - 0.5) * 20
          );
          smokeMesh.scale.set(smokeS, smokeS * 1.4, smokeS);
          grp.add(smokeMesh);
          entry.smoke      = smokeMesh;
          entry.smokeRstep = Math.random() * 7;
        }

        grp.position.set(xPos, 0, z);
        sc.add(grp);
        self._pool.push(entry);
      }
    });

    /* ── Mega buildings — 18 static distant landmarks ─────────── */
    var megaSlots = [
      [-200, -650],  [ 240, -780],  [-460, -600],  [ 480, -700],
      [-320, -950],  [ 360, -1050], [-580, -850],  [ 600, -980],
      [-160, -1250], [ 220, -1380], [-500, -1150], [ 520, -1280],
      [-400, -1600], [ 440, -1750], [-620, -1450], [ 640, -1550],
      [-260, -2000], [ 300, -1900],
    ];

    megaSlots.forEach(function (pos) {
      var geo = getModel(MEGA_KEYS);
      if (!geo) return;
      var scale = rnd(0.8, 1.5);
      var grp   = new THREE.Group();
      var mesh  = new THREE.Mesh(geo, mats.mega || fallbackMat);
      mesh.scale.set(1, scale, 1);
      mesh.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      grp.add(mesh);
      if (Math.random() < 0.75) {
        var adGeo = getModel(AD_T_KEYS);
        if (adGeo) {
          var adMesh2 = new THREE.Mesh(adGeo, getAdMat(true));
          adMesh2.scale.set(1, scale, 1);
          grp.add(adMesh2);
        }
      }
      grp.position.set(pos[0] + rnd(-25, 25), 0, pos[1]);
      sc.add(grp);
    });
  };

  /* ── Flying aircraft (SynthCity car models at sky altitude) ─── */
  SynthCityBg.prototype._buildAircraft = function () {
    var self    = this;
    var sc      = this._sc;
    var models  = this._models;
    var mats    = this._mats;

    var carKeys = ['car1','car2','car3','car4','car5','car6','car7','car8'];
    var carMat  = mats.cars || new THREE.MeshBasicMaterial({ color: 0x112233 });

    /* Flight paths: different x-ranges and altitudes for variety */
    var paths = [
      /* x orbit center, y altitude, z start,  xa, ya,  xf,    yf,    phase */
      { ox: 80,  oy: 120, oz: -300, xa: 200, ya: 28, xf: 0.080, yf: 0.110, ph: 0.0,  cycle: 2200, s: 1.4 },
      { ox:-160, oy: 190, oz: -600, xa: 260, ya: 40, xf: 0.055, yf: 0.090, ph: 1.3,  cycle: 2600, s: 1.0 },
      { ox: 50,  oy: 280, oz:-1000, xa: 340, ya: 55, xf: 0.040, yf: 0.070, ph: 2.7,  cycle: 3000, s: 0.8 },
      { ox:-220, oy: 155, oz: -200, xa: 140, ya: 22, xf: 0.100, yf: 0.130, ph: 0.8,  cycle: 1800, s: 1.2 },
      { ox: 200, oy: 240, oz: -500, xa: 180, ya: 35, xf: 0.065, yf: 0.085, ph: 4.2,  cycle: 2400, s: 0.9 },
      { ox:-80,  oy: 330, oz: -850, xa: 380, ya: 65, xf: 0.032, yf: 0.060, ph: 3.1,  cycle: 3400, s: 0.7 },
    ];

    /* Collect available car model keys */
    var availCars = [];
    for (var ki = 0; ki < carKeys.length; ki++) {
      if (models[carKeys[ki]]) availCars.push(carKeys[ki]);
    }
    if (!availCars.length) return;

    paths.forEach(function (path, idx) {
      var key = availCars[idx % availCars.length];
      var geo = models[key];

      var grp = new THREE.Group();
      var mesh = new THREE.Mesh(geo, carMat);
      /* Cars face -Z by default in SynthCity; no additional rotation needed
         for forward travel. The bank is applied to the GROUP in tick(). */
      var s = path.s;
      mesh.scale.set(s, s, s);
      grp.add(mesh);

      /* Navigation lights — small emissive spheres */
      function navLight(col, ox, oy, oz) {
        var lg = new THREE.Mesh(
          new THREE.SphereGeometry(1.2, 6, 6),
          new THREE.MeshBasicMaterial({ color: col })
        );
        lg.position.set(ox, oy, oz);
        grp.add(lg);
      }
      navLight(0xff3322, -18 * s,  0, 0);   /* port red */
      navLight(0x88ccff,  18 * s,  0, 0);   /* starboard blue-white */
      navLight(0xffffff,   0,  6 * s, 0);   /* belly strobe */

      grp.position.set(path.ox, path.oy, path.oz);
      sc.add(grp);

      self._aircraft.push({
        grp: grp,
        ox: path.ox, oy: path.oy,
        xa: path.xa, ya: path.ya,
        xf: path.xf, yf: path.yf,
        ph: path.ph, cycle: path.cycle,
      });
    });
  };

  /* ── Laser sweep beams ─────────────────────────────────────── */
  SynthCityBg.prototype._buildLasers = function () {
    var self = this;
    var sc   = this._sc;

    /* Each beam: a long thin plane with AdditiveBlending, rotating slowly
       on the Y-axis to simulate a search laser or city atmospheric effect. */
    var beamDefs = [
      /* color,     opacity, width, length, y,    z,    speed,  range, phase */
      { col: 0x00e5ff, op: 0.12, w: 1.5, len: 1800, y: 160, z: -700,  spd: 0.022, rng: 0.55, ph: 0.0  },
      { col: 0xff00aa, op: 0.09, w: 1.2, len: 2000, y: 240, z:-1000,  spd: 0.016, rng: 0.70, ph: 1.8  },
      { col: 0x00ff88, op: 0.08, w: 1.0, len: 1600, y: 200, z: -600,  spd: 0.028, rng: 0.45, ph: 3.4  },
      { col: 0x8844ff, op: 0.07, w: 1.4, len: 2200, y: 300, z:-1300,  spd: 0.013, rng: 0.80, ph: 0.9  },
    ];

    beamDefs.forEach(function (bd) {
      var grp  = new THREE.Group();
      var mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bd.w, bd.len),
        new THREE.MeshBasicMaterial({
          color: bd.col, transparent: true, opacity: bd.op,
          blending: THREE.AdditiveBlending, depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      /* Lay the plane horizontally so it sweeps across the city */
      mesh.rotation.x = -Math.PI / 2;
      /* Offset the plane forward so the pivot is at the beam origin */
      mesh.position.set(0, 0, -bd.len / 2);
      grp.add(mesh);
      grp.position.set(0, bd.y, bd.z);
      sc.add(grp);
      self._lasers.push({ grp: grp, speed: bd.spd, range: bd.rng, phase: bd.ph });
    });
  };

  /* ── Export ─────────────────────────────────────────────────── */
  global.SynthCityBg = SynthCityBg;

}(window));
