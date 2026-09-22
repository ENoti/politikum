import React from 'react';

export default function PersonaHandPicker({ targetName, targetId, cards = [], onPick, displayCardTitle }) {
  return (
    <div className="fixed inset-x-0 top-14 z-[9600] flex items-start justify-center pointer-events-none select-none">
      <div className="pointer-events-auto bg-black/75 border border-amber-900/30 rounded-3xl shadow-2xl p-4 max-w-[96vw]">
        <div className="text-amber-200/70 text-[11px] font-mono font-black tracking-widest">
          p17: выберите персону из руки {targetName || targetId}
        </div>
        <div className="mt-3 flex gap-3 flex-wrap justify-center">
          {cards.map((card) => (
            <button key={card.id} data-testid={`persona-hand-card-${card.id}`} type="button" className="w-40 aspect-[2/3] rounded-2xl overflow-hidden border border-emerald-400/40 hover:border-emerald-300 cursor-pointer shadow-2xl hover:scale-[1.02] transition-transform" onClick={() => onPick(card.id)} title={displayCardTitle(card)}>
              <img src={card.img} alt={displayCardTitle(card)} className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
          {!cards.length && <div className="text-amber-200/70 text-sm">В руке нет персонажей.</div>}
        </div>
      </div>
    </div>
  );
}
