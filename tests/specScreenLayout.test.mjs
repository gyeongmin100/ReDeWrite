import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/screens/SpecScreen.js', import.meta.url), 'utf8');

function styleBlock(name) {
  const match = source.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n  \\},`));
  assert.ok(match, `${name} style block should exist`);
  return match[1];
}

test('spec category tabs keep a stable height after save rerenders', () => {
  const tabsScroll = styleBlock('tabsScroll');
  const tabsContent = styleBlock('tabsContent');
  const tab = styleBlock('tab');

  assert.match(tabsScroll, /height:\s*52/);
  assert.match(tabsScroll, /flexGrow:\s*0/);
  assert.match(tabsContent, /minHeight:\s*52/);
  assert.match(tabsContent, /alignItems:\s*'center'/);
  assert.match(tab, /height:\s*32/);
  assert.match(tab, /justifyContent:\s*'center'/);
});
