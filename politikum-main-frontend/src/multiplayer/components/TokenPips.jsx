import React from 'react';

export const TokenPips = ({ delta, compact, right, dim }) => {
    const d = Number(delta || 0);
    if (!d) return null;
    const isNeg = d < 0;
    const n = Math.min(10, Math.abs(d));
    const more = Math.max(0, Math.abs(d) - 10);
    return (
      <div
        className={
          "absolute bottom-2 z-20 flex items-center gap-1 " +
          (right ? "right-2" : "left-2") +
          (compact ? " scale-[1.0]" : "") +
          (dim ? " opacity-80" : "")
        }
        style={{ pointerEvents: 'none' }}
      >
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className={
              "w-3.5 h-3.5 rounded-full border shadow-[0_2px_6px_rgba(0,0,0,0.6)] " +
              (isNeg ? "bg-red-700/95 border-red-200/50" : "bg-emerald-700/95 border-emerald-200/50")
            }
          />
        ))}
        {more > 0 && (
          <div
            className={
              "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black border " +
              (isNeg ? "bg-red-900/70 border-red-200/30 text-red-50" : "bg-emerald-900/70 border-emerald-200/30 text-emerald-50")
            }
          >
            ×{more + 10}
          </div>
        )}
      </div>
    );
  };

export const TokenPipsInline = ({ count, neg }) => {
    const d = Math.abs(Number(count || 0));
    if (!d) return null;
    const n = Math.min(10, d);
    const more = Math.max(0, d - 10);
    return (
      <div className="flex items-center gap-1" style={{ pointerEvents: 'none' }}>
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className={
              "w-3 h-3 rounded-full border shadow-[0_2px_6px_rgba(0,0,0,0.6)] " +
              (neg ? "bg-red-700/95 border-red-200/50" : "bg-emerald-700/95 border-emerald-200/50")
            }
          />
        ))}
        {more > 0 && (
          <div
            className={
              "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border " +
              (neg ? "bg-red-900/70 border-red-200/30 text-red-50" : "bg-emerald-900/70 border-emerald-200/30 text-emerald-50")
            }
          >
            ×{more + 10}
          </div>
        )}
      </div>
    );
  };
