import { test, expect } from '@playwright/test';
import { card, createStartedMatch, installFixture, matchState, waitForMove } from './fixture.mjs';

test.beforeEach(async ({ page }) => { await createStartedMatch(page); });

test('fixture: draw, play a card and end the turn through the Java backend', async ({ page }) => {
  await installFixture(page, matchState({ hand: [card('persona_35#1')], deck: [card('action_5#1'), card('action_7#1')], hasDrawn: false }));
  const draw = waitForMove(page, 'beginTurnDraw');
  await page.locator('button:enabled').filter({ hasText: 'Взять карту' }).click();
  expect((await draw).status()).toBe(200);
  await installFixture(page, matchState({ hand: [card('persona_35#1')], deck: [card('action_5#1'), card('action_7#1')] }));
  const play = waitForMove(page, 'playPersona');
  await page.getByTestId('hand-card-persona_35#1').dispatchEvent('click');
  expect((await play).status()).toBe(200);
  await installFixture(page, matchState({ hand: [], deck: [card('action_5#1')], hasPlayed: true }));
  const end = waitForMove(page, 'endTurn');
  await page.getByRole('button', { name: 'Закончить ход', exact: true }).click();
  expect((await end).status()).toBe(200);
});

for (const action of ['action_4#1', 'action_9#1']) {
  test(`fixture: ${action.split('#')[0]} selects an opponent before Java applies it`, async ({ page }) => {
    await installFixture(page, matchState({ hand: [card(action)], opponentCoalition: [card('persona_35#2')] }));
    await page.getByTestId(`hand-card-${action}`).click({ force: true });
    const move = waitForMove(page, 'playAction');
    await page.getByTestId('opponent-1').click();
    if (action.startsWith('action_9')) await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    expect((await move).status()).toBe(200);
  });
}

test('fixture: persona 17 exposes and steals an opponent persona', async ({ page }) => {
  await installFixture(page, matchState({ hand: [card('persona_17#1')], opponentHand: [card('persona_35#2')] }));
  await page.getByTestId('hand-card-persona_17#1').click({ force: true });
  await page.getByTestId('opponent-1').click();
  const steal = waitForMove(page, 'persona17StealPersonaFromHand');
  await page.getByTestId('persona-hand-card-persona_35#2').click();
  expect((await steal).status()).toBe(200);
});

test('fixture: persona 20 selects an action from discard', async ({ page }) => {
  await installFixture(page, matchState({ hand: [card('persona_20#1')], discard: [card('action_5#1')] }));
  const play = waitForMove(page, 'playPersona');
  await page.getByTestId('hand-card-persona_20#1').click({ force: true });
  expect((await play).status()).toBe(200);
  await installFixture(page, matchState({
    hand: [], discard: [card('action_5#1')],
    pending: { kind: 'persona_20_pick_from_discard', playerId: '0', sourceCardId: 'persona_20#1' },
  }));
  const pick = waitForMove(page, 'persona20PickFromDiscard');
  await page.getByTestId('discard-card-action_5#1').click();
  expect((await pick).status()).toBe(200);
});

test('fixture: persona 34 makes a top-deck guess and persona 45 selects an opponent', async ({ page }) => {
  await installFixture(page, matchState({ hand: [card('persona_34#1')], deck: [card('persona_35#2')] }));
  await page.getByTestId('hand-card-persona_34#1').click({ force: true });
  const guess = waitForMove(page, 'persona34GuessTopdeck');
  await page.getByTestId('persona34-guess-persona_1').click();
  expect((await guess).status()).toBe(200);

  await installFixture(page, matchState({ hand: [card('persona_45#1')], opponentHand: [card('action_5#1')] }));
  await page.getByTestId('hand-card-persona_45#1').click({ force: true });
  const steal = waitForMove(page, 'persona45StealFromOpponent');
  await page.getByTestId('opponent-1').click();
  expect((await steal).status()).toBe(200);
});

test('fixture: response cards 6, 8 and 14 are interactive without a browser clock move', async ({ page }) => {
  const browserClockMoves = [];
  page.on('request', request => { if (/\/move\/tick(Bot)?(?:\?|$)/.test(request.url())) browserClockMoves.push(request.url()); });
  const cases = [
    ['action_6#1', 'response-action-6', 'cancel_action', card('action_4#1')],
    ['action_8#1', 'response-action-8', 'cancel_persona', card('persona_35#2')],
    ['action_14#1', 'response-action-14', 'cancel_action', card('action_4#1')],
  ];
  for (const [responseCard, selector, kind, playedCard] of cases) {
    const state = matchState({
      hand: [card(responseCard)],
      pending: kind === 'cancel_action' ? { kind: 'action_4_discard', attackerId: '1', targetId: '0', sourceCardId: 'action_4#1' } : null,
      response: { kind, playedBy: '1', actionCard: kind === 'cancel_action' ? playedCard : null, personaCard: kind === 'cancel_persona' ? playedCard : null, expiresAtMs: Date.now() + 30000 },
      hasDrawn: true,
    });
    state.ctx.currentPlayer = '1';
    state.ctx.playOrderPos = 1;
    await installFixture(page, state);
    await expect(page.getByTestId(selector)).toBeVisible();
    await page.getByTestId(selector).dispatchEvent('click');
  }
  expect(browserClockMoves).toEqual([]);
});

test('fixture: server advances a bot turn without a browser tick request', async ({ page }) => {
  const browserClockMoves = [];
  page.on('request', request => { if (/\/move\/tick(Bot)?(?:\?|$)/.test(request.url())) browserClockMoves.push(request.url()); });
  const state = matchState({ hand: [], opponentHand: [card('persona_35#2')], deck: [card('action_5#1')], hasDrawn: false });
  state.ctx.currentPlayer = '1';
  state.ctx.playOrderPos = 1;
  state.G.players[1].isBot = true;
  state.G.botNextActAtMs = Date.now() - 1;
  await installFixture(page, state);
  const { matchId, credentials } = await page.evaluate(() => ({
    matchId: localStorage.getItem('politikum.lastMatchID'), credentials: JSON.parse(localStorage.getItem('politikum.lastCredentials')),
  }));
  await expect.poll(async () => {
    const response = await page.request.get(`http://127.0.0.1:18081/games/politikum/${matchId}/state`, {
      headers: { 'X-Player-ID': '0', 'X-Player-Credentials': credentials },
    });
    return (await response.json()).state.ctx.currentPlayer;
  }, { timeout: 7000 }).not.toBe('1');
  expect(browserClockMoves).toEqual([]);
});
