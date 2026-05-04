import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEssayRevision,
  buildEssayPayload,
  buildEssayShareText,
  undoEssayRevision,
} from '../src/services/essayUtils.mjs';

test('buildEssayPayload normalizes essay fields for persistence', () => {
  assert.deepEqual(
    buildEssayPayload({
      questionText: ' 지원 동기 ',
      targetLength: ' 700 ',
      draft: '초안',
      evidenceSummary: [' 경험 ', '', null],
      updatedAt: '2026-05-05T00:00:00.000Z',
    }),
    {
      questionText: '지원 동기',
      targetLength: '700',
      draft: '초안',
      evidenceSummary: ['경험'],
      previousDraft: '',
      updatedAt: '2026-05-05T00:00:00.000Z',
    },
  );
});

test('applyEssayRevision stores previous draft and replaces current draft', () => {
  const revised = applyEssayRevision(
    { questionText: '문항', draft: '이전 초안', evidenceSummary: ['근거'] },
    '수정 초안',
    '2026-05-05T01:00:00.000Z',
  );

  assert.equal(revised.draft, '수정 초안');
  assert.equal(revised.previousDraft, '이전 초안');
  assert.deepEqual(revised.evidenceSummary, ['근거']);
});

test('undoEssayRevision restores previous draft once', () => {
  const undone = undoEssayRevision(
    { questionText: '문항', draft: '수정 초안', previousDraft: '이전 초안' },
    '2026-05-05T02:00:00.000Z',
  );

  assert.equal(undone.draft, '이전 초안');
  assert.equal(undone.previousDraft, '');
});

test('buildEssayShareText includes company, question, and draft', () => {
  const text = buildEssayShareText({
    companyName: '삼성전자',
    essay: { questionText: '지원 동기', draft: '초안 본문' },
  });

  assert.match(text, /삼성전자/);
  assert.match(text, /지원 동기/);
  assert.match(text, /초안 본문/);
});
