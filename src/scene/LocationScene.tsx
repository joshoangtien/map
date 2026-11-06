import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { SiteData } from './geo';
import { SceneRuntime } from './runtime';
import { pickTemplate } from './templates';

export interface LocationInfo {
  id: string;
  name: string;
  kind: string;
  category: string;
  site: SiteData;
}

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
  const template = pickTemplate(place.kind, place.category === 'place_of_worship');

  useEffect(() => {
    if (!container.current) return;
    const rt = new SceneRuntime({
      container: container.current,
      site: place.site,
      placeName: place.name,
      placeKind: place.kind,
      template,
      playerName,
      seed: hash(place.id),
    });
    runtime.current = rt;
    if (import.meta.env.DEV) (window as unknown as { __scene: SceneRuntime }).__scene = rt;
    const timer = setInterval(() => setInside(rt.isInside()), 300);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onExit();
      if (e.code === 'KeyH') setHelp((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      rt.dispose();
      runtime.current = null;
    };
    // Chỉ dựng lại scene khi đổi địa điểm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

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
            {TEMPLATE_LABEL[template]}
            {place.site.target ? ', kích thước và hướng theo mặt bằng thật.' : ' (chưa có mặt bằng thật, dùng kích thước mặc định).'} Nhà, đường, cây xung quanh lấy từ
            dữ liệu bản đồ.
          </small>
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
