import React from 'react';

export default function DiscardPicker({ kind, cards = [], title, description, onPick, displayCardTitle }) {
  const empty = kind === 'action18' ? 'В сбросе нет персонажей.' : 'В сбросе нет карт.';
  return (
    <div className="fixed inset-0 z-[3200] flex items-center justify-center bg-transparent backdrop-filter pointer-events-auto">
      <div className="bg-black/70 border border-amber-900/30 rounded-3xl shadow-2xl p-5 w-[860px] max-w-[96vw]">
        <div className="text-amber-200/80 text-[10px] uppercase tracking-[0.3em] font-black">{title}</div>
        <div className="mt-2 text-amber-100/80 text-sm">{description}</div>
        <div className="mt-4 flex flex-wrap gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {cards.map((card) => (
            <button key={card.id} data-testid={`discard-card-${card.id}`} type="button" className="w-40 aspect-[2/3] rounded-2xl overflow-hidden border border-black/40 shadow-2xl hover:scale-[1.02] transition-transform" onClick={() => onPick(card.id)} title={displayCardTitle(card)}>
              <img src={card.img} alt={displayCardTitle(card)} className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
          {!cards.length && <div className="text-amber-200/70 text-sm">{empty}</div>}
        </div>
      </div>
    </div>
  );
}
