/**
 * Texture vẽ bằng canvas (không cần file ảnh): gạch, đá, ngói, sàn, chữ...
 */
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

/** Bộ sinh số ngẫu nhiên có hạt giống: cùng địa điểm thì ra cùng một kết quả. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
};

/** Khối đá/gạch xếp so le. Một ô texture = 2 m × 2 m. */
export function blockTexture(base: string, rows = 6, cols = 3, mortar = 'rgba(0,0,0,0.18)', seed = 1) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  const bh = 256 / rows;
  const bw = 256 / cols;
  g.fillStyle = mortar;
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < rows; y++) {
    const off = (y % 2) * bw * 0.5;
    for (let x = -1; x < cols + 1; x++) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.08);
      g.fillRect(x * bw + off + 1.5, y * bh + 1.5, bw - 3, bh - 3);
    }
  }
  return toTexture(c);
}

/** Sàn lát gạch caro. */
export function tileTexture(a: string, b: string, n = 4) {
  const [c, g] = canvas(256, 256);
  const s = 256 / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * s, y * s, s, s);
    }
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, 256);
    g.moveTo(0, i * s);
    g.lineTo(256, i * s);
    g.stroke();
  }
  return toTexture(c);
}

/** Ngói: các hàng vảy cá. */
export function roofTexture(base: string, seed = 7) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = shade(base, -0.08);
  g.fillRect(0, 0, 256, 256);
  const rows = 8;
  const cols = 8;
  const h = 256 / rows;
  const w = 256 / cols;
  for (let y = 0; y < rows; y++)
    for (let x = -1; x <= cols; x++) {
      const cx = x * w + ((y % 2) * w) / 2 + w / 2;
      g.fillStyle = shade(base, (r() - 0.5) * 0.08);
      g.beginPath();
      g.ellipse(cx, y * h + h * 0.55, w * 0.48, h * 0.6, 0, 0, Math.PI);
      g.fill();
    }
  return toTexture(c);
}

/** Mặt đất có nhiễu nhẹ (cỏ, đất, đá lát). */
export function noiseTexture(base: string, amount = 0.06, seed = 3, dots = 2200) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < dots; i++) {
    g.fillStyle = shade(base, (r() - 0.5) * amount * 2);
    const s = 2 + r() * 5;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  return toTexture(c);
}

/** Kính màu cho cửa sổ nhà thờ. */
export function stainedGlassTexture(seed = 11) {
  const [c, g] = canvas(128, 256);
  const r = rng(seed);
  const colors = ['#1d4e89', '#b8242a', '#e0a526', '#2e7d4f', '#6a2c91', '#2a6fb0'];
  const n = 6;
  for (let y = 0; y < 256; y += 256 / (n * 2))
    for (let x = 0; x < 128; x += 128 / n) {
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      g.fillRect(x, y, 128 / n, 256 / (n * 2));
    }
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 3;
  for (let x = 0; x <= 128; x += 128 / n) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  for (let y = 0; y <= 256; y += 256 / (n * 2)) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Biển chữ (tên địa điểm, tên nhân vật). Trả về texture và tỉ lệ rộng/cao. */
export function textTexture(text: string, opts: { color?: string; bg?: string; font?: string; padding?: number; border?: string } = {}) {
  const font = opts.font ?? 'bold 64px "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif';
  const pad = opts.padding ?? 28;
  const [, mg] = canvas(8, 8);
  mg.font = font;
  const w = Math.ceil(mg.measureText(text).width) + pad * 2;
  const h = 64 + pad * 1.4;
  const [c, g] = canvas(w, h);
  if (opts.bg) {
    g.fillStyle = opts.bg;
    const rr = Math.min(24, h / 2);
    g.beginPath();
    g.roundRect(0, 0, w, h, rr);
    g.fill();
    if (opts.border) {
      g.strokeStyle = opts.border;
      g.lineWidth = 6;
      g.stroke();
    }
  }
  g.font = font;
  g.fillStyle = opts.color ?? '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, aspect: w / h };
}

/** Mặt tiền nhà phố: tường sơn + cửa sổ. Một ô texture = 1 tầng × 1 gian (3.2 m × 3.2 m). */
export function facadeTexture(wall: string, seed = 5) {
  const [c, g] = canvas(128, 128);
  const r = rng(seed);
  g.fillStyle = wall;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.fillRect(0, 118, 128, 10);
  const lit = r() < 0.25;
  g.fillStyle = lit ? '#f4d58a' : '#3c4a57';
  g.fillRect(34, 30, 60, 62);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(36, 32, 26, 58);
  g.strokeStyle = shade(wall, -0.25);
  g.lineWidth = 5;
  g.strokeRect(34, 30, 60, 62);
  g.beginPath();
  g.moveTo(64, 30);
  g.lineTo(64, 92);
  g.stroke();
  const t = toTexture(c);
  t.repeat.set(1 / 3.2, 1 / 3.2);
  return t;
}

export const PASTELS = ['#f2e2c4', '#e9d3a8', '#f0d7cf', '#dfe6d2', '#e6dfd4', '#f3e9b8', '#d9e2ea', '#efd2a2', '#e8c9b5'];
