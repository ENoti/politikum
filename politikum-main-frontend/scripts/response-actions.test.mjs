import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playFirstResponse } from '../src/multiplayer/responseActions.js';

test('one shortcut sends only one cancellation when multiple responses are available', () => {
  const calls = [];
  const moves = { playAction: id => calls.push(id), persona10CancelFromCoalition: () => calls.push('p10') };
  playFirstResponse({ cancelActionCardId: 'action_6#2', cancelEffectCardId: 'action_14#1', persona10Cancel: true }, moves);
  assert.deepEqual(calls, ['action_6#2']);
});

test('shortcuts honor server choices and do nothing without an eligible response', () => {
  const calls = [];
  const moves = { playAction: id => calls.push(id), persona10CancelFromCoalition: () => calls.push('p10') };
  playFirstResponse({}, moves);
  assert.deepEqual(calls, []);
  playFirstResponse({ cancelPersonaCardId: 'action_8#3' }, moves);
  playFirstResponse({ cancelEffectCardId: 'action_14#2' }, moves);
  playFirstResponse({ persona10Cancel: true }, moves);
  assert.deepEqual(calls, ['action_8#3', 'action_14#2', 'p10']);
});
