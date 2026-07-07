import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEssayContext,
  buildChatRequest,
  buildWriteDraftRequest,
  buildWriteDraftsRequest,
  buildCollectCompanyInfoRequest,
  getDefaultAiModel,
  getOpenAIRequestTimeoutMs,
  isEssayLengthAcceptable,
  normalizeResearchPlainText,
} from '../worker/api/[...path].js';

test('buildCollectCompanyInfoRequest combines web search and structured JSON output', () => {
  const body = buildCollectCompanyInfoRequest({
    company: 'Acme',
    role: 'Product Manager',
    today: '2026-05-08',
  });

  assert.deepEqual(body.tools, [{ type: 'web_search' }]);
  assert.equal(body.tool_choice, 'auto');
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.name, 'company_research_report');
  assert.equal(body.text.format.strict, true);
  assert.equal(body.model, 'gpt-5.4-mini');
  assert.match(body.input, /Acme/);
  assert.match(body.input, /Product Manager/);
  assert.match(body.instructions, /2026-05-08/);
  assert.match(body.instructions, /가장 최근/);
  assert.doesNotMatch(body.instructions, /18개월/);
});

test('getOpenAIRequestTimeoutMs keeps provider timeout below the Vercel function limit', () => {
  assert.equal(getOpenAIRequestTimeoutMs({}), 50000);
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: '70000' }), 55000);
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: '100' }), 1000);
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: '15000' }), 15000);
});

test('getDefaultAiModel uses gpt-5.4-mini for all worker routes by default', () => {
  assert.equal(getDefaultAiModel(), 'gpt-5.4-mini');
});

test('buildWriteDraftsRequest uses gpt-5.4-mini and requests an indexed essay array', () => {
  const body = buildWriteDraftsRequest({
    context: 'Company context',
    questions: [
      { index: 0, questionText: 'Question 1', targetLength: '700' },
      { index: 1, questionText: 'Question 2', targetLength: '500' },
    ],
  });

  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.text.format.name, 'essay_batch_response');
  assert.equal(body.text.format.schema.properties.essays.items.required.includes('index'), true);
  assert.match(body.instructions, /채용 자기소개서 전문 작성 AI/);
  assert.match(body.input, /draft에는 최종 제출용 자기소개서 본문만/);
  assert.match(body.input, /설명, 분석, 제목, 소제목, 번호, 글자 수 표기, markdown, bullet point/);
  assert.match(body.input, /Question 1/);
  assert.match(body.input, /Question 2/);
});

test('buildWriteDraftsRequest clearly separates source inputs and requires final drafts per question', () => {
  const context = buildEssayContext({
    researchReport: {
      company: 'Acme',
      role: 'Product Manager',
    },
    debateMessages: [
      { role: 'assistant', content: 'Focus on ownership and impact.' },
      { role: 'user', content: 'Use my automation project.' },
    ],
    userExperiences: [
      { category: 'project', text: 'Automated weekly reporting.' },
    ],
  });
  const body = buildWriteDraftsRequest({
    context,
    questions: [
      { index: 0, questionText: '지원 동기를 작성하세요.', targetLength: '700' },
      { index: 1, questionText: '문제 해결 경험을 작성하세요.', targetLength: '500' },
    ],
  });

  assert.match(body.input, /\[기업 정보\]/);
  assert.match(body.input, /\[직무 정보\]/);
  assert.match(body.input, /\[채팅 내역\]/);
  assert.match(body.input, /\[지원자 스펙\]/);
  assert.match(body.input, /\[자소서 문항 목록\]/);
  assert.match(body.input, /index: 0/);
  assert.match(body.input, /index: 1/);
  assert.match(body.input, /essays/);
  assert.match(body.input, /draft에는 최종 제출용 자기소개서 본문만/);
  assert.doesNotMatch(body.input, /몇 문단으로 나눌지|예상 글자수|paragraph plan/i);
});

test('buildWriteDraftRequest uses the same source sections for a single question draft', () => {
  const body = buildWriteDraftRequest({
    context: [
      '[기업 정보]',
      'Acme',
      '[직무 정보]',
      'Product Manager',
      '[채팅 내역]',
      'AI: Focus on ownership.',
      '[지원자 스펙]',
      '1. [project] Automated reporting.',
    ].join('\n'),
    questionText: '지원 동기를 작성하세요.',
    targetLength: '700',
  });

  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.text.format.name, 'essay_response');
  assert.match(body.input, /\[자소서 문항\]/);
  assert.match(body.input, /지원 동기를 작성하세요/);
  assert.match(body.input, /최종 제출용 자기소개서 본문만 출력/);
  assert.match(body.input, /설명, 분석, 제목, 소제목, 번호, 글자 수 표기, markdown, bullet point/);
  assert.doesNotMatch(body.input, /몇 문단으로 나눌지|예상 글자수|paragraph plan/i);
});

test('write draft prompts make the target length range a hard first-pass contract', () => {
  const body = buildWriteDraftRequest({
    context: '[기업 정보]\nAcme\n[직무 정보]\nProduct Manager',
    questionText: '지원 동기를 작성하세요.',
    targetLength: '700',
  });

  assert.match(body.input, /LENGTH_CONTRACT: draft must be 630-700 characters/);
  assert.match(body.input, /under 630 characters is incomplete/);
  assert.match(body.input, /do not call this a draft until it satisfies the range/);
  assert.doesNotMatch(body.input, /rewrite|repair|regenerate/i);
});

test('batch write prompt gives each question its own hard target length range', () => {
  const body = buildWriteDraftsRequest({
    context: '[기업 정보]\nAcme',
    questions: [
      { index: 0, questionText: '지원 동기', targetLength: '700' },
      { index: 1, questionText: '문제 해결 경험', targetLength: '500' },
    ],
  });

  assert.match(body.input, /LENGTH_CONTRACT: draft must be 630-700 characters/);
  assert.match(body.input, /LENGTH_CONTRACT: draft must be 450-500 characters/);
});

test('essay length validation accepts only the 90 to 100 percent target range', () => {
  const target = { min: 630, limit: 700 };

  assert.equal(isEssayLengthAcceptable('가'.repeat(500), target), false);
  assert.equal(isEssayLengthAcceptable('가'.repeat(630), target), true);
  assert.equal(isEssayLengthAcceptable('가'.repeat(700), target), true);
  assert.equal(isEssayLengthAcceptable('가'.repeat(701), target), false);
});

test('buildEssayContext keeps company role debate and specs but excludes research detail fields', () => {
  const context = buildEssayContext({
    researchReport: {
      company: 'Acme',
      role: 'Product Manager',
      summary: 'Long research summary should not be included',
      traits: ['customer obsession'],
      jdKeywords: ['roadmap'],
      roleFitAnalysis: ['fit analysis'],
      hiringSignals: ['signal'],
      risks: ['risk'],
    },
    debateMessages: [
      { role: 'assistant', content: 'Debate advice' },
      { role: 'user', content: 'My direction' },
    ],
    userExperiences: [
      { category: 'project', text: 'Launched a product' },
    ],
  });

  assert.match(context, /\[기업 정보\]/);
  assert.match(context, /기업: Acme/);
  assert.match(context, /\[직무 정보\]/);
  assert.match(context, /직무: Product Manager/);
  assert.match(context, /\[채팅 내역\]/);
  assert.match(context, /\[지원자 스펙\]/);
  assert.match(context, /AI: Debate advice/);
  assert.match(context, /Applicant: My direction/);
  assert.match(context, /Launched a product/);
  assert.doesNotMatch(context, /Long research summary/);
  assert.doesNotMatch(context, /customer obsession/);
  assert.doesNotMatch(context, /roadmap/);
  assert.doesNotMatch(context, /fit analysis/);
  assert.doesNotMatch(context, /signal/);
  assert.doesNotMatch(context, /risk/);
});

test('buildChatRequest tells debate to answer briefly by default and expand only on request', () => {
  const body = buildChatRequest({
    messages: [{ role: 'user', content: '이 경험 괜찮아?' }],
    researchReport: {
      company: 'Acme',
      role: 'Product Manager',
    },
    userExperiences: [{ category: 'project', text: 'Launched a product' }],
  });

  assert.equal(body.model, 'gpt-5.4-mini');
  assert.match(body.instructions, /기본 답변은 결론부터 짧고 직접적으로/);
  assert.match(body.instructions, /자세한 설명, 초안, 예시, 구조, 비교를 요청한 경우에만 길게/);
  assert.match(body.instructions, /리서치 내용을 길게 반복하지 말고/);
  assert.doesNotMatch(body.instructions, /목록은 최대 3개/);
});

test('normalizeResearchPlainText converts markdown links to plain text at the worker boundary', () => {
  assert.equal(
    normalizeResearchPlainText('내용은 [카카오 IR](https://example.com/ir)을 참고하세요 ([](https://kakaocrop.com)). 출처: kakaocrop.com'),
    '내용은 카카오 IR을 참고하세요.'
  );
});
