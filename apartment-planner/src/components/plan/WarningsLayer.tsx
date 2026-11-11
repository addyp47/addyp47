import type { Project } from '../../model/types';
import type { PlanWarning } from '../../analysis/warnings';
import { doorGeometry } from '../../geometry/plan';
import { polyToPath } from '../../geometry/polygon';
import { formatInches } from '../../geometry/units';

const WARN = '#d9822b';
const ERR = '#c0392b';

export function WarningsLayer({ warnings, project, px }: { warnings: PlanWarning[]; project: Project; px: number }) {
  const walls = new Map(project.walls.map((w) => [w.id, w]));
  const blockedDoors = new Set(warnings.filter((w) => w.openingId).map((w) => w.openingId!));
  const fs = 10 * px;
  return (
    <g className="no-export" pointerEvents="none">
      {project.openings
        .filter((o) => blockedDoors.has(o.id))
        .map((o) => {
          const w = walls.get(o.wallId);
          if (!w) return null;
          return <path key={o.id} d={polyToPath(doorGeometry(o, w).swing)} fill={ERR} fillOpacity={0.18} stroke={ERR} strokeWidth={1.5 * px} />;
        })}
      {warnings.map((w) => {
        if (w.kind === 'clearance' && w.line) {
          const [a, b] = w.line;
          const label = formatInches(w.gap ?? 0);
          return (
            <g key={w.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WARN} strokeWidth={2 * px} strokeDasharray={`${4 * px} ${3 * px}`} />
              <circle cx={a.x} cy={a.y} r={2.5 * px} fill={WARN} />
              <circle cx={b.x} cy={b.y} r={2.5 * px} fill={WARN} />
              <rect x={w.at.x - label.length * fs * 0.33 - 3 * px} y={w.at.y - fs * 0.75} width={label.length * fs * 0.66 + 6 * px} height={fs * 1.45} rx={3 * px} fill={WARN} />
              <text x={w.at.x} y={w.at.y + fs * 0.38} textAnchor="middle" fontSize={fs} fill="white" fontWeight={600} fontFamily="system-ui, sans-serif">
                {label}
              </text>
            </g>
          );
        }
        if (w.kind === 'wall' || w.kind === 'overlap') {
          const r = 7 * px;
          return (
            <g key={w.id}>
              <circle cx={w.at.x} cy={w.at.y} r={r} fill={w.severity === 'error' ? ERR : WARN} />
              <text x={w.at.x} y={w.at.y + r * 0.45} textAnchor="middle" fontSize={r * 1.3} fill="white" fontWeight={700} fontFamily="system-ui, sans-serif">
                !
              </text>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}
