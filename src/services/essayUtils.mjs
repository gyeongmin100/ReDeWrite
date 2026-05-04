function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildEssayPayload({
  questionText,
  targetLength = '',
  draft,
  evidenceSummary = [],
  previousDraft = '',
  updatedAt = new Date().toISOString(),
} = {}) {
  return {
    questionText: asText(questionText),
    targetLength: asText(targetLength),
    draft: typeof draft === 'string' ? draft : '',
    evidenceSummary: Array.isArray(evidenceSummary)
      ? evidenceSummary.map(asText).filter(Boolean)
      : [],
    previousDraft: typeof previousDraft === 'string' ? previousDraft : '',
    updatedAt,
  };
}

export function applyEssayRevision(currentEssay = {}, revisedDraft = '', updatedAt = new Date().toISOString()) {
  return buildEssayPayload({
    ...currentEssay,
    draft: revisedDraft,
    previousDraft: currentEssay.draft || '',
    updatedAt,
  });
}

export function undoEssayRevision(currentEssay = {}, updatedAt = new Date().toISOString()) {
  if (!currentEssay.previousDraft) return buildEssayPayload({ ...currentEssay, updatedAt });

  return buildEssayPayload({
    ...currentEssay,
    draft: currentEssay.previousDraft,
    previousDraft: '',
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
