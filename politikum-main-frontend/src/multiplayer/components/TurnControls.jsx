import React from "react";

export default function TurnControls({ G, selectedHandCardId, moves, playSfx, safeEndTurn, clearSelectedHandCard, moveInFlight = false, onSurrender = () => {} }) {
  const canDraw = !!G?.choices?.actions?.drawCard && !moveInFlight;
  const canEndTurn = !!G?.choices?.actions?.endTurn && !moveInFlight;
  const pulseStyle = canDraw ? { animationDuration: '1.8s' } : undefined;
  const canDiscardDownTo7 = Object.values(G?.choices?.hand || {}).some(c => c.discardDownTo7);
  const canDiscardSelected = !!G?.choices?.hand?.[String(selectedHandCardId)]?.discardDownTo7 && !moveInFlight;
  const blockByResponse = !!G?.response;

  return (
    <div className="fixed inset-0 z-[1100] pointer-events-none">
      <div className="fixed top-3 z-[20000] pointer-events-auto select-none flex flex-col gap-2" style={{ right: 'min(16px, 1vw)' }}>
        <button type="button" onClick={() => { if (!canEndTurn) return; safeEndTurn(); }} className={"px-4 py-2 rounded-xl bg-amber-600/90 border border-amber-500/30 text-amber-950 font-mono font-black text-[12px] shadow-lg " + (!canEndTurn ? "opacity-50" : "")} title="Закончить ход" aria-disabled={!canEndTurn} disabled={!canEndTurn}>Закончить ход</button>
        <button type="button" onClick={() => { if (!canDraw) return; try { playSfx('draw'); } catch {} moves.drawCard(); }} className={"px-4 py-2 rounded-xl border text-amber-100/90 font-mono font-black text-[12px] transition-colors shadow-lg " + (!canDraw ? "opacity-50 bg-black/60 border-amber-900/25" : (canDraw ? "bg-emerald-700/45 border-emerald-300/60 animate-pulse" : "bg-black/60 border-amber-900/25"))} style={pulseStyle} title={blockByResponse ? "Сначала ответьте на активное окно ответа" : "Взять карту"} aria-disabled={!canDraw} disabled={!canDraw}>Взять карту</button>
        {canDiscardDownTo7 && (
          <button type="button" onClick={() => { if (!canDiscardSelected) return; try { playSfx('ui', 0.25); moves.discardFromHandDownTo7(selectedHandCardId); } catch {} clearSelectedHandCard(); }} className={"mt-2 px-4 py-2 rounded-xl border font-mono font-black text-[12px] transition-colors shadow-lg " + (canDiscardSelected ? "bg-red-600/90 border-red-300/30 text-red-50" : "opacity-50 bg-black/60 border-red-900/25 text-red-200/50")} disabled={!canDiscardSelected}>Сбросить</button>
        )}
        <button type="button" onClick={async () => { try { playSfx('ui', 0.2); } catch {} try { await onSurrender(); } catch {} }} className="px-4 py-2 rounded-xl bg-red-900/45 border border-red-300/20 text-red-100/85 font-mono font-black text-[12px] shadow-lg hover:bg-red-800/55" title="Сдаться и выйти в главное меню">Сдаться</button>
      </div>
    </div>
  );
}
