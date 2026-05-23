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
var textTrail   = null;
var audioPlayer = null;
var cityscape   = null;
var speedLayer  = null;
var currentMode = 'moonlit';
var lastTick    = 0;

function buildRoadOptions(mode) {
  var m = MODES[mode] || MODES.moonlit;
  return {
    onSpeedUp:  function(){},
    onSlowDown: function(){},
    distortion: LongRaceDistortion,

    length:      400,
    roadWidth:   10,
    islandWidth: 2,
    lanesPerRoad:3,

    fov:         90,
    fovSpeedUp:  150,
    speedUp:     2.5,
    carLightsFade: 0.4,

    totalSideLightSticks: 50,
    lightPairsPerRoadWay: 50,

    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage:   0.1,
    brokenLinesLengthPercentage:  0.5,

    lightStickWidth:  [0.12, 0.5],
    lightStickHeight: [1.3,  1.7],

    movingAwaySpeed:   [60,  80],
    movingCloserSpeed: [-120,-160],

    carLightsLength:    [400 * 0.05, 400 * 0.15],
    carLightsRadius:    [0.05, 0.14],
    carWidthPercentage: [0.3,  0.5],
    carShiftX:          [-0.2, 0.2],
    carFloorSeparation: [0.05, 1],

    colors: {
      roadColor:     0x050810,
      islandColor:   0x070a14,
      background:    m.roadBg,
      shoulderLines: 0x141e2c,
      brokenLines:   0x0c1420,
      leftCars:      m.leftCars,
      rightCars:     m.rightCars,
      sticks:        m.sticks,
    },
  };
}

/* ── rAF tick loop ──────────────────────────────────────── */
function rafTick(now) {
  requestAnimationFrame(rafTick);
  var dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 0.016;
  lastTick = now;
  if (cityscape)  cityscape.tick(dt);
  if (speedLayer) speedLayer.tick(dt);
}

/* ── Init ───────────────────────────────────────────────── */
function init() {

  /* Road (InfiniteLights center corridor) */
  var roadEl = document.getElementById('road-bg');
  if (roadEl) {
    try {
      roadApp = new App(roadEl, buildRoadOptions(currentMode));
      roadApp.loadAssets().then(roadApp.init);
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

  /* Cityscape */
  var cityMount = document.getElementById('city-mount');
  if (cityMount && typeof CityScape !== 'undefined') {
    try { cityscape = new CityScape(cityMount); }
    catch(e) { console.warn('CityScape:', e); }
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
    if (roadApp) {
      roadApp.fovTarget     = roadApp.options.fovSpeedUp;
      roadApp.speedUpTarget = roadApp.options.speedUp;
    }
    if (cityscape)  cityscape.setIntensity(1);
    if (speedLayer) speedLayer.setIntensity(1);
  });
  document.addEventListener('nightdrive:musicstop', function() {
    if (roadApp) {
      roadApp.fovTarget     = roadApp.options.fov;
      roadApp.speedUpTarget = 0;
    }
    if (cityscape)  cityscape.setIntensity(0);
    if (speedLayer) speedLayer.setIntensity(0);
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
  var lbl = document.getElementById('mode-label');
  if (lbl) lbl.textContent = m.label;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
