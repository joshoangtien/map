import type * as THREE from 'three';
import type { CollisionWorld } from '../collision';
import type { SiteData, XZ } from '../geo';

export interface TemplateInput {
  name: string;
  kind: string;
  site: SiteData;
  collisions: CollisionWorld;
  occluders: THREE.Object3D[];
  seed: number;
}

export interface TemplateResult {
  group: THREE.Group;
  /** Điểm xuất hiện của nhân vật và hướng nhìn (radian, quanh trục đứng). */
  spawn: { x: number; z: number; facing: number };
  /** Vùng công trình chiếm chỗ (toạ độ scene): nhà xung quanh và cây trong vùng này sẽ bị bỏ. */
  footprint: XZ[];
  /** Điểm bên trong công trình để camera tự thu gần khi vào trong. */
  interior?: XZ[];
  /** Các bục/nền cao hơn mặt đất: nhân vật đứng lên đúng cao độ khi đi vào. */
  floors?: { ring: XZ[]; y: number }[];
  /** false nếu model tự dựng chưa có khối va chạm riêng. */
  hasColliders?: boolean;
}
