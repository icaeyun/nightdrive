/* TextTrail — WebGL text-trail effect.
   Adapted from references/text-trail-effect/src/demo2 logic.
   Uses the already-loaded THREE global.
   Renders text with a persistence/smear trail on a transparent canvas,
   reacting to mouse movement. */

/* Inline simplex 3D noise (Stefan Gustavson algorithm) */
const SIMPLEX_GLSL = `
  vec3 _mod289v3(vec3 x){return x - floor(x*(1./289.))*289.;}
  vec4 _mod289v4(vec4 x){return x - floor(x*(1./289.))*289.;}
  vec4 _permute(vec4 x){return _mod289v4(((x*34.)+1.)*x);}
  vec4 _taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}

  float snoise3(vec3 v){
    const vec2 C = vec2(1./6., 1./3.);
    const vec4 D = vec4(0., .5, 1., 2.);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1. - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = _mod289v3(i);
    vec4 p = _permute(_permute(_permute(
      i.z + vec4(0., i1.z, i2.z, 1.)) +
      i.y + vec4(0., i1.y, i2.y, 1.)) +
      i.x + vec4(0., i1.x, i2.x, 1.));
    float n_ = .142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j  = p - 49.*floor(p*ns.z*ns.z);
    vec4 x_ = floor(j*ns.z);
    vec4 y_ = floor(j - 7.*x_);
    vec4 x  = x_*ns.x + ns.yyyy;
    vec4 y  = y_*ns.x + ns.yyyy;
    vec4 h  = 1. - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy,  y.xy);
    vec4 b1 = vec4(x.zw,  y.zw);
    vec4 s0 = floor(b0)*2. + 1.;
    vec4 s1 = floor(b1)*2. + 1.;
    vec4 sh = -step(h, vec4(0.));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = _taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.);
    m = m*m;
    return 42.*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const BASE_VERT = `
  varying vec2 v_uv;
  void main(){
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    v_uv = uv;
  }
`;

const PERSIST_FRAG = `
  uniform sampler2D sampler;
  uniform float     time;
  uniform float     aspect;
  uniform vec2      mousePos;
  uniform float     noiseFactor;
  uniform float     noiseScale;
  uniform float     rgbPersist;
  uniform float     alphaPersist;
  varying vec2 v_uv;

  ${SIMPLEX_GLSL}

  void main(){
    float a = snoise3(vec3(v_uv * noiseFactor,           time * 0.1))        * noiseScale;
    float b = snoise3(vec3(v_uv * noiseFactor + 100.0,   time * 0.1 + 100.)) * noiseScale;
    vec4 t0 = texture2D(sampler, v_uv + vec2(a,b) + mousePos * 0.005);
    gl_FragColor = vec4(t0.rgb * rgbPersist, t0.a * alphaPersist);
  }
`;

const TEXT_FRAG = `
  uniform sampler2D sampler;
  uniform vec3 color;
  varying vec2 v_uv;
  void main(){
    vec4 tex = texture2D(sampler, v_uv);
    if(tex.a < 0.85) discard;
    gl_FragColor = vec4(color, 1.0);
  }
`;

class TextTrail {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign({
      text:           'nightdrive',
      fontFamily:     'Orbitron, sans-serif',
      fontWeight:     '700',
      color:          [1.0, 0.92, 0.82],
      noiseFactor:    1.0,
      noiseScale:     0.0028,
      rgbPersist:     0.975,
      alphaPersist:   0.965,
    }, options);

    this._mouse  = [0, 0];
    this._target = [0, 0];
    this._ready  = false;

    this._setup();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    document.addEventListener('mousemove', e => this._onMouse(e));

    /* Draw text after fonts are ready */
    document.fonts.ready.then(() => {
      this._drawText(this.opts.text);
      this._ready = true;
      this._renderer.setAnimationLoop(() => this._tick());
    });
  }

  setColor(r, g, b) {
    this._textMat.uniforms.color.value.set(r, g, b);
  }

  setNoise(factor, scale) {
    this._fluidMat.uniforms.noiseFactor.value = factor;
    this._fluidMat.uniforms.noiseScale.value  = scale;
  }

  setText(text) {
    this.opts.text = text;
    if (this._ready) this._drawText(text);
  }

  destroy() {
    this._renderer.setAnimationLoop(null);
    this._renderer.dispose();
    if (this._renderer.domElement.parentNode) {
      this._renderer.domElement.parentNode.removeChild(this._renderer.domElement);
    }
  }

  _setup() {
    const Geom = THREE.PlaneGeometry || THREE.PlaneBufferGeometry;

    /* Renderer — transparent so road shows through */
    this._renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.autoClear = false;
    this.container.appendChild(this._renderer.domElement);

    this._clock = new THREE.Clock();

    /* Scenes */
    this._scene      = new THREE.Scene();
    this._fluidScene = new THREE.Scene();

    /* Orthographic camera in NDC space */
    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this._cam.position.set(0, 0, 1);
    this._cam.lookAt(0, 0, 0);

    /* Render targets (ping-pong) */
    this._rt0 = new THREE.WebGLRenderTarget(2, 2);
    this._rt1 = this._rt0.clone();

    /* Fluid / persistence quad (covers full NDC) */
    this._fluidMat = new THREE.ShaderMaterial({
      uniforms: {
        sampler:     { value: null },
        time:        { value: 0 },
        aspect:      { value: 1 },
        mousePos:    { value: new THREE.Vector2(-1, 1) },
        noiseFactor: { value: this.opts.noiseFactor },
        noiseScale:  { value: this.opts.noiseScale },
        rgbPersist:  { value: this.opts.rgbPersist },
        alphaPersist:{ value: this.opts.alphaPersist },
      },
      vertexShader:   BASE_VERT,
      fragmentShader: PERSIST_FRAG,
      transparent: true,
    });
    this._fluidScene.add(new THREE.Mesh(new Geom(2, 2), this._fluidMat));

    /* Text quad */
    this._textMat = new THREE.ShaderMaterial({
      uniforms: {
        sampler: { value: null },
        color:   { value: new THREE.Vector3(...this.opts.color) },
      },
      vertexShader:   BASE_VERT,
      fragmentShader: TEXT_FRAG,
      transparent: true,
    });
    this._scene.add(new THREE.Mesh(new Geom(2, 2), this._textMat));

    /* Canvas for text texture */
    this._texCanvas = document.createElement('canvas');
    this._texCtx    = this._texCanvas.getContext('2d');
  }

  _drawText(text) {
    const sz  = 2048;
    const ctx = this._texCtx;
    const fam = this.opts.fontFamily;
    const wt  = this.opts.fontWeight;

    this._texCanvas.width  = sz;
    this._texCanvas.height = sz;
    ctx.clearRect(0, 0, sz, sz);

    /* Auto-scale font to fill ~80% of canvas width */
    ctx.font = `${wt} 200px ${fam}`;
    const tw   = ctx.measureText(text).width;
    const scale = (sz * 0.80) / tw;
    const fs    = Math.min(Math.floor(200 * scale), sz * 0.38);
    ctx.font         = `${wt} ${fs}px ${fam}`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sz / 2, sz / 2);

    const tex = new THREE.CanvasTexture(this._texCanvas);
    this._textMat.uniforms.sampler.value = tex;
  }

  _onResize() {
    const w = this.container.offsetWidth  || window.innerWidth;
    const h = this.container.offsetHeight || window.innerHeight;

    this._renderer.setSize(w, h, true);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._fluidMat.uniforms.aspect.value = w / h;

    /* Size render targets to actual pixel dimensions */
    const pw = this._renderer.domElement.width;
    const ph = this._renderer.domElement.height;
    this._rt0.setSize(pw, ph);
    this._rt1.setSize(pw, ph);
  }

  _onMouse(e) {
    this._target[0] =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._target[1] = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  _tick() {
    const dt = this._clock.getDelta();
    const sp = dt * 5;

    this._mouse[0] += (this._target[0] - this._mouse[0]) * sp;
    this._mouse[1] += (this._target[1] - this._mouse[1]) * sp;

    this._fluidMat.uniforms.mousePos.value.set(this._mouse[0], this._mouse[1]);
    this._fluidMat.uniforms.time.value     = this._clock.getElapsedTime();
    this._fluidMat.uniforms.sampler.value  = this._rt1.texture;

    /* Render to rt0: persistence pass + text */
    this._renderer.setRenderTarget(this._rt0);
    this._renderer.clearColor();
    this._renderer.render(this._fluidScene, this._cam);
    this._renderer.render(this._scene,      this._cam);

    /* Render to screen */
    this._renderer.setRenderTarget(null);
    this._renderer.clearColor();
    this._renderer.render(this._fluidScene, this._cam);
    this._renderer.render(this._scene,      this._cam);

    /* Swap ping-pong */
    const tmp  = this._rt0;
    this._rt0  = this._rt1;
    this._rt1  = tmp;
  }
}
