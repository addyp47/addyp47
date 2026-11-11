import { useEffect, useState } from 'react';
import { formatFtIn, parseLength } from '../geometry/units';

/** Text input accepting 7' 6", 90, 7ft 6in… Commits on blur/Enter. */
export function LengthInput({
  value,
  onCommit,
  min = 0.5,
  precise = true,
}: {
  value: number;
  onCommit: (inches: number) => void;
  min?: number;
  precise?: boolean;
}) {
  const [text, setText] = useState(formatFtIn(value, precise));
  useEffect(() => setText(formatFtIn(value, precise)), [value, precise]);
  const commit = () => {
    const v = parseLength(text);
    if (v !== null && v >= min && Math.abs(v - value) > 1e-6) onCommit(v);
    else setText(formatFtIn(value, precise));
  };
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(formatFtIn(value, precise));
      }}
    />
  );
}
