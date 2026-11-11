import type { FurnitureItem, Palette } from '../../model/types';
import { furnitureColor } from '../../catalog/furniture';
import { furnitureLocalCorners, toWorld } from '../../geometry/plan';
import { DimensionLine, SELECT_COLOR } from './layers';
import { formatFtIn } from '../../geometry/units';

/** Mix a hex color toward black (amt < 0) or white (amt > 0). */
export function shade(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const t = amt < 0 ? 0 : 255;
    return Math.round(c + (t - c) * Math.abs(amt));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function Detail({ f, fill, stroke, sw }: { f: FurnitureItem; fill: string; stroke: string; sw: number }) {
  const w = f.width;
  const d = f.depth;
  const x0 = -w / 2;
  const y0 = -d / 2;
  const common = { stroke, strokeWidth: sw };
  switch (f.kind) {
    case 'sofa': {
      const back = Math.min(10, d * 0.25);
      const arm = Math.min(8, w * 0.1);
      const seatW = w - arm * 2;
      const seats = Math.max(1, Math.round(seatW / 26));
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} rx={3} fill={fill} {...common} />
          <rect x={x0} y={y0} width={w} height={back} rx={3} fill={shade(fill, -0.15)} {...common} />
          <rect x={x0} y={y0} width={arm} height={d} rx={3} fill={shade(fill, -0.1)} {...common} />
          <rect x={w / 2 - arm} y={y0} width={arm} height={d} rx={3} fill={shade(fill, -0.1)} {...common} />
          {Array.from({ length: seats - 1 }, (_, i) => {
            const x = x0 + arm + (seatW / seats) * (i + 1);
            return <line key={i} x1={x} y1={y0 + back} x2={x} y2={d / 2 - 2} {...common} />;
          })}
        </>
      );
    }
    case 'bed': {
      const head = Math.min(4, d * 0.05);
      const pillowH = Math.min(14, d * 0.17);
      const pillows = w >= 50 ? 2 : 1;
      const pw = (w - 8 - (pillows - 1) * 4) / pillows;
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} rx={2} fill={shade(fill, 0.55)} {...common} />
          <rect x={x0} y={y0} width={w} height={head} fill={shade(fill, -0.3)} {...common} />
          {Array.from({ length: pillows }, (_, i) => (
            <rect key={i} x={x0 + 4 + i * (pw + 4)} y={y0 + head + 3} width={pw} height={pillowH} rx={4} fill="white" {...common} />
          ))}
          <path
            d={`M ${x0} ${y0 + d * 0.38} L ${w / 2} ${y0 + d * 0.38} L ${w / 2} ${d / 2} L ${x0} ${d / 2} Z`}
            fill={fill}
            {...common}
          />
          <line x1={x0} y1={y0 + d * 0.46} x2={w / 2} y2={y0 + d * 0.46} {...common} strokeOpacity={0.5} />
        </>
      );
    }
    case 'chair': {
      if (f.shape === 'ellipse') {
        return (
          <>
            <ellipse rx={w / 2} ry={d / 2} fill={fill} {...common} />
            <ellipse rx={w / 2 - 3} ry={d / 2 - 3} fill="none" {...common} strokeOpacity={0.4} />
          </>
        );
      }
      const back = Math.min(6, d * 0.22);
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} rx={3} fill={fill} {...common} />
          <rect x={x0} y={y0} width={w} height={back} rx={2} fill={shade(fill, -0.18)} {...common} />
        </>
      );
    }
    case 'rug': {
      const inset = Math.min(5, Math.min(w, d) * 0.08);
      if (f.shape === 'ellipse') {
        return (
          <>
            <ellipse rx={w / 2} ry={d / 2} fill={fill} fillOpacity={0.55} {...common} strokeOpacity={0.6} />
            <ellipse rx={w / 2 - inset} ry={d / 2 - inset} fill="none" {...common} strokeDasharray="3 2" strokeOpacity={0.6} />
          </>
        );
      }
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} fill={fill} fillOpacity={0.55} {...common} strokeOpacity={0.6} />
          <rect x={x0 + inset} y={y0 + inset} width={w - inset * 2} height={d - inset * 2} fill="none" {...common} strokeDasharray="3 2" strokeOpacity={0.6} />
        </>
      );
    }
    case 'lamp':
      return (
        <>
          <ellipse rx={w / 2} ry={d / 2} fill={shade(fill, 0.5)} {...common} />
          <ellipse rx={w / 5} ry={d / 5} fill={fill} {...common} />
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0} {...common} strokeOpacity={0.5} />
          <line x1={0} y1={-d / 2} x2={0} y2={d / 2} {...common} strokeOpacity={0.5} />
        </>
      );
    case 'plant':
      return (
        <>
          <ellipse rx={w / 2} ry={d / 2} fill={fill} {...common} />
          {[0, 72, 144, 216, 288].map((a) => {
            const r = (a * Math.PI) / 180;
            return <ellipse key={a} cx={Math.cos(r) * w * 0.22} cy={Math.sin(r) * d * 0.22} rx={w * 0.18} ry={d * 0.18} fill={shade(fill, 0.2)} {...common} strokeOpacity={0.5} />;
          })}
        </>
      );
    case 'storage':
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} rx={1} fill={fill} {...common} />
          <line x1={x0} y1={d / 2 - Math.min(3, d * 0.2)} x2={w / 2} y2={d / 2 - Math.min(3, d * 0.2)} {...common} strokeOpacity={0.6} />
          <line x1={x0} y1={y0} x2={w / 2} y2={d / 2} {...common} strokeOpacity={0.25} />
          <line x1={w / 2} y1={y0} x2={x0} y2={d / 2} {...common} strokeOpacity={0.25} />
        </>
      );
    case 'table':
    case 'desk':
      if (f.shape === 'ellipse')
        return (
          <>
            <ellipse rx={w / 2} ry={d / 2} fill={fill} {...common} />
            <ellipse rx={w / 2 - 2.5} ry={d / 2 - 2.5} fill="none" {...common} strokeOpacity={0.35} />
          </>
        );
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} rx={1.5} fill={fill} {...common} />
          <rect x={x0 + 2.5} y={y0 + 2.5} width={Math.max(0, w - 5)} height={Math.max(0, d - 5)} rx={1} fill="none" {...common} strokeOpacity={0.35} />
        </>
      );
    default:
      return f.shape === 'ellipse' ? (
        <ellipse rx={w / 2} ry={d / 2} fill={fill} {...common} />
      ) : (
        <rect x={x0} y={y0} width={w} height={d} rx={1} fill={fill} {...common} />
      );
  }
}

export function FurnitureShape({
  f,
  palette,
  px,
  state,
  interactive,
  flagged,
}: {
  f: FurnitureItem;
  palette: Palette;
  px: number;
  state: 'idle' | 'hover' | 'selected';
  interactive: boolean;
  flagged: boolean;
}) {
  const fill = furnitureColor(f, palette);
  const stroke = state === 'selected' ? SELECT_COLOR : flagged ? '#c0392b' : shade(fill, -0.45);
  const sw = (state === 'idle' ? 1 : 1.75) * px;
  const fs = 10 * px;
  const showLabel = Math.min(f.width, f.depth) / px > 34 && f.kind !== 'rug';
  return (
    <g data-kind={interactive ? 'furniture' : undefined} data-id={f.id} style={interactive ? { cursor: 'move' } : undefined}>
      <g transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}>
        <Detail f={f} fill={fill} stroke={stroke} sw={sw} />
      </g>
      {showLabel && (
        <text
          x={f.x}
          y={f.y + fs * 0.35}
          textAnchor="middle"
          fontSize={fs}
          fill="#24272b"
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
          style={{ paintOrder: 'stroke' }}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={3 * px}
        >
          {f.name.length > 18 ? f.name.slice(0, 17) + '…' : f.name}
        </text>
      )}
    </g>
  );
}

const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function FurnitureHandles({ f, px }: { f: FurnitureItem; px: number }) {
  const hs = 8 * px;
  const w = f.width / 2;
  const d = f.depth / 2;
  const rotY = -d - 22 * px;
  return (
    <g className="no-export" transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}>
      <rect x={-w} y={-d} width={f.width} height={f.depth} fill="none" stroke={SELECT_COLOR} strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} pointerEvents="none" />
      <line x1={0} y1={-d} x2={0} y2={rotY} stroke={SELECT_COLOR} strokeWidth={px} />
      <circle data-kind="handle" data-handle="rotate" cx={0} cy={rotY} r={6 * px} fill="white" stroke={SELECT_COLOR} strokeWidth={2 * px} style={{ cursor: 'grab' }} />
      {HANDLES.map(([hx, hy]) => (
        <rect
          key={`${hx},${hy}`}
          data-kind="handle"
          data-handle="resize"
          data-hx={hx}
          data-hy={hy}
          x={hx * w - hs / 2}
          y={hy * d - hs / 2}
          width={hs}
          height={hs}
          fill="white"
          stroke={SELECT_COLOR}
          strokeWidth={1.5 * px}
          style={{ cursor: resizeCursor(hx, hy, f.rotation) }}
        />
      ))}
    </g>
  );
}

function resizeCursor(hx: number, hy: number, rotation: number): string {
  const angle = ((Math.atan2(hy, hx) * 180) / Math.PI + rotation + 360) % 180;
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize';
  if (angle < 67.5) return 'nwse-resize';
  if (angle < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

/** Width and depth dimension lines plus a size label: shown on hover/selection. */
export function FurnitureDimensions({ f, px }: { f: FurnitureItem; px: number }) {
  const c = furnitureLocalCorners(f).map((p) => toWorld(f, p));
  return (
    <g className="no-export" pointerEvents="none">
      <DimensionLine a={c[0]} b={c[1]} offset={-12 * px} px={px} label={formatFtIn(f.width, true)} />
      <DimensionLine a={c[1]} b={c[2]} offset={-12 * px} px={px} label={formatFtIn(f.depth, true)} />
    </g>
  );
}
