import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function frontendMoveNames(sourceRoot) {
  const names = new Set();
  for (const file of filesUnder(sourceRoot)) {
    if (!/\.(?:js|jsx)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bmoves\.([A-Za-z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  }
  return [...names].sort();
}

export function assertJavaHandlesFrontendMoves({ frontendSource, javaEngineSource, javaLobbySource }) {
  const handlers = `${javaEngineSource}\n${javaLobbySource}`;
  const moves = frontendMoveNames(frontendSource);
  const unsupported = moves.filter((move) => !handlers.includes(`"${move}"`));
  if (unsupported.length) throw new Error(`Frontend moves missing Java handlers: ${unsupported.join(', ')}`);
  const browserClock = moves.filter((move) => move === 'tick' || move === 'tickBot');
  if (browserClock.length) throw new Error(`Browser must not drive the game clock: ${browserClock.join(', ')}`);
  return moves;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(import.meta.dirname, '..');
  const moves = assertJavaHandlesFrontendMoves({
    frontendSource: join(root, 'politikum-main-frontend', 'src'),
    javaEngineSource: readFileSync(join(root, 'politikum-main-backend', 'src/main/java/com/politikum/engine/JavaGameEngine.java'), 'utf8'),
    javaLobbySource: readFileSync(join(root, 'politikum-main-backend', 'src/main/java/com/politikum/engine/JavaLobbyEngine.java'), 'utf8'),
  });
  console.log(`All ${moves.length} frontend moves have Java handlers; browser clock moves are absent.`);
}
