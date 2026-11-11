import type { ViewTransform } from '../../store/editor';

/** 1 ft grid with a heavier line every 5 ft, covering the visible viewport. */
export function Grid({ view, width, height }: { view: ViewTransform; width: number; height: number }) {
  const x0 = -view.x / view.scale;
  const y0 = -view.y / view.scale;
  const w = width / view.scale;
  const h = height / view.scale;
  const minor = view.scale * 12 >= 6; // hide 1 ft lines when they'd be < 6 px apart
  return (
    <g className="no-export" pointerEvents="none">
      <defs>
        <pattern id="grid-minor" width={12} height={12} patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e4e6ea" strokeWidth={1 / view.scale} />
        </pattern>
        <pattern id="grid-major" width={60} height={60} patternUnits="userSpaceOnUse">
          {minor && <rect width={60} height={60} fill="url(#grid-minor)" />}
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#d0d4da" strokeWidth={1 / view.scale} />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill="url(#grid-major)" />
    </g>
  );
}
