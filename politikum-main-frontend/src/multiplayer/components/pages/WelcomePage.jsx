import React, { useEffect, useMemo, useState } from 'react';
import { SERVER, createMatchApi, getMatchApi, joinMatchApi, renameMatchOwnerApi, deleteMatchOwnerApi } from '../../api.js';
import usePublicLobbyData from '../../hooks/usePublicLobbyData.js';
import usePublicProfile from '../../hooks/usePublicProfile.js';
import NewsPanel from '../content/NewsPanel.jsx';
import PublicProfileModal from '../profile/PublicProfileModal.jsx';

const NAMES = [
  'Hakon', 'Rixa', 'Gisela', 'Dunstan', 'Irmgard', 'Cedric', 'Freya', 'Ulric', 'Yolanda', 'Tristan',
  'Beatrix', 'Lambert', 'Maude', 'Odilia', 'Viggo', 'Sibylla', 'Katarina', 'Norbert', 'Quintus',
];

function SectionCard({ title, eyebrow, right, className = '', children }) {

  return (
    <div
      className="relative min-h-screen w-screen overflow-hidden text-slate-100"
      style={{
        backgroundImage: "url('/assets/lobby_bg.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#09111a',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_22%,rgba(255,225,155,0.48),rgba(255,225,155,0.16)_20%,transparent_44%),linear-gradient(180deg,rgba(4,10,18,0.18)_0%,rgba(6,11,17,0.18)_34%,rgba(12,8,6,0.44)_73%,rgba(9,11,17,0.88)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[180px] bg-[linear-gradient(180deg,rgba(251,191,36,0)_0%,rgba(251,191,36,0.10)_40%,rgba(251,191,36,0.26)_68%,rgba(7,12,20,0.92)_100%)]" />

      {showRules && (
        <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-[min(1100px,96vw)] h-[min(88vh,900px)] rounded-3xl border border-amber-700/30 bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-900/30 bg-black/30">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/60">Правила игры</div>
                <div className="text-xl font-black text-amber-50">Политикум — инструкция</div>
              </div>
              <button type="button" onClick={() => setShowRules(false)} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-amber-950 font-black uppercase tracking-widest">Закрыть</button>
            </div>
            <div className="flex-1 bg-white/95">
              <object data="/politikum-rules.pdf" type="application/pdf" className="w-full h-full">
                <iframe src="/politikum-rules.pdf" title="Правила игры Политикум" className="w-full h-full" />
              </object>
            </div>
          </div>
        </div>
      )}

      {showWhereAmI && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto">
          <div className="w-[min(1100px,95vw)] max-h-[92vh] overflow-auto rounded-2xl border border-amber-900/30 bg-black/60 shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-amber-100 font-black text-sm">Что я? Где я?</div></div>
              <button type="button" onClick={() => setShowWhereAmI(false)} className="px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest">Закрыть (Esc)</button>
            </div>
            <div className="mt-4"><img src="/assets/ui/tutorial.webp" alt="Tutorial" className="w-full rounded-xl border border-amber-900/20 shadow-[0_30px_80px_rgba(0,0,0,0.55)]" draggable={false} /></div>
          </div>
        </div>
      )}

      <PublicProfileModal open={showProfile} onClose={closeProfile} loading={profileLoading} error={profileErr} profile={profile} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="h-[38px] border-b border-amber-300/25 bg-[linear-gradient(180deg,rgba(5,18,30,0.96),rgba(10,28,42,0.90))] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex h-full max-w-[1380px] items-center justify-between px-4 text-white/95">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-7 w-7 rounded-full border border-amber-300/45 bg-[radial-gradient(circle_at_30%_30%,rgba(250,220,120,0.9),rgba(145,111,30,0.95))] shadow-[0_0_14px_rgba(255,210,100,0.28)]" />
              <div className="max-w-[180px] truncate text-[16px] font-semibold">{String(playerName || 'Игрок_007').trim() || 'Игрок_007'}</div>
            </div>
            <div className="hidden md:flex items-center gap-5 text-[14px] font-semibold">
              <div className="flex items-center gap-2 rounded-full bg-black/18 px-3 py-1 ring-1 ring-white/8">
                <span className="text-[18px]">🪙</span>
                <span>1,500</span>
              </div>
              <div className="text-[18px]">💎</div>
              {authToken ? (
                <button
                  type="button"
                  onClick={() => {
                    try { window.localStorage.removeItem('politikum.authToken'); } catch {}
                    try { window.localStorage.removeItem('politikum.sessionPlayerId'); } catch {}
                    setAuthToken('');
                    setAuthRating(null);
                  }}
                  className="min-w-[112px] rounded-md border border-amber-200/50 bg-[linear-gradient(180deg,#d9c17d,#b18a35)] px-4 py-1.5 text-center text-[14px] font-black text-stone-950 shadow-[inset_0_1px_0_rgba(255,245,200,0.45)]"
                >
                  Выйти
                </button>
              ) : (
                <button type="button" onClick={doBetaLogin} disabled={betaLoading || !String(betaPassword || '').trim()} className="min-w-[112px] rounded-md border border-amber-200/50 bg-[linear-gradient(180deg,#d9c17d,#b18a35)] px-4 py-1.5 text-center text-[14px] font-black text-stone-950 shadow-[inset_0_1px_0_rgba(255,245,200,0.45)] disabled:opacity-60">
                  {betaLoading ? '...' : 'Войти'}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1380px] flex-1 px-4 pt-7 pb-[92px]">
          <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[350px_minmax(0,1fr)_450px] xl:grid-rows-[118px_1fr_auto]">
            <div className="xl:col-start-1 xl:row-start-1 self-end">
              <div className="w-[220px] rounded-[2px] border border-[#d2aa58]/60 bg-[linear-gradient(180deg,rgba(10,28,46,0.92),rgba(4,18,34,0.92))] shadow-[0_12px_30px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#c99e50]/35">
                  <div className="text-[16px] font-semibold text-[#f2cc79]">Новости</div>
                  <button type="button" className="text-[#d8b56c] text-[18px] leading-none">×</button>
                </div>
                <div className="min-h-[96px] px-4 py-3 text-[#f5d78f]">
                  <NewsPanel />
                </div>
              </div>
            </div>

            <div className="xl:col-start-2 xl:row-start-1 xl:row-span-2 flex flex-col items-center pt-2 text-center">
              <div className="mt-2 text-[86px] leading-[0.88] md:text-[118px] xl:text-[138px] font-black uppercase tracking-[-0.04em] text-[#fff4cf] drop-shadow-[0_0_12px_rgba(255,220,140,0.68)]">
                ПОЛИ<br />ТИКУМ
              </div>
              <div className="mt-4 text-[22px] md:text-[24px] font-semibold text-[#fff5d6] drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                Собери оппозиционеров за одним столом!
              </div>

              <div className="mt-auto pb-2 xl:pb-6 flex flex-col items-center">
                <button
                  onClick={createMatch}
                  disabled={loading}
                  className="min-w-[290px] md:min-w-[314px] rounded-[10px] border border-[#ffd88f]/60 bg-[linear-gradient(180deg,#f19a34,#dd6c1d)] px-10 py-4 text-[24px] font-black uppercase tracking-[-0.02em] text-[#fff7df] shadow-[0_10px_0_rgba(132,58,14,0.6),0_0_0_3px_rgba(255,214,134,0.18),0_14px_34px_rgba(0,0,0,0.26)] transition hover:brightness-105 active:translate-y-[1px] disabled:opacity-60"
                >
                  Создать игру
                </button>
                <div className="mt-5 max-w-[520px] text-center text-[18px] leading-tight text-[#1d1711] font-semibold drop-shadow-[0_1px_0_rgba(255,245,220,0.42)]">
                  Создай lobby и пригласи друзей. Или зайди в уже открытое.
                </div>
              </div>
            </div>

            <div className="xl:col-start-1 xl:row-start-2 self-start">
              <div className="rounded-[2px] border border-[#d2aa58]/60 bg-[linear-gradient(180deg,rgba(7,24,40,0.97),rgba(3,18,34,0.97))] shadow-[0_16px_38px_rgba(0,0,0,0.42)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#c99e50]/35">
                  <div className="text-[16px] font-semibold text-[#f2cc79]">Чат лобби</div>
                  <button type="button" className="text-[#d8b56c] text-[18px] leading-none">×</button>
                </div>
                <div className="h-[250px] md:h-[286px] xl:h-[258px] px-4 py-4 overflow-y-auto text-[18px] leading-[1.6] text-[#e6eef9] custom-scrollbar">
                  {!!lobbyChatErr && <div className="mb-2 text-[14px] text-red-300/90">Chat error: {lobbyChatErr}</div>}
                  {!(lobbyChat || []).length && !lobbyChatErr && (
                    <>
                      <div><span className="text-[#f5c15d]">[Админ]</span> <span className="text-white">Добро пожаловать в lobby!</span></div>
                      <div><span className="text-[#5dc2ff]">[{String(playerName || 'Игрок_007').trim() || 'Игрок_007'}]</span> <span className="text-white">Привет всем!</span></div>
                      <div><span className="text-[#f5c15d]">[Игрок_42]</span> <span className="text-white">Готовы к старту?</span></div>
                    </>
                  )}
                  {(lobbyChat || []).map((m, idx) => {
                    const isMe = String(m?.name || '') === String(playerName || '');
                    return (
                      <div key={m.id ?? idx} className="mb-1.5 pr-12">
                        <span
                          className={isMe ? 'text-[#5dc2ff] cursor-pointer' : 'text-[#f5c15d] cursor-pointer'}
                          onClick={() => { if (m?.playerId) openProfileById(m.playerId); }}
                        >
                          [{m.name || m.playerId || 'Anon'}]
                        </span>{' '}
                        <span className="text-white">{m.text}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 pb-4">
                  <div className="flex gap-2">
                    <input
                      value={lobbyChatInput}
                      onChange={(e) => setLobbyChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendLobbyChat();
                        }
                      }}
                      placeholder={authToken ? (lobbyChatEnabled ? '' : 'Чат выключен') : 'Войди, чтобы писать...'}
                      disabled={!authToken || !lobbyChatEnabled}
                      className="h-[46px] flex-1 rounded-[2px] border border-[#436180] bg-[rgba(7,18,29,0.92)] px-4 text-[18px] text-white outline-none placeholder:text-white/35 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={sendLobbyChat}
                      disabled={!authToken || !lobbyChatEnabled || !String(lobbyChatInput || '').trim()}
                      className="min-w-[82px] rounded-[8px] border border-[#ffd88f]/60 bg-[linear-gradient(180deg,#d7b254,#b8871f)] px-4 py-2 text-[15px] font-bold text-[#1b140d] shadow-[inset_0_1px_0_rgba(255,240,185,0.48)] disabled:opacity-60"
                    >
                      Отправить
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-start-3 xl:row-start-2 self-start">
              <div className="rounded-[2px] border border-[#d2aa58]/60 bg-[linear-gradient(180deg,rgba(9,26,41,0.97),rgba(4,18,34,0.97))] shadow-[0_16px_38px_rgba(0,0,0,0.42)] overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-[#c99e50]/35">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[16px] font-semibold text-[#f2cc79]">Список игр</div>
                    <div className="text-[16px] font-semibold text-[#f2cc79]">Лобби и подключение</div>
                  </div>
                  <div className="mt-3 flex gap-4 text-[14px]">
                    {['games', 'top10', 'tournaments'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setRightTab(tab)}
                        className={
                          'border-b pb-1 transition ' +
                          (rightTab === tab ? 'border-[#f1c76b] text-[#f1c76b]' : 'border-transparent text-white/55 hover:text-white/85')
                        }
                      >
                        {tab === 'games' ? 'Лобби' : tab === 'top10' ? 'Топ-10' : 'Турниры'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-[250px] md:h-[286px] xl:h-[258px] overflow-y-auto px-3 py-3 custom-scrollbar">
                  {rightTab === 'top10' && (
                    <div className="space-y-2">
                      {(top10 || []).length ? top10.slice(0, 10).map((r, i) => (
                        <button key={i} type="button" onClick={() => {
                          const pid = String(r?.playerId || r?.player_id || '').trim();
                          if (pid) openProfileById(pid);
                        }} className="flex w-full items-center justify-between rounded-[2px] border border-[#33506a] bg-[rgba(8,21,34,0.82)] px-3 py-2 text-left hover:bg-[rgba(11,28,45,0.95)]">
                          <div>
                            <div className="text-[16px] text-white">#{i + 1} {r.name}</div>
                            <div className="text-[12px] text-white/55">Игры {Number(r.games ?? 0) || 0} · Победы {Number(r.wins ?? 0) || 0}</div>
                          </div>
                          <div className="text-[18px] font-bold text-[#f4ca76]">{Number(r.rating ?? 0) || 0}</div>
                        </button>
                      )) : <div className="px-2 py-4 text-sm text-white/50">Пока пусто.</div>}
                    </div>
                  )}

                  {rightTab === 'tournaments' && (
                    <div className="space-y-2">
                      {tournamentsErr && <div className="px-2 py-2 text-sm text-white/55">{tournamentsErr}</div>}
                      {(tournaments || []).slice(0, 10).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { window.location.hash = `#/tournament/${t.id}`; }}
                          className="w-full rounded-[2px] border border-[#33506a] bg-[rgba(8,21,34,0.82)] px-3 py-3 text-left hover:bg-[rgba(11,28,45,0.95)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[16px] text-white">{t.name || t.id}</div>
                            <div className="text-[11px] uppercase text-[#f1c76b]">{t.status}</div>
                          </div>
                          <div className="mt-1 text-[12px] text-white/55">{t.type} · стол {t.tableSize} · игроков {t.playersCount}{t.config?.maxPlayers ? `/${t.config.maxPlayers}` : ''}</div>
                        </button>
                      ))}
                      {!(tournaments || []).length && !tournamentsErr && <div className="px-2 py-4 text-sm text-white/50">Нет открытых турниров.</div>}
                    </div>
                  )}

                  {rightTab === 'games' && (
                    <div className="space-y-2.5">
                      {publicMatches.map((match, idx) => {
                        const title = String(match?.setupData?.lobbyTitle || '').trim();
                        const host = match.setupData?.hostName || 'Лобби';
                        const displayName = title || host;
                        const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
                        const activeSeats = seats.filter((p) => p?.name || p?.isBot || p?.isConnected).length;
                        const maxSeats = seats.length || 5;
                        const thumbHue = (idx * 47 + 18) % 360;
                        return (
                          <div key={match.matchID} className="flex items-center gap-3 rounded-[2px] border border-[#3d5874] bg-[rgba(8,21,34,0.82)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[2px] border border-[#8ca2b9]/25 bg-[rgba(26,45,65,0.94)]">
                              <div className="flex h-full w-full items-center justify-center text-[22px] font-black text-white/90" style={{ background: `linear-gradient(135deg, hsla(${thumbHue},58%,62%,0.95), hsla(${(thumbHue + 45) % 360},60%,34%,0.95))` }}>
                                {displayName.slice(0, 1).toUpperCase() || 'Л'}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[18px] leading-tight text-white">Лобби “{displayName}”</div>
                              <div className="mt-0.5 truncate text-[12px] leading-tight text-white/60">{activeSeats}/{maxSeats} · Режим: Классика · Пинг: {45 + (idx % 4) * 15}ms</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => joinMatch(match.matchID)}
                              className="shrink-0 rounded-[8px] border border-[#ffe0a7]/55 bg-[linear-gradient(180deg,#d7b254,#b8871f)] px-4 py-2 text-[14px] font-bold text-[#1b140d] shadow-[inset_0_1px_0_rgba(255,240,185,0.48)] hover:brightness-105"
                            >
                              Присоединиться
                            </button>
                          </div>
                        );
                      })}
                      {(!publicMatches || publicMatches.length === 0) && (
                        <div className="px-2 py-4 text-sm text-white/50">Сейчас нет открытых лобби — создай своё первым.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto h-[58px] border-t border-amber-300/20 bg-[linear-gradient(180deg,rgba(4,18,32,0.92),rgba(2,10,18,0.97))] shadow-[0_-10px_30px_rgba(0,0,0,0.32)]">
          <div className="mx-auto flex h-full max-w-[1380px] items-center justify-center gap-12 px-4 text-[20px] text-white/82">
            <div>Онлайн <span className="ml-1 text-[#f1c76b] font-semibold">{onlineCount}</span></div>
            <div>Лобби <span className="ml-1 text-[#f1c76b] font-semibold">{activeGameCount}</span></div>
            <div>Турниры <span className="ml-1 text-[#f1c76b] font-semibold">{(tournaments || []).length}</span></div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default WelcomePage;