import React from 'react';

/** Layout shell for the opponent card fans. */
export default function OpponentBoard({ opponents, crowdedTable, opponentsWrapStyle, children }) {
  return (
    <div
      className={"fixed top-20 z-[700] pointer-events-auto " + (crowdedTable ? 'grid' : 'flex justify-start gap-6')}
      style={opponents.length === 1 ? { left: '50%', transform: 'translateX(-50%)' } : opponentsWrapStyle}
    >
      {children}
    </div>
  );
}
