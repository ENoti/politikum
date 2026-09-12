import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// This process can only start a disposable backend; it never reads production config.
const data = mkdtempSync(join(tmpdir(), 'politikum-e2e-'));
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java') : 'java';
const backend = spawn(java, ['-jar', resolve('../politikum-main-backend/target/backend.jar'),
  '--server.address=127.0.0.1', '--server.port=18081',
  `--politikum.db.path=${join(data, 'test.sqlite')}`,
  `--politikum.news.path=${join(data, 'NEWS.md')}`,
  `--politikum.profile-img-dir=${join(data, 'profiles')}`,
], { stdio: 'inherit', env: { ...process.env, POLITIKUM_ADMIN_TOKEN: 'isolated-browser-test-only-token' } });
let stopping = false;
let timer;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true;
  backend.kill('SIGTERM');
  timer ??= setTimeout(() => backend.kill('SIGKILL'), 10000);
});
backend.on('error', (error) => {
  console.error(error.message);
  rmSync(data, { recursive: true, force: true });
  process.exitCode = 1;
});
backend.on('exit', (code) => {
  clearTimeout(timer);
  rmSync(data, { recursive: true, force: true });
  process.exitCode = stopping ? 0 : (code || 1);
});
