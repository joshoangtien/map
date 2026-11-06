/**
 * Nhân vật mặc định dựng bằng khối hình đơn giản (cao ~1.72 m), có dáng đi
 * vung tay chân. Ở MVP 4 sẽ thay bằng nhân vật tuỳ biến (định dạng VRM).
 */
import * as THREE from 'three';
import { textTexture } from './textures';

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export const DEFAULT_LOOK: Look = { skin: '#e8b892', hair: '#1d1714', shirt: '#2f6fb3', pants: '#2c2f3a', shoes: '#f2f2f2' };

export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private armL: THREE.Group;
  private armR: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private phase = 0;

  constructor(name: string, look: Look = DEFAULT_LOOK) {
    const mat = (c: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
    const skin = mat(look.skin, 0.7);
    const shirt = mat(look.shirt);
    const pants = mat(look.pants);
    const shoes = mat(look.shoes, 0.5);
    const hair = mat(look.hair, 0.9);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Chi: nhóm có khớp ở đầu trên để xoay khi bước.
    const limb = (x: number, y: number, upper: THREE.Material, lower: THREE.Material, len: number, r: number, foot?: THREE.Material) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      add(g, new THREE.CapsuleGeometry(r, len * 0.55, 4, 10), upper, 0, -len * 0.35, 0);
      add(g, new THREE.CapsuleGeometry(r * 0.88, len * 0.35, 4, 10), lower, 0, -len * 0.78, 0);
      if (foot) add(g, new THREE.BoxGeometry(r * 2.1, r * 1.1, r * 3.4), foot, 0, -len - 0.02, r * 0.7);
      this.body.add(g);
      return g;
    };

    this.legL = limb(-0.11, 0.86, pants, pants, 0.84, 0.075, shoes);
    this.legR = limb(0.11, 0.86, pants, pants, 0.84, 0.075, shoes);
    // Thân.
    add(this.body, new THREE.CapsuleGeometry(0.19, 0.38, 6, 14), shirt, 0, 1.14, 0).scale.set(1, 1, 0.7);
    add(this.body, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin, 0, 1.44, 0);
    this.armL = limb(-0.25, 1.38, shirt, skin, 0.62, 0.058);
    this.armR = limb(0.25, 1.38, shirt, skin, 0.62, 0.058);
    // Đầu, tóc, mắt.
    const head = add(this.body, new THREE.SphereGeometry(0.13, 24, 18), skin, 0, 1.6, 0);
    head.scale.set(0.92, 1.08, 0.98);
    const h = add(this.body, new THREE.SphereGeometry(0.138, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.62, -0.012);
    h.rotation.x = -0.25;
    const eye = mat('#1a1410', 0.3);
    for (const s of [-1, 1]) add(this.body, new THREE.SphereGeometry(0.016, 10, 8), eye, s * 0.045, 1.615, 0.118);

    this.root.add(this.body);

    // Bảng tên trên đầu (luôn quay về phía camera).
    const { texture, aspect } = textTexture(name, { bg: 'rgba(20,18,15,0.6)', color: '#ffffff', font: '600 56px "Be Vietnam Pro", system-ui, sans-serif', padding: 22 });
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    tag.scale.set(0.26 * aspect, 0.26, 1);
    tag.position.y = 2.0;
    tag.renderOrder = 10;
    this.root.add(tag);
  }

  /** Cập nhật dáng đi theo tốc độ (m/s). */
  animate(speed: number, dt: number) {
    const moving = speed > 0.1;
    this.phase += dt * (moving ? 2.2 + speed * 1.6 : 0);
    const amp = moving ? Math.min(0.75, 0.25 + speed * 0.11) : 0;
    const k = 1 - Math.exp(-dt * 12);
    const swing = Math.sin(this.phase) * amp;
    this.legL.rotation.x += (swing - this.legL.rotation.x) * k;
    this.legR.rotation.x += (-swing - this.legR.rotation.x) * k;
    this.armL.rotation.x += (-swing * 0.8 - this.armL.rotation.x) * k;
    this.armR.rotation.x += (swing * 0.8 - this.armR.rotation.x) * k;
    // Nhún nhẹ khi bước, thở nhẹ khi đứng.
    const bob = moving ? Math.abs(Math.cos(this.phase)) * 0.04 * amp : Math.sin(performance.now() / 700) * 0.006;
    this.body.position.y = bob;
  }
}
