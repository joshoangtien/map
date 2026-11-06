// Chép bộ giải nén Draco của three.js vào public/draco/ để GLTFLoader đọc
// được model .glb đã nén (add-on Blender xuất có nén Draco).
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const dst = join(root, 'public/draco');
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
