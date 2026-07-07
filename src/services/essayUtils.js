function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function countEssayChars(text = '') {
  return typeof text === 'string' ? Array.from(text).length : 0;
}

export function getEssayLengthTarget(targetLength = '') {
  const limit = Number(targetLength);
  if (!Number.isInteger(limit) || limit <= 0) return null;

  return {
    limit,
    min: Math.ceil(limit * 0.9),
  };
}

export function clampDraftToLimit(draft = '', limit = 0) {
  if (!Number.isInteger(limit) || limit <= 0 || typeof draft !== 'string') return draft;
  if (countEssayChars(draft) <= limit) return draft;

  const chars = Array.from(draft.trim());
  return chars.slice(0, limit).join('').trimEnd();
}

export const ESSAY_DRAFT_HISTORY_LIMIT = 20;

function normalizeDraftHistory({
  draft = '',
  draftHistory,
  draftHistoryIndex,
  previousDraft = '',
  redoDraft = '',
} = {}) {
  const currentDraft = typeof draft === 'string' ? draft : '';
  let history = Array.isArray(draftHistory)
    ? draftHistory.filter(item => typeof item === 'string')
    : [];

  if (history.length === 0) {
    if (typeof previousDraft === 'string' && previousDraft) history.push(previousDraft);
    if (currentDraft) history.push(currentDraft);
    if (typeof redoDraft === 'string' && redoDraft) history.push(redoDraft);
  }

  let index = Number.isInteger(draftHistoryIndex) ? draftHistoryIndex : history.findIndex(item => item === currentDraft);
  if (currentDraft && index < 0) {
    history.push(currentDraft);
    index = history.length - 1;
  }

  if (history.length > ESSAY_DRAFT_HISTORY_LIMIT) {
    const overflow = history.length - ESSAY_DRAFT_HISTORY_LIMIT;
    history = history.slice(overflow);
    index -= overflow;
  }

  if (history.length === 0) index = -1;
  else if (index < 0 || index >= history.length) index = history.length - 1;

  return {
    draftHistory: history,
    draftHistoryIndex: index,
    previousDraft: index > 0 ? history[index - 1] : '',
    redoDraft: index >= 0 && index < history.length - 1 ? history[index + 1] : '',
  };
}

function appendDraftHistory(currentEssay = {}, nextDraft = '', updatedAt = new Date().toISOString()) {
  const base = buildEssayPayload(currentEssay);
  const draft = typeof nextDraft === 'string' ? nextDraft : '';
  let history = base.draftHistory.slice(0, base.draftHistoryIndex + 1);

  if (draft && history[history.length - 1] !== draft) {
    history.push(draft);
  }

  if (history.length > ESSAY_DRAFT_HISTORY_LIMIT) {
    history = history.slice(history.length - ESSAY_DRAFT_HISTORY_LIMIT);
  }

  return buildEssayPayload({
    ...base,
    draft,
    draftHistory: history,
    draftHistoryIndex: history.length - 1,
    updatedAt,
  });
}

export function buildEssayPayload({
  questionText,
  targetLength = '',
  draft,
  evidenceSummary = [],
  previousDraft = '',
  redoDraft = '',
  draftHistory,
  draftHistoryIndex,
  updatedAt = new Date().toISOString(),
} = {}) {
  const normalizedDraft = typeof draft === 'string' ? draft : '';
  const history = normalizeDraftHistory({
    draft: normalizedDraft,
    draftHistory,
    draftHistoryIndex,
    previousDraft,
    redoDraft,
  });

  return {
    questionText: asText(questionText),
    targetLength: asText(targetLength),
    draft: normalizedDraft,
    evidenceSummary: Array.isArray(evidenceSummary)
      ? evidenceSummary.map(asText).filter(Boolean)
      : [],
    previousDraft: history.previousDraft,
    redoDraft: history.redoDraft,
    draftHistory: history.draftHistory,
    draftHistoryIndex: history.draftHistoryIndex,
    updatedAt,
  };
}

function normalizeQuestion(question = {}, index = 0) {
  return {
    id: asText(question.id) || `q_${index + 1}`,
    questionText: asText(question.questionText),
    targetLength: asText(question.targetLength).replace(/[^0-9]/g, ''),
  };
}

function normalizeEssay(essay) {
  if (!essay || typeof essay !== 'object') return null;
  return buildEssayPayload(essay);
}

function alignEssayList(essays = [], length = 1) {
  return Array.from({ length }, (_, index) => normalizeEssay(essays[index]));
}

export function getRepresentativeEssay(essays = []) {
  return essays.find(essay => essay?.draft) || essays.find(Boolean) || null;
}

export function normalizeWriteState(rawEssay = null, updatedAt = new Date().toISOString()) {
  if (rawEssay?.version === 2 && Array.isArray(rawEssay.questions)) {
    const questions = rawEssay.questions.length > 0
      ? rawEssay.questions.map(normalizeQuestion)
      : [normalizeQuestion({}, 0)];
    const essays = alignEssayList(rawEssay.essays, questions.length);
    const representative = getRepresentativeEssay(essays);

    return {
      version: 2,
      questions,
      essays,
      pending: rawEssay.pending || null,
      updatedAt: rawEssay.updatedAt || updatedAt,
      ...buildEssayPayload({ ...(representative || {}), updatedAt: rawEssay.updatedAt || updatedAt }),
    };
  }

  if (rawEssay?.draft || rawEssay?.questionText || rawEssay?.targetLength) {
    const question = normalizeQuestion({
      id: rawEssay.questionId || 'q_legacy_1',
      questionText: rawEssay.questionText,
      targetLength: rawEssay.targetLength,
    });
    const essay = buildEssayPayload({ ...rawEssay, updatedAt: rawEssay.updatedAt || updatedAt });
    return {
      version: 2,
      questions: [question],
      essays: [essay],
      pending: null,
      updatedAt: essay.updatedAt,
      ...essay,
    };
  }

  const question = normalizeQuestion({}, 0);
  return {
    version: 2,
    questions: [question],
    essays: [null],
    pending: null,
    updatedAt,
    ...buildEssayPayload({ updatedAt }),
  };
}

export function buildWriteState({
  previousState = null,
  questions,
  essays,
  pending,
  updatedAt = new Date().toISOString(),
} = {}) {
  const base = normalizeWriteState(previousState, updatedAt);
  const nextQuestions = Array.isArray(questions) && questions.length > 0
    ? questions.map(normalizeQuestion)
    : base.questions;
  const nextEssays = alignEssayList(Array.isArray(essays) ? essays : base.essays, nextQuestions.length);
  const representative = getRepresentativeEssay(nextEssays);

  return {
    version: 2,
    questions: nextQuestions,
    essays: nextEssays,
    pending: pending === undefined ? base.pending : pending,
    updatedAt,
    ...buildEssayPayload({ ...(representative || {}), updatedAt }),
  };
}

export function buildWritePendingState(previousState, pending, updatedAt = new Date().toISOString()) {
  return buildWriteState({
    previousState,
    pending: {
      ...pending,
      status: 'pending',
      requestedAt: pending?.requestedAt || updatedAt,
    },
    updatedAt,
  });
}

export function completeWritePendingState(previousState, essays, updatedAt = new Date().toISOString()) {
  return buildWriteState({
    previousState,
    essays,
    pending: null,
    updatedAt,
  });
}

export function applyGeneratedEssayBatch(questions = [], currentEssays = [], generatedEssays = [], requiredIndexes = null) {
  const nextEssays = Array.isArray(currentEssays) ? [...currentEssays] : [];
  const generatedByIndex = new Map(
    (Array.isArray(generatedEssays) ? generatedEssays : [])
      .map(essay => [Number(essay?.index), essay])
      .filter(([index]) => Number.isInteger(index) && index >= 0),
  );
  const indexes = Array.isArray(requiredIndexes)
    ? requiredIndexes
    : questions
        .map((question, index) => ({ question, index }))
        .filter(({ question }) => asText(question?.questionText))
        .map(({ index }) => index);

  indexes.forEach((index) => {
    const question = questions[index];
    const generated = generatedByIndex.get(index);
    const draft = typeof generated?.draft === 'string' ? generated.draft.trim() : '';

    if (!draft) {
      throw new Error(`Missing generated draft for question ${index + 1}.`);
    }

    nextEssays[index] = buildEssayPayload({
      questionText: question?.questionText || generated?.questionText || '',
      targetLength: question?.targetLength || generated?.targetLength || '',
      draft,
      evidenceSummary: generated?.evidenceSummary,
    });
  });

  return nextEssays;
}

export function hasAllRequiredEssaysComplete(questions = [], essays = []) {
  const requiredIndexes = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => asText(question?.questionText));

  if (requiredIndexes.length === 0) return false;
  return requiredIndexes.every(({ index }) => Boolean(asText(essays[index]?.draft)));
}

export function shouldGenerateEssayForQuestion(question = {}, essay = null) {
  const questionText = asText(question?.questionText);
  if (!questionText) return false;
  if (!asText(essay?.draft)) return true;
  return questionText !== asText(essay?.questionText)
    || asText(question?.targetLength) !== asText(essay?.targetLength);
}

export function hasTemporaryWriteQuestions(questions = [], essays = []) {
  return Array.isArray(questions)
    && Array.isArray(essays)
    && questions.length > essays.length;
}

export function shouldAutosaveWriteQuestions({
  serializedQuestions = '',
  lastSerializedQuestions = '',
  loading = false,
  hasTemporaryQuestions = false,
  isEditingQuestions = false,
} = {}) {
  if (loading) return false;
  if (hasTemporaryQuestions) return false;
  if (isEditingQuestions) return false;
  return serializedQuestions !== lastSerializedQuestions;
}

export function getWriteStageAfterStateChange({
  currentStage = 'input',
  previousGenerateAllPending = false,
  pending = null,
  isComplete = false,
  isEditingQuestions = false,
} = {}) {
  const isPending = pending?.status === 'pending';
  if (isPending && pending?.type === 'revise' && currentStage === 'result') return 'result';
  if (isPending) return 'input';
  if (previousGenerateAllPending && isComplete) return 'result';
  if (isEditingQuestions) return currentStage;
  if (isComplete) return 'result';
  if (previousGenerateAllPending) return 'input';
  return currentStage;
}

export function failWritePendingState(previousState, errorMessage, updatedAt = new Date().toISOString()) {
  const base = normalizeWriteState(previousState, updatedAt);
  return buildWriteState({
    previousState: base,
    pending: {
      ...(base.pending || {}),
      status: 'failed',
      errorMessage: asText(errorMessage),
      failedAt: updatedAt,
    },
    updatedAt,
  });
}

export function shouldResumeWritePending(rawEssay = null) {
  const state = normalizeWriteState(rawEssay);
  return Boolean(state.pending && state.pending.status === 'pending');
}

export function applyEssayRevision(currentEssay = {}, revisedDraft = '', updatedAt = new Date().toISOString()) {
  return appendDraftHistory(currentEssay, revisedDraft, updatedAt);
}

export function undoEssayRevision(currentEssay = {}, updatedAt = new Date().toISOString()) {
  const base = buildEssayPayload(currentEssay);
  if (base.draftHistoryIndex <= 0) return buildEssayPayload({ ...base, updatedAt });

  const nextIndex = base.draftHistoryIndex - 1;
  return buildEssayPayload({
    ...base,
    draft: base.draftHistory[nextIndex],
    draftHistory: base.draftHistory,
    draftHistoryIndex: nextIndex,
    updatedAt,
  });
}

export function redoEssayRevision(currentEssay = {}, updatedAt = new Date().toISOString()) {
  const base = buildEssayPayload(currentEssay);
  if (base.draftHistoryIndex < 0 || base.draftHistoryIndex >= base.draftHistory.length - 1) {
    return buildEssayPayload({ ...base, updatedAt });
  }

  const nextIndex = base.draftHistoryIndex + 1;
  return buildEssayPayload({
    ...base,
    draft: base.draftHistory[nextIndex],
    draftHistory: base.draftHistory,
    draftHistoryIndex: nextIndex,
    updatedAt,
  });
}

export function buildEssayShareText({ companyName = '기업', essay = {} } = {}) {
  const question = asText(essay.questionText);
  const draft = typeof essay.draft === 'string' ? essay.draft.trim() : '';
  return [
    `[${companyName} 자소서 초안]`,
    question ? `문항: ${question}` : '',
    draft,
  ].filter(Boolean).join('\n\n');
}
