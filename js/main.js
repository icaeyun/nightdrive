/* main.js — nightdrive app init and mode coordination */

var MODES = {
  moonlit: {
    label:    'Moonlit Coast',
    glowRGB:  '10, 25, 52',
    trailCol: [0.70, 0.88, 1.00],
    roadBg:   0x020408,
    leftCars: [0xff3820, 0xd02010, 0xff2a14],
    rightCars:[0xa8c8e8, 0x88acd0, 0x6890b8],
    sticks:   0x2a5070,
    speedMod: 1.0,
  },
  metropolis: {
    label:    'Metropolis Glow',
    glowRGB:  '22, 8, 60',
    trailCol: [0.78, 0.60, 1.00],
    roadBg:   0x030108,
    leftCars: [0xff2820, 0xd01810, 0xff1a10],
    rightCars:[0x9060d8, 0x7050c0, 0x5040a8],
    sticks:   0x3a186a,
    speedMod: 1.25,
  },
  cyber: {
    label:    'Cyber Harbor',
    glowRGB:  '4, 16, 42',
    trailCol: [0.55, 0.82, 1.00],
    roadBg:   0x010305,
    leftCars: [0xff1818, 0xcc1010, 0xff0e0e],
    rightCars:[0x2868d8, 0x1850b8, 0x0c3a9a],
    sticks:   0x0e2a50,
    speedMod: 1.55,
  },
  midnight: {
    label:    'After Midnight',
    glowRGB:  '4, 8, 18',
    trailCol: [0.52, 0.68, 0.88],
    roadBg:   0x010204,
    leftCars: [0xaa1808, 0x880e06, 0xbb1a0a],
    rightCars:[0x485868, 0x384858, 0x283848],
    sticks:   0x0a1422,
    speedMod: 0.55,
  },
};

var roadApp     = null;
var incomingRoadApp = null;
var textTrail   = null;
var audioPlayer = null;
var cityscape   = null;
var metropolisBg = null;
var synthCityBg  = null;
var aquaCityBg   = null;
var speedLayer  = null;
var currentMode = 'moonlit';
var lastTick    = 0;
var roadMotionActive = false;
var roadSwitchToken = 0;

var ROAD_PRESETS = {
  moonlit: {
    distortion: function() { return LongRaceDistortion; },
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 3,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2.5,
    carLightsFade: 0.4,
    totalSideLightSticks: 50,
    lightPairsPerRoadWay: 50,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.05, 400 * 0.15],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.2, 0.2],
    carFloorSeparation: [0.05, 1],
    colors: {
      roadColor: 0x050810,
      islandColor: 0x070a14,
      background: 0x020408,
      shoulderLines: 0x141e2c,
      brokenLines: 0x0c1420,
      leftCars: [0xff3820, 0xd02010, 0xff2a14],
      rightCars: [0xa8c8e8, 0x88acd0, 0x6890b8],
      sticks: 0x2a5070,
    },
  },
  metropolis: {
    distortion: function() { return LongRaceDistortion; },
    length: 400,
    roadWidth: 10,
    islandWidth: 5,
    lanesPerRoad: 2,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 50,
    lightPairsPerRoadWay: 70,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.05, 400 * 0.15],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.2, 0.2],
    carFloorSeparation: [0.05, 1],
    colors: {
      roadColor: 0x080808,
      islandColor: 0x0a0a0a,
      background: 0x000000,
      shoulderLines: 0x131318,
      brokenLines: 0x131318,
      leftCars: [0xFF5F73, 0xE74D60, 0xff102a],
      rightCars: [0xA4E3E6, 0x80D1D4, 0x53C2C6],
      sticks: 0xA4E3E6,
    },
  },
  cyber: {
    distortion: function() { return turbulentDistortion; },
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 3,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 20,
    lightPairsPerRoadWay: 40,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.03, 400 * 0.2],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.8, 0.8],
    carFloorSeparation: [0, 5],
    colors: {
      roadColor: 0x080808,
      islandColor: 0x0a0a0a,
      background: 0x000000,
      shoulderLines: 0x131318,
      brokenLines: 0x131318,
      leftCars: [0xD856BF, 0x6750A2, 0xC247AC],
      rightCars: [0x03B3C3, 0x0E5EA5, 0x324555],
      sticks: 0x03B3C3,
    },
  },
  midnight: {
    distortion: function() { return deepDistortion; },
    length: 400,
    roadWidth: 9,
    islandWidth: 2,
    lanesPerRoad: 3,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 50,
    lightPairsPerRoadWay: 50,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.05, 400 * 0.15],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.2, 0.2],
    carFloorSeparation: [0.05, 1],
    colors: {
      roadColor: 0x080808,
      islandColor: 0x0a0a0a,
      background: 0x000000,
      shoulderLines: 0x131318,
      brokenLines: 0x131318,
      leftCars: [0xE2173C, 0x841010, 0xF23D3D],
      rightCars: [0xffffff, 0x7686BF, 0x1338B5],
      sticks: 0xDCE0EE,
    },
  },
};

function buildRoadOptions(mode) {
  var preset = ROAD_PRESETS[mode] || ROAD_PRESETS.moonlit;
  var options = {
    onSpeedUp: function(){},
    onSlowDown: function(){},
    distortion: preset.distortion(),
  };
  Object.keys(preset).forEach(function(key) {
    if (key !== 'distortion') options[key] = preset[key];
  });
  return options;
}

function setRoadCanvasState(app, active) {
  if (!app || !app.renderer) return;
  var canvas = app.renderer.domElement;
  canvas.style.opacity = active ? '1' : '0';
  canvas.style.pointerEvents = active ? 'auto' : 'none';
}

function applyRoadMotion(app) {
  if (!app) return;
  app.fovTarget = roadMotionActive ? app.options.fovSpeedUp : app.options.fov;
  app.speedUpTarget = roadMotionActive ? app.options.speedUp : 0;
}

function setRoadMotion(active) {
  roadMotionActive = active;
  applyRoadMotion(roadApp);
  applyRoadMotion(incomingRoadApp);
}

function createRoadApp(mode, roadEl, active) {
  var app = new App(roadEl, buildRoadOptions(mode));
  app.renderer.domElement.className = 'road-canvas road-canvas--' + mode;
  setRoadCanvasState(app, active);
  app.ready = app.loadAssets().then(function() {
    app.init();
    applyRoadMotion(app);
    setRoadCanvasState(app, active);
    return app;
  });
  return app;
}

function removeRoadApp(app) {
  if (!app) return;
  app.dispose();
  if (app.renderer && app.renderer.domElement && app.renderer.domElement.parentNode) {
    app.renderer.domElement.parentNode.removeChild(app.renderer.domElement);
  }
}

function switchRoadMode(mode) {
  var roadEl = document.getElementById('road-bg');
  if (!roadEl || !ROAD_PRESETS[mode]) return;

  roadSwitchToken += 1;
  var token = roadSwitchToken;

  if (incomingRoadApp) {
    removeRoadApp(incomingRoadApp);
    incomingRoadApp = null;
  }

  var nextApp = createRoadApp(mode, roadEl, false);
  incomingRoadApp = nextApp;

  nextApp.ready.then(function(nextApp) {
    if (token !== roadSwitchToken) {
      removeRoadApp(nextApp);
      return;
    }

    var previousApp = roadApp;
    incomingRoadApp = null;
    roadApp = nextApp;
    setRoadCanvasState(nextApp, true);
    setRoadCanvasState(previousApp, false);

    setTimeout(function() {
      if (previousApp !== roadApp) removeRoadApp(previousApp);
    }, 820);
  }).catch(function(e) {
    console.warn('InfiniteLights mode switch:', e);
  });
}

/* ── rAF tick loop ──────────────────────────────────────── */
function rafTick(now) {
  requestAnimationFrame(rafTick);
  var dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 0.016;
  lastTick = now;
  if (currentMode === 'cyber') {
    if (synthCityBg) synthCityBg.tick(dt);
  } else if (currentMode === 'metropolis') {
    if (metropolisBg) metropolisBg.tick(dt);
  } else if (currentMode === 'midnight') {
    if (aquaCityBg) aquaCityBg.tick(dt);
  } else {
    if (cityscape) cityscape.tick(dt);
  }
  if (speedLayer) speedLayer.tick(dt);
}

/* ── Init ───────────────────────────────────────────────── */
function init() {

  /* Road (InfiniteLights center corridor) */
  var roadEl = document.getElementById('road-bg');
  if (roadEl) {
    try {
      var initialMode = currentMode;
      var initialRoadApp = createRoadApp(initialMode, roadEl, true);
      initialRoadApp.ready.then(function(app) {
        if (currentMode !== initialMode) {
          removeRoadApp(app);
          return;
        }
        roadApp = app;
      });
    } catch(e) { console.warn('InfiniteLights:', e); }
  }

  /* Text trail */
  var trailWrap = document.getElementById('text-trail-wrap');
  if (trailWrap && typeof THREE !== 'undefined') {
    try {
      textTrail = new TextTrail(trailWrap, {
        text:  'nightdrive',
        color: MODES[currentMode].trailCol,
      });
    } catch(e) { console.warn('TextTrail:', e); }
  }

  /* Cityscape (modes 1, 2, 4) */
  var cityMount = document.getElementById('city-mount');
  if (cityMount && typeof CityScape !== 'undefined') {
    try { cityscape = new CityScape(cityMount); }
    catch(e) { console.warn('CityScape:', e); }
  }

  /* MetropolisBg (mode 2 — Metropolis Glow) */
  if (cityMount && typeof MetropolisBg !== 'undefined') {
    try { metropolisBg = new MetropolisBg(cityMount); }
    catch(e) { console.warn('MetropolisBg:', e); }
  }

  /* SynthCity background (mode 3 — Cyber Harbor) */
  if (cityMount && typeof SynthCityBg !== 'undefined') {
    try { synthCityBg = new SynthCityBg(cityMount); }
    catch(e) { console.warn('SynthCityBg:', e); }
  }

  /* AquaCityBg (mode 4 — After Midnight) */
  if (cityMount && typeof AquaCityBg !== 'undefined') {
    try { aquaCityBg = new AquaCityBg(cityMount); }
    catch(e) { console.warn('AquaCityBg:', e); }
  }

  /* Speed overlay */
  var speedMount = document.getElementById('speed-layer-mount');
  if (speedMount && typeof SpeedLayer !== 'undefined') {
    try { speedLayer = new SpeedLayer(speedMount); }
    catch(e) { console.warn('SpeedLayer:', e); }
  }

  /* Audio */
  var musicBtn = document.getElementById('music-btn');
  if (musicBtn) audioPlayer = new AudioPlayer(musicBtn);

  /* Mode buttons */
  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setMode(btn.dataset.mode);
      document.querySelectorAll('.mode-btn').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  /* Music events → road + city acceleration */
  document.addEventListener('nightdrive:musicstart', function() {
    setRoadMotion(true);
    if (currentMode === 'cyber'       && synthCityBg)  synthCityBg.setIntensity(1);
    else if (currentMode === 'metropolis' && metropolisBg) metropolisBg.setIntensity(1);
    else if (currentMode === 'midnight'   && aquaCityBg)   aquaCityBg.setIntensity(1);
    else if (cityscape) cityscape.setIntensity(1);
    if (speedLayer) speedLayer.setIntensity(1);
  });
  document.addEventListener('nightdrive:musicstop', function() {
    setRoadMotion(false);
    if (synthCityBg)  synthCityBg.setIntensity(0);
    if (metropolisBg) metropolisBg.setIntensity(0);
    if (aquaCityBg)   aquaCityBg.setIntensity(0);
    if (cityscape)    cityscape.setIntensity(0);
    if (speedLayer)   speedLayer.setIntensity(0);
  });

  /* Loading veil */
  var veil = document.querySelector('.loading-veil');
  if (veil) {
    setTimeout(function() { veil.classList.add('fade-out'); }, 900);
    setTimeout(function() { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 2900);
  }

  document.documentElement.style.setProperty('--c-glow-rgb', MODES[currentMode].glowRGB);

  requestAnimationFrame(rafTick);
}

/* ── Set mode ───────────────────────────────────────────── */
function setMode(mode) {
  if (!MODES[mode]) return;
  currentMode = mode;
  var m = MODES[mode];

  if (textTrail) textTrail.setColor(m.trailCol[0], m.trailCol[1], m.trailCol[2]);
  document.documentElement.style.setProperty('--c-glow-rgb', m.glowRGB);
  switchRoadMode(mode);

  /* Swap city backgrounds */
  var csEl = cityscape && cityscape._ren && cityscape._ren.domElement;
  if (mode === 'cyber') {
    if (csEl) csEl.style.opacity = '0';
    if (metropolisBg) metropolisBg.hide();
    if (synthCityBg)  synthCityBg.show();
    if (aquaCityBg)   aquaCityBg.hide();
  } else if (mode === 'metropolis') {
    if (csEl) csEl.style.opacity = '0';
    if (metropolisBg) metropolisBg.show();
    if (synthCityBg)  synthCityBg.hide();
    if (aquaCityBg)   aquaCityBg.hide();
  } else if (mode === 'midnight') {
    if (csEl) csEl.style.opacity = '0';
    if (metropolisBg) metropolisBg.hide();
    if (synthCityBg)  synthCityBg.hide();
    if (aquaCityBg)   aquaCityBg.show();
  } else {
    if (csEl) csEl.style.opacity = '1';
    if (metropolisBg) metropolisBg.hide();
    if (synthCityBg)  synthCityBg.hide();
    if (aquaCityBg)   aquaCityBg.hide();
  }

  var lbl = document.getElementById('mode-label');
  if (lbl) lbl.textContent = m.label;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
