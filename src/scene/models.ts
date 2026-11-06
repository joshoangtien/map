/**
 * Model 3D tự dựng (Blender → .glb) cho từng địa điểm.
 *
 * Danh sách model nằm ở `public/models/index.json`, mỗi mục cho biết file .glb
 * và cách gắn vào địa điểm (theo tên và/hoặc toạ độ). Add-on Blender trong
 * thư mục `blender/` tự ghi file này khi bấm "Xuất sang game".
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface ModelEntry {
  /** Mã model, cũng là tên file mặc định: `<id>.glb`. */
  id: string;
  /** File .glb trong `public/models/` (mặc định `<id>.glb`). */
  file?: string;
  /** Gắn vào địa điểm có đúng tên này (không phân biệt hoa thường). */
  name?: string;
  /** Toạ độ [kinh độ, vĩ độ] đặt gốc model. Cũng dùng để gắn với địa điểm gần đó. */
  lngLat?: [number, number];
  /** Bán kính (m) để coi một địa điểm là "gần" lngLat. Mặc định 60. */
  matchRadius?: number;
  /**
   * Hướng mặt tiền theo la bàn (độ): 0 = Bắc, 90 = Đông, 180 = Nam, 270 = Tây.
   * "auto": tự xoay theo mặt bằng toà nhà thật và con đường gần nhất.
   */
  facade?: number | 'auto';
  /** Thời điểm xuất gần nhất, dùng để trình duyệt không lấy bản cũ trong bộ nhớ đệm. */
  updated?: string;
}

const BASE = `${import.meta.env.BASE_URL}models/`;

export async function loadRegistry(): Promise<ModelEntry[]> {
  try {
    const res = await fetch(`${BASE}index.json`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

function metersBetween([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lng2 - lng1) * 111_320 * k, (lat2 - lat1) * 110_574);
}

/** Tìm model gắn với địa điểm: khớp tên, hoặc nằm trong bán kính quanh lngLat. Ưu tiên mục gần nhất. */
export function findModel(entries: ModelEntry[], name: string, lngLat: [number, number]): ModelEntry | null {
  let best: ModelEntry | null = null;
  let bestScore = Infinity;
  for (const e of entries) {
    const d = e.lngLat ? metersBetween(e.lngLat, lngLat) : Infinity;
    const byName = !!e.name && norm(e.name) === norm(name);
    const byPos = d <= (e.matchRadius ?? 60);
    if (!byName && !byPos) continue;
    // Khớp tên mà toạ độ quá xa (vd. hai nhà thờ trùng tên ở hai tỉnh) thì bỏ qua.
    if (byName && e.lngLat && d > 2000) continue;
    const score = (byName ? 0 : 1000) + (Number.isFinite(d) ? d : 500);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

let loader: GLTFLoader | null = null;

function getLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export async function loadModel(entry: ModelEntry): Promise<THREE.Group> {
  const file = entry.file ?? `${entry.id}.glb`;
  const url = `${BASE}${file}${entry.updated ? `?v=${encodeURIComponent(entry.updated)}` : ''}`;
  const gltf = await getLoader().loadAsync(url);
  return gltf.scene;
}
