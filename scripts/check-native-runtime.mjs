import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkNativeEntries(entries) {
  const required = 'BOOT-INF/classes/com/politikum/engine/JavaGameEngine.class';
  if (!entries.includes(required)) throw new Error('Packaged Java game engine is missing');
  const forbidden = entries.filter(entry =>
    /^BOOT-INF\/classes\/.*\.js$/.test(entry) ||
    /^BOOT-INF\/classes\/com\/politikum\/.*Graal.*\.class$/.test(entry) ||
    /^BOOT-INF\/lib\/(polyglot|truffle[^/]*|js-language|graal-sdk)-/.test(entry));
  if (forbidden.length) throw new Error(`Legacy JavaScript runtime in production JAR:\n${forbidden.join('\n')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const jar = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'jar') : 'jar';
  const artifact = resolve(process.argv[2] || 'politikum-main-backend/target/backend.jar');
  const entries = execFileSync(jar, ['tf', artifact], { encoding: 'utf8' }).split(/\r?\n/);
  checkNativeEntries(entries);
  console.log('Production JAR contains the Java engine and no legacy JS runtime.');
}
