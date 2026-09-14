import React from 'react';

/**
 * Layout shell for the player's hand fan.
 * Card behaviour stays supplied by the parent while the panel owns the
 * fixed positioning and hover hit area.
 */
export default function HandPanel({
  handWidth,
  cards,
  handStep,
  setHoverHandIndex,
  children,
}) {
  return (
    <div className="fixed z-[999] pointer-events-auto bottom-2 left-1/2 -translate-x-1/2">
      <div
        className="relative h-56 overflow-visible"
        style={{ width: `${handWidth}px`, marginLeft: 'auto' }}
        onMouseMove={(e) => {
          if (!cards.length) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const idx = Math.max(0, Math.min(cards.length - 1, Math.round(x / handStep)));
          setHoverHandIndex(idx);
        }}
        onMouseLeave={() => setHoverHandIndex(null)}
      >
        {children}
      </div>
    </div>
  );
}
