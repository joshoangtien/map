/**
 * MapLibre v6 tự đoán đường dẫn worker từ `import.meta.url`, nhưng sau khi Vite
 * gom code (cả lúc dev lẫn lúc build) đường dẫn đó không còn đúng.
 * Ta trỏ thẳng tới file worker để Vite copy nó vào bản build.
 */
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
