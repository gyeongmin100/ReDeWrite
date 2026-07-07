import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEssayRevision,
  buildEssayPayload,
  buildEssayShareText,
  applyGeneratedEssayBatch,
  buildWritePendingState,
  buildWriteState,
  clampDraftToLimit,
  completeWritePendingState,
  countEssayChars,
  getEssayLengthTarget,
  getWriteStageAfterStateChange,
  hasAllRequiredEssaysComplete,
  hasTemporaryWriteQuestions,
  shouldAutosaveWriteQuestions,
  normalizeWriteState,
  redoEssayRevision,
  shouldGenerateEssayForQuestion,
  shouldResumeWritePending,
  undoEssayRevision,
} from '../src/services/essayUtils.mjs';

test('buildEssayPayload normalizes essay fields for persistence', () => {
  assert.deepEqual(
    buildEssayPayload({
      questionText: ' Motivation ',
      targetLength: ' 700 ',
      draft: 'Draft',
      evidenceSummary: [' Evidence ', '', null],
      updatedAt: '2026-05-05T00:00:00.000Z',
    }),
    {
      questionText: 'Motivation',
      targetLength: '700',
      draft: 'Draft',
      evidenceSummary: ['Evidence'],
      previousDraft: '',
      redoDraft: '',
      draftHistory: ['Draft'],
      draftHistoryIndex: 0,
      updatedAt: '2026-05-05T00:00:00.000Z',
    },
  );
});

test('normalizeWriteState restores legacy single essay payload', () => {
  const state = normalizeWriteState({
    questionText: 'Motivation',
    targetLength: '700',
    draft: 'Draft',
    evidenceSummary: ['Evidence'],
    updatedAt: '2026-05-06T00:00:00.000Z',
  });

  assert.equal(state.version, 2);
  assert.equal(state.questions[0].questionText, 'Motivation');
  assert.equal(state.essays[0].draft, 'Draft');
  assert.equal(state.draft, 'Draft');
});

test('buildWriteState keeps representative draft at top level for archive compatibility', () => {
  const state = buildWriteState({
    questions: [
      { id: 'q1', questionText: 'Question 1', targetLength: '500' },
      { id: 'q2', questionText: 'Question 2', targetLength: '700' },
    ],
    essays: [
      null,
      buildEssayPayload({ questionText: 'Question 2', targetLength: '700', draft: 'Second draft' }),
    ],
    updatedAt: '2026-05-06T01:00:00.000Z',
  });

  assert.equal(state.version, 2);
  assert.equal(state.questions.length, 2);
  assert.equal(state.essays.length, 2);
  assert.equal(state.draft, 'Second draft');
  assert.equal(state.questionText, 'Question 2');
});

test('write pending state can be resumed and completed', () => {
  const pending = buildWritePendingState(
    buildWriteState({
      questions: [{ id: 'q1', questionText: 'Question', targetLength: '600' }],
      essays: [null],
    }),
    { type: 'generateOne', index: 0 },
    '2026-05-06T02:00:00.000Z',
  );

  assert.equal(shouldResumeWritePending(pending), true);
  assert.equal(pending.pending.type, 'generateOne');

  const completed = completeWritePendingState(
    pending,
    [buildEssayPayload({ questionText: 'Question', targetLength: '600', draft: 'Completed draft' })],
    '2026-05-06T02:01:00.000Z',
  );

  assert.equal(shouldResumeWritePending(completed), false);
  assert.equal(completed.pending, null);
  assert.equal(completed.draft, 'Completed draft');
});

test('applyGeneratedEssayBatch maps batch results by original question index', () => {
  const questions = [
    { id: 'q1', questionText: 'Question 1', targetLength: '700' },
    { id: 'q2', questionText: 'Question 2', targetLength: '500' },
  ];
  const nextEssays = applyGeneratedEssayBatch(
    questions,
    [null, null],
    [
      { index: 1, draft: 'Draft 2', evidenceSummary: ['Evidence 2'] },
      { index: 0, draft: 'Draft 1', evidenceSummary: ['Evidence 1'] },
    ],
  );

  assert.equal(nextEssays[0].questionText, 'Question 1');
  assert.equal(nextEssays[0].draft, 'Draft 1');
  assert.deepEqual(nextEssays[0].evidenceSummary, ['Evidence 1']);
  assert.equal(nextEssays[1].questionText, 'Question 2');
  assert.equal(nextEssays[1].draft, 'Draft 2');
});

test('applyGeneratedEssayBatch rejects missing or empty batch drafts', () => {
  assert.throws(
    () => applyGeneratedEssayBatch(
      [{ id: 'q1', questionText: 'Question 1', targetLength: '700' }],
      [null],
      [{ index: 0, draft: '   ', evidenceSummary: [] }],
    ),
    /Missing generated draft/,
  );
});

test('getEssayLengthTarget derives 90 to 100 percent range from numeric targetLength', () => {
  assert.deepEqual(getEssayLengthTarget('700'), {
    limit: 700,
    min: 630,
  });

  assert.equal(getEssayLengthTarget(''), null);
  assert.equal(getEssayLengthTarget('0'), null);
});

test('countEssayChars counts spaces and punctuation as displayed characters', () => {
  assert.equal(countEssayChars('a b.'), 4);
});

test('clampDraftToLimit never returns text over the configured limit', () => {
  assert.equal(clampDraftToLimit('first sentence. second sentence.', 7), 'first s');
  assert.equal(clampDraftToLimit('first sentence. second sentence.', 12), 'first senten');
});

test('applyEssayRevision stores previous draft and replaces current draft', () => {
  const revised = applyEssayRevision(
    { questionText: 'Question', draft: 'Old draft', evidenceSummary: ['Evidence'] },
    'Revised draft',
    '2026-05-05T01:00:00.000Z',
  );

  assert.equal(revised.draft, 'Revised draft');
  assert.equal(revised.previousDraft, 'Old draft');
  assert.equal(revised.redoDraft, '');
  assert.deepEqual(revised.evidenceSummary, ['Evidence']);
});

test('undoEssayRevision restores previous draft once', () => {
  const undone = undoEssayRevision(
    { questionText: 'Question', draft: 'Revised draft', previousDraft: 'Old draft' },
    '2026-05-05T02:00:00.000Z',
  );

  assert.equal(undone.draft, 'Old draft');
  assert.equal(undone.previousDraft, '');
  assert.equal(undone.redoDraft, 'Revised draft');
});

test('redoEssayRevision restores undone draft and keeps undo available', () => {
  const redone = redoEssayRevision(
    { questionText: 'Question', draft: 'Old draft', previousDraft: '', redoDraft: 'Revised draft' },
    '2026-05-05T02:05:00.000Z',
  );

  assert.equal(redone.draft, 'Revised draft');
  assert.equal(redone.previousDraft, 'Old draft');
  assert.equal(redone.redoDraft, '');
});

test('essay revision history supports multiple undo and redo steps', () => {
  let essay = buildEssayPayload({ questionText: 'Question', draft: 'v1' });
  essay = applyEssayRevision(essay, 'v2', '2026-05-05T03:00:00.000Z');
  essay = applyEssayRevision(essay, 'v3', '2026-05-05T03:01:00.000Z');

  const backOnce = undoEssayRevision(essay, '2026-05-05T03:02:00.000Z');
  assert.equal(backOnce.draft, 'v2');
  assert.equal(backOnce.previousDraft, 'v1');
  assert.equal(backOnce.redoDraft, 'v3');

  const backTwice = undoEssayRevision(backOnce, '2026-05-05T03:03:00.000Z');
  assert.equal(backTwice.draft, 'v1');
  assert.equal(backTwice.previousDraft, '');
  assert.equal(backTwice.redoDraft, 'v2');

  const forwardOnce = redoEssayRevision(backTwice, '2026-05-05T03:04:00.000Z');
  assert.equal(forwardOnce.draft, 'v2');
  assert.equal(forwardOnce.previousDraft, 'v1');
  assert.equal(forwardOnce.redoDraft, 'v3');

  const branched = applyEssayRevision(forwardOnce, 'v4', '2026-05-05T03:05:00.000Z');
  assert.equal(branched.draft, 'v4');
  assert.deepEqual(branched.draftHistory, ['v1', 'v2', 'v4']);
  assert.equal(branched.draftHistoryIndex, 2);
  assert.equal(branched.redoDraft, '');
});

test('essay revision history keeps the latest twenty drafts per question', () => {
  let essay = buildEssayPayload({ questionText: 'Question', draft: 'v0' });

  for (let index = 1; index <= 25; index += 1) {
    essay = applyEssayRevision(essay, `v${index}`, `2026-05-05T04:${String(index).padStart(2, '0')}:00.000Z`);
  }

  assert.equal(essay.draftHistory.length, 20);
  assert.equal(essay.draftHistory[0], 'v6');
  assert.equal(essay.draftHistory[19], 'v25');
  assert.equal(essay.draftHistoryIndex, 19);
  assert.equal(essay.previousDraft, 'v24');
});

test('hasAllRequiredEssaysComplete requires every filled question to have a draft', () => {
  const questions = [
    { id: 'q1', questionText: 'Question 1', targetLength: '500' },
    { id: 'q2', questionText: 'Question 2', targetLength: '700' },
    { id: 'q3', questionText: '   ', targetLength: '' },
  ];

  assert.equal(
    hasAllRequiredEssaysComplete(questions, [
      buildEssayPayload({ questionText: 'Question 1', draft: 'Draft 1' }),
      null,
      null,
    ]),
    false,
  );

  assert.equal(
    hasAllRequiredEssaysComplete(questions, [
      buildEssayPayload({ questionText: 'Question 1', draft: 'Draft 1' }),
      buildEssayPayload({ questionText: 'Question 2', draft: 'Draft 2' }),
      null,
    ]),
    true,
  );
});

test('getWriteStageAfterStateChange moves completed restored generation from input to result', () => {
  assert.equal(
    getWriteStageAfterStateChange({
      currentStage: 'input',
      previousGenerateAllPending: false,
      pending: null,
      isComplete: true,
    }),
    'result',
  );
});

test('getWriteStageAfterStateChange keeps input open while editing completed questions', () => {
  assert.equal(
    getWriteStageAfterStateChange({
      currentStage: 'input',
      previousGenerateAllPending: false,
      pending: null,
      isComplete: true,
      isEditingQuestions: true,
    }),
    'input',
  );
});

test('getWriteStageAfterStateChange moves to result after generation even when editing was active', () => {
  assert.equal(
    getWriteStageAfterStateChange({
      currentStage: 'input',
      previousGenerateAllPending: true,
      pending: null,
      isComplete: true,
      isEditingQuestions: true,
    }),
    'result',
  );
});

test('getWriteStageAfterStateChange keeps result open while revising a draft', () => {
  assert.equal(
    getWriteStageAfterStateChange({
      currentStage: 'result',
      pending: { status: 'pending', type: 'revise' },
      isComplete: true,
    }),
    'result',
  );
});

test('hasTemporaryWriteQuestions detects question inputs that do not have essay slots yet', () => {
  assert.equal(
    hasTemporaryWriteQuestions(
      [
        { id: 'q1', questionText: 'Question 1', targetLength: '500' },
        { id: 'q2', questionText: 'Question 2', targetLength: '700' },
      ],
      [buildEssayPayload({ questionText: 'Question 1', draft: 'Draft 1' })],
    ),
    true,
  );

  assert.equal(
    hasTemporaryWriteQuestions(
      [{ id: 'q1', questionText: 'Question 1', targetLength: '500' }],
      [buildEssayPayload({ questionText: 'Question 1', draft: 'Draft 1' })],
    ),
    false,
  );
});

test('shouldAutosaveWriteQuestions skips autosave while write generation is active', () => {
  assert.equal(
    shouldAutosaveWriteQuestions({
      serializedQuestions: '[1]',
      lastSerializedQuestions: '[0]',
      loading: true,
      hasTemporaryQuestions: false,
    }),
    false,
  );

  assert.equal(
    shouldAutosaveWriteQuestions({
      serializedQuestions: '[1]',
      lastSerializedQuestions: '[0]',
      loading: false,
      hasTemporaryQuestions: false,
    }),
    true,
  );
});

test('shouldAutosaveWriteQuestions skips autosave while editing completed questions', () => {
  assert.equal(
    shouldAutosaveWriteQuestions({
      serializedQuestions: '[1]',
      lastSerializedQuestions: '[0]',
      loading: false,
      hasTemporaryQuestions: false,
      isEditingQuestions: true,
    }),
    false,
  );
});

test('shouldGenerateEssayForQuestion includes empty and modified drafts only', () => {
  assert.equal(
    shouldGenerateEssayForQuestion(
      { questionText: 'Question', targetLength: '700' },
      null,
    ),
    true,
  );
  assert.equal(
    shouldGenerateEssayForQuestion(
      { questionText: 'Question updated', targetLength: '700' },
      buildEssayPayload({ questionText: 'Question', targetLength: '700', draft: 'Draft' }),
    ),
    true,
  );
  assert.equal(
    shouldGenerateEssayForQuestion(
      { questionText: 'Question', targetLength: '700' },
      buildEssayPayload({ questionText: 'Question', targetLength: '700', draft: 'Draft' }),
    ),
    false,
  );
});

test('buildEssayShareText includes company, question, and draft', () => {
  const text = buildEssayShareText({
    companyName: 'Company',
    essay: { questionText: 'Motivation', draft: 'Draft body' },
  });

  assert.match(text, /Company/);
  assert.match(text, /Motivation/);
  assert.match(text, /Draft body/);
});
