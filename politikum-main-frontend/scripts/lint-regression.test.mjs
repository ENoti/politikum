import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

test('release lint rejects the stray Cyrillic identifier that crashed ActionBoard', async () => {
  const eslint = new ESLint({ overrideConfigFile: 'eslint.ci.config.js' });
  const [result] = await eslint.lintText(
    'export default function Board() { г; return <div>Game</div>; }',
    { filePath: 'src/Regression.jsx' },
  );
  assert.equal(result.errorCount, 1);
  assert.equal(result.messages[0].ruleId, 'no-undef');
  assert.match(result.messages[0].message, /г/);
});
