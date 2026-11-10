import { useId } from 'react';
import type { BagStatus } from '../types';
import { STATUS_META } from '../lib/status';

interface Props {
  percent: number;
  status: BagStatus;
  /** Where the LOW threshold sits, as a percentage of the bag (draws a dashed marker). */
  lowPercent?: number;
  /** Where the CRITICAL threshold sits, as a percentage of the bag (draws a red dashed marker). */
  criticalPercent?: number;
  size?: 'sm' | 'lg';
}

/** SVG IV bag whose fill height follows the remaining percentage.
 *  Features:
 *  - Animated wave on the fluid surface
 *  - Low (amber) and Critical (red) threshold dashed lines
 *  - Glow ring around bag border when CRITICAL
 */
export function FluidLevelIndicator({
  percent,
  status,
  lowPercent,
  criticalPercent,
  size = 'sm',
}: Props) {
  const clipId = useId();
  const waveId = useId();
  const fillGradId = useId();
  const top = 22;
  const height = 110;
  const pct = Math.min(100, Math.max(0, percent));
  const fillH = (height * pct) / 100;
  const fillY = top + height - fillH;
  const fault = status === 'SENSOR_FAULT';
  const isCritical = status === 'CRITICAL';
  const color = fault ? '#94a3b8' : STATUS_META[status].hex;
  const lowY =
    lowPercent !== undefined ? top + height - (height * Math.min(100, lowPercent)) / 100 : null;
  const critY =
    criticalPercent !== undefined
      ? top + height - (height * Math.min(100, criticalPercent)) / 100
      : null;
  const dim = size === 'lg' ? 'h-64 w-44' : 'h-32 w-24';

  return (
    <svg
      viewBox="0 0 100 160"
      className={`${dim} shrink-0`}
      role="img"
      aria-label={fault ? 'Fluid level unavailable: sensor fault' : `Fluid level ${pct.toFixed(0)} percent`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M20 22 H80 Q90 22 90 32 V122 Q90 134 78 134 H22 Q10 134 10 122 V32 Q10 22 20 22 Z" />
        </clipPath>
        {/* Fluid body shades from a bright surface down to a deeper tone */}
        <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.68" />
        </linearGradient>
        {/* Wave pattern for fluid surface animation */}
        <pattern id={waveId} x="0" y="0" width="100" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q12.5 0 25 4 Q37.5 8 50 4 Q62.5 0 75 4 Q87.5 8 100 4 L100 8 L0 8 Z"
            fill={color} opacity={fault ? 0.35 : 0.85}>
            <animateTransform
              attributeName="patternTransform"
              type="translate"
              from="0 0"
              to="-25 0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
        </pattern>
      </defs>

      {/* Glow ring for CRITICAL status */}
      {isCritical && (
        <path
          d="M20 22 H80 Q90 22 90 32 V122 Q90 134 78 134 H22 Q10 134 10 122 V32 Q10 22 20 22 Z"
          fill="none"
          stroke="#dc2626"
          strokeWidth="4"
          opacity="0.4"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 5px rgba(220, 38, 38, 0.55))' }}
        >
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.2s" repeatCount="indefinite" />
        </path>
      )}

      {/* Bag background */}
      <circle cx="50" cy="10" r="5" fill="none" stroke="#475569" strokeWidth="2" />
      <path
        d="M20 22 H80 Q90 22 90 32 V122 Q90 134 78 134 H22 Q10 134 10 122 V32 Q10 22 20 22 Z"
        fill="#f1f5f9"
      />

      {/* Clipped fluid fill + scale marks + threshold lines */}
      <g clipPath={`url(#${clipId})`}>
        {/* Solid body of fluid */}
        <rect
          x="0"
          y={fillY + 4}
          width="100"
          height={fillH}
          fill={`url(#${fillGradId})`}
          opacity={fault ? 0.35 : 1}
          style={{ transition: 'y 600ms ease, height 600ms ease' }}
        />
        {/* Specular highlight down the left edge of the fluid */}
        {!fault && fillH > 30 && (
          <rect x="16" y={fillY + 12} width="7" height={Math.max(0, fillH - 20)} rx="3.5" fill="#ffffff" opacity="0.18" />
        )}
        {/* Slow bubbles rising through the fluid */}
        {!fault && fillH > 40 && (
          <>
            <circle cx="34" cy={fillY + fillH - 10} r="2.4" fill="#ffffff" opacity="0" className="ds-bubble" />
            <circle cx="64" cy={fillY + fillH - 16} r="1.8" fill="#ffffff" opacity="0" className="ds-bubble"
              style={{ animationDelay: '2.2s' }} />
            <circle cx="52" cy={fillY + fillH - 8} r="1.4" fill="#ffffff" opacity="0" className="ds-bubble"
              style={{ animationDelay: '3.4s' }} />
          </>
        )}
        {/* Animated wave on top of fluid */}
        {!fault && fillH > 6 && (
          <rect x="0" y={fillY} width="100" height="8" fill={`url(#${waveId})`} />
        )}
        {/* Scale tick marks at 25 %, 50 %, 75 % */}
        {[25, 50, 75].map((m) => {
          const y = top + height - (height * m) / 100;
          return (
            <line
              key={m}
              x1="10"
              x2="26"
              y1={y}
              y2={y}
              stroke="#0b1f3a"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          );
        })}
        {/* LOW threshold line (amber dashed) */}
        {lowY !== null && (
          <line
            x1="10"
            x2="90"
            y1={lowY}
            y2={lowY}
            stroke="#b45309"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}
        {/* CRITICAL threshold line (red dashed) */}
        {critY !== null && (
          <line
            x1="10"
            x2="90"
            y1={critY}
            y2={critY}
            stroke="#dc2626"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
      </g>

      {/* Bag border outline */}
      <path
        d="M20 22 H80 Q90 22 90 32 V122 Q90 134 78 134 H22 Q10 134 10 122 V32 Q10 22 20 22 Z"
        fill="none"
        stroke="#334155"
        strokeWidth="2.5"
      />
      {/* IV drip tube */}
      <rect x="45" y="134" width="10" height="16" rx="2" fill="#94a3b8" />
      {/* Percentage text */}
      <text
        x="50"
        y="80"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="20"
        fontWeight="700"
        fill={fault ? '#475569' : pct > 45 ? '#ffffff' : '#0b1f3a'}
      >
        {fault ? '?' : `${pct.toFixed(0)}%`}
      </text>
    </svg>
  );
}
