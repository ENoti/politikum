import React from "react";

export default function ResponsePanel({ reactions = {}, hand = [], moves, responseActive, responseKey, responseKind, responseSecondsLeft, setSkippedResponseKey, skippedResponseKey }) {
  const { persona10Cancel: canPersona10Cancel, persona8Swap: canPersona8Swap } = reactions;
  const c6 = hand.find(c => String(c.id) === reactions.cancelActionCardId);
  const c8 = hand.find(c => String(c.id) === reactions.cancelPersonaCardId);
  const c14 = hand.find(c => String(c.id) === reactions.cancelEffectCardId);
  const haveAction6 = !!c6;
  const haveAction14 = !!c14;
  const canShowResponse = responseActive && responseKey !== skippedResponseKey && !!(c6 || c8 || c14 || canPersona10Cancel || canPersona8Swap);
  return canShowResponse ? (
    <div className="fixed inset-0 z-[6000] pointer-events-none select-none">
      {responseKind === 'cancel_action' && (
        <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 bg-black/70 border border-amber-900/30 rounded-full px-5 py-3 text-amber-100/90 font-mono text-[12px] shadow-2xl flex items-center gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div>{haveAction6 && 'Сыграно действие — ответьте картой 6, чтобы отменить'}{!haveAction6 && haveAction14 && 'Вы стали целью — ответьте картой 14, чтобы отменить эффект'}{!haveAction6 && !haveAction14 && canPersona10Cancel && 'Вы можете позвать маму Наки, чтобы отменить действие'}<span className="ml-3 text-amber-200/70">{responseSecondsLeft}s</span></div>
            {haveAction6 && c6 && <button data-testid="response-action-6" type="button" onClick={() => { try { moves.playAction(c6.id); } catch {} }} className="px-3 py-1 rounded-full bg-emerald-700/60 hover:bg-emerald-600/70 border border-emerald-200/20 text-emerald-50 font-black text-[11px]">Сыграть карту 6</button>}
            {c14 && <button data-testid="response-action-14" type="button" onClick={() => moves.playAction(c14.id)} className="px-3 py-1 rounded-full bg-emerald-700/60 hover:bg-emerald-600/70 border border-emerald-200/20 text-emerald-50 font-black text-[11px]">Сыграть карту 14</button>}
            {canPersona10Cancel && <button type="button" onClick={() => { try { moves.persona10CancelFromCoalition(); } catch {} }} className="px-3 py-1 rounded-full bg-fuchsia-700/50 hover:bg-fuchsia-600/60 border border-fuchsia-200/20 text-fuchsia-50 font-black text-[11px]">Отмена p10</button>}
          </div>
        </div>
      )}
      {responseKind === 'cancel_persona' && (
        <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 pointer-events-auto">
          {c8 && <><button data-testid="response-action-8" type="button" className="px-4 py-1.5 rounded-xl bg-emerald-700/60 hover:bg-emerald-600/70 border border-emerald-200/20 text-emerald-50 font-black text-[12px] shadow-2xl" onClick={() => { try { moves.playAction(c8.id); } catch {} }} >ИСПОЛЬЗОВАТЬ</button><div className="w-48 aspect-[2/3] rounded-3xl overflow-hidden border border-black/50 shadow-[0_30px_80px_rgba(0,0,0,0.65)]"><img src={c8.img} alt={String(c8?.name || "Работа на Кремль")} className="w-full h-full object-cover" draggable={false} /></div></>}
          <button type="button" className="px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 border border-amber-900/20 text-amber-50 font-black text-[12px] shadow-2xl" onClick={() => { try { setSkippedResponseKey(responseKey); window.localStorage.setItem(`politikum.skipResponse:${responseKey}`, String(Date.now())); } catch {} try { moves.skipResponseWindow(); } catch {} }} >ПРОПУСТИТЬ</button>
          {canPersona8Swap && <button type="button" className="px-3 py-2 rounded-xl bg-purple-800/50 hover:bg-purple-700/60 border border-purple-200/20 text-purple-50 font-black text-[12px] shadow-2xl" onClick={() => { try { moves.persona8SwapWithPlayedPersona(); } catch {} }} >p8 обмен</button>}
          <div className="absolute left-1/2 top-[-28px] -translate-x-1/2 text-amber-200/70 font-mono text-[12px]">Окно ответа для карты «Работа на Кремль» · {responseSecondsLeft}с</div>
        </div>
      )}
    </div>
  ) : null;
}
