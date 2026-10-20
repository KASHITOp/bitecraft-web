/** Progress ring. Goes chilli-red when more than 10% over target. */
export function Ring({
  value,
  target,
  label,
  unit,
  color = "var(--accent)",
  testId,
}: {
  value: number;
  target: number;
  label: string;
  unit: string;
  color?: string;
  testId?: string;
}) {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? value / target : 0;
  const over = pct > 1.1;
  const shown = Math.min(1, pct);
  return (
    <figure className="flex flex-col items-center" data-testid={testId}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "var(--chilli)" : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - shown)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-2xl font-bold leading-none" data-testid={testId ? `${testId}-value` : undefined}>
            {Math.round(value)}
          </span>
          <span className="num mt-1 text-xs text-muted">
            of {Math.round(target)} {unit}
          </span>
        </div>
      </div>
      <figcaption className="mt-2 text-sm font-semibold">
        {label} <span className="num font-normal text-muted">{Math.round(pct * 100)}%</span>
      </figcaption>
    </figure>
  );
}
