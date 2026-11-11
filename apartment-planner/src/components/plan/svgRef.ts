/** Module-level handle to the plan <svg>, used by PNG export. */
let planSvg: SVGSVGElement | null = null;

export function setPlanSvg(el: SVGSVGElement | null) {
  planSvg = el;
}

export function getPlanSvg(): SVGSVGElement | null {
  return planSvg;
}
