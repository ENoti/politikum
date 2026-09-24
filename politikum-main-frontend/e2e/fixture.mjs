const fixtureToken = 'isolated-browser-fixture-token';

const ABILITIES = {
  persona_17: 'persona_17_on_enter_steal_persona',
  persona_20: 'persona_20_on_enter_take_from_discard',
  persona_34: 'persona_34_on_enter_guess_topdeck',
  persona_45: 'persona_45_steal_from_opponent',
};

export function card(id) {
  const base = id.split('#')[0];
  const type = base.startsWith('action_') ? 'action' : base.startsWith('event_') ? 'event' : 'persona';
  return {
    id, type, img: `/cards/${base}.webp`, name: base, baseVp: 1, vp: 1,
    vpDelta: 0, passiveVpDelta: 0, tags: [],
    ...(ABILITIES[base] ? { abilityKey: ABILITIES[base] } : {}),
  };
}

export function matchState({ hand = [], opponentHand = [], coalition = [], opponentCoalition = [], discard = [], deck = [], pending = null, response = null, hasDrawn = true, hasPlayed = false } = {}) {
  return {
    _stateID: 100,
    ctx: { numPlayers: 2, phase: 'action', currentPlayer: '0', playOrderPos: 0, turn: 1 },
    G: {
      players: [
        { id: '0', name: 'E2E host', active: true, isBot: false, hand, coalition, identity: {} },
        { id: '1', name: 'E2E opponent', active: true, isBot: false, hand: opponentHand, coalition: opponentCoalition, identity: {} },
      ],
      deck, discard, log: [], chat: [], history: [], pending, response,
      activePlayerIds: ['0', '1'], hasDrawn, hasPlayed, playsThisTurn: hasPlayed ? 1 : 0,
      maxPlaysThisTurn: 1, drawsThisTurn: 0, turnN: 1, gameOver: false,
      botNextActAtMs: null, botPauseUntilMs: null,
    },
  };
}

export async function createStartedMatch(page) {
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('Fixture host');
    else await dialog.dismiss();
  });
  await page.goto('/');
  const created = page.waitForResponse(response => response.url().endsWith('/games/politikum/create'));
  await page.getByRole('button', { name: 'Начать игру', exact: true }).click();
  const createResponse = await created;
  if (!createResponse.ok()) throw new Error(`create match failed: HTTP ${createResponse.status()}`);
  await page.getByRole('button', { name: 'Добавить бота', exact: true }).waitFor();
  const botAdded = page.waitForResponse(response => response.url().endsWith('/move/addBot'));
  await page.getByRole('button', { name: 'Добавить бота', exact: true }).click();
  const botResult = await botAdded;
  if (!botResult.ok() || !(await botResult.json()).ok) throw new Error('adding fixture bot failed');
  await page.getByRole('button', { name: 'Старт', exact: true }).waitFor();
  const gameStarted = page.waitForResponse(response => response.url().endsWith('/move/startGame'));
  await page.getByRole('button', { name: 'Старт', exact: true }).click();
  const startResult = await gameStarted;
  if (!startResult.ok() || !(await startResult.json()).ok) throw new Error('starting fixture match failed');
  await page.getByRole('button', { name: 'Закончить ход', exact: true }).waitFor();
}

export async function installFixture(page, state) {
  const matchId = await page.evaluate(() => localStorage.getItem('politikum.lastMatchID'));
  if (!matchId) throw new Error('E2E match id is missing');
  const response = await page.request.post(`http://127.0.0.1:18081/internal/e2e/matches/${matchId}/state`, {
    headers: { 'X-Politikum-E2E-Token': fixtureToken }, data: state,
  });
  if (!response.ok()) throw new Error(`fixture endpoint failed: ${response.status()}`);
  await page.reload();
}

export function waitForMove(page, move) {
  return page.waitForResponse(response => response.url().includes(`/move/${move}`), { timeout: 8000 });
}
