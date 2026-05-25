/* aquacity-bg.js — Mode 4: Faraz Fake Caustics pool scene
   Reference: https://farazzshaikh.com/demos/demo-2022-fake-caustics
   Technique: direct scene render + Voronoi3D screen-space caustic overlay
   Pool tile floor, bronze monkey statue GLB, SpotLight [-5,10,3]               */

(function (global) {
  'use strict';

  /* ── Scene constants (from reference) ──────────────────────────────────── */
  var BG_HEX  = 0x0a0e27;   /* reference exact: #0a0e27                      */
  var FOG_FAR = 22;          /* shorter than ref (22 vs 30) = more depth feel  */

  /* Camera — reference CameraRig targets ~[-5,2,5] looking at [0,1,0]        */
  var ORBIT_R = 5.0;
  var CAM_FOV = 50;          /* reference: perspectiveCamera fov=50            */

  /* SpotLight — reference: position[-5,10,3], angle=PI/4, penumbra=0.5       */
  var SPOT_X = -5, SPOT_Y = 10, SPOT_Z = 3;

  /* ── GLSL: 3D Voronoi — exact from reference Voronoi.js ─────────────────── */
  var _V3D = [
    'vec3 _v3h(vec3 p){',
    '  return fract(',
    '    sin(vec3(dot(p,vec3(1.,57.,113.)),dot(p,vec3(57.,113.,1.)),',
    '            dot(p,vec3(113.,1.,57.))))*43758.5453);',
    '}',
    'vec3 voronoi3d(vec3 x){',
    '  vec3 p=floor(x); vec3 f=fract(x);',
    '  float id=0.; vec2 res=vec2(100.);',
    '  for(int k=-1;k<=1;k++)for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){',
    '    vec3 b=vec3(float(i),float(j),float(k));',
    '    vec3 r=b-f+_v3h(p+b);',
    '    float d=dot(r,r);',
    '    float cond=max(sign(res.x-d),0.); float nCond=1.-cond;',
    '    float cond2=nCond*max(sign(res.y-d),0.); float nCond2=1.-cond2;',
    '    id=(dot(p+b,vec3(1.,57.,113.))*cond)+(id*nCond);',
    '    res=vec2(d,res.x)*cond+res*nCond;',
    '    res.y=cond2*d+nCond2*res.y;',
    '  }',
    '  return vec3(sqrt(res),abs(id));',
    '}'
  ].join('\n');

  /* ── Caustic overlay material (screen-space, additive) ──────────────────── */
  function makeCausticOverlay() {
    var frag = [
      'uniform float uTime, uOpacity, uAspect;',
      'varying vec2 vUv;',
      _V3D,
      /* getNoise — exact from reference Caustics.jsx getNoise() */
      'vec3 getNoise(vec3 pos, float t){',
      '  float scale=1.5;',
      '  vec3 ns=vec3(scale,.6,scale);',
      '  float offset=.09;',
      '  vec3 coords=pos+vec3(t*.5,t,0.);',
      '  vec3 n1=vec3(',
      '    voronoi3d((coords+vec3(offset,0.,0.))*ns).x,',
      '    voronoi3d((coords+vec3(0.,offset,0.))*ns).x,',
      '    voronoi3d((coords+vec3(0.,0.,offset))*ns).x);',
      '  n1=pow(n1,vec3(3.));',
      '  return clamp(n1,0.,1.);',
      '}',
      'void main(){',
      /* Wave-distort UV → water-lens ripple on the caustic itself */
      '  vec2 uv=vUv;',
      '  uv.x+=sin(vUv.y*7.0+uTime*1.1)*0.009;',
      '  uv.y+=cos(vUv.x*5.5+uTime*0.85)*0.007;',
      /* Map screen UV to 3D position for Voronoi, z-axis = slow drift */
      '  float sc=5.5;',
      '  vec3 pos=vec3(uv.x*uAspect*sc, uv.y*sc, uTime*0.08);',
      '  float t=uTime*.5;',                /* ref: t = uTime * 0.5 */
      '  vec3 n=getNoise(pos,t);',
      /* Combine 3 channels — same weights as ref */
      '  float c=n.x*.52+n.y*.30+n.z*.20;',
      /* Soft depth fade — stronger toward bottom (pool floor area) */
      '  float depth=smoothstep(1.0,.2,vUv.y)*0.55+0.45;',
      /* Blue-white caustic colour (matches pool light feel) */
      '  vec3 col=vec3(.75,.91,1.0);',
      '  gl_FragColor=vec4(col*c*depth, c*uOpacity*depth);',
      '}'
    ].join('\n');

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uOpacity: { value: 0.55 },
        uAspect:  { value: window.innerWidth / window.innerHeight },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){',
        '  vUv=uv;',
        '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
        '}'
      ].join('\n'),
      fragmentShader: frag,
      transparent:  true,
      blending:     THREE.AdditiveBlending,
      depthWrite:   false,
      depthTest:    false,
    });
  }

  /* ── Async pool tile texture loader ─────────────────────────────────────── */
  function loadPoolTiles(onDone) {
    var loader = new THREE.TextureLoader();
    var base   = 'assets/caustics/';
    var jobs   = [
      { key: 'map',          file: 'tlfmffydy_4K_Albedo.jpg'    },
      { key: 'normalMap',    file: 'tlfmffydy_4K_Normal.jpg'    },
      { key: 'aoMap',        file: 'tlfmffydy_4K_AO.jpg'        },
      { key: 'roughnessMap', file: 'tlfmffydy_4K_Roughness.jpg' },
    ];
    var result = {}, left = jobs.length;
    function finish() { if (--left === 0) onDone(result); }
    jobs.forEach(function(j) {
      loader.load(
        base + j.file,
        function(tex) {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(15 / 4, 15 / 4);
          result[j.key] = tex;
          finish();
        },
        null,
        function() { result[j.key] = null; finish(); }
      );
    });
  }

  /* ── Build the reference scene ───────────────────────────────────────────── */
  function buildObjects(grp) {

    /* Floor — PlaneGeometry(15,15), pool tile textures                       */
    var floorGeo = new THREE.PlaneGeometry(15, 15);
    var uvSrc    = floorGeo.attributes.uv;
    var uv2Buf   = new THREE.BufferAttribute(new Float32Array(uvSrc.array), uvSrc.itemSize);
    if (floorGeo.setAttribute) floorGeo.setAttribute('uv2', uv2Buf);
    else                        floorGeo.addAttribute('uv2', uv2Buf);

    var floorMat = new THREE.MeshStandardMaterial({
      color: 0x5588dd, roughness: 0.05, metalness: 0.0,
    });
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    grp.add(floorMesh);

    loadPoolTiles(function(textures) {
      if (textures.map)          floorMat.map          = textures.map;
      if (textures.normalMap)    floorMat.normalMap     = textures.normalMap;
      if (textures.aoMap)        floorMat.aoMap         = textures.aoMap;
      if (textures.roughnessMap) {
        floorMat.roughnessMap = textures.roughnessMap;
        floorMat.roughness    = 0.05;
      }
      floorMat.needsUpdate = true;
    });

    /* Cylinder platform — reference: CylinderGeometry(5,5,0.1,32)           */
    var cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x2255bb, roughness: 0.15, metalness: 0.2 })
    );
    cyl.position.y = 0.05;
    cyl.receiveShadow = cyl.castShadow = true;
    grp.add(cyl);

    /* Blue box — reference: BoxGeometry(2,2,2) at [-3,1,-3]                 */
    var boxL = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x0066cc, roughness: 0.25 })
    );
    boxL.position.set(-3, 1, -3);
    boxL.castShadow = boxL.receiveShadow = true;
    grp.add(boxL);

    /* Red box — reference: BoxGeometry(2,2,2) at [3,1,-3]                   */
    var boxR = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.25 })
    );
    boxR.position.set(3, 1, -3);
    boxR.castShadow = boxR.receiveShadow = true;
    grp.add(boxR);

    /* SpotLight — reference: [-5,10,3], intensity≈600, angle=PI/4           */
    var spot = new THREE.SpotLight(0xffffff, 3.0);
    spot.position.set(SPOT_X, SPOT_Y, SPOT_Z);
    spot.angle            = Math.PI / 4;
    spot.penumbra         = 0.5;
    spot.castShadow       = true;
    spot.shadow.mapSize.width  = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.target.position.set(0, 0, 0);
    grp.add(spot);
    grp.add(spot.target);

    /* Ambient blue — reference: <ambientLight color="blue" intensity={2} /> */
    grp.add(new THREE.AmbientLight(0x0033cc, 0.9));
    /* Ambient fill — reference: <ambientLight intensity={0.5} />             */
    grp.add(new THREE.AmbientLight(0x336688, 0.5));

    /* Bronze monkey statue — reference: bronze_monkey_statue.glb             */
    if (typeof THREE.GLTFLoader !== 'undefined') {
      var gltfLoader = new THREE.GLTFLoader();
      gltfLoader.load(
        'assets/caustics/bronze_monkey_statue.glb',
        function(gltf) {
          var model = gltf.scene;
          model.position.set(0, 0, 0);
          model.traverse(function(obj) {
            if (obj.isMesh) { obj.castShadow = obj.receiveShadow = true; }
          });
          grp.add(model);
        },
        null,
        function() {
          /* Fallback pedestal */
          var ped = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.55, 2.4, 16),
            new THREE.MeshStandardMaterial({ color: 0xbb8822, roughness: 0.2, metalness: 0.7 })
          );
          ped.position.set(0, 1.2, 0);
          ped.castShadow = ped.receiveShadow = true;
          grp.add(ped);
        }
      );
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  function AquaCityBg(container) {
    var w = window.innerWidth, h = window.innerHeight;

    /* Canvas — no contrast filter (would crush dark background to black) */
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    canvas.style.opacity = '0';
    container.appendChild(canvas);
    this._canvas = canvas;

    /* Renderer — reference: antialias:true, dpr=1 */
    this._ren = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance',
    });
    this._ren.setPixelRatio(1);
    this._ren.setSize(w, h);
    this._ren.setClearColor(BG_HEX, 1);
    this._ren.shadowMap.enabled  = true;
    this._ren.shadowMap.type     = THREE.PCFSoftShadowMap;
    this._ren.toneMapping        = THREE.ACESFilmicToneMapping;
    this._ren.toneMappingExposure = 1.1;

    /* Scene — reference: background="#0a0e27", fog("#0a0e27", 0, 30)        */
    this._sc = new THREE.Scene();
    this._sc.background = new THREE.Color(BG_HEX);
    this._sc.fog = new THREE.Fog(0x040c1e, 1, FOG_FAR);

    /* Camera — FOV=50 matching reference */
    this._cam = new THREE.PerspectiveCamera(CAM_FOV, w / h, 0.1, 200);
    this._cam.position.set(-ORBIT_R, 2.5, ORBIT_R);
    this._cam.lookAt(0, 1, 0);

    /* Scene objects */
    this._objectsGroup = new THREE.Group();
    this._sc.add(this._objectsGroup);
    buildObjects(this._objectsGroup);

    /* ── Screen-space Voronoi3D caustic overlay ────────────────────────── */
    this._causticMat = makeCausticOverlay();
    this._ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var ndqGeo  = new THREE.PlaneGeometry(2, 2);
    this._overlayScene = new THREE.Scene();
    this._overlayScene.add(new THREE.Mesh(ndqGeo, this._causticMat));

    /* EffectComposer — Bloom matching reference intensity=1, threshold=0.7  */
    this._useComposer = false;
    try {
      var P     = POSTPROCESSING;
      var comp  = new P.EffectComposer(this._ren);
      var rp    = new P.RenderPass(this._sc, this._cam);
      var bloom = new P.BloomEffect({ intensity: 1.0, luminanceThreshold: 0.7, luminanceSmoothing: 0.025 });
      var fxp   = new P.EffectPass(this._cam, bloom);
      fxp.renderToScreen = true;
      comp.addPass(rp);
      comp.addPass(fxp);
      this._composer    = comp;
      this._useComposer = true;
    } catch (e) { console.warn('AquaCityBg bloom:', e); }

    /* State */
    this._iv      = 0;
    this._time    = 0;
    this._orbit   = 0;
    this._visible = false;

    var self = this;
    this._onResize = function () { self._resize(); };
    window.addEventListener('resize', this._onResize);
  }

  /* ── Tick ─────────────────────────────────────────────────────────────── */
  AquaCityBg.prototype.tick = function (dt) {
    if (!this._visible) return;

    this._time  += dt;
    /* Very slow orbit — full circle ≈ 2.5 min, gentle vertical bob         */
    this._orbit += dt * 0.04;
    var cx = ORBIT_R * Math.cos(this._orbit);
    var cz = ORBIT_R * Math.sin(this._orbit);
    var cy = 2.5 + Math.sin(this._orbit * 0.25) * 0.5;
    this._cam.position.set(cx, cy, cz);
    this._cam.lookAt(0, 1, 0);

    /* Update caustic overlay uniforms */
    this._causticMat.uniforms.uTime.value   = this._time;
    this._causticMat.uniforms.uAspect.value = this._ren.domElement.width / this._ren.domElement.height;

    /* ── Render: scene via composer (bloom) ────────────────────────────── */
    if (this._useComposer) {
      this._composer.render(dt);
    } else {
      this._ren.render(this._sc, this._cam);
    }

    /* ── Overlay: Voronoi3D caustic quad on top (additive) ─────────────── */
    this._ren.autoClear = false;
    this._ren.render(this._overlayScene, this._ortho);
    this._ren.autoClear = true;
  };

  /* ── Show / hide / intensity ──────────────────────────────────────────── */
  AquaCityBg.prototype.show = function () {
    this._canvas.style.opacity = '1';
    this._visible = true;
  };

  AquaCityBg.prototype.hide = function () {
    this._canvas.style.opacity = '0';
    this._visible = false;
  };

  AquaCityBg.prototype.setIntensity = function (iv) {
    this._iv = iv;
    /* Slightly faster time when engine running */
    this._causticMat.uniforms.uOpacity.value = 0.55 + iv * 0.15;
  };

  /* ── Resize ───────────────────────────────────────────────────────────── */
  AquaCityBg.prototype._resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this._cam.aspect = w / h;
    this._cam.updateProjectionMatrix();
    this._ren.setSize(w, h);
    this._causticMat.uniforms.uAspect.value = w / h;
    if (this._composer) this._composer.setSize(w, h);
  };

  global.AquaCityBg = AquaCityBg;

})(window);
