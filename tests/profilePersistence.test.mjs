import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProfileUpsertPayload } from '../src/services/profilePersistence.mjs';

test('buildProfileUpsertPayload includes id and experiences for upsert persistence', () => {
  assert.deepEqual(
    buildProfileUpsertPayload({
      id: 'user-1',
      name: '홍길동',
      major: '경영학',
      experiences: ['동아리 운영', '인턴 프로젝트'],
    }),
    {
      id: 'user-1',
      name: '홍길동',
      major: '경영학',
      experiences: ['동아리 운영', '인턴 프로젝트'],
    },
  );
});

test('buildProfileUpsertPayload normalizes missing optional fields', () => {
  assert.deepEqual(
    buildProfileUpsertPayload({ id: 'user-1' }),
    { id: 'user-1', name: '', major: '', experiences: [] },
  );
});
