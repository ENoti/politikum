import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertJavaHandlesFrontendMoves } from './check-java-moves.mjs';

const root = resolve(import.meta.dirname, '..');

test('every frontend move is registered by a Java engine', () => {
  const moves = assertJavaHandlesFrontendMoves({
    frontendSource: join(root, 'politikum-main-frontend', 'src'),
    javaEngineSource: readFileSync(join(root, 'politikum-main-backend', 'src/main/java/com/politikum/engine/JavaGameEngine.java'), 'utf8'),
    javaLobbySource: readFileSync(join(root, 'politikum-main-backend', 'src/main/java/com/politikum/engine/JavaLobbyEngine.java'), 'utf8'),
  });
  assert.ok(moves.includes('playPersona'));
  assert.ok(moves.includes('startGame'));
  assert.ok(!moves.includes('tick'));
  assert.ok(!moves.includes('tickBot'));
});
