/* metropolis-bg.js - Mode 2: Project Rebecca simple background renderer.
   Intentionally mirrors the simple background-class pattern used by Mode 3/4:
   one fixed canvas, one scene, loading screen first, then original GLTF. */
(function (global) {
  'use strict';

  var ASSET_ROOT = 'references/project-rebecca/public/';
  var CITY_GLTF = ASSET_ROOT + 'nc_optim/scene.gltf';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setPositionAttribute(geometry, data) {
    var attr = new THREE.BufferAttribute(new Float32Array(data), 3);
    if (geometry.setAttribute) geometry.setAttribute('position', attr);
    else geometry.addAttribute('position', attr);
  }

  function lineMaterial(color, opacity) {
    return new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  function basicMaterial(color, opacity, additive) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity < 1 || additive,
      opacity: opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive,
      side: THREE.DoubleSide
    });
  }

  function MetropolisBg(container) {
    this.container = container;
    this._target = 0;
    this._iv = 0;
    this._time = 0;
    this._renderAccum = 0;
    this._scroll = [];
    this._fallback = new THREE.Group();
    this._accentGroup = new THREE.Group();
    this._cityModels = [];
    this._loaded = false;
    this._cityMinZ = -18;
    this._cityMaxZ = 24;
    this._citySpan = this._cityMaxZ - this._cityMinZ;
    this._look = new THREE.Vector3(0, 6.5, 5);

    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:1;' +
      'display:block;pointer-events:none;opacity:0;transition:opacity 0.65s ease;' +
      'filter:brightness(1.75) contrast(1.42) saturate(1.35);';
    container.appendChild(this._canvas);

    this._loading = document.createElement('div');
    this._loading.textContent = 'LOADING NIGHT CITY';
    this._loading.style.cssText =
      'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;' +
      'font:600 11px/1.2 system-ui,Segoe UI,sans-serif;letter-spacing:0.32em;' +
      'color:rgba(130,245,255,0.88);text-shadow:0 0 18px rgba(80,246,255,0.75);' +
      'pointer-events:none;opacity:0;transition:opacity 0.28s ease;';
    container.appendChild(this._loading);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.sortObjects = false;
    if (this.renderer.outputEncoding !== undefined && THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 22, 72);

    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 1200);
    this.camera.position.set(0, 9.0, -12);
    this.camera.lookAt(this._look);

    this._buildRebeccaFallback();
    this._buildPermanentAccents();
    this._loadRebeccaModels();
    this._resize();

    var self = this;
    this._onResize = function () { self._resize(); };
    window.addEventListener('resize', this._onResize);

    this.renderer.render(this.scene, this.camera);
  }

  MetropolisBg.prototype.show = function () {
    this._canvas.style.opacity = '1';
    if (this._loading && !this._loaded) this._loading.style.opacity = '1';
  };

  MetropolisBg.prototype.hide = function () {
    this._canvas.style.opacity = '0';
    if (this._loading) this._loading.style.opacity = '0';
  };

  MetropolisBg.prototype.setIntensity = function (v) {
    this._target = clamp(v || 0, 0, 1);
  };

  MetropolisBg.prototype.tick = function (dt) {
    dt = clamp(dt || 0.016, 0.001, 0.05);
    this._time += dt;
    this._iv += (this._target - this._iv) * (1 - Math.pow(0.001, dt));
    this._renderAccum += dt;
    if (this._renderAccum < 1 / 30) return;
    dt = this._renderAccum;
    this._renderAccum = 0;

    var speed = (3.2 + this._iv * 19.0) * dt;
    for (var i = 0; i < this._scroll.length; i++) {
      var o = this._scroll[i];
      o.position.z += speed * o.userData.speedMul;
      if (o.position.z > 16) o.position.z -= 64;
    }

    for (var j = 0; j < this._cityModels.length; j++) {
      var city = this._cityModels[j];
      city.position.z -= speed * city.userData.speedMul;
      if (city.position.z < this._cityMinZ) city.position.z += this._citySpan;
    }

    this.camera.position.x = 0;
    this.camera.position.y = 9.0 + Math.sin(this._time * 0.23) * 0.08;
    this._look.set(0, 6.5, 5);
    this.camera.lookAt(this._look);
    this.renderer.render(this.scene, this.camera);
  };

  MetropolisBg.prototype._resize = function () {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  MetropolisBg.prototype._buildRebeccaFallback = function () {
    this.scene.add(this._fallback);
    this._fallback.visible = false;

    this.scene.add(new THREE.AmbientLight(0xe2f2ff, 3.4));

    var cyan = new THREE.PointLight(0x54f6ff, 6.2, 90);
    cyan.position.set(-8, 7, -8);
    this.scene.add(cyan);

    var pink = new THREE.PointLight(0xff4fe7, 5.8, 90);
    pink.position.set(9, 5, 2);
    this.scene.add(pink);

    var violet = new THREE.PointLight(0xa58cff, 4.4, 105);
    violet.position.set(0, 12, 12);
    this.scene.add(violet);

    var back = new THREE.Mesh(new THREE.PlaneGeometry(95, 55), basicMaterial(0x152a78, 1, false));
    back.position.set(0, 7, 24);
    this._fallback.add(back);

    var glowA = new THREE.Mesh(new THREE.PlaneGeometry(72, 30), basicMaterial(0x19f8ff, 0.26, true));
    glowA.position.set(-13, 6, 23.5);
    this._fallback.add(glowA);

    var glowB = new THREE.Mesh(new THREE.PlaneGeometry(60, 28), basicMaterial(0xff37e6, 0.24, true));
    glowB.position.set(16, 4, 23);
    this._fallback.add(glowB);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(92, 92), basicMaterial(0x071434, 0.95, false));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -2.4, 8);
    this._fallback.add(ground);

    this._makePerspectiveGrid();
    this._makeFallbackCity();
    this._makeRain();
  };

  MetropolisBg.prototype._buildPermanentAccents = function () {
    this.scene.add(this._accentGroup);
    this._accentGroup.visible = false;

    var colors = [0x65ffff, 0xff4de6, 0x8d6cff, 0x36ffc4];
    var i;

    for (i = 0; i < 22; i++) {
      var side = i % 2 ? -1 : 1;
      var z = this._cityMinZ + (i / 22) * this._citySpan;
      var panel = new THREE.Mesh(
        new THREE.PlaneGeometry(rnd(1.8, 4.2), rnd(0.35, 1.15)),
        basicMaterial(colors[i % colors.length], rnd(0.28, 0.52), true)
      );
      panel.position.set(side * rnd(6.6, 13.5), rnd(1.2, 8.8), z);
      panel.rotation.y = side > 0 ? -Math.PI / 2.7 : Math.PI / 2.7;
      panel.userData.speedMul = rnd(0.42, 0.55);
      this._accentGroup.add(panel);
      this._cityModels.push(panel);
    }

    for (i = 0; i < 12; i++) {
      var geo = new THREE.BufferGeometry();
      var x = i % 2 ? -7.2 : 7.2;
      var z0 = this._cityMinZ + (i / 12) * this._citySpan;
      setPositionAttribute(geo, [x, -1.8, z0, x, rnd(5.5, 12), z0 + rnd(0.5, 2.2)]);
      var beam = new THREE.Line(geo, lineMaterial(colors[(i + 1) % colors.length], rnd(0.4, 0.72)));
      beam.userData.speedMul = rnd(0.45, 0.6);
      this._accentGroup.add(beam);
      this._cityModels.push(beam);
    }
  };

  MetropolisBg.prototype._makePerspectiveGrid = function () {
    var group = new THREE.Group();
    group.userData.speedMul = 1.1;
    this._fallback.add(group);
    this._scroll.push(group);

    var cyan = lineMaterial(0x66ffff, 0.32);
    var magenta = lineMaterial(0xff55e6, 0.22);
    var i;

    for (i = -15; i <= 15; i++) {
      var geo = new THREE.BufferGeometry();
      setPositionAttribute(geo, [i * 1.2, -2.34, -45, i * 1.2, -2.34, 18]);
      group.add(new THREE.Line(geo, i % 2 ? cyan : magenta));
    }

    for (i = 0; i < 36; i++) {
      var z = -45 + i * 1.8;
      var g = new THREE.BufferGeometry();
      setPositionAttribute(g, [-24, -2.33, z, 24, -2.33, z]);
      group.add(new THREE.Line(g, i % 2 ? magenta : cyan));
    }
  };

  MetropolisBg.prototype._makeFallbackCity = function () {
    for (var i = 0; i < 34; i++) {
      var side = i % 2 ? -1 : 1;
      var z = -42 + i * 1.9;
      var h = rnd(3.4, 12.5);
      var w = rnd(0.7, 2.0);
      var d = rnd(0.7, 2.3);
      var x = side * rnd(7.5, 17);

      var body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        basicMaterial(i % 3 ? 0x07162f : 0x111144, 0.92, false)
      );
      body.position.set(x, h * 0.5 - 2.4, z);
      body.userData.speedMul = rnd(0.82, 1.06);
      this._fallback.add(body);
      this._scroll.push(body);

      var strip = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.78, h * 0.78),
        basicMaterial(i % 2 ? 0xff42df : 0x54f6ff, 0.5, true)
      );
      strip.position.set(x - side * (w * 0.52 + 0.02), h * 0.5 - 2.35, z);
      strip.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      strip.userData.speedMul = body.userData.speedMul;
      this._fallback.add(strip);
      this._scroll.push(strip);
    }
  };

  MetropolisBg.prototype._makeRain = function () {
    var count = 420;
    var pts = [];
    for (var i = 0; i < count; i++) {
      var x = rnd(-28, 28);
      var y = rnd(-1, 24);
      var z = rnd(-48, 18);
      pts.push(x, y, z, x - 0.08, y - rnd(0.35, 1.1), z + 0.25);
    }
    var geo = new THREE.BufferGeometry();
    setPositionAttribute(geo, pts);
    var rain = new THREE.LineSegments(geo, lineMaterial(0x9ffcff, 0.22));
    rain.userData.speedMul = 1.55;
    this._fallback.add(rain);
    this._scroll.push(rain);
  };

  MetropolisBg.prototype._loadRebeccaModels = function () {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('MetropolisBg: GLTFLoader missing; Mode 2 loading screen remains visible.');
      return;
    }

    var loader = new THREE.GLTFLoader();
    this._loadMainCity(loader);
  };

  MetropolisBg.prototype._loadMainCity = function (loader) {
    var self = this;
    loader.load(CITY_GLTF, function (gltf) {
      var model = gltf.scene || gltf.scenes && gltf.scenes[0];
      if (!model) return;
      self._styleRebeccaModel(model);

      var root = new THREE.Group();
      var zOffsets = [-12, 8];
      var lanes = [
        { x: -7.5, scale: 1.22, y: 5.9, rot: 0 },
        { x: 7.5, scale: 1.22, y: 5.9, rot: 0 }
      ];
      for (var l = 0; l < lanes.length; l++) {
        for (var i = 0; i < zOffsets.length; i++) {
          var city = model.clone(true);
          city.scale.setScalar(lanes[l].scale);
          city.position.set(lanes[l].x, lanes[l].y, zOffsets[i] + (l * 3.3));
          city.rotation.y = lanes[l].rot;
          city.userData.speedMul = 0.42 + l * 0.025;
          root.add(city);
          self._cityModels.push(city);
        }
      }

      self._loaded = true;
      self._fallback.visible = false;
      self._accentGroup.visible = true;
      if (self._loading) self._loading.style.opacity = '0';
      self.scene.add(root);
    }, undefined, function (err) {
      console.warn('MetropolisBg: project-rebecca main GLTF failed; Mode 2 loading screen remains visible.', err && err.message ? err.message : err);
    });
  };

  MetropolisBg.prototype._styleRebeccaModel = function (root) {
    root.traverse(function (node) {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      if (node.geometry) {
        if (node.geometry.computeVertexNormals) node.geometry.computeVertexNormals();
        if (node.geometry.computeBoundingSphere) node.geometry.computeBoundingSphere();
        if (node.geometry.computeBoundingBox) node.geometry.computeBoundingBox();
      }
      if (node.material) {
        if (node.material.map || node.material.alphaMap) {
          node.material.map = node.material.map || node.material.alphaMap;
        }
        node.material.wireframe = true;
        node.material.transparent = false;
        node.material.opacity = 1;
        node.material.depthWrite = true;
        node.material.needsUpdate = true;
      }
    });
  };

  global.MetropolisBg = MetropolisBg;
})(window);
