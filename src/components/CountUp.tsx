import { useCountUp } from '../lib/useMotion';

/** Number that eases to its new value; pair with tabular-nums on the parent. */
export function CountUp({ value, decimals = 0, className }: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const display = useCountUp(Number.isFinite(value) ? value : 0);
  return <span className={className}>{display.toFixed(decimals)}</span>;
}
