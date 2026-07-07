import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveWorkerPath } from '../worker/routeUtils.mjs';

test('resolveWorkerPath accepts array catch-all path values', () => {
  assert.equal(resolveWorkerPath(['collect-company-info']), '/collect-company-info');
});

test('resolveWorkerPath strips an optional api prefix', () => {
  assert.equal(resolveWorkerPath(['api', 'collect-company-info']), '/collect-company-info');
  assert.equal(resolveWorkerPath('api/collect-company-info'), '/collect-company-info');
});
