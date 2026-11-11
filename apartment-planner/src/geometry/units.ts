/** Format inches as 7' 6" (rounded to the nearest inch, or half inch when precise). */
export function formatFtIn(inches: number, precise = false): string {
  const step = precise ? 0.5 : 1;
  const total = Math.round(Math.abs(inches) / step) * step;
  const ft = Math.floor(total / 12);
  const inch = total - ft * 12;
  const sign = inches < 0 ? '-' : '';
  const inStr = Number.isInteger(inch) ? `${inch}` : inch.toFixed(1);
  if (ft === 0) return `${sign}${inStr}"`;
  if (inch === 0) return `${sign}${ft}'`;
  return `${sign}${ft}' ${inStr}"`;
}

export function formatInches(inches: number): string {
  const r = Math.round(inches * 2) / 2;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}"`;
}

export function formatArea(sqIn: number): string {
  return `${Math.round(sqIn / 144)} sq ft`;
}

/**
 * Parse lengths like `7' 6"`, `7ft 6in`, `7'`, `90"`, `90` (plain = inches), `7.5ft`.
 * Returns inches or null.
 */
export function parseLength(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(?:(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot))?\s*(?:(-?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const ft = m[1] !== undefined ? parseFloat(m[1]) : 0;
  const inch = m[2] !== undefined ? parseFloat(m[2]) : 0;
  const total = ft * 12 + inch;
  return Number.isFinite(total) ? total : null;
}
