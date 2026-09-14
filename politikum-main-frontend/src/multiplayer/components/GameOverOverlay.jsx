import React, { useState } from 'react';
import { SERVER } from '../api.js';

export default function GameOverOverlay({ G, matchID, displayCardTitle }) {
  const [goShowAllDetails, setGoShowAllDetails] = useState(false);
  const hoverOppCoalition = {};
  return (G.gameOver && (
        <div
          className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/65 backdrop-blur-sm pointer-events-auto overflow-y-auto py-12"
        >
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[3100] pointer-events-auto">
            <button
              type="button"
              onClick={async () => {
                const m = String(matchID || '').match(/^t_([^_]+)_(\d+)_/);
                const tid = m ? m[1] : null;
                const tableId = m ? m[2] : null;
                if (tid && tableId) {
                  try {
                    await fetch(`${SERVER}/public/tournament/${tid}/table/${tableId}/sync_result`, { method: 'POST' });
                  } catch {}
                  try { window.location.hash = `#/tournament/${tid}`; } catch {}
                } else {
                  // Leave match state (client-side). Also clear persisted last match so reload doesn't re-open gameover.
                  try {
                    window.localStorage.removeItem('politikum.lastMatchID');
                    window.localStorage.removeItem('politikum.lastPlayerID');
                    window.localStorage.removeItem('politikum.lastCredentials');
                  } catch {}
                  try { window.location.hash = ''; } catch {}
                  try { window.location.reload(); } catch {}
                }
              }}
              className="px-4 py-2 rounded-full bg-black/60 border border-amber-900/30 text-amber-100/90 font-mono font-black text-[12px] hover:bg-black/70"
              title={String(matchID || '').startsWith('t_') ? 'Назад в турнир' : 'Назад в лобби'}
            >
              {String(matchID || '').startsWith('t_') ? 'Назад в турнир' : 'Назад в лобби'}
            </button>
          </div>
          <div className="bg-black/70 border border-amber-900/30 rounded-3xl shadow-2xl p-6 w-[1100px] max-w-[96vw] relative max-h-[90vh] overflow-y-auto">
            {/* hitbox debug removed */}
            <button
              type="button"
              onClick={() => setGoShowAllDetails((v) => !v)}
              className="absolute top-4 right-4 z-[3200] px-3 py-2 rounded-xl bg-black/50 hover:bg-black/65 border border-amber-900/25 text-amber-100 font-mono font-black text-[11px]"
              title="Показать детали расчёта"
            >
              Детали
            </button>
            <div className="text-amber-200/80 text-[10px] uppercase tracking-[0.3em] font-black text-center">КОНЕЦ ИГРЫ</div>
            <div className="mt-2 text-amber-100 font-serif text-2xl font-bold text-center">
              Победитель {G.gameOver?.winnerName || (G.players || []).find(p => String(p.id) === String(G.winnerId))?.name || '—'}
            </div>
            {Array.isArray(G.history) && G.history.length >= 2 && (() => {
              const hist = G.history;
              // Use the same ordering for legend + chart: sort by final score DESC.
              const colors = ['#f59e0b', '#22c55e', '#60a5fa', '#f472b6', '#a78bfa'];
              const scoreNow = (pid) => {
                const p = (G.players || []).find((pp) => String(pp.id) === String(pid));
                return (p?.coalition || []).reduce((s, c) => s + Number(c.vp || 0), 0);
              };
              const playerIds = (G.players || [])
                .filter((p) => !!p?.active)
                .filter((p) => {
                  const n = String(p?.name || '').trim();
                  if (!n) return false;
                  if (n.startsWith('[H] Seat')) return false;
                  return true;
                })
                .map((p) => String(p.id))
                .sort((a, b) => scoreNow(b) - scoreNow(a));

              const leftIds = playerIds.slice(0, Math.ceil(playerIds.length / 2));
              const rightIds = playerIds.slice(Math.ceil(playerIds.length / 2));

              const Fan = ({ pid, color }) => {
                const p = (G.players || []).find((pp) => String(pp.id) === String(pid));
                const coal = (p?.coalition || []).filter((c) => c.type === 'persona');
                const show = Math.min(12, coal.length);
                const stepFace = 40;
                const width = 140 + Math.max(0, (show - 1)) * stepFace;
                const hoverIdx = hoverOppCoalition?.[`go-${pid}`] ?? null;

                const scaleByDist2 = (_dist) => 1; // no zoom on win screen

                return (
                  <div className="flex flex-col items-center gap-2 relative pt-10 pointer-events-auto">
                    <div className="absolute -top-10 left-0 flex items-center gap-2 bg-black/55 border border-amber-900/20 rounded-full px-4 py-1 text-[11px] font-mono font-black tracking-widest z-[2000] whitespace-nowrap justify-center" style={{ color }}>
                      <span>{p?.name || pid}</span>
                      <span className="opacity-50">•</span>
                      <span>{scoreNow(pid)} очк</span>
                    </div>
                    <div
                      className="relative h-52 pointer-events-none select-none"
                      style={{ width: Math.max(width, 260) }}
                      // no hover-zoom on win screen
                    >
                      {coal.slice(0, show).map((c, i) => {
                        const t = show <= 1 ? 0.5 : i / (show - 1);
                        const rot = (t - 0.5) * 12;
                        const left = i * stepFace;
                        const dist = (hoverIdx == null) ? 99 : Math.abs(i - hoverIdx);
                        const scale = (hoverIdx == null) ? 1 : scaleByDist2(dist);
                        const z = (hoverIdx == null) ? i : (1000 - dist);
                        return (
                          <div
                            key={c.id}
                            className="absolute bottom-0 w-40 aspect-[2/3] rounded-2xl overflow-hidden border border-black/40 shadow-2xl pointer-events-none"
                            style={{ left, zIndex: z, transform: `rotate(${rot}deg) scale(${scale})`, transformOrigin: 'center center' }}
                          >
                            <img src={c.img} alt={displayCardTitle(c)} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                            {(Number(c.vpDelta || 0) !== 0) && (
                              <div className={
                                "absolute left-2 bottom-2 w-8 h-8 rounded-full border flex items-center justify-center text-white font-black text-[14px] " +
                                (Number(c.vpDelta || 0) < 0 ? "bg-red-700/90 border-red-200/30" : "bg-emerald-700/90 border-emerald-200/30")
                              }>
                                {c.vpDelta}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-player details section (toggled by top-right button) */}
                    {goShowAllDetails && (
                      <div className="w-full max-w-[520px] px-1">
                        <div className="mt-1 space-y-0.5 text-[10px] font-mono text-amber-100/70">
                          {coal.map((c) => {
                            const base = Number(c.baseVp ?? 0);
                            const tok = Number(c.vpDelta || 0);
                            const pas = Number(c.passiveVpDelta || 0);
                            const total = Number(c.vp ?? (base + tok + pas));
                            return (
                              <div key={c.id} className="flex items-baseline justify-between gap-3">
                                <span className="truncate">{String(c.name || c.id)}</span>
                                <span className="shrink-0 tabular-nums">
                                  {base}{tok ? ` ${tok > 0 ? '+' : ''}${tok}` : ''}{pas ? ` ${pas > 0 ? '+' : ''}${pas}` : ''} = {total}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* per-player details button removed */}
                  </div>
                );
              };

              return (
                <>
                  {/* Score history chart (turn vs VP) */}
                  {(() => {
                    const turns = hist.map((h) => Number(h.turn || 0));
                    const minT = Math.min(...turns);
                    const maxT = Math.max(...turns);

                    const allScores = hist.flatMap((h) => playerIds.map((pid) => Number(h.scores?.[pid] ?? 0)));
                    const minY = Math.min(0, ...allScores);
                    const maxY = Math.max(1, ...allScores);

                    const W = 460, H = 160, pad = 18;
                    const sx = (t) => pad + ((t - minT) / Math.max(1, (maxT - minT))) * (W - pad * 2);
                    const sy = (v) => (H - pad) - ((v - minY) / Math.max(1, (maxY - minY))) * (H - pad * 2);

                    const pathFor = (pid) => {
                      const pts = hist.map((h) => ({ x: sx(Number(h.turn || 0)), y: sy(Number(h.scores?.[pid] ?? 0)) }));
                      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                    };

                    return (
                      <div className="mt-4">
                        <div className="text-amber-200/60 text-[10px] uppercase tracking-[0.3em] font-black text-center">История успеха</div>
                        <svg width={W} height={H} className="mt-2 mx-auto block rounded-xl bg-black/25 border border-amber-900/20">
                          {/* axes */}
                          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(251,191,36,0.25)" />
                          <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="rgba(251,191,36,0.25)" />

                          {/* axis labels */}
                          <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="rgba(251,191,36,0.55)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">ход</text>
                          <text x={6} y={H / 2} textAnchor="middle" fontSize={9} fill="rgba(251,191,36,0.55)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" transform={`rotate(-90 6 ${H / 2})`}>очки</text>

                          {/* ticks */}
                          {(() => {
                            const ticksY = 4;
                            const out = [];
                            for (let i = 0; i <= ticksY; i++) {
                              const v = minY + ((maxY - minY) * i) / ticksY;
                              const y = sy(v);
                              out.push(
                                <g key={`y-${i}`}>
                                  <line x1={pad - 4} y1={y} x2={pad} y2={y} stroke="rgba(251,191,36,0.25)" />
                                  <text x={pad - 7} y={y + 3} textAnchor="end" fontSize={9} fill="rgba(251,191,36,0.55)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">{Math.round(v)}</text>
                                </g>
                              );
                            }
                            const ticksX = Math.min(6, Math.max(1, maxT - minT));
                            for (let i = 0; i <= ticksX; i++) {
                              const t = minT + Math.round(((maxT - minT) * i) / ticksX);
                              const x = sx(t);
                              out.push(
                                <g key={`x-${i}`}>
                                  <line x1={x} y1={H - pad} x2={x} y2={H - pad + 4} stroke="rgba(251,191,36,0.25)" />
                                  <text x={x} y={H - pad + 14} textAnchor="middle" fontSize={9} fill="rgba(251,191,36,0.55)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">{t}</text>
                                </g>
                              );
                            }
                            return out;
                          })()}

                          {playerIds.map((pid, i) => (
                            <path key={pid} d={pathFor(pid)} fill="none" stroke={colors[i % colors.length]} strokeWidth={2.5} opacity={0.95} />
                          ))}
                        </svg>
                      </div>
                    );
                  })()}

                  {/* Final coalitions: single bottom row */}
                  <div className="mt-6 flex justify-evenly gap-6 items-end flex-wrap">
                    {playerIds.map((pid, i) => (
                      <Fan key={pid} pid={pid} color={colors[i % colors.length]} />
                    ))}
                  </div>

                  {/* Global details removed: now rendered under each player */}
                </>
              );
            })()}

            {/* fallback if no history */}
            {(!Array.isArray(G.history) || G.history.length < 2) && (
              <div className="mt-4 text-amber-100/80 text-sm font-mono whitespace-pre">
                {(G.players || [])
                  .filter((p) => !!p?.active)
                  .filter((p) => {
                    const n = String(p?.name || '').trim();
                    if (!n) return false;
                    if (n.startsWith('[H] Seat')) return false;
                    return true;
                  })
                  .map((p) => {
                    const pts = (p.coalition || []).reduce((s, c) => s + Number(c.vp || 0), 0);
                    return `${p.name}: ${pts} очк (коалиция ${(p.coalition || []).length})`;
                  }).join('\n')}
              </div>
            )}

            {/* (removed) */}
          </div>
        </div>
      ));
}
