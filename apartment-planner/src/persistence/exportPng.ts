import type { Project } from '../model/types';
import { projectBounds } from '../geometry/plan';

const MAX_SIDE = 4096;
const MARGIN = 24; // inches around the plan

/**
 * Rasterize the plan SVG to PNG. Clones the live <svg>, strips UI-only nodes
 * (.no-export: grid, handles, warnings), and re-frames the viewBox on the plan.
 * Labels are sized in screen pixels at the current zoom, so the export renders at
 * 2× the current zoom (capped) to look like the screen, only sharper.
 */
export async function exportPlanPng(svg: SVGSVGElement, project: Project, viewScale: number): Promise<Blob> {
  const b = projectBounds(project);
  if (!b) throw new Error('Nothing to export yet. Trace a room first.');
  const x = b.minX - MARGIN;
  const y = b.minY - MARGIN;
  const w = b.maxX - b.minX + MARGIN * 2;
  const h = b.maxY - b.minY + MARGIN * 2;
  const pxPerIn = Math.min(viewScale * 2, MAX_SIDE / Math.max(w, h));
  const outW = Math.round(w * pxPerIn);
  const outH = Math.round(h * pxPerIn);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.no-export').forEach((n) => n.remove());
  const content = clone.querySelector('#plan-content');
  content?.setAttribute('transform', '');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  clone.setAttribute('width', String(outW));
  clone.setAttribute('height', String(outH));
  clone.removeAttribute('style');
  clone.removeAttribute('class');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(x));
  bg.setAttribute('y', String(y));
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', 'white');
  clone.insertBefore(bg, clone.firstChild);

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', String(x + 6));
  title.setAttribute('y', String(y + 14 / pxPerIn + 6));
  title.setAttribute('font-size', String(14 / pxPerIn));
  title.setAttribute('font-family', 'system-ui, sans-serif');
  title.setAttribute('fill', '#555');
  title.textContent = project.name;
  clone.appendChild(title);

  const data = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not render the plan image.'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, outW, outH);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
