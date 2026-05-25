/* aquacity-bg.js - Mode 4: Faraz fake caustics scene, Mode 3-style structure. */

(function (global) {
  'use strict';

  var ASSET_BASE = 'assets/caustics/';
  var GLB_PATH = ASSET_BASE + 'bronze_monkey_statue.glb';
  var POOL_PROP_BASE = 'assets/mode4-poolprops/';
  var HEAVY_PROP_BASE = 'assets/mode4-poolprops-heavy-backup/';
  var POOL_PROP_FILES = [
    'uno_-_rabbid.glb',
    'mario_rabbit.glb',
    'iphone_14_pro_max_deep_purple.glb',
    'bikini_girl.glb',
    'watermelon_jelly.glb'
  ];
  var HEAVY_PROP_FILES = [
    'back_yard_burgers_-_classic_burger.glb',
    'jelly.glb',
    'jelly_birkin_bag.glb',
    'blonde_woman_black_bikini_blue_eyes.glb'
  ];
  var BG = 0x3b9ed1;
  var SIZE = 10;
  var POOL_SEGMENT_COUNT = 9;
  var POOL_SEGMENT_SPACING = 7.4;
  var POOL_SEGMENT_PERIOD = POOL_SEGMENT_COUNT * POOL_SEGMENT_SPACING;
  var PROP_ROUTE_INTRO_TIME = 22;
  var PROP_ROUTE_REPEATS = 7;
  var PROP_ROUTE_EMPTY_DISTANCE = 1900;
  var PROP_ROUTE_Z_A = -42;
  var PROP_ROUTE_Z_B = -68;
  var HEAVY_ROUTE_EVERY = 0;

  var VORONOI = [
    'vec3 hash(vec3 p){',
    '  return fract(sin(vec3(',
    '    dot(p,vec3(1.0,57.0,113.0)),',
    '    dot(p,vec3(57.0,113.0,1.0)),',
    '    dot(p,vec3(113.0,1.0,57.0))',
    '  ))*43758.5453);',
    '}',
    'vec3 voronoi3d(vec3 x){',
    '  vec3 p=floor(x);',
    '  vec3 f=fract(x);',
    '  float id=0.0;',
    '  vec2 res=vec2(100.0);',
    '  for(int k=-1;k<=1;k++){',
    '    for(int j=-1;j<=1;j++){',
    '      for(int i=-1;i<=1;i++){',
    '        vec3 b=vec3(float(i),float(j),float(k));',
    '        vec3 r=b-f+hash(p+b);',
    '        float d=dot(r,r);',
    '        float cond=max(sign(res.x-d),0.0);',
    '        float nCond=1.0-cond;',
    '        float cond2=nCond*max(sign(res.y-d),0.0);',
    '        float nCond2=1.0-cond2;',
    '        id=(dot(p+b,vec3(1.0,57.0,113.0))*cond)+(id*nCond);',
    '        res=vec2(d,res.x)*cond+res*nCond;',
    '        res.y=cond2*d+nCond2*res.y;',
    '      }',
    '    }',
    '  }',
    '  return vec3(sqrt(res),abs(id));',
    '}'
  ].join('\n');

  function makeMat(opts) {
    var Mat = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
    return new Mat(opts);
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setObjectOpacity(obj, opacity) {
    obj.traverse(function (node) {
      if (!node.isMesh || !node.material) return;
      node.material.transparent = opacity < 0.995;
      node.material.opacity = opacity;
    });
  }

  function setMeshListOpacity(meshes, opacity) {
    meshes.forEach(function (node) {
      if (!node.material) return;
      node.material.transparent = opacity < 0.995;
      node.material.opacity = opacity;
    });
  }

  function setPooledPropOpacity(obj, opacity) {
    var data = obj.userData.poolProp;
    if (!data || Math.abs((data.lastOpacity || 0) - opacity) < 0.025) return;
    data.lastOpacity = opacity;
    setMeshListOpacity(data.meshes, opacity);
  }

  function disposePropObject(obj, disposeGeometry) {
    if (!obj || !obj.traverse) return;
    obj.traverse(function (node) {
      if (!node.isMesh) return;
      if (disposeGeometry && node.geometry && node.geometry.dispose) node.geometry.dispose();
      if (!node.material) return;
      var mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(function (mat) {
        if (mat && mat.dispose) mat.dispose();
      });
    });
  }

  function addUv2(geo) {
    if (!geo || !geo.attributes || !geo.attributes.uv) return;
    var uv = geo.attributes.uv;
    var uv2 = new THREE.BufferAttribute(new Float32Array(uv.array), 2);
    if (geo.setAttribute) geo.setAttribute('uv2', uv2);
    else geo.addAttribute('uv2', uv2);
  }

  function makeCausticMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.42 },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){',
        '  vUv=uv;',
        '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform float uOpacity;',
        'varying vec2 vUv;',
        VORONOI,
        'vec3 getNoise(vec3 pos){',
        '  float scale=1.5;',
        '  vec3 noiseScale=vec3(scale,0.6,scale);',
        '  float t=uTime*0.5;',
        '  float offset=0.09;',
        '  vec3 coords=pos+vec3(t*0.5,t,0.0);',
        '  vec3 n=vec3(',
        '    voronoi3d((coords+vec3(offset,0.0,0.0))*noiseScale).x,',
        '    voronoi3d((coords+vec3(0.0,offset,0.0))*noiseScale).x,',
        '    voronoi3d((coords+vec3(0.0,0.0,offset))*noiseScale).x',
        '  );',
        '  return clamp(pow(n,vec3(3.0)),0.0,1.0);',
        '}',
        'void main(){',
        '  vec2 uv=vUv;',
        '  uv.x += sin(uv.y*12.0+uTime*0.85)*0.018;',
        '  uv.y += cos(uv.x*10.0+uTime*0.70)*0.014;',
        '  vec3 n=getNoise(vec3(uv*7.0,uTime*0.08));',
        '  float c=(n.x*0.52+n.y*0.30+n.z*0.20);',
        '  c=smoothstep(0.16,0.82,c);',
        '  vec3 col=vec3(0.78,0.93,1.0)*c*1.35;',
        '  gl_FragColor=vec4(col,c*uOpacity);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
  }

  function AquaCityBg(container) {
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'z-index:1;pointer-events:none;opacity:0;transition:opacity 0.65s ease;';
    container.appendChild(this._canvas);

    this._ren = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: false,
      precision: 'mediump',
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.85));
    this._ren.setSize(window.innerWidth, window.innerHeight);
    this._ren.setClearColor(BG, 1);
    this._ren.shadowMap.enabled = false;
    this._ren.toneMapping = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.05;

    this._sc = new THREE.Scene();
    this._sc.background = new THREE.Color(BG);
    this._sc.fog = new THREE.Fog(BG, 0.1, 25);

    this._cam = new THREE.PerspectiveCamera(
      54, window.innerWidth / window.innerHeight, 0.1, 100
    );
    this._cam.position.set(0, 2.45, 7.2);
    this._cam.lookAt(new THREE.Vector3(0, 1, -5));

    this._time = 0;
    this._target = 0;
    this._iv = 0;
    this._active = false;
    this._floats = [];
    this._sideObjects = [];
    this._poolSegments = [];
    this._poolPropCache = {};
    this._propSlots = [];
    this._propRouteState = 'intro';
    this._propRoutePair = null;
    this._propRouteIndex = 0;
    this._propRouteRepeats = 0;
    this._propEmptyRemaining = 0;
    this._propLoadToken = 0;
    this._propLoading = false;

    this._buildScene();

    var self = this;
    window.addEventListener('resize', function () { self._resize(); });
  }

  AquaCityBg.prototype._buildScene = function () {
    var self = this;
    var tileMat = makeMat({ color: 0xffffff, roughness: 0.0 });

    var texLoader = new THREE.TextureLoader();
    [
      ['map', 'tlfmffydy_4K_Albedo.jpg'],
      ['aoMap', 'tlfmffydy_4K_AO.jpg'],
      ['normalMap', 'tlfmffydy_4K_Normal.jpg'],
      ['roughnessMap', 'tlfmffydy_4K_Roughness.jpg']
    ].forEach(function (item) {
      texLoader.load(ASSET_BASE + item[1], function (tex) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(SIZE / 4, SIZE / 4);
        tileMat[item[0]] = tex;
        tileMat.needsUpdate = true;
      });
    });

    function addPoolSegment(z, index) {
      var group = new THREE.Group();
      group.position.z = z;
      self._sc.add(group);

      function segFloor(x, y, localZ, rx, ry, sx, sy) {
        var geo = new THREE.PlaneGeometry(sx, sy, 1, 1);
        addUv2(geo);
        var mesh = new THREE.Mesh(geo, tileMat);
        mesh.position.set(x, y, localZ);
        mesh.rotation.x = rx || 0;
        mesh.rotation.y = ry || 0;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
      }

      segFloor(0, 0, 0, -Math.PI / 2, 0, 11, 8);
      segFloor(-4.35, 3.05, 0, 0, Math.PI / 2, 8, 6.1);
      segFloor(4.35, 3.05, 0, 0, -Math.PI / 2, 8, 6.1);

      self._poolSegments.push({
        group: group,
        z: z,
        phase: index * 0.8,
        baseX: group.position.x,
        baseY: group.position.y
      });
    }

    for (var si = 0; si < POOL_SEGMENT_COUNT; si++) {
      addPoolSegment(-si * POOL_SEGMENT_SPACING, si);
    }

    var spot = new THREE.SpotLight(0xffffff, 4.0);
    spot.position.set(-5, 10, 3);
    spot.angle = Math.PI / 4;
    spot.penumbra = 0.5;
    spot.castShadow = false;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.target.position.set(0, 0, 0);
    this._sc.add(spot);
    this._sc.add(spot.target);
    this._sc.add(new THREE.AmbientLight(0x0000ff, 1.6));
    this._sc.add(new THREE.AmbientLight(0xffffff, 0.55));

    function addSideObject(obj, lane, z, phase, rotOffset) {
      obj.position.set(lane, 1.35, z);
      obj.rotation.y = (lane < 0 ? -Math.PI / 5 : Math.PI + Math.PI / 5) + (rotOffset || 0);
      self._sc.add(obj);
      self._sideObjects.push({
        obj: obj,
        lane: lane,
        z: z,
        phase: phase,
        baseY: obj.position.y,
        baseRotX: obj.rotation.x,
        baseRotY: obj.rotation.y,
        amp: 0.16 + (phase % 3) * 0.025
      });
    }

    function makeSideBox(size, color) {
      var mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        makeMat({ color: color, roughness: 0.1 })
      );
      mesh.castShadow = mesh.receiveShadow = false;
      return mesh;
    }

    addSideObject(makeSideBox(0.95, 0x00ffff), -3.30, -4, 0.8, -0.18);
    addSideObject(makeSideBox(0.72, 0xff0000), 3.30, -9, 1.7, 0.46);
    addSideObject(makeSideBox(0.85, 0x00ffff), -3.58, -15, 2.6, 0.14);
    addSideObject(makeSideBox(0.65, 0xff0000), 3.58, -21, 3.4, -0.52);

    if (typeof THREE.GLTFLoader !== 'undefined') {
      new THREE.GLTFLoader().load(GLB_PATH, function (gltf) {
        var root = gltf.scene || gltf.scenes[0];
        var source = root && root.getObjectByName ? root.getObjectByName('Object_4') : null;
        var model;
        if (source && source.geometry) {
          model = new THREE.Mesh(
            source.geometry,
            makeMat({ color: 0xff6347, roughness: 0.1, metalness: 0.0 })
          );
          model.rotation.x = -35 * Math.PI / 180;
        } else {
          model = root;
        }
        var lanes = [-3.18, 3.18, -3.68, 3.68, -3.38, 3.38];
        var zs = [-2, -6.5, -11, -15.5, -20, -24.5];
        var rots = [-0.28, 0.62, 0.34, -0.48, 0.12, 0.88];
        lanes.forEach(function (lane, i) {
          var clone = model.clone(true);
          clone.traverse(function (obj) {
            if (obj.isMesh) {
              obj.castShadow = false;
              obj.receiveShadow = false;
              obj.material = makeMat({ color: 0xff6347, roughness: 0.1, metalness: 0.0 });
            }
          });
          clone.scale.setScalar(0.92);
          addSideObject(clone, lane, zs[i], i * 0.7, rots[i]);
        });
      }, null, function (err) {
        console.warn('AquaCityBg monkey GLB load failed:', err);
      });
    }

    this._causticMat = makeCausticMaterial();
    var caustic = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), this._causticMat);
    caustic.position.set(0, 0.018, 0);
    caustic.rotation.x = -Math.PI / 2;
    caustic.renderOrder = 10;
    this._sc.add(caustic);
  };

  function propSpec(file, heavy) {
    return {
      file: file,
      base: heavy ? HEAVY_PROP_BASE : POOL_PROP_BASE,
      heavy: !!heavy
    };
  }

  AquaCityBg.prototype._loadPoolPropEntry = function (spec, done) {
    var self = this;
    var key = spec.base + spec.file;
    if (this._poolPropCache[key]) {
      done(this._poolPropCache[key]);
      return;
    }
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('AquaCityBg pool prop skipped; GLTFLoader missing:', spec.file);
      done(null);
      return;
    }

    Object.keys(this._poolPropCache).forEach(function (cacheKey) {
      disposePropObject(self._poolPropCache[cacheKey].root, true);
      delete self._poolPropCache[cacheKey];
    });

    new THREE.GLTFLoader().load(
      spec.base + encodeURIComponent(spec.file),
      function (gltf) {
        var root = gltf.scene || gltf.scenes[0];
        if (!root) {
          console.warn('AquaCityBg pool prop has no scene:', spec.file);
          done(null);
          return;
        }

        root.traverse(function (node) {
          if (!node.isMesh) return;
          node.castShadow = false;
          node.receiveShadow = false;
          if (node.material) {
            node.material = node.material.clone();
            node.material.transparent = true;
            node.material.opacity = 1;
          }
        });

        var box = new THREE.Box3().setFromObject(root);
        var size = box.getSize(new THREE.Vector3());
        var center = box.getCenter(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z, 0.001);
        var normalized = new THREE.Group();
        root.position.sub(center);
        normalized.add(root);
        var entry = {
          file: spec.file,
          heavy: spec.heavy,
          root: normalized,
          maxDim: maxDim
        };
        self._poolPropCache[key] = entry;
        done(self._poolPropCache[key]);
      },
      undefined,
      function (err) {
        console.warn('AquaCityBg pool prop GLB skipped:', spec.file, err);
        done(null);
      }
    );
  };

  AquaCityBg.prototype._loadPoolPropPair = function (files, done) {
    var out = [];
    this._loadPoolPropEntry(files[0], function (first) {
      if (first) out.push(first);
      done(out);
    });
  };

  AquaCityBg.prototype._pickPoolPropPairFiles = function () {
    var lightCount = POOL_PROP_FILES.length;
    var lightStart = this._propRouteIndex % lightCount;
    if (HEAVY_ROUTE_EVERY > 0 &&
        this._propRouteIndex > 0 &&
        this._propRouteIndex % HEAVY_ROUTE_EVERY === 0 &&
        HEAVY_PROP_FILES.length) {
      return [
        propSpec(HEAVY_PROP_FILES[(this._propRouteIndex / HEAVY_ROUTE_EVERY - 1) % HEAVY_PROP_FILES.length], true)
      ];
    }
    return [
      propSpec(POOL_PROP_FILES[lightStart], false)
    ];
  };

  AquaCityBg.prototype._startPropRoute = function () {
    var self = this;
    if (this._propLoading || this._propRouteState === 'route') return false;
    this._clearPropRoute();
    this._propLoading = true;
    this._propRouteState = 'loading';
    var token = ++this._propLoadToken;
    this._loadPoolPropPair(this._pickPoolPropPairFiles(), function (pair) {
      if (token !== self._propLoadToken) return;
      self._propLoading = false;
      if (pair.length < 1) {
        self._propRouteState = 'empty';
        self._propEmptyRemaining = PROP_ROUTE_EMPTY_DISTANCE;
        self._propRouteIndex += 1;
        return;
      }
      self._propRoutePair = pair;
      self._propRouteRepeats = 0;
      self._propRouteState = 'route';
      self._resetPropRoutePass();
    });
    return true;
  };

  AquaCityBg.prototype._clonePoolProp = function (entry, slotIndex, z) {
    var obj = entry.root.clone(true);
    var meshes = [];
    obj.traverse(function (node) {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      if (node.material) {
        node.material = node.material.clone();
      }
      meshes.push(node);
    });

    var isCharacterProp = entry.file === 'uno_-_rabbid.glb' || entry.file === 'mario_rabbit.glb';
    var targetSize = entry.file === 'bikini_girl.glb' ? rnd(3.8, 4.8) :
      isCharacterProp ? rnd(4.8, 6.0) :
      entry.heavy ? rnd(1.05, 1.55) : rnd(1.55, 2.25);
    obj.scale.setScalar(targetSize / entry.maxDim);
    obj.rotation.set(
      rnd(-0.35, 0.35),
      rnd(-Math.PI, Math.PI),
      rnd(-0.22, 0.22)
    );
    obj.userData.poolProp = {
      lane: isCharacterProp ? rnd(-0.95, 0.95) :
        (slotIndex % 2 === 0 ? rnd(-2.15, -1.45) : rnd(1.45, 2.15)),
      z: z,
      spinX: rnd(-0.25, 0.25),
      spinY: rnd(-0.38, 0.38),
      spinZ: rnd(-0.18, 0.18),
      phase: rnd(0, Math.PI * 2),
      baseY: isCharacterProp ? rnd(1.75, 2.28) : rnd(1.18, 1.82),
      amp: rnd(0.08, 0.16),
      meshes: meshes,
      lastOpacity: -1
    };
    setMeshListOpacity(meshes, 0);
    return obj;
  };

  AquaCityBg.prototype._clearPropRoute = function (keepPair) {
    this._propSlots.forEach(function (slot) {
      if (slot.obj && slot.obj.parent) slot.obj.parent.remove(slot.obj);
      disposePropObject(slot.obj, false);
    });
    this._propSlots = [];
    if (!keepPair) this._propRoutePair = null;
  };

  AquaCityBg.prototype._resetPropRoutePass = function () {
    var self = this;
    if (!this._propRoutePair || this._propRoutePair.length < 1) return;
    if (!this._propSlots.length) {
      this._propRoutePair.forEach(function (entry, i) {
        var obj = self._clonePoolProp(entry, i, i === 0 ? PROP_ROUTE_Z_A : PROP_ROUTE_Z_B);
        self._sc.add(obj);
        self._propSlots.push({ obj: obj });
      });
    } else {
      this._propSlots.forEach(function (slot, i) {
        var data = slot.obj.userData.poolProp;
        data.z = i === 0 ? PROP_ROUTE_Z_A : PROP_ROUTE_Z_B;
        data.lastOpacity = -1;
        slot.obj.visible = true;
        setMeshListOpacity(data.meshes, 0);
      });
    }
    this._propRouteRepeats += 1;
  };

  AquaCityBg.prototype.show = function () {
    this._active = true;
    this._canvas.style.opacity = '1';
  };

  AquaCityBg.prototype.hide = function () {
    this._active = false;
    this._target = 0;
    this._propLoading = false;
    this._propLoadToken += 1;
    this._clearPropRoute();
    this._propRouteState = 'intro';
    this._canvas.style.opacity = '0';
  };

  AquaCityBg.prototype.setIntensity = function (v) {
    this._target = Math.max(0, Math.min(1, +v || 0));
  };

  AquaCityBg.prototype.tick = function (dt) {
    this._time += dt;
    this._iv += (this._target - this._iv) * Math.min(dt * 2.5, 1);
    if (!this._active && this._iv < 0.01) return;

    var t = this._time;
    var cx = Math.sin(t * 0.18) * (0.35 + this._iv * 0.22);
    var cy = 2.45 + Math.sin(t * 0.13) * 0.28;
    var cz = 7.2 + Math.cos(t * 0.16) * 0.38;
    this._cam.position.set(cx, cy, cz);
    this._cam.lookAt(new THREE.Vector3(0, 1.0, -5.2 - this._iv * 1.2));

    this._floats.forEach(function (f) {
      f.obj.position.y = f.baseY + Math.sin(t * 0.9 + f.phase) * f.amp;
      f.obj.rotation.x += dt * f.rot * 0.45;
      f.obj.rotation.y += dt * f.rot;
    });

    var sideSpeed = 5.8 + this._iv * 22.0;
    var shake = 0.035 + this._iv * 0.18;

    this._poolSegments.forEach(function (p) {
      p.z += sideSpeed * dt;
      while (p.z > 18) p.z -= POOL_SEGMENT_PERIOD;
      p.group.position.z = p.z;
      p.group.position.x = p.baseX;
      p.group.position.y = p.baseY;
      p.group.rotation.x = 0;
      p.group.rotation.z = 0;
    }, this);

    this._sideObjects.forEach(function (s) {
      s.z += sideSpeed * dt;
      while (s.z > 12) s.z -= 40;

      var wave = Math.sin(t * (2.4 + this._iv * 7.0) + s.phase);
      s.obj.position.z = s.z;
      s.obj.position.x = s.lane + wave * shake;
      s.obj.position.y = s.baseY + Math.sin(t * 1.4 + s.phase) * s.amp + this._iv * 0.08;
      s.obj.rotation.x = s.baseRotX + Math.sin(t * 2.0 + s.phase) * (0.08 + this._iv * 0.18);
      s.obj.rotation.y = s.baseRotY + Math.sin(t * 1.6 + s.phase) * (0.10 + this._iv * 0.22);
      var fadeIn = Math.max(0, Math.min(1, (-26 - s.z) / -10));
      var fadeOut = Math.max(0, Math.min(1, (12 - s.z) / 8));
      setObjectOpacity(s.obj, Math.min(fadeIn, fadeOut));
    }, this);

    if (!this._active || this._target < 0.05) {
      if (this._propRouteState === 'route') {
        this._clearPropRoute();
        this._propRouteState = 'intro';
      }
    } else if (this._propRouteState === 'intro') {
      if (t >= PROP_ROUTE_INTRO_TIME) {
        this._startPropRoute();
      }
    } else if (this._propRouteState === 'empty') {
      this._propEmptyRemaining -= sideSpeed * dt;
      if (this._propEmptyRemaining <= 0) {
        this._propRouteIndex += 1;
        this._startPropRoute();
      }
    } else if (this._propRouteState === 'route') {
      var allPassed = true;
      this._propSlots.forEach(function (slot) {
        var obj = slot.obj;
        var data = obj.userData.poolProp;
        data.z += sideSpeed * dt;
        var wave = Math.sin(t * (1.55 + this._iv * 4.0) + data.phase);
        obj.position.set(
          data.lane + wave * shake * 0.55,
          data.baseY + Math.sin(t * 1.05 + data.phase) * data.amp,
          data.z
        );
        obj.rotation.x += data.spinX * dt;
        obj.rotation.y += data.spinY * dt;
        obj.rotation.z += data.spinZ * dt;
        var fadeIn = Math.max(0, Math.min(1, (-24 - data.z) / -8));
        var fadeOut = Math.max(0, Math.min(1, (11 - data.z) / 8));
        setPooledPropOpacity(obj, Math.min(fadeIn, fadeOut));
        if (data.z <= 13) allPassed = false;
      }, this);

      if (allPassed) {
        if (this._propRouteRepeats < PROP_ROUTE_REPEATS) {
          this._resetPropRoutePass();
        } else {
          this._clearPropRoute();
          this._propRouteState = 'empty';
          this._propEmptyRemaining = PROP_ROUTE_EMPTY_DISTANCE;
        }
      }
    }

    this._causticMat.uniforms.uTime.value = t * (1 + this._iv * 0.35);
    this._causticMat.uniforms.uOpacity.value = 0.42 + this._iv * 0.16;

    this._ren.render(this._sc, this._cam);
  };

  AquaCityBg.prototype._resize = function () {
    var w = window.innerWidth;
    var h = window.innerHeight;
    this._cam.aspect = w / h;
    this._cam.updateProjectionMatrix();
    this._ren.setSize(w, h);
  };

  global.AquaCityBg = AquaCityBg;
})(window);
