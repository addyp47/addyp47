import type { BackgroundImage, Project, Room, Selection, Vec2, Wall } from '../../model/types';
import { polyToPath, polygonArea, polygonCentroid } from '../../geometry/polygon';
import { wallLength, wallPolygon } from '../../geometry/plan';
import { formatArea, formatFtIn } from '../../geometry/units';
import { lerp, perp, norm, sub, add, scale as vscale } from '../../geometry/vec';

export const SELECT_COLOR = '#2f7de1';

export function BackgroundLayer({ bg }: { bg: BackgroundImage | null }) {
  if (!bg || !bg.visible) return null;
  return (
    <image
      data-kind="background"
      href={bg.dataUrl}
      x={bg.x}
      y={bg.y}
      width={bg.naturalWidth * bg.inchesPerPixel}
      height={bg.naturalHeight * bg.inchesPerPixel}
      opacity={bg.opacity}
      preserveAspectRatio="none"
      style={{ cursor: bg.locked ? undefined : 'move' }}
    />
  );
}

export function RoomsLayer({
  project,
  selection,
  px,
  interactive,
}: {
  project: Project;
  selection: Selection | null;
  px: number;
  interactive: boolean;
}) {
  const floor = project.style.palette.floor;
  return (
    <g>
      {project.rooms.map((r) => (
        <path
          key={r.id}
          data-kind={interactive ? 'room' : undefined}
          data-id={r.id}
          d={polyToPath(r.polygon)}
          fill={r.floorColor ?? floor}
          fillOpacity={project.background?.visible ? 0.55 : 1}
          stroke={selection?.kind === 'room' && selection.id === r.id ? SELECT_COLOR : 'none'}
          strokeWidth={2 * px}
          strokeDasharray={`${6 * px} ${4 * px}`}
        />
      ))}
    </g>
  );
}

export function RoomLabels({ rooms, px }: { rooms: Room[]; px: number }) {
  return (
    <g pointerEvents="none">
      {rooms.map((r) => {
        const c = polygonCentroid(r.polygon);
        const fs = Math.max(13 * px, 7);
        return (
          <g key={r.id}>
            <text x={c.x} y={c.y} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#3b3f45" fontFamily="system-ui, sans-serif">
              {r.name}
            </text>
            <text x={c.x} y={c.y + fs * 1.2} textAnchor="middle" fontSize={fs * 0.8} fill="#6b7078" fontFamily="system-ui, sans-serif">
              {formatArea(polygonArea(r.polygon))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function WallsLayer({
  walls,
  color,
  selection,
  hoverId,
  px,
  interactive,
}: {
  walls: Wall[];
  color: string;
  selection: Selection | null;
  hoverId: string | null;
  px: number;
  interactive: boolean;
}) {
  return (
    <g>
      {walls.map((w) => {
        const selected = selection?.kind === 'wall' && selection.id === w.id;
        return (
          <path
            key={w.id}
            data-kind={interactive ? 'wall' : undefined}
            data-id={w.id}
            d={polyToPath(wallPolygon(w))}
            fill={selected ? SELECT_COLOR : color}
            stroke={hoverId === w.id && !selected ? SELECT_COLOR : 'none'}
            strokeWidth={1.5 * px}
          />
        );
      })}
    </g>
  );
}

/** Dimension line offset from a segment, with a centered label. */
export function DimensionLine({ a, b, offset, px, label }: { a: Vec2; b: Vec2; offset: number; px: number; label?: string }) {
  const n = perp(norm(sub(b, a)));
  const o = vscale(n, offset);
  const p0 = add(a, o);
  const p1 = add(b, o);
  const mid = lerp(p0, p1, 0.5);
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180;
  const fs = 11 * px;
  const text = label ?? formatFtIn(Math.hypot(b.x - a.x, b.y - a.y));
  const tick = vscale(n, 4 * px);
  return (
    <g pointerEvents="none" className="no-export">
      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#2f7de1" strokeWidth={px} />
      <line x1={p0.x - tick.x} y1={p0.y - tick.y} x2={p0.x + tick.x} y2={p0.y + tick.y} stroke="#2f7de1" strokeWidth={px} />
      <line x1={p1.x - tick.x} y1={p1.y - tick.y} x2={p1.x + tick.x} y2={p1.y + tick.y} stroke="#2f7de1" strokeWidth={px} />
      <g transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}>
        <rect x={-text.length * fs * 0.32 - 3 * px} y={-fs * 0.7} width={text.length * fs * 0.64 + 6 * px} height={fs * 1.3} rx={3 * px} fill="white" opacity={0.92} />
        <text y={fs * 0.38} textAnchor="middle" fontSize={fs} fill="#1f4f9a" fontFamily="system-ui, sans-serif">
          {text}
        </text>
      </g>
    </g>
  );
}

export function VertexHandles({ points, px }: { points: Vec2[]; px: number }) {
  return (
    <g className="no-export">
      {points.map((p, i) => (
        <circle
          key={i}
          data-kind="vertex"
          data-x={p.x}
          data-y={p.y}
          cx={p.x}
          cy={p.y}
          r={6 * px}
          fill="white"
          stroke={SELECT_COLOR}
          strokeWidth={2 * px}
          style={{ cursor: 'move' }}
        />
      ))}
    </g>
  );
}

export function WallDimensions({ wall, px }: { wall: Wall; px: number }) {
  return <DimensionLine a={wall.a} b={wall.b} offset={wall.thickness / 2 + 14 * px} px={px} label={formatFtIn(wallLength(wall))} />;
}
