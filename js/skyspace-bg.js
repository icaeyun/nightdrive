/* skyspace-bg.js — MODE1 sky-to-space background  v3
   Reference: 3d-weather-codrops
     - Clouds.js  → cluster sprite technique, opacity layering
     - Rain.js    → PointsMaterial rain with BufferGeometry
     - Sun GLB    → local skyspace model + glowing sphere fallback
     - Moon.js    → moon_2k.jpg TextureLoader + MeshLambertMaterial rotation
     - Scene3D.js → sky gradient colour values (#0D7FDB, #0A1428)

   Timeline
   --------
    0 – 14 s : natural blue sky + cloud fly-through + brief rain (3–8 s)
   14 – 20 s : clouds fade completely out
   20 – 28 s : sky darkens → stars appear (transition)
   28 s+     : endless space flight + streaming starfield
   30 s+     : sun / moon / planet pass-bys (every 18–28 s)
*/
(function (global) {
  'use strict';

  var CLOUD_IN_END  =  2;   /* clouds fully faded in */
  var CLOUD_OUT_SRT = 14;   /* cloud fade-out begins */
  var CLOUD_OUT_END = 20;   /* clouds completely gone */
  var TRANS_END     = 28;   /* sky→space transition complete */
  var CEL_START     = 30;   /* first celestial pass-by */
  var SUN_GLB_PATH  = 'assets/skyspace/sun.glb';

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function smoothstep(a, b, t) {
    var x = clamp((t - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function setAttr(geo, name, arr, n) {
    var attr = new THREE.BufferAttribute(arr, n);
    if (geo.setAttribute) geo.setAttribute(name, attr);
    else                   geo.addAttribute(name, attr);
  }

  /* ── Cloud puff texture: layered soft volume sprite ──────── */
  function makeCloudTex() {
    var sz = 1024;
    var cv = document.createElement('canvas');
    cv.width = sz; cv.height = sz;
    var c  = cv.getContext('2d');
    c.clearRect(0, 0, sz, sz);
    [
      { x:.50, y:.54, r:.53, a:.13 }, { x:.50, y:.50, r:.43, a:.52 },
      { x:.30, y:.58, r:.31, a:.46 }, { x:.69, y:.56, r:.33, a:.44 },
      { x:.18, y:.64, r:.22, a:.34 }, { x:.83, y:.61, r:.25, a:.34 },
      { x:.50, y:.36, r:.29, a:.50 }, { x:.36, y:.43, r:.20, a:.42 },
      { x:.64, y:.41, r:.22, a:.40 }, { x:.42, y:.70, r:.20, a:.28 },
      { x:.59, y:.69, r:.21, a:.30 }, { x:.25, y:.47, r:.12, a:.30 },
      { x:.75, y:.45, r:.13, a:.28 }, { x:.47, y:.28, r:.12, a:.20 },
      { x:.56, y:.27, r:.11, a:.18 }, { x:.12, y:.70, r:.14, a:.16 },
      { x:.90, y:.69, r:.15, a:.16 },
    ].forEach(function (p) {
      var g = c.createRadialGradient(
        p.x*sz, p.y*sz, 0, p.x*sz, p.y*sz, p.r*sz);
      g.addColorStop(0.00, 'rgba(255,255,255,' + p.a + ')');
      g.addColorStop(0.22, 'rgba(255,255,255,' + (p.a * 0.86) + ')');
      g.addColorStop(0.56, 'rgba(242,248,255,' + (p.a * 0.32) + ')');
      g.addColorStop(1.00, 'rgba(235,245,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x*sz, p.y*sz, p.r*sz, 0, Math.PI*2);
      c.fill();
    });

    var img = c.getImageData(0, 0, sz, sz);
    var d = img.data;
    for (var y = 0; y < sz; y += 2) {
      for (var x = 0; x < sz; x += 2) {
        var nx = x / sz - 0.5;
        var ny = y / sz - 0.5;
        var grain = 0.78 + 0.22 * Math.sin(x * 0.035 + y * 0.021) *
                    Math.sin(x * 0.014 - y * 0.031);
        var edge = clamp(1.12 - Math.sqrt(nx*nx + ny*ny) * 1.65, 0, 1);
        var k = (y * sz + x) * 4;
        d[k + 3] = Math.round(d[k + 3] * lerp(0.74, grain, edge));
      }
    }
    c.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function makeHazeTex() {
    var sz = 512;
    var cv = document.createElement('canvas');
    cv.width = sz; cv.height = sz;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(sz * 0.5, sz * 0.54, 0, sz * 0.5, sz * 0.54, sz * 0.54);
    g.addColorStop(0.00, 'rgba(255,250,226,0.72)');
    g.addColorStop(0.35, 'rgba(190,226,255,0.34)');
    g.addColorStop(0.72, 'rgba(92,151,214,0.11)');
    g.addColorStop(1.00, 'rgba(92,151,214,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, sz, sz);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /* ══════════════════════════════════════════════════════════ */
  function SkySpaceBg(container) {
    this._container  = container;
    this._elapsed    = 0;
    this._intensity  = 0;
    this._clusters   = [];
    this._celestials = [];
    this._hazeSprites = [];
    this._nextCel    = CEL_START;
    this._moonTex    = null;
    this._sunModel   = null;
    this._sunModelSize = 1;

    /* Cached colour instances for lerp — avoids per-frame GC */
    this._C = {
      /* Natural sky uses one soft pale blue across the daytime dome. */
      topSky:     new THREE.Color(0xb9e4f4),
      topSpace:   new THREE.Color(0x00030b),
      horizSky:   new THREE.Color(0xb9e4f4),
      horizSpace: new THREE.Color(0x020014),
    };
    this._setup();
  }

  /* ── _setup ─────────────────────────────────────────────── */
  SkySpaceBg.prototype._setup = function () {
    var w = window.innerWidth, h = window.innerHeight;

    var cv = document.createElement('canvas');
    cv.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'z-index:1;pointer-events:none;display:none;opacity:0;' +
      'transition:opacity 0.65s ease;';
    this._container.appendChild(cv);
    this._cv = cv;

    this._ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._ren.setSize(w, h);
    this._ren.setClearColor(0x000000, 1);

    this._scene = new THREE.Scene();
    this._cam   = new THREE.PerspectiveCamera(70, w / h, 0.1, 5000);
    this._cam.position.set(0, 0, 0);

    this._cloudTex = makeCloudTex();
    this._loadCelestialTextures();
    this._loadSunModel();

    this._buildSkyDome();
    this._buildAtmosphere();
    this._buildClouds();
    this._buildRain();
    this._buildStars();

    this._scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    var sunDir = new THREE.DirectionalLight(0xfffcf0, 0.5);
    sunDir.position.set(3, 8, 2);
    this._scene.add(sunDir);

    var self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener('resize', this._onResize);

    this._ren.render(this._scene, this._cam);
  };

  /* ── Load moon texture from reference ────────────────────
     Paths relative to nightdrive root served via HTTP.
     Reference: Moon.js from 3d-weather-codrops.   */
  SkySpaceBg.prototype._loadCelestialTextures = function () {
    var loader = new THREE.TextureLoader();
    var self   = this;
    loader.load(
      'references/3d-weather-codrops/public/textures/moon_2k.jpg',
      function (t) { self._moonTex = t; },
      undefined, function () {}
    );
  };

  SkySpaceBg.prototype._loadSunModel = function () {
    var self = this;
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('SkySpaceBg sun GLB skipped: GLTFLoader missing.');
      return;
    }
    new THREE.GLTFLoader().load(SUN_GLB_PATH, function (gltf) {
      var root = gltf.scene || gltf.scenes[0];
      if (!root) return;
      root.traverse(function (node) {
        if (!node.isMesh || !node.material) return;
        node.castShadow = false;
        node.receiveShadow = false;
        if (node.material.emissive) {
          node.material.emissive = new THREE.Color(0xffaa33);
          node.material.emissiveIntensity = 0.35;
        }
      });
      var box = new THREE.Box3().setFromObject(root);
      var size = box.getSize(new THREE.Vector3());
      self._sunModelSize = Math.max(size.x, size.y, size.z, 0.001);
      self._sunModel = root;
    }, undefined, function (err) {
      console.warn('SkySpaceBg sun GLB load failed; using glowing sphere fallback:', err);
    });
  };

  /* ── Sky dome ────────────────────────────────────────────
     Three-tone natural sky gradient + warm sun haze at horizon.
     Adapted from Scene3D.js getBackgroundColor() palette.   */
  SkySpaceBg.prototype._buildSkyDome = function () {
    var geo = new THREE.SphereGeometry(3000, 32, 16);
    this._skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop:   { value: new THREE.Color().copy(this._C.topSky)   },
        uHoriz: { value: new THREE.Color().copy(this._C.horizSky) },
        uMid:   { value: new THREE.Color(0xb9e4f4) },
        uSpace: { value: 0.0 },
        uTime:  { value: 0.0 },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'varying float vY;',
        'void main(){',
        '  vDir = normalize(position);',
        '  vY = vDir.y;',
        '  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop; uniform vec3 uHoriz; uniform vec3 uMid;',
        'uniform float uSpace; uniform float uTime;',
        'varying vec3 vDir;',
        'varying float vY;',
        'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }',
        'float noise(vec2 p){',
        '  vec2 i=floor(p); vec2 f=fract(p);',
        '  vec2 u=f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),',
        '             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);',
        '}',
        'void main(){',
        '  float t = clamp((vY + 0.10)/0.86, 0.0, 1.0);',
        '  vec3 sky = t < 0.5',
        '    ? mix(uHoriz, uMid, t*2.0)',
        '    : mix(uMid,   uTop, (t-0.5)*2.0);',
        '  float horizon = 1.0 - smoothstep(-0.10, 0.24, abs(vY));',
        '  float sun = pow(max(dot(normalize(vDir), normalize(vec3(-0.42,-0.08,-0.90))), 0.0), 10.0);',
        '  float air = noise(vDir.xz * 3.0 + vec2(uTime * 0.012, 0.0));',
        '  sky = mix(sky, vec3(0.92,0.98,1.0), sun * 0.10 + horizon * 0.05);',
        '  sky += (air - 0.5) * 0.012;',
        '  float neb = noise(vDir.xz * 7.0 + vec2(uTime * 0.006, uTime * 0.004));',
        '  vec3 space = mix(vec3(0.002,0.004,0.016), vec3(0.0,0.0,0.004), t);',
        '  space += vec3(0.030,0.018,0.060) * smoothstep(0.55, 0.95, neb) * (1.0 - t) * 0.34;',
        '  space += vec3(0.015,0.036,0.060) * horizon * 0.16;',
        '  gl_FragColor = vec4(mix(sky, space, uSpace), 1.0);',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
    });
    this._skyDome = new THREE.Mesh(geo, this._skyMat);
    this._scene.add(this._skyDome);
  };

  SkySpaceBg.prototype._buildAtmosphere = function () {
    var tex = makeHazeTex();
    var defs = [
      { x:-150, y:-70, z:-520, sx:760,  sy:260, op:0.34, rot: 0.05 },
      { x: 170, y:-45, z:-740, sx:920,  sy:310, op:0.24, rot:-0.08 },
      { x:   0, y: 28, z:-980, sx:1180, sy:380, op:0.14, rot: 0.02 }
    ];
    var self = this;
    defs.forEach(function (d) {
      var mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      });
      var sp = new THREE.Sprite(mat);
      sp.position.set(d.x, d.y, d.z);
      sp.scale.set(d.sx, d.sy, 1);
      sp.material.rotation = d.rot;
      self._scene.add(sp);
      self._hazeSprites.push({ sp: sp, mat: mat, maxOp: d.op, phase: rnd(0, Math.PI * 2) });
    });
  };

  /* ── Cloud clusters ──────────────────────────────────────
     Inspired by drei Clouds component strategy:
     each cloud = many overlapping sprites in a loose sphere.
     Clusters span the full 14-second sky phase continuously.

     10 near  → fly-through path, fast
      6 mid   → atmospheric depth layer
      4 far   → slow horizon backdrop

     Initial z values are staggered so there are ALWAYS
     multiple clusters visible at any point in the sky phase. */
  SkySpaceBg.prototype._buildClouds = function () {
    var tex  = this._cloudTex;
    var self = this;

    /* Max opacity per layer */
    var OPAC = [0.82, 0.60, 0.42];
    var TINT = [0xffffff, 0xf4f8ff, 0xe9f2ff];

    /* Reset zone per layer: [zMin, zMax, xSpread, yMin, yMax] */
    var ZR = [
      { min:-115, max:-255, xR:130, yMin: -4, yMax: 42 },
      { min:-290, max:-520, xR:245, yMin: 18, yMax: 82 },
      { min:-700, max:-1120, xR:430, yMin: 52, yMax:155 },
    ];

    /*
      Cluster def: cx cy cz | puffs | puff-spread-radius |
                   scale-min scale-max | speed | layer
      Near clusters start at a range of z depths so the viewer
      immediately sees action and it continues for 14 seconds.
    */
    var DEFS = [
      /* ── NEAR — staggered z for continuous coverage ──────── */
      { cx:  0, cy:  3, cz: -90, puffs:20, rad:42, sMin:82, sMax:132, spd:13, layer:0 },
      { cx: 38, cy: 18, cz:-135, puffs:16, rad:34, sMin:70, sMax:112, spd:12, layer:0 },
      { cx:-44, cy: 22, cz:-105, puffs:16, rad:36, sMin:72, sMax:118, spd:14, layer:0 },
      { cx: 65, cy: 11, cz:-160, puffs:14, rad:30, sMin:62, sMax: 98, spd:11, layer:0 },
      { cx:-22, cy: 28, cz:-120, puffs:15, rad:32, sMin:68, sMax:105, spd:13, layer:0 },
      { cx:  8, cy:  5, cz:-180, puffs:17, rad:38, sMin:78, sMax:126, spd:12, layer:0 },
      { cx:-60, cy: 14, cz:-145, puffs:15, rad:34, sMin:65, sMax:108, spd:14, layer:0 },
      { cx: 50, cy: 30, cz:-200, puffs:13, rad:30, sMin:58, sMax: 94, spd:11, layer:0 },
      { cx:-30, cy:  8, cz:-115, puffs:16, rad:36, sMin:72, sMax:112, spd:13, layer:0 },
      { cx: 20, cy: 24, cz:-170, puffs:14, rad:32, sMin:66, sMax:102, spd:12, layer:0 },

      /* ── MID ─────────────────────────────────────────────── */
      { cx: 90, cy: 40, cz:-300, puffs:16, rad:62, sMin:140, sMax:235, spd: 6, layer:1 },
      { cx:-100, cy:46, cz:-360, puffs:16, rad:68, sMin:150, sMax:252, spd: 5, layer:1 },
      { cx: 25, cy: 55, cz:-400, puffs:15, rad:58, sMin:132, sMax:220, spd: 7, layer:1 },
      { cx:-60, cy: 34, cz:-280, puffs:15, rad:60, sMin:136, sMax:228, spd: 6, layer:1 },
      { cx:120, cy: 28, cz:-330, puffs:13, rad:55, sMin:126, sMax:210, spd: 5, layer:1 },
      { cx:-80, cy: 60, cz:-420, puffs:13, rad:62, sMin:134, sMax:220, spd: 6, layer:1 },

      /* ── FAR — slow horizon backdrop ─────────────────────── */
      { cx: 165, cy: 70, cz:-680, puffs:12, rad:100, sMin:245, sMax:430, spd: 2,   layer:2 },
      { cx:-145, cy: 76, cz:-780, puffs:12, rad:105, sMin:255, sMax:450, spd: 1.5, layer:2 },
      { cx:  30, cy: 84, cz:-860, puffs:11, rad:94,  sMin:230, sMax:405, spd: 1.8, layer:2 },
      { cx:-200, cy: 62, cz:-720, puffs:11, rad:96,  sMin:240, sMax:420, spd: 2.2, layer:2 },
    ];

    DEFS.forEach(function (def) {
      var zr = ZR[def.layer];
      var cl = {
        cx: def.cx, cy: def.cy, cz: def.cz,
        speed: def.spd, layer: def.layer,
        maxOpac: OPAC[def.layer],
        zr: zr,
        puffs: [],
      };
      for (var i = 0; i < def.puffs; i++) {
        var mat = new THREE.SpriteMaterial({
          map: tex, transparent: true, opacity: 0,
          color: TINT[def.layer],
          depthWrite: false, blending: THREE.NormalBlending,
        });
        var sp = new THREE.Sprite(mat);
        var sc = rnd(def.sMin, def.sMax);
        sp.scale.set(sc, sc * rnd(0.52, 0.70), 1);
        var lx = rnd(-def.rad,        def.rad);
        var ly = rnd(-def.rad * 0.40, def.rad * 0.40);
        var lz = rnd(-def.rad * 0.85, def.rad * 0.85);
        sp.position.set(def.cx + lx, def.cy + ly, def.cz + lz);
        cl.puffs.push({
          mat: mat, sp: sp, lx: lx, ly: ly, lz: lz,
          opMul: rnd(0.62, 1.08),
          drift: rnd(0.02, 0.10),
          phase: rnd(0, Math.PI * 2)
        });
        self._scene.add(sp);
      }
      self._clusters.push(cl);
    });
  };

  /* ── Rain ────────────────────────────────────────────────
     Adapted from Rain.js: PointsMaterial + BufferGeometry,
     y-position wrap. Visible 3–8 s only (within sky phase). */
  SkySpaceBg.prototype._buildRain = function () {
    var N   = 700;
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i*3]   = rnd(-145, 145);
      pos[i*3+1] = rnd(-20,  135);
      pos[i*3+2] = rnd(-25,  -98);
    }
    var geo = new THREE.BufferGeometry();
    setAttr(geo, 'position', pos, 3);
    this._rainPos = pos;
    this._rainGeo = geo;
    this._rainMat = new THREE.PointsMaterial({
      color: 0xaaddff, size: 0.30,
      transparent: true, opacity: 0,
      sizeAttenuation: true, depthWrite: false,
    });
    this._scene.add(new THREE.Points(geo, this._rainMat));
  };

  /* ── Stars ───────────────────────────────────────────────
     Three depth shells, invisible during sky.
     Adapted from Scene3D.js Stars usage (radius, depth, count,
     factor). Vertex colour variation for realistic appearance.
     Streaming speed (units/s): far=6, mid=28, near=90.       */
  SkySpaceBg.prototype._buildStars = function () {
    var self = this;
    function mkLayer(N, radius, size, speed, warmBias) {
      var pos = new Float32Array(N * 3);
      var col = new Float32Array(N * 3);
      for (var i = 0; i < N; i++) {
        var th = rnd(0, Math.PI * 2);
        var ph = Math.acos(rnd(-1, 1));
        var r  = rnd(radius * 0.45, radius);
        pos[i*3]   =  r * Math.sin(ph) * Math.cos(th);
        pos[i*3+1] =  r * Math.sin(ph) * Math.sin(th);
        pos[i*3+2] = -Math.abs(r * Math.cos(ph)) - 30;
        var v  = 0.80 + Math.random() * 0.20;
        var wb = warmBias;
        col[i*3]   = v + (wb > 0 ? wb * 0.10 : 0);
        col[i*3+1] = v;
        col[i*3+2] = v + (wb < 0 ? (-wb) * 0.12 : 0);
      }
      var geo = new THREE.BufferGeometry();
      setAttr(geo, 'position', pos, 3);
      setAttr(geo, 'color',    col, 3);
      var mat = new THREE.PointsMaterial({
        size: size, vertexColors: THREE.VertexColors,
        transparent: true, opacity: 0,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var pts = new THREE.Points(geo, mat);
      pts.userData.pos   = pos;
      pts.userData.speed = speed;
      self._scene.add(pts);
      return pts;
    }
    this._starFar  = mkLayer(4200, 2100, 0.72,  6, -1);
    this._starMid  = mkLayer(2100, 1350, 1.12, 28,  0);
    this._starNear = mkLayer(1200,  760, 1.72, 90,  1);
  };

  /* ── Celestial pass-by ───────────────────────────────────
     Sun uses the local GLB when loaded. Moon uses the
     reference jpg texture. Planets are procedural Lambert spheres.
     Objects fly from in front (z ≈ -600) toward the camera
     and off to one side so they never dominate the view.     */
  SkySpaceBg.prototype._spawnCelestial = function () {
    var kinds = ['sun', 'moon', 'planet'];
    var kind  = kinds[Math.floor(Math.random() * kinds.length)];
    var side  = Math.random() > 0.5 ? 1 : -1;
    var rad   = rnd(20, 40);
    var geo;
    var mat;
    var mesh;

    if (kind === 'sun') {
      if (this._sunModel) {
        mesh = this._sunModel.clone(true);
        mesh.scale.setScalar((rad * 2) / this._sunModelSize);
      } else {
        geo = new THREE.SphereGeometry(rad, 32, 32);
        mat = new THREE.MeshBasicMaterial({ color: 0xffee66 });
        mesh = new THREE.Mesh(geo, mat);
      }
    } else if (kind === 'moon') {
      /* Moon.js: MeshLambertMaterial + moon_2k.jpg + emissive */
      geo = new THREE.SphereGeometry(rad, 32, 32);
      mat = this._moonTex
        ? new THREE.MeshLambertMaterial({
            map: this._moonTex,
            emissive: new THREE.Color(0x111110),
          })
        : new THREE.MeshLambertMaterial({
            color: 0xccccba,
            emissive: new THREE.Color(0x1a1a14),
          });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      var pCols = [0x7744bb, 0x225599, 0x336677, 0x994422, 0x447744];
      geo = new THREE.SphereGeometry(rad, 32, 32);
      mat = new THREE.MeshLambertMaterial({
        color: pCols[Math.floor(Math.random() * pCols.length)],
        emissive: new THREE.Color(0x080808),
      });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.set(side * rnd(65, 150), rnd(-50, 70), rnd(-700, -380));
    mesh.userData.speed    = rnd(16, 28);
    /* Sun.js / Moon.js: slow y-axis rotation */
    mesh.userData.rotSpeed = kind === 'planet' ? 0 :
                             kind === 'sun'    ? 0.08 : 0.04;
    this._scene.add(mesh);
    this._celestials.push(mesh);
    this._nextCel = this._elapsed + rnd(18, 28);
  };

  /* ══════════════════════════════════════════════════════════
     Public API
  ══════════════════════════════════════════════════════════ */

  SkySpaceBg.prototype.show = function () {
    var self = this;
    this._elapsed = 0;
    this._nextCel = CEL_START;

    /* Clear any leftover celestials from previous visit */
    this._celestials.forEach(function (o) { self._scene.remove(o); });
    this._celestials = [];

    /* Reset clusters to their staggered starting positions */
    this._clusters.forEach(function (cl) {
      cl.cz = rnd(cl.zr.min, cl.zr.max);
      cl.cx = rnd(-cl.zr.xR, cl.zr.xR);
      cl.cy = rnd(cl.zr.yMin, cl.zr.yMax);
      cl.puffs.forEach(function (p) {
        p.mat.opacity = 0;
        p.sp.position.set(cl.cx + p.lx, cl.cy + p.ly, cl.cz + p.lz);
      });
    });

    this._cv.style.display = 'block';
    requestAnimationFrame(function () { self._cv.style.opacity = '1'; });
  };

  SkySpaceBg.prototype.hide = function () {
    this._cv.style.opacity = '0';
    var cv = this._cv;
    setTimeout(function () {
      if (parseFloat(cv.style.opacity) < 0.05) cv.style.display = 'none';
    }, 700);
  };

  SkySpaceBg.prototype.setIntensity = function (v) {
    this._intensity = clamp(v || 0, 0, 1);
  };

  SkySpaceBg.prototype.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this._ren.setSize(w, h);
    this._cam.aspect = w / h;
    this._cam.updateProjectionMatrix();
  };

  /* ── tick ───────────────────────────────────────────────── */
  SkySpaceBg.prototype.tick = function (dt) {
    if (this._cv.style.display === 'none') return;
    dt = clamp(dt || 0.016, 0.001, 0.05);
    this._elapsed += dt;
    var t  = this._elapsed;
    var sp = 1 + this._intensity * 0.55;

    /* ── Phase scalars ──────────────────────────────────── */
    /* transF: 0 during sky, reaches 1 at TRANS_END=28 s    */
    var transF = smoothstep(CLOUD_OUT_END, TRANS_END, t);
    /* cloudF: fade-in 0–2 s, full 2–14 s, fade-out 14–20 s */
    var cloudF = smoothstep(0, CLOUD_IN_END, t) *
                 (1 - smoothstep(CLOUD_OUT_SRT, CLOUD_OUT_END, t));
    /* spaceF: streaming strength, 0 until TRANS_END, full by +4 s */
    var spaceF = smoothstep(TRANS_END, TRANS_END + 4, t);

    /* ── Sky dome ─────────────────────────────────────────── */
    this._skyMat.uniforms.uTop.value
      .copy(this._C.topSky).lerp(this._C.topSpace, transF);
    this._skyMat.uniforms.uHoriz.value
      .copy(this._C.horizSky).lerp(this._C.horizSpace, transF);
    this._skyMat.uniforms.uSpace.value = transF;
    this._skyMat.uniforms.uTime.value = t;

    this._hazeSprites.forEach(function (h) {
      h.mat.opacity = (1 - transF * 0.72) * h.maxOp *
        (0.82 + Math.sin(t * 0.18 + h.phase) * 0.08);
      h.sp.position.x += Math.sin(t * 0.07 + h.phase) * dt * 1.8;
    });

    /* ── Cloud clusters ───────────────────────────────────── */
    var self = this;
    this._clusters.forEach(function (cl) {
      cl.cz += cl.speed * sp * dt;
      if (cl.cz > 48) {
        /* Wrap to far depth — stagger x/y for organic spread */
        cl.cz = rnd(cl.zr.min, cl.zr.max);
        cl.cx = rnd(-cl.zr.xR, cl.zr.xR);
        cl.cy = rnd(cl.zr.yMin, cl.zr.yMax);
      }
      var op = cloudF * cl.maxOpac;
      cl.puffs.forEach(function (p) {
        var driftX = Math.sin(t * p.drift + p.phase) * (2.0 + cl.layer * 5.0);
        var driftY = Math.cos(t * p.drift * 0.8 + p.phase) * (0.8 + cl.layer * 2.4);
        p.sp.position.set(cl.cx + p.lx + driftX, cl.cy + p.ly + driftY, cl.cz + p.lz);
        p.mat.opacity = op * p.opMul;
      });
    });

    /* ── Rain  3–8 s bell curve ───────────────────────────── */
    var rainF = smoothstep(3.0, 5.0, t) * (1 - smoothstep(6.0, 8.0, t));
    this._rainMat.opacity = rainF * 0.34;
    if (rainF > 0.01) {
      var rp  = this._rainPos;
      var len = rp.length / 3;
      for (var i = 0; i < len; i++) {
        rp[i*3+1] -= (16 + sp*3) * dt;
        if (rp[i*3+1] < -20) rp[i*3+1] = 135;
      }
      this._rainGeo.attributes.position.needsUpdate = true;
    }

    /* ── Stars ────────────────────────────────────────────── */
    [
      { pts: this._starFar,  opT: 0.55 },
      { pts: this._starMid,  opT: 0.85 },
      { pts: this._starNear, opT: 0.96 },
    ].forEach(function (sl) {
      sl.pts.material.opacity = transF * sl.opT;
      if (spaceF < 0.01) return;
      var pos  = sl.pts.userData.pos;
      var step = sl.pts.userData.speed * spaceF * sp * dt;
      var n    = pos.length / 3;
      for (var i = 0; i < n; i++) {
        pos[i*3+2] += step;
        if (pos[i*3+2] > 60) {
          var th = rnd(0, Math.PI * 2);
          var r  = rnd(400, 1900);
          pos[i*3]   = Math.cos(th) * r * 0.44;
          pos[i*3+1] = rnd(-r * 0.38, r * 0.38);
          pos[i*3+2] = -r;
        }
      }
      sl.pts.geometry.attributes.position.needsUpdate = true;
    });

    /* ── Celestials ───────────────────────────────────────── */
    if (t >= this._nextCel && spaceF > 0.6) {
      this._spawnCelestial();
    }
    var toRm = [];
    this._celestials.forEach(function (obj) {
      obj.position.z += obj.userData.speed * sp * dt;
      if (obj.userData.rotSpeed) obj.rotation.y += obj.userData.rotSpeed * dt;
      if (obj.position.z > 80) toRm.push(obj);
    });
    toRm.forEach(function (obj) {
      self._scene.remove(obj);
      var idx = self._celestials.indexOf(obj);
      if (idx >= 0) self._celestials.splice(idx, 1);
    });

    /* ── Camera drift ─────────────────────────────────────── */
    var dScale = 1 + spaceF * 2.0;
    this._cam.position.y = (Math.sin(t * 0.28)*2.4 + Math.sin(t * 0.07)*1.1) * dScale;
    this._cam.position.x = (Math.sin(t * 0.15)*1.6 + Math.cos(t * 0.23)*0.9) * dScale;

    this._ren.render(this._scene, this._cam);
  };

  SkySpaceBg.prototype.dispose = function () {
    window.removeEventListener('resize', this._onResize);
    if (this._ren) this._ren.dispose();
    if (this._cv && this._cv.parentNode) this._cv.parentNode.removeChild(this._cv);
  };

  global.SkySpaceBg = SkySpaceBg;

}(window));
