/* ============================================================
   ИМПЕРИЯ АВТО — 3D-шоурум на three.js (r150, глобальный THREE)
   Процедурные автомобили VOYAH FREE / LI AUTO L9 /
   VOYAH ZHUIGUANG / VOYAH DREAM, зеркальный пол, студийный свет.
   ============================================================ */
(function () {
'use strict';

const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOutCubic = t => 1 - Math.pow(1 - clamp01(t), 3);
const easeInCubic = t => Math.pow(clamp01(t), 3);

/* ---------- текстуры-градиенты (canvas) ---------- */
function radialTex(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------- студийное окружение (для отражений лака) ---------- */
function buildEnvScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x020204);
  const panel = (w, h, col, k, x, y, z, rx, ry) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    s.add(m);
  };
  panel(12, 5, 0xffffff, 7.0, 0, 9, 0, Math.PI / 2, 0);      // верхний софтбокс
  panel(7, 12, 0xdfe8ff, 3.2, -11, 3.5, 0, 0, Math.PI / 2);  // холодная левая
  panel(7, 12, 0xffe3c2, 1.9, 11, 3, 0, 0, -Math.PI / 2);    // тёплая правая
  panel(16, 6, 0xffffff, 0.75, 0, 4, -14, 0, 0);             // задняя
  panel(40, 40, 0x101017, 1, 0, -2, 0, -Math.PI / 2, 0);     // пол
  return s;
}

/* ---------- силуэты кузовов ---------- */
function archTo(path, cx, p) {
  const archR = p.wheelR + 0.085;
  const dy = p.ride - p.wheelR;
  const dx = Math.sqrt(Math.max(archR * archR - dy * dy, 0.02));
  const th = Math.asin(dy / archR);
  path.lineTo(cx - dx, p.ride);
  path.absarc(cx, p.wheelR, archR, Math.PI - th, th, true);
}

function bodyShape(p) {
  const hf = p.L / 2;
  const s = new THREE.Shape();
  s.moveTo(hf - 0.14, p.ride);
  s.quadraticCurveTo(hf + 0.03, (p.ride + p.noseY) * 0.5, hf, p.noseY);
  s.quadraticCurveTo(hf - 0.5, p.hoodY + 0.05, p.cowlX, p.hoodY);
  s.quadraticCurveTo(p.wsTopX - 0.4, p.wsTopY + 0.01, p.wsTopX, p.wsTopY);
  s.quadraticCurveTo((p.wsTopX + p.roofEndX) / 2, p.roofY + 0.035, p.roofEndX, p.roofY);
  s.quadraticCurveTo(p.roofEndX - 0.62, p.deckY + 0.16, -hf + 0.36, p.deckY);
  s.quadraticCurveTo(-hf - 0.02, (p.deckY + p.ride) * 0.5 + 0.07, -hf + 0.04, p.ride + 0.02);
  archTo(s, p.xR, p);
  archTo(s, p.xF, p);
  s.closePath();
  return s;
}

function glassShape(p) {
  const belt = p.beltY;
  const s = new THREE.Shape();
  s.moveTo(p.cowlX - 0.08, belt);
  s.quadraticCurveTo(p.wsTopX - 0.42, p.wsTopY, p.wsTopX - 0.05, p.wsTopY - 0.025);
  s.quadraticCurveTo((p.wsTopX + p.roofEndX) / 2, p.roofY + 0.005, p.roofEndX + 0.07, p.roofY - 0.025);
  s.quadraticCurveTo(p.roofEndX - 0.55, belt + 0.2, -p.L / 2 + 0.52, belt);
  s.lineTo(p.cowlX - 0.08, belt);
  return s;
}

/* ---------- колесо ---------- */
function buildWheel(R, mats) {
  const w = new THREE.Group();
  w.name = 'wheelSpin';
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 28), mats.tire);
  tire.rotation.x = Math.PI / 2;
  w.add(tire);
  const rimR = R * 0.66;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.305, 24), mats.rim);
  rim.rotation.x = Math.PI / 2;
  w.add(rim);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(rimR * 1.9, 0.09, 0.31), mats.rim);
    sp.rotation.z = (i / 5) * Math.PI * 2;
    w.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 12), mats.rim);
  hub.rotation.x = Math.PI / 2;
  w.add(hub);
  return w;
}

/* ---------- сборка автомобиля ---------- */
function buildCar(spec, glowTex) {
  const mats = {
    body: new THREE.MeshPhysicalMaterial({
      color: spec.paint, metalness: 0.72, roughness: 0.3,
      clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.2
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0a0e14, metalness: 0.15, roughness: 0.06,
      envMapIntensity: 1.9, transparent: true, opacity: 0.94
    }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0d0d10, metalness: 0.5, roughness: 0.5 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.28 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.4), toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.28, 0.22), toneMapped: false })
  };
  mats.body.userData.paint = true;

  const grp = new THREE.Group();
  const body = new THREE.Group();
  grp.add(body);
  const W = spec.W;
  const bevel = 0.04;
  const depth = W - bevel * 2;

  const bodyMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bodyShape(spec), {
      depth: depth, curveSegments: 26, bevelEnabled: true,
      bevelThickness: bevel, bevelSize: 0.035, bevelSegments: 5
    }),
    mats.body
  );
  bodyMesh.position.z = -depth / 2;
  body.add(bodyMesh);

  const glassMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(glassShape(spec), {
      depth: W + 0.012, curveSegments: 22, bevelEnabled: true,
      bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2
    }),
    mats.glass
  );
  glassMesh.position.z = -(W + 0.012) / 2;
  glassMesh.renderOrder = 2;
  body.add(glassMesh);

  // нижняя линия порога — зрительно приземляет кузов
  const rocker = new THREE.Mesh(
    new THREE.BoxGeometry(spec.L - 1.15, 0.1, W - 0.05), mats.trim
  );
  rocker.position.set(0, spec.ride + 0.045, 0);
  body.add(rocker);

  // зеркала
  [-1, 1].forEach(function (sz) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.05), mats.body);
    pod.position.set(spec.cowlX - 0.1, spec.hoodY + 0.13, sz * (W / 2 + 0.035));
    pod.rotation.y = sz * 0.22;
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.024, 0.09), mats.trim);
    stalk.position.set(spec.cowlX - 0.1, spec.hoodY + 0.1, sz * (W / 2 + 0.005));
    body.add(pod, stalk);
  });

  // световые полосы
  const barY = spec.noseY + 0.13;
  const headBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, W - 0.46), mats.head);
  headBar.position.set(spec.L / 2 + 0.01, barY, 0);
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, W - 0.4), mats.tail);
  tailBar.position.set(-spec.L / 2 - 0.01, spec.deckY - 0.13, 0);
  headBar.renderOrder = 3; tailBar.renderOrder = 3;
  body.add(headBar, tailBar);

  // гало вокруг фонарей
  function mkHalo(col, sc) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: col, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.set(sc, sc * 0.5, 1);
    sp.renderOrder = 3;
    return sp;
  }
  const hHalo = mkHalo(0xfff4dc, 2.0); hHalo.position.copy(headBar.position); hHalo.scale.set(2.0, 0.7, 1);
  const tHalo = mkHalo(0xff2a1e, 2.6); tHalo.position.copy(tailBar.position); tHalo.scale.set(2.8, 0.6, 1);
  body.add(hHalo, tHalo);

  // конусы света фар
  const cones = [];
  [-1, 1].forEach(function (sz) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 3.6, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2d8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    cone.rotation.order = 'ZYX';
    cone.rotation.z = -Math.PI / 2;
    cone.rotation.y = sz * 0.06;
    cone.position.set(spec.L / 2 + 1.9, barY, sz * (W / 2 - 0.55));
    cone.visible = false;
    cone.renderOrder = 6;
    cones.push(cone);
    body.add(cone);
  });

  // колёса
  const wheels = [];
  [[spec.xF, 1], [spec.xF, -1], [spec.xR, 1], [spec.xR, -1]].forEach(function (pair) {
    const w = buildWheel(pair[0] === spec.xF ? spec.wheelR : spec.wheelR, mats);
    w.position.set(pair[0], spec.wheelR, pair[1] * (W / 2 - 0.13));
    wheels.push(w);
    body.add(w);
  });

  /* ---- зеркальное отражение на полу ---- */
  const mirror = body.clone(true);
  const paintMats = [mats.body];
  const mWheels = [];
  mirror.traverse(function (o) {
    if (o.isMesh || o.isSprite) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = (o.material.opacity === undefined ? 1 : o.material.opacity) * 0.5;
      o.material.depthWrite = false;
      o.material.side = THREE.DoubleSide;
      o.renderOrder = -1;
      if (o.material.userData && o.material.userData.paint) paintMats.push(o.material);
    }
    if (o.name === 'wheelSpin') mWheels.push(o);
  });
  mirror.scale.y = -1;
  grp.add(mirror);

  /* ---- тень и подсветка под кузовом (не отражаются) ---- */
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.L * 1.25, W * 1.7),
    new THREE.MeshBasicMaterial({
      map: radialTex(256, [[0, 'rgba(0,0,0,0.85)'], [0.55, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true, opacity: 0.5, depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.renderOrder = 5;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.L + 0.9, W + 1.1),
    new THREE.MeshBasicMaterial({
      map: glowTex, color: spec.accent, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.011;
  glow.renderOrder = 4;
  grp.add(shadow, glow);

  return {
    grp: grp, body: body, wheels: wheels, mWheels: mWheels, cones: cones,
    paintMats: paintMats, glow: glow, spec: spec,
    prevX: 0, vx: 0, pitch: 0, settle: 0, wasMoving: false, paintTgt: null, lastDir: 1
  };
}

/* ---------- модели ---------- */
const SPECS = [
  { id: 'free', L: 4.9, W: 1.98, ride: 0.25, wheelR: 0.37, xF: 1.5, xR: -1.46,
    noseY: 0.6, hoodY: 0.86, cowlX: 0.92, wsTopX: 0.4, wsTopY: 1.27,
    roofEndX: -0.82, roofY: 1.4, deckY: 1.0, beltY: 0.87,
    paint: 0xa86032, accent: 0xd99a62 },
  { id: 'l9', L: 5.2, W: 2.0, ride: 0.27, wheelR: 0.39, xF: 1.58, xR: -1.55,
    noseY: 0.72, hoodY: 0.97, cowlX: 1.02, wsTopX: 0.52, wsTopY: 1.42,
    roofEndX: -1.62, roofY: 1.56, deckY: 1.34, beltY: 0.98,
    paint: 0xdfe3e6, accent: 0x86c5e8 },
  { id: 'zh', L: 5.0, W: 1.92, ride: 0.21, wheelR: 0.355, xF: 1.42, xR: -1.42,
    noseY: 0.54, hoodY: 0.77, cowlX: 0.85, wsTopX: 0.3, wsTopY: 1.16,
    roofEndX: -0.55, roofY: 1.24, deckY: 0.92, beltY: 0.79,
    paint: 0x7a1420, accent: 0xe2505a },
  { id: 'dr', L: 5.32, W: 1.98, ride: 0.27, wheelR: 0.385, xF: 1.48, xR: -1.72,
    noseY: 0.78, hoodY: 1.03, cowlX: 1.22, wsTopX: 0.9, wsTopY: 1.56,
    roofEndX: -2.14, roofY: 1.68, deckY: 1.5, beltY: 1.05,
    paint: 0x17233f, accent: 0x808ff2 }
];

const POSES = [
  { az: 0.62, el: 0.26, r: 8.0, ty: 0.6, ox: -1.05 },
  { az: 2.58, el: 0.27, r: 8.6, ty: 0.68, ox: 1.05 },
  { az: 5.8, el: 0.13, r: 7.3, ty: 0.55, ox: 0 },
  { az: 7.25, el: 0.33, r: 9.0, ty: 0.78, ox: 0.95 }
];
const POSE_OUT = { az: 7.85, el: 0.46, r: 12.6, ty: 0.92, ox: 0 };

/* ============================================================
   ШОУРУМ
   ============================================================ */
class Showroom {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060609);
    this.scene.fog = new THREE.FogExp2(0x060609, 0.05);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 130);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(buildEnvScene(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 7, 3);
    this.rim = new THREE.DirectionalLight(0xd99a62, 1.1);
    this.rim.position.set(-6, 3, -6);
    this.scene.add(key, this.rim, new THREE.AmbientLight(0x3c3c46, 0.55));

    this.glowTex = radialTex(128, [
      [0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']
    ]);

    this.buildStage();

    this.cars = SPECS.map(spec => {
      const car = buildCar(spec, this.glowTex);
      car.grp.position.x = -16;
      car.grp.visible = false;
      this.scene.add(car.grp);
      return car;
    });

    this.streaks = [];
    const stGeo = new THREE.PlaneGeometry(2.6, 0.05);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(stGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      m.visible = false;
      m.renderOrder = 7;
      m.userData.seed = Math.random();
      this.streaks.push(m);
      this.scene.add(m);
    }

    this.pointer = { x: 0, y: 0, tx: 0, ty: 0, lastMove: -10 };
    this.introV = 0;
    this.introOn = false;
    this.reduced = false;
    this.fovCur = 38;
    this.accCol = new THREE.Color(0xd99a62);
    this.tmpCol = new THREE.Color();
    this.time = 0;
    this.fitScale = 1;
    this.baseFov = 38;
  }

  buildStage() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(70, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0a0a0e, roughness: 0.5, metalness: 0.3,
        envMapIntensity: 0.32, transparent: true, opacity: 0.76
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 0;
    this.scene.add(floor);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.75, 3.75, 0.012, 72),
      new THREE.MeshStandardMaterial({ color: 0x0e0e13, roughness: 0.42, metalness: 0.5, envMapIntensity: 0.32 })
    );
    disc.position.y = 0.006;
    this.scene.add(disc);

    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xd99a62, toneMapped: false, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.73, 0.016, 8, 110), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.renderOrder = 1;
    this.ring = ring;
    this.scene.add(ring);

    [5.4, 8.7].forEach(function (r) {
      const rg = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.028, 96),
        new THREE.MeshBasicMaterial({ color: 0x33333e, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      rg.rotation.x = -Math.PI / 2;
      rg.position.y = 0.007;
      rg.renderOrder = 1;
      this.scene.add(rg);
    }.bind(this));

    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.45, 1.38), toneMapped: false });
    [-6, -2, 2, 6].forEach(x => {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 34), stripMat);
      st.position.set(x, 7.6, 0);
      this.scene.add(st);
    });
  }

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(Math.min(dpr, 1.75));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fitScale = this.camera.aspect < 1.15
      ? Math.min(2.15, 1.18 / this.camera.aspect + 0.2)
      : 1;
    this.baseFov = this.camera.aspect < 0.8 ? 46 : (this.camera.aspect < 1.15 ? 42 : 38);
    this.camera.updateProjectionMatrix();
  }

  setPointer(nx, ny) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
    this.pointer.lastMove = this.time;
  }

  setPaint(i, hex) { this.cars[i].paintTgt = new THREE.Color(hex); }
  setReduced(b) { this.reduced = b; }
  intro() {
    if (this.introV >= 1) return;
    this.introOn = true;
    this.introT0 = performance.now();
  }
  introSkip() { this.introV = 1; this.introOn = false; }

  carX(uPrev, uNext) {
    let x = -16 * (1 - easeOutCubic((clamp01((uPrev - 0.3) / 0.7))));
    if (uNext != null) x += 16 * easeInCubic(clamp01(uNext / 0.66));
    return x;
  }

  tick(dt, sy, tops, vh, outroTop) {
    this.time += dt;
    const t = this.time;

    const u = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const span = Math.max(tops[i + 1] - tops[i], 1);
      u[i] = clamp01((sy - tops[i]) / span);
    }
    const uOut = clamp01((sy - outroTop) / (vh * 0.92));

    if (this.introOn) {
      // по настенным часам: устойчиво к замороженному rAF
      this.introV = Math.min(1, (performance.now() - this.introT0) / 1700);
      if (this.introV >= 1) this.introOn = false;
    }

    let act = 0;
    for (let i = 0; i < 4; i++) if (sy >= tops[i] - 1) act = i;

    /* --- автомобили --- */
    let maxSpd = 0;
    this.cars.forEach((car, i) => {
      const uPrev = i === 0 ? this.introV : u[i - 1];
      const uNext = i < 3 ? u[i] : uOut;
      const x = this.carX(uPrev, uNext);
      const dx = x - car.prevX;
      car.prevX = x;
      if (Math.abs(dx) > 1e-6) car.lastDir = Math.sign(dx);
      car.grp.position.x = x;
      car.grp.visible = Math.abs(x) < 15.9;

      const spd = Math.abs(dx) / Math.max(dt, 1e-4);
      car.vx = lerp(car.vx, spd, 0.3);
      const moving = spd > 0.4;
      if (car.wasMoving && !moving) car.settle = 1;
      car.wasMoving = moving;
      if (car.settle > 0) {
        car.settle = Math.max(0, car.settle - dt * 1.8);
        const st = 1 - car.settle;
        car.grp.position.y = Math.sin(st * 16) * 0.028 * car.settle * car.settle;
        car.body.rotation.x = Math.sin(st * 13) * 0.012 * car.settle * car.settle;
      } else {
        car.grp.position.y = 0;
        car.body.rotation.x = 0;
      }

      const dir = Math.sign(dx) || 1;
      car.pitch = lerp(car.pitch, Math.min(car.vx * 0.009, 0.05) * dir, 0.12);
      car.body.rotation.z = this.reduced ? 0 : car.pitch;

      const rot = dx / car.spec.wheelR;
      car.wheels.forEach(w => { w.rotation.z -= rot; });
      car.mWheels.forEach((w, k) => { if (car.wheels[k]) w.rotation.z = car.wheels[k].rotation.z; });

      const coneOp = this.reduced ? 0 : Math.min(car.vx / 9, 1) * 0.15;
      car.cones.forEach(c => {
        c.visible = coneOp > 0.004;
        c.material.opacity = coneOp;
      });

      if (car.paintTgt) car.paintMats.forEach(m => m.color.lerp(car.paintTgt, 0.09));

      maxSpd = Math.max(maxSpd, car.vx);
    });

    /* --- акцент сцены --- */
    this.accCol.setHex(SPECS[0].accent);
    for (let i = 0; i < 3; i++) this.accCol.lerp(this.tmpCol.setHex(SPECS[i + 1].accent), smooth(u[i]));
    this.accCol.lerp(this.tmpCol.setHex(0xd8b077), smooth(uOut) * 0.8);
    this.ringMat.color.copy(this.accCol);
    this.rim.color.copy(this.accCol);
    this.ring.scale.setScalar(1 + Math.sin(t * 1.4) * 0.012);
    this.ringMat.opacity = 0.55 + Math.sin(t * 1.4) * 0.2;

    /* --- полосы скорости --- */
    const showStreaks = !this.reduced && maxSpd > 1.4;
    if (showStreaks) {
      let mc = null, best = 1e9;
      this.cars.forEach(c => {
        if (!c.grp.visible) return;
        const d = Math.abs(c.grp.position.x);
        if (c.vx > 1 && d < best) { best = d; mc = c; }
      });
      const dirFinal = (mc && mc.lastDir) || 1;
      this.streaks.forEach((s, i) => {
        const seed = s.userData.seed;
        const cx = mc ? mc.grp.position.x - dirFinal * (0.9 + seed * 3.4) : 0;
        s.position.set(
          cx - dirFinal * ((t * (2 + seed * 5)) % 4),
          0.25 + seed * 2.1,
          ((seed * 13.7 + i * 2.3) % 11) - 5.5
        );
        s.material.opacity = Math.min(maxSpd / 10, 1) * (0.12 + seed * 0.3) * (0.6 + 0.4 * Math.sin(t * 9 + seed * 20));
        s.material.color.copy(this.accCol).lerp(this.tmpCol.setHex(0xffffff), 0.55);
        s.scale.x = 0.7 + Math.min(maxSpd / 8, 1) * 1.6;
        s.visible = s.material.opacity > 0.01;
      });
    } else {
      this.streaks.forEach(s => { s.visible = false; });
    }

    /* --- камера --- */
    const mixPose = (a, b, k) => ({
      az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k),
      r: lerp(a.r, b.r, k), ty: lerp(a.ty, b.ty, k), ox: lerp(a.ox, b.ox, k)
    });
    let pose = POSES[0];
    for (let i = 0; i < 3; i++) pose = mixPose(pose, POSES[i + 1], smooth(u[i]));
    pose = mixPose(pose, POSE_OUT, smooth(uOut));

    if (t - this.pointer.lastMove > 4 && !this.reduced) {
      this.pointer.tx = Math.sin(t * 0.28) * 0.5;
      this.pointer.ty = Math.cos(t * 0.2) * 0.25;
    }
    this.pointer.x = lerp(this.pointer.x, this.pointer.tx, 0.055);
    this.pointer.y = lerp(this.pointer.y, this.pointer.ty, 0.055);

    const az = pose.az + this.pointer.x * 0.44;
    const el = Math.max(0.05, Math.min(0.95, pose.el - this.pointer.y * 0.17));
    const r = pose.r * this.fitScale;
    this.camera.position.set(
      r * Math.cos(el) * Math.cos(az),
      pose.ty + r * Math.sin(el),
      r * Math.cos(el) * Math.sin(az)
    );
    this.camera.lookAt(pose.ox + this.pointer.x * 0.35, pose.ty - this.pointer.y * 0.12, 0);

    const fovT = this.baseFov + Math.min(maxSpd / 12, 1) * 7;
    if (Math.abs(this.fovCur - fovT) > 0.02) {
      this.fovCur = lerp(this.fovCur, fovT, 0.1);
      this.camera.fov = this.fovCur;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.render(this.scene, this.camera);
    return act;
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
    this.envTex.dispose();
    this.renderer.dispose();
  }
}

window.ImperiaShowroom = Showroom;
})();
