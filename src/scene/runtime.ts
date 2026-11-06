/**
 * Vòng chạy của scene địa điểm: renderer, ánh sáng, bầu trời, nhân vật,
 * camera góc nhìn thứ ba, điều khiển bàn phím / chuột / chạm và va chạm.
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Character } from './character';
import { CollisionWorld } from './collision';
import { buildEnvironment } from './environment';
import { pointInRing, type SiteData, type XZ } from './geo';
import { buildTemplate, type TemplateId, type TemplateResult } from './templates';

export interface SceneOptions {
  container: HTMLElement;
  site: SiteData;
  placeName: string;
  placeKind: string;
  template: TemplateId;
  playerName: string;
  seed: number;
}

const WALK = 3.2;
const RUN = 6.8;
const RADIUS = 0.32;
const HEAD = 1.55;

export class SceneRuntime {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  readonly player: Character;
  readonly collisions = new CollisionWorld();
  readonly template: TemplateResult;
  private occluders: THREE.Object3D[] = [];
  private sun: THREE.DirectionalLight;
  private raycaster = new THREE.Raycaster();
  private timer = new THREE.Timer();
  private raf = 0;
  private disposed = false;
  private resizeObs: ResizeObserver;

  // Trạng thái nhân vật.
  pos: XZ;
  private y = 0;
  private facing: number;
  private speed = 0;
  private target: XZ | null = null;
  private stuckTime = 0;
  private marker: THREE.Mesh;

  // Camera quay quanh nhân vật.
  yaw: number;
  private pitch = 0.32;
  private distance = 7;
  private camDist = 7;

  // Điều khiển.
  private keys = new Set<string>();
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  private removers: (() => void)[] = [];
  private R: number;

  constructor(private opts: SceneOptions) {
    const { container, site } = opts;
    this.R = site.radius;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    // --- Bầu trời & ánh sáng ---
    const sky = new Sky();
    sky.scale.setScalar(5000);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(150));
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(sunDir);
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog('#c9d9e4', 90, site.radius * 2.2);

    this.scene.add(new THREE.HemisphereLight('#dceeff', '#7a6d55', 1.3));
    this.sun = new THREE.DirectionalLight('#fff3df', 2.6);
    this.sun.position.copy(sunDir.clone().multiplyScalar(80));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // --- Công trình chính + môi trường ---
    this.template = buildTemplate(opts.template, {
      name: opts.placeName,
      kind: opts.placeKind,
      site,
      collisions: this.collisions,
      occluders: this.occluders,
      seed: opts.seed,
    });
    this.scene.add(this.template.group);
    this.scene.add(
      buildEnvironment({ site, collisions: this.collisions, occluders: this.occluders, footprint: this.template.footprint, seed: opts.seed }),
    );

    // --- Nhân vật ---
    this.player = new Character(opts.playerName);
    this.scene.add(this.player.root);
    this.pos = this.findFreeSpot([this.template.spawn.x, this.template.spawn.z]);
    this.facing = this.template.spawn.facing;
    this.yaw = this.facing + Math.PI;

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 32),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.syncPlayer(0);
    this.updateCamera(1);
    this.loop();
  }

  /** Tìm chỗ đứng không bị kẹt trong vật cản, quanh điểm mong muốn. */
  private findFreeSpot(p: XZ): XZ {
    if (!this.collisions.blocked(p, RADIUS + 0.1)) return p;
    for (let r = 1; r < 40; r += 1)
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const q: XZ = [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
        if (!this.collisions.blocked(q, RADIUS + 0.1)) return q;
      }
    return p;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- Điều khiển ----------------

  private bindInput() {
    const el = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, o?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, o);
      this.removers.push(() => t.removeEventListener(type, fn as EventListener, o));
    };
    const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    on(window, 'keydown', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (MOVE_KEYS.has(e.code)) {
        this.keys.add(e.code);
        if (!e.code.startsWith('Shift')) this.setTarget(null);
        e.preventDefault();
      }
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());

    on(el, 'pointerdown', (e: PointerEvent) => {
      if (this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    on(el, 'pointermove', (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, -0.15, 1.35);
    });
    const up = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved) this.clickToMove(e);
    };
    on(el, 'pointerup', up);
    on(el, 'pointercancel', () => (this.drag = null));
    on(
      el,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.0012), 1.8, 22);
      },
      { passive: false },
    );
    on(el, 'contextmenu', (e: Event) => e.preventDefault());
  }

  private clickToMove(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.y), hit)) return;
    const p: XZ = [hit.x, hit.z];
    if (Math.hypot(p[0] - this.pos[0], p[1] - this.pos[1]) > 80) return;
    this.setTarget(p);
  }

  private setTarget(p: XZ | null) {
    this.target = p;
    this.stuckTime = 0;
    this.marker.visible = !!p;
    if (p) this.marker.position.set(p[0], this.y + 0.05, p[1]);
  }

  /** Điều khiển bằng nút trên màn hình (điện thoại): hướng theo camera, x phải, y tiến. */
  virtualStick = { x: 0, y: 0, run: false };

  // ---------------- Cập nhật mỗi khung hình ----------------

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private floorAt(p: XZ) {
    let y = 0;
    for (const f of this.template.floors ?? []) if (pointInRing(p, f.ring)) y = Math.max(y, f.y);
    return y;
  }

  update(dt: number) {
    const k = this.keys;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iy = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.virtualStick.x || this.virtualStick.y) {
      ix = this.virtualStick.x;
      iy = this.virtualStick.y;
      run = run || this.virtualStick.run;
      this.setTarget(null);
    }

    // Hướng di chuyển theo camera: "tiến" là hướng camera đang nhìn.
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let mx = fx * iy + -fz * ix;
    let mz = fz * iy + fx * ix;

    if (!ix && !iy && this.target) {
      const dx = this.target[0] - this.pos[0];
      const dz = this.target[1] - this.pos[1];
      const d = Math.hypot(dx, dz);
      if (d < 0.25) this.setTarget(null);
      else {
        mx = dx / d;
        mz = dz / d;
        run = d > 12;
      }
    }

    const len = Math.hypot(mx, mz);
    const want = len > 0.01 ? (run ? RUN : WALK) * Math.min(1, len) : 0;
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 10));

    if (len > 0.01) {
      mx /= len;
      mz /= len;
      // Quay mặt mượt theo hướng đi.
      const targetFacing = Math.atan2(mx, mz);
      let diff = targetFacing - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * (1 - Math.exp(-dt * 14));
    }

    if (this.speed > 0.01 && len > 0.01) {
      const before = this.pos;
      let total = this.speed * dt;
      let p = this.pos;
      // Chia nhỏ bước để không xuyên tường mỏng.
      while (total > 0) {
        const s = Math.min(total, 0.12);
        total -= s;
        p = this.collisions.resolve([p[0] + mx * s, p[1] + mz * s], RADIUS);
      }
      // Giới hạn trong vùng có dữ liệu.
      const r = Math.hypot(p[0], p[1]);
      const lim = this.R - 4;
      if (r > lim) p = [(p[0] / r) * lim, (p[1] / r) * lim];
      this.pos = p;
      // Đi tới điểm đã bấm mà bị kẹt thì dừng.
      if (this.target) {
        const moved = Math.hypot(p[0] - before[0], p[1] - before[1]);
        this.stuckTime = moved < this.speed * dt * 0.25 ? this.stuckTime + dt : 0;
        if (this.stuckTime > 0.5) this.setTarget(null);
      }
    }
    const actual = this.speed;
    this.y += (this.floorAt(this.pos) - this.y) * (1 - Math.exp(-dt * 12));

    this.syncPlayer(dt, actual);
    this.updateCamera(dt);

    // Bóng đổ đi theo nhân vật.
    const sunOff = this.sun.position.clone().sub(this.sun.target.position);
    this.sun.target.position.set(this.pos[0], 0, this.pos[1]);
    this.sun.position.copy(this.sun.target.position).add(sunOff);
    if (this.marker.visible) this.marker.rotation.z += dt * 2;
  }

  private syncPlayer(dt: number, speed = 0) {
    this.player.root.position.set(this.pos[0], this.y, this.pos[1]);
    this.player.root.rotation.y = this.facing;
    this.player.animate(speed, dt);
  }

  private updateCamera(dt: number) {
    const head = new THREE.Vector3(this.pos[0], this.y + HEAD, this.pos[1]);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // Không để camera bị tường/mái che: kéo lại gần nếu có vật cản.
    let d = this.distance;
    this.raycaster.set(head, dir);
    this.raycaster.far = d + 0.3;
    const hit = this.raycaster.intersectObjects(this.occluders, false)[0];
    if (hit) d = Math.max(0.5, hit.distance - 0.3);
    // Không chui xuống đất.
    const minY = 0.3;
    if (head.y + dir.y * d < minY && dir.y < 0) d = Math.max(0.5, (head.y - minY) / -dir.y);
    // Thu gần nhanh, lùi ra chậm.
    const k = d < this.camDist ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 4);
    this.camDist += (d - this.camDist) * (dt >= 1 ? 1 : k);
    this.camera.position.copy(head).addScaledVector(dir, this.camDist);
    this.camera.lookAt(head);
  }

  /** Nhân vật đang ở trong công trình chính không. */
  isInside() {
    return !!this.template.interior && pointInRing(this.pos, this.template.interior);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    for (const r of this.removers) r();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
