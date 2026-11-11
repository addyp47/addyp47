import type { Opening, Wall } from '../../model/types';
import { doorGeometry, openingCenter, openingPolygon, openingSpan, wallNormal } from '../../geometry/plan';
import { polyToPath } from '../../geometry/polygon';
import { add, scale, dist } from '../../geometry/vec';
import { SELECT_COLOR } from './layers';

const CUT_FILL = '#fbfbfa';

export function OpeningShape({
  opening: o,
  wall: w,
  px,
  selected,
  hovered,
  ghost,
  interactive,
}: {
  opening: Opening;
  wall: Wall;
  px: number;
  selected?: boolean;
  hovered?: boolean;
  ghost?: boolean;
  interactive?: boolean;
}) {
  const stroke = selected ? SELECT_COLOR : hovered ? '#5b8fd6' : '#30343a';
  const sw = (selected ? 2 : 1.25) * px;
  const cut = openingPolygon(o, w);
  const hit = {
    'data-kind': interactive ? 'opening' : undefined,
    'data-id': o.id,
    style: interactive ? { cursor: 'grab' } : undefined,
  };

  if (o.kind === 'outlet') {
    const n = scale(wallNormal(w), o.side);
    const c = add(openingCenter(o, w), scale(n, w.thickness / 2 + 3));
    const r = 2.6;
    return (
      <g opacity={ghost ? 0.6 : 1} {...hit}>
        <circle cx={c.x} cy={c.y} r={Math.max(r, 5 * px)} fill="white" stroke={stroke} strokeWidth={sw} />
        <line x1={c.x - r * 0.4} y1={c.y - r * 0.5} x2={c.x - r * 0.4} y2={c.y + r * 0.5} stroke={stroke} strokeWidth={sw} />
        <line x1={c.x + r * 0.4} y1={c.y - r * 0.5} x2={c.x + r * 0.4} y2={c.y + r * 0.5} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }

  if (o.kind === 'window') {
    const [p0, p1] = openingSpan(o, w);
    const n = scale(wallNormal(w), w.thickness / 2);
    const lines = [-1, 0, 1].map((k) => [add(p0, scale(n, k * 0.8)), add(p1, scale(n, k * 0.8))]);
    return (
      <g opacity={ghost ? 0.6 : 1} {...hit}>
        <path d={polyToPath(cut)} fill={CUT_FILL} stroke={stroke} strokeWidth={sw} />
        {lines.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={i === 1 ? sw * 1.4 : sw} />
        ))}
      </g>
    );
  }

  if (o.kind === 'opening') {
    return (
      <g opacity={ghost ? 0.6 : 1} {...hit}>
        <path d={polyToPath(cut)} fill={CUT_FILL} stroke={selected || hovered ? stroke : 'none'} strokeWidth={sw} />
      </g>
    );
  }

  // door
  const g = doorGeometry(o, w);
  const r = dist(g.hinge, g.latch);
  return (
    <g opacity={ghost ? 0.6 : 1} {...hit}>
      <path d={polyToPath(cut)} fill={CUT_FILL} stroke="none" />
      {/* invisible swing area for easier picking */}
      <path d={polyToPath(g.swing)} fill={selected ? 'rgba(47,125,225,0.08)' : 'rgba(0,0,0,0.001)'} stroke="none" />
      <line x1={g.hinge.x} y1={g.hinge.y} x2={g.open.x} y2={g.open.y} stroke={stroke} strokeWidth={sw * 1.6} />
      <path
        d={`M ${g.open.x} ${g.open.y} A ${r} ${r} 0 0 ${g.sweepFlag} ${g.latch.x} ${g.latch.y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={`${4 * px} ${3 * px}`}
      />
    </g>
  );
}

export function OpeningsLayer({
  openings,
  walls,
  px,
  selectedId,
  hoverId,
  interactive,
}: {
  openings: Opening[];
  walls: Wall[];
  px: number;
  selectedId: string | null;
  hoverId: string | null;
  interactive: boolean;
}) {
  const byId = new Map(walls.map((w) => [w.id, w]));
  return (
    <g>
      {openings.map((o) => {
        const w = byId.get(o.wallId);
        if (!w) return null;
        return (
          <OpeningShape
            key={o.id}
            opening={o}
            wall={w}
            px={px}
            selected={selectedId === o.id}
            hovered={hoverId === o.id}
            interactive={interactive}
          />
        );
      })}
    </g>
  );
}
