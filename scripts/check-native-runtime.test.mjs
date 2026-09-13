import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNativeEntries } from './check-native-runtime.mjs';

const engine = 'BOOT-INF/classes/com/politikum/engine/JavaGameEngine.class';
test('accepts the native engine with ordinary application dependencies', () => {
  assert.doesNotThrow(() => checkNativeEntries([engine, 'BOOT-INF/lib/spring-core-6.1.6.jar']));
});
test('rejects missing engine and accidental packaging of legacy runtime', () => {
  assert.throws(() => checkNativeEntries([]), /engine is missing/);
  for (const entry of [
    'BOOT-INF/classes/engine/politikum-engine-bridge.js',
    'BOOT-INF/classes/com/politikum/engine/GraalAbilityBridge.class',
    'BOOT-INF/lib/polyglot-25.0.2.jar',
    'BOOT-INF/lib/js-language-25.0.2.jar',
    'BOOT-INF/lib/truffle-runtime-25.0.2.jar',
  ]) assert.throws(() => checkNativeEntries([engine, entry]), /Legacy JavaScript runtime/);
});
