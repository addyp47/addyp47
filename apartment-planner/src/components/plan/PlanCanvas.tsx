import { useEffect, useRef, useState } from 'react';
import { screenToWorld, useEditor } from '../../store/editor';
import { Grid } from './Grid';
import type { Vec2 } from '../../model/types';

type DragState = { type: 'pan'; startX: number; startY: number; viewX: number; viewY: number } | null;

export function PlanCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);

  const view = useEditor((s) => s.view);
  const viewport = useEditor((s) => s.viewport);
  const setView = useEditor((s) => s.setView);
  const setViewport = useEditor((s) => s.setViewport);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewport(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  // Wheel zoom around the cursor (non-passive so we can preventDefault).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const v = useEditor.getState().view;
      if (e.ctrlKey || !e.shiftKey) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const s = Math.min(20, Math.max(0.1, v.scale * factor));
        const wx = (sx - v.x) / v.scale;
        const wy = (sy - v.y) / v.scale;
        setView({ scale: s, x: sx - wx * s, y: sy - wy * s });
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  const localPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { sx, sy } = localPoint(e);
    if (e.button === 1 || e.button === 0) {
      drag.current = { type: 'pan', startX: sx, startY: sy, viewX: view.x, viewY: view.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { sx, sy } = localPoint(e);
    setCursor(screenToWorld(view, sx, sy));
    const d = drag.current;
    if (d?.type === 'pan') setView({ ...view, x: d.viewX + sx - d.startX, y: d.viewY + sy - d.startY });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="plan-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="plan-svg"
        width={viewport.width}
        height={viewport.height}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <Grid view={view} width={viewport.width} height={viewport.height} />
        </g>
      </svg>
      <div className="statusbar">
        {cursor && (
          <span>
            x {Math.round(cursor.x)}" · y {Math.round(cursor.y)}"
          </span>
        )}
        <span>{Math.round(view.scale * 12)} px / ft</span>
      </div>
    </div>
  );
}
