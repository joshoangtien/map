/** Kiểm tra style bản đồ theo đặc tả MapLibre: `npm run validate-style`. */
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildStyle } from '../src/map/style';

const errors = validateStyleMin(buildStyle());
if (errors.length) {
  for (const e of errors) console.error('✗', e.message);
  process.exit(1);
}
console.log('✓ Style hợp lệ');
