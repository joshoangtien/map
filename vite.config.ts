import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Khi chạy `npm run dev`: theo dõi public/models/. Mỗi lần add-on Blender xuất
 * lại model, báo cho trình duyệt để scene tự nạp lại (không phải tải lại trang).
 */
function watchModels(): Plugin {
  return {
    name: 'vnmap-watch-models',
    configureServer(server) {
      const dir = path.resolve(server.config.root, 'public/models');
      server.watcher.add(dir);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onFile = (file: string) => {
        if (!path.resolve(file).startsWith(dir)) return;
        clearTimeout(timer);
        // Đợi một chút để Blender ghi xong cả .glb lẫn index.json.
        timer = setTimeout(() => {
          server.config.logger.info(`[models] ${path.basename(file)} thay đổi, nạp lại scene`, { timestamp: true });
          server.ws.send({ type: 'custom', event: 'vnmap:models-changed', data: { file: path.basename(file) } });
        }, 400);
      };
      server.watcher.on('add', onFile);
      server.watcher.on('change', onFile);
    },
  };
}

export default defineConfig({
  plugins: [react(), watchModels()],
});
