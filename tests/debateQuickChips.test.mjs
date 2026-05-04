import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQuickChips } from '../src/services/debateQuickChips.mjs';

test('buildQuickChips keeps only the three core debate actions', () => {
  assert.deepEqual(
    buildQuickChips(['도전', '협업', '문제해결']),
    ['내 경험과 연결하기', '강점 소재 뽑기', '면접 질문 준비'],
  );
});
