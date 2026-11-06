import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { SiteData } from './geo';
import { SceneRuntime, type RuntimeState } from './runtime';
import { pickTemplate } from './templates';
import { findModel, loadModel, loadRegistry, type ModelEntry } from './models';

export interface LocationInfo {
  id: string;
  name: string;
  kind: string;
  category: string;
  lngLat: [number, number];
  site: SiteData;
}

type Source =
  | { type: 'loading' }
  | { type: 'template' }
  | { type: 'model'; entry: ModelEntry; hasColliders: boolean }
  | { type: 'error'; entry: ModelEntry; message: string };

interface Props {
  place: LocationInfo;
  playerName: string;
  onExit: () => void;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const TEMPLATE_LABEL = {
  church: 'Mẫu nhà thờ',
  pagoda: 'Mẫu chùa / đình / đền',
  generic: 'Mẫu toà nhà',
};

export default function LocationScene({ place, playerName, onExit }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const [inside, setInside] = useState(false);
  const [help, setHelp] = useState(true);
  const [source, setSource] = useState<Source>({ type: 'loading' });
  // Tăng lên mỗi khi file model thay đổi (xuất lại từ Blender) để dựng lại scene.
  const [version, setVersion] = useState(0);
  // Giữ vị trí nhân vật và camera khi dựng lại scene.
  const keep = useRef<RuntimeState | null>(null);
  const template = pickTemplate(place.kind, place.category === 'place_of_worship');

  useEffect(() => {
    if (!container.current) return;
    const el = container.current;
    let cancelled = false;
    let rt: SceneRuntime | null = null;
    let timer = 0;

    (async () => {
      const entry = findModel(await loadRegistry(), place.name, place.lngLat);
      let model: Awaited<ReturnType<typeof loadModel>> | null = null;
      let next: Source = { type: 'template' };
      if (entry) {
        try {
          model = await loadModel(entry);
        } catch (e) {
          next = { type: 'error', entry, message: e instanceof Error ? e.message : String(e) };
        }
      }
      if (cancelled) return;
      rt = new SceneRuntime({
        container: el,
        site: place.site,
        placeName: place.name,
        placeKind: place.kind,
        template,
        playerName,
        seed: hash(place.id),
        model: model && entry ? { group: model, entry, poiLngLat: place.lngLat } : undefined,
      });
      if (model && entry) next = { type: 'model', entry, hasColliders: rt.template.hasColliders !== false };
      if (keep.current) rt.setState(keep.current);
      setSource(next);
      runtime.current = rt;
      if (import.meta.env.DEV) (window as unknown as { __scene: SceneRuntime }).__scene = rt;
      const r = rt;
      timer = window.setInterval(() => setInside(r.isInside()), 300);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (rt) {
        keep.current = rt.getState();
        rt.dispose();
      }
      runtime.current = null;
    };
    // Chỉ dựng lại scene khi đổi địa điểm hoặc model thay đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onExit();
      if (e.code === 'KeyH') setHelp((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  // Khi chạy `npm run dev`: xuất lại model từ Blender thì scene tự cập nhật.
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const onChange = () => setVersion((v) => v + 1);
    hot.on('vnmap:models-changed', onChange);
    return () => hot.off('vnmap:models-changed', onChange);
  }, []);

  return (
    <div className="scene">
      <div ref={container} className="scene-canvas" />

      <header className="scene-top">
        <button className="back" onClick={onExit}>
          ← Về bản đồ
        </button>
        <div className="scene-title">
          <strong>{place.name}</strong>
          <span>
            {place.kind} · {inside ? 'Bên trong' : 'Bên ngoài'}
            {source.type === 'model' && ' · Model tự dựng'}
          </span>
        </div>
      </header>

      {help && (
        <div className="scene-help" onClick={() => setHelp(false)}>
          <b>Điều khiển</b>
          <ul>
            <li>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> / mũi tên: đi · giữ <kbd>Shift</kbd>: chạy
            </li>
            <li>Bấm xuống mặt đất: đi tới đó</li>
            <li>Kéo chuột / vuốt: xoay camera · lăn chuột: gần / xa</li>
            <li>
              <kbd>H</kbd>: ẩn/hiện hướng dẫn · <kbd>Esc</kbd>: về bản đồ
            </li>
          </ul>
          <small>
            {source.type === 'model' ? (
              <>
                Model tự dựng: <code>{source.entry.file ?? `${source.entry.id}.glb`}</code>.
                {!source.hasColliders && ' Model chưa có khối "collider…" nên chưa vào trong được.'}
              </>
            ) : (
              <>
                {TEMPLATE_LABEL[template]}
                {place.site.target ? ', kích thước và hướng theo mặt bằng thật.' : ' (chưa có mặt bằng thật, dùng kích thước mặc định).'}
              </>
            )}{' '}
            Nhà, đường, cây xung quanh lấy từ dữ liệu bản đồ.
          </small>
        </div>
      )}

      {source.type === 'loading' && <div className="scene-status">Đang dựng địa điểm…</div>}
      {source.type === 'error' && (
        <div className="scene-status error-status">
          Không tải được model <code>{source.entry.file ?? `${source.entry.id}.glb`}</code>, đang dùng mẫu có sẵn.
          <br />
          <small>{source.message}</small>
        </div>
      )}

      <Joystick runtime={runtime} />
    </div>
  );
}

/** Cần điều khiển ảo cho màn hình cảm ứng. */
function Joystick({ runtime }: { runtime: RefObject<SceneRuntime | null> }) {
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const R = 46;

  const move = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob([dx, dy]);
    const rt = runtime.current;
    if (rt) rt.virtualStick = { x: dx / R, y: -dy / R, run: d > R * 0.95 };
  };
  const end = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob([0, 0]);
    if (runtime.current) runtime.current.virtualStick = { x: 0, y: 0, run: false };
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}
