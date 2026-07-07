import test from 'node:test';
import assert from 'node:assert/strict';

import { getHeaderSafeEnv } from '../worker/envUtils.mjs';

test('getHeaderSafeEnv strips a leading BOM from header values', () => {
  const env = {
    SUPABASE_ANON_KEY: '\uFEFFeyJhbGciOiJIUzI1NiJ9.example',
  };

  assert.equal(getHeaderSafeEnv(env, 'SUPABASE_ANON_KEY'), 'eyJhbGciOiJIUzI1NiJ9.example');
});
