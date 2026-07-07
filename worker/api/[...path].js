import { getEnv, getHeaderSafeEnv } from '../envUtils.mjs';
import { resolveWorkerPath } from '../routeUtils.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_OPENAI_REQUEST_TIMEOUT_MS = 50000;
const MIN_OPENAI_REQUEST_TIMEOUT_MS = 1000;
const MAX_OPENAI_REQUEST_TIMEOUT_MS = 55000;
const DEFAULT_AI_MODEL = 'gpt-5.4-mini';
const DEFAULT_RESEARCH_MODEL = DEFAULT_AI_MODEL;

function nowMs() {
  return Date.now();
}

function getRequestId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getDefaultAiModel() {
  return DEFAULT_AI_MODEL;
}

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

function jsonResponse(res, body, status = 200) {
  setCors(res);
  return res.status(status).json(body);
}

export function getOpenAIRequestTimeoutMs(env = process.env) {
  const configured = Number(env.OPENAI_REQUEST_TIMEOUT_MS);
  const timeout = Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_OPENAI_REQUEST_TIMEOUT_MS;

  return Math.min(
    MAX_OPENAI_REQUEST_TIMEOUT_MS,
    Math.max(MIN_OPENAI_REQUEST_TIMEOUT_MS, timeout)
  );
}

function requireString(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  const limit = maxLength || 150;
  if (value.length > limit) {
    throw new Error(`${name} is too long.`);
  }
  return value.trim();
}

function optionalString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function requireArray(value, name, maxItems) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  if (value.length > maxItems) {
    throw new Error(`${name} has too many items.`);
  }
  return value;
}

async function verifySupabaseUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const supabaseUrl = getEnv(process.env, 'SUPABASE_URL');
  const supabaseAnonKey = getHeaderSafeEnv(process.env, 'SUPABASE_ANON_KEY');

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${match[1]}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function callOpenAI(path, body) {
  const openAiApiKey = getHeaderSafeEnv(process.env, 'OPENAI_API_KEY');
  const timeoutMs = getOpenAIRequestTimeoutMs(process.env);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = nowMs();
  const model = body?.model || 'unknown';
  const inputSize = typeof body?.input === 'string'
    ? body.input.length
    : JSON.stringify(body?.input || '').length;

  let res;
  try {
    res = await fetch(`https://api.openai.com/v1${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openAiApiKey}`,
        'user-agent': 'ReDeWrite-Worker/1.1',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    console.error('OpenAI request exception', {
      path,
      model,
      durationMs: nowMs() - startedAt,
      errorName: error?.name,
      errorMessage: error?.message,
    });
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('AI provider request timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  console.info('OpenAI request timing', {
    path,
    model,
    status: res.status,
    durationMs: nowMs() - startedAt,
    timeoutMs,
    inputSize,
    outputSize: getResponseText(data).length,
    inputTokens: data?.usage?.input_tokens,
    outputTokens: data?.usage?.output_tokens,
  });
  if (!res.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    console.error('OpenAI request failed', { status: res.status, path, error: errMsg });
    throw new Error(`AI provider request failed: ${res.status} – ${errMsg}`);
  }
  return data;
}

function parseJsonText(rawText) {
  const cleaned = String(rawText || '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI response was not valid JSON.');
  }
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeResearchPlainText(value) {
  return asText(value)
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]*\)/gi, '$1')
    .replace(/\[\]\((?:https?:\/\/|www\.)[^)]*\)/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?\b/gi, '')
    .replace(/(?:출처|source)\s*[:：]?\s*/gi, '')
    .replace(/[\s([{]*[\[\]]+[\s)\]}]*/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.。])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function asTextArray(value, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeResearchPlainText).filter(Boolean).slice(0, maxItems);
}

function normalizeNews(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      title: normalizeResearchPlainText(item?.title),
      summary: normalizeResearchPlainText(item?.summary),
      date: asText(item?.date),
    }))
    .filter(item => item.title)
    .slice(0, 5);
}

function getResponseText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const message = (data.output || []).find(item => item.type === 'message');
  const textPart = message?.content?.find(part => part.type === 'output_text' || part.type === 'text');
  return textPart?.text || '';
}

function normalizeResearchReport(parsed, company, role) {
  return {
    company,
    role,
    summary: normalizeResearchPlainText(parsed.summary),
    traits: asTextArray(parsed.traits),
    jdKeywords: asTextArray(parsed.jdKeywords),
    businessInsights: asTextArray(parsed.businessInsights),
    roleFitAnalysis: asTextArray(parsed.roleFitAnalysis),
    hiringSignals: asTextArray(parsed.hiringSignals),
    risks: asTextArray(parsed.risks),
    news: normalizeNews(parsed.news),
    culture: asTextArray(parsed.culture),
  };
}

const COMPANY_RESEARCH_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'traits', 'jdKeywords', 'businessInsights', 'roleFitAnalysis', 'hiringSignals', 'risks', 'news', 'culture'],
  properties: {
    summary: { type: 'string' },
    traits: { type: 'array', items: { type: 'string' } },
    jdKeywords: { type: 'array', items: { type: 'string' } },
    businessInsights: { type: 'array', items: { type: 'string' } },
    roleFitAnalysis: { type: 'array', items: { type: 'string' } },
    hiringSignals: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    news: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'date'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          date: { type: 'string' },
        },
      },
    },
    culture: { type: 'array', items: { type: 'string' } },
  },
};

export function buildCollectCompanyInfoRequest({ company, role, today }) {
  return {
    model: process.env.RESEARCH_MODEL || DEFAULT_RESEARCH_MODEL,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    text: {
      format: {
        type: 'json_schema',
        name: 'company_research_report',
        strict: true,
        schema: COMPANY_RESEARCH_REPORT_SCHEMA,
      },
    },
    instructions: `당신은 한국 취업 시장과 기업 분석에 강한 리서치 컨설턴트입니다.
반드시 최신 웹 검색 결과를 근거로 ${today} 기준 리서치를 작성하세요.
뉴스는 검색 시점 기준 가장 최근에 공개된 기사, 공시, 보도자료를 최신순으로 수집하세요.
몇 년 전 뉴스를 최신 뉴스처럼 넣지 말고, 더 최신 공개 자료가 부족할 때만 상대적으로 가장 최근인 항목을 사용하세요.
추측과 일반론을 줄이고, 지원자가 자기소개서와 면접 준비에 바로 쓸 수 있는 분석을 제공하세요.
최종 응답은 지정된 JSON 스키마만 따르세요. URL, 링크, 출처명, 설명문은 별도 필드로 추가하지 마세요.`,
    input: `${company}의 ${role} 직무 지원자를 위한 전문 기업 리서치를 수행하세요.
다음 항목을 모두 포함해 상세히 분석하세요: 기업 요약, 인재상, JD 핵심 역량, 비즈니스 인사이트, 직무 적합 분석, 채용 신호, 리스크, 최신 뉴스 3건, 조직문화.`,
  };
}

function normalizeEssayResponse(parsed) {
  return {
    draft: asText(parsed.draft),
    evidenceSummary: asTextArray(parsed.evidenceSummary, 6),
  };
}

function countEssayChars(text = '') {
  return typeof text === 'string' ? Array.from(text).length : 0;
}

function getEssayLengthTarget(targetLength = '') {
  const limit = Number(targetLength);
  if (!Number.isInteger(limit) || limit <= 0) return null;
  return { limit, min: Math.ceil(limit * 0.9) };
}

function clampDraftToLimit(draft = '', limit = 0) {
  if (!Number.isInteger(limit) || limit <= 0 || typeof draft !== 'string') return draft;
  if (countEssayChars(draft) <= limit) return draft;
  return Array.from(draft.trim()).slice(0, limit).join('').trimEnd();
}

function buildLengthInstruction(target) {
  if (!target) return '문항에 별도 글자수 제한이 없으면 문항 요구에 맞는 충분한 길이로 작성하세요.';
  return [
    `LENGTH_CONTRACT: draft must be ${target.min}-${target.limit} characters, including spaces.`,
    `Hard rule: under ${target.min} characters is incomplete; over ${target.limit} characters is invalid.`,
    `Before returning JSON, count the draft length yourself and do not call this a draft until it satisfies the range.`,
    `If the body is short, expand only with concrete input-backed detail: situation, action, result, company fit, role fit, and problem-solving evidence.`,
    `공백과 문장부호를 포함해 반드시 ${target.min}자 이상 ${target.limit}자 이하로 작성하세요.`,
    `${target.limit}자를 1자라도 초과하면 즉시 실패입니다. 절대 초과 금지.`,
    `가능하면 ${target.limit}자에 가깝게 쓰되 절대 넘지 마세요.`,
    `${target.min}자 미만이면 너무 짧으므로 구체적 근거를 보강하세요.`,
  ].join('\n');
}

export function isEssayLengthAcceptable(draft, target) {
  if (!target) return true;
  const count = countEssayChars(draft);
  return count >= target.min && count <= target.limit;
}

function assertEssayLengthAcceptable(draft, target, label = 'draft') {
  if (!target || isEssayLengthAcceptable(draft, target)) return;
  const count = countEssayChars(draft);
  const error = new Error(`${label} length ${count} is outside target range ${target.min}-${target.limit}.`);
  error.statusCode = 502;
  throw error;
}

async function requestEssayJson({ systemPrompt, userPrompt }) {
  const data = await callOpenAI('/responses', {
    model: DEFAULT_AI_MODEL,
    text: {
      format: {
        type: 'json_schema',
        name: 'essay_response',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['draft', 'evidenceSummary'],
          properties: {
            draft: { type: 'string' },
            evidenceSummary: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    instructions: systemPrompt,
    input: userPrompt,
  });
  return normalizeEssayResponse(parseJsonText(getResponseText(data)));
}

function normalizeEssayBatchResponse(value) {
  const essays = Array.isArray(value?.essays) ? value.essays : [];
  return {
    essays: essays.map(item => ({
      index: Number(item?.index),
      questionText: optionalString(item?.questionText, 3000),
      targetLength: optionalString(item?.targetLength, 100),
      draft: typeof item?.draft === 'string' ? item.draft.trim() : '',
      evidenceSummary: Array.isArray(item?.evidenceSummary)
        ? item.evidenceSummary.map(v => String(v || '').trim()).filter(Boolean).slice(0, 8)
        : [],
    })).filter(item => Number.isInteger(item.index) && item.index >= 0),
  };
}

export function buildWriteDraftsRequest({ context = '', questions = [] } = {}) {
  const questionLines = questions.map(question => [
    `index: ${question.index}`,
    `문항: ${question.questionText}`,
    `글자 수 제한: ${question.targetLength || '없음'}`,
    `글자 수 기준: ${buildLengthInstruction(getEssayLengthTarget(question.targetLength || ''))}`,
  ].join('\n')).join('\n\n');

  const input = `${context}

[자소서 문항 목록]
${questionLines}

[출력 형식]
반드시 JSON 하나만 출력하세요.
essays 배열에 문항별 결과를 담고, 각 결과는 원래 문항의 index를 반드시 포함하세요.

{
  "essays": [
    {
      "index": 0,
      "questionText": "문항 원문",
      "targetLength": "글자 수 제한",
      "draft": "최종 제출용 자기소개서 본문",
      "evidenceSummary": ["반영한 핵심 근거"]
    }
  ]
}

[작성 규칙]
- draft에는 최종 제출용 자기소개서 본문만 작성하세요.
- draft 안에는 설명, 분석, 제목, 소제목, 번호, 글자 수 표기, markdown, bullet point를 넣지 마세요.
- 입력 정보에 없는 사실은 만들지 마세요.
- 기업 정보와 직무 정보는 나열하지 말고 문장 안에 자연스럽게 반영하세요.
- 채팅 내역에서 정리된 지원 방향과 강점을 우선 반영하세요.
- 지원자 스펙은 경험, 행동, 결과 중심으로 풀어 쓰세요.
- 각 draft는 해당 문항의 의도에 직접 답해야 합니다.
- 직무 연관성과 문제 해결 역량이 드러나야 합니다.
- 추상적인 표현, 과장된 표현, AI가 쓴 듯한 문체를 피하세요.
- evidenceSummary에는 draft에 반영한 핵심 근거만 짧게 쓰세요.`;

  return {
    model: DEFAULT_AI_MODEL,
    text: {
      format: {
        type: 'json_schema',
        name: 'essay_batch_response',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['essays'],
          properties: {
            essays: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['index', 'questionText', 'targetLength', 'draft', 'evidenceSummary'],
                properties: {
                  index: { type: 'integer' },
                  questionText: { type: 'string' },
                  targetLength: { type: 'string' },
                  draft: { type: 'string' },
                  evidenceSummary: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    instructions: '당신은 채용 자기소개서 전문 작성 AI입니다. 제공된 기업 정보, 직무 정보, 채팅 내역, 지원자 스펙, 자소서 문항들을 참고해 각 문항별로 실제 제출 가능한 자기소개서 본문을 작성하세요. 반환은 지정된 JSON 하나만 허용됩니다.',
    input,
  };
}

export function buildWriteDraftRequest({ context = '', questionText = '', targetLength = '' } = {}) {
  const lengthTarget = getEssayLengthTarget(targetLength);
  const input = `${context}

[자소서 문항]
${questionText}

[글자 수 제한]
${targetLength || '없음'}

[글자 수 기준]
${buildLengthInstruction(lengthTarget)}

[출력 형식]
반드시 JSON 하나만 출력하세요.

{
  "draft": "최종 제출용 자기소개서 본문",
  "evidenceSummary": ["반영한 핵심 근거"]
}

[작성 규칙]
- draft에는 최종 제출용 자기소개서 본문만 출력하세요.
- draft 안에는 설명, 분석, 제목, 소제목, 번호, 글자 수 표기, markdown, bullet point를 넣지 마세요.
- 답변은 자기소개서 본문으로 바로 시작해야 합니다.
- 입력 정보에 없는 사실은 만들지 마세요.
- 기업 정보와 직무 정보는 나열하지 말고 문장 안에 자연스럽게 반영하세요.
- 채팅 내역에서 정리된 지원 방향과 강점을 우선 반영하세요.
- 지원자 스펙은 경험, 행동, 결과 중심으로 풀어 쓰세요.
- 문항의 의도에 직접 답하세요.
- 직무 연관성과 문제 해결 역량이 드러나야 합니다.
- 추상적인 표현, 과장된 표현, AI가 쓴 듯한 문체를 피하세요.
- evidenceSummary에는 draft에 반영한 핵심 근거만 짧게 쓰세요.`;

  return {
    model: DEFAULT_AI_MODEL,
    text: {
      format: {
        type: 'json_schema',
        name: 'essay_response',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['draft', 'evidenceSummary'],
          properties: {
            draft: { type: 'string' },
            evidenceSummary: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    instructions: '당신은 채용 자기소개서 전문 작성 AI입니다. 제공된 정보를 참고해 실제 제출 가능한 자기소개서 본문을 작성하세요. 반환은 지정된 JSON 하나만 허용됩니다.',
    input,
  };
}

async function requestEssayBatchJson({ context, questions }) {
  const data = await callOpenAI('/responses', buildWriteDraftsRequest({ context, questions }));
  return normalizeEssayBatchResponse(parseJsonText(getResponseText(data)));
}


export function buildEssayContext({ researchReport = {}, debateMessages = [], userExperiences = [] }) {
  const debateSummary = Array.isArray(debateMessages)
    ? debateMessages
        .slice(-15)
        .map(m => `${m.role === 'assistant' ? 'AI' : 'Applicant'}: ${String(m.content || '').slice(0, 2000)}`)
        .join('\n')
    : '';
  const experiences = Array.isArray(userExperiences)
    ? userExperiences.slice(0, 20).map((item, i) => {
        const text = typeof item === 'string' ? item : String(item.text || '');
        const cat = typeof item === 'object' && item.category ? `[${item.category}] ` : '';
        return `${i + 1}. ${cat}${text.slice(0, 2000)}`;
      }).join('\n')
    : '';

  return `[기업 정보]
기업: ${String(researchReport.company || 'Unknown').slice(0, 200)}

[직무 정보]
직무: ${String(researchReport.role || 'Unknown').slice(0, 200)}

[채팅 내역]
${debateSummary || 'No saved debate history.'}

[지원자 스펙]
${experiences || 'No saved applicant specs.'}`;
}

async function handleParseIntent(payload) {
  const userInput = requireString(payload.userInput, 'userInput', 2000);
  const data = await callOpenAI('/responses', {
    model: DEFAULT_AI_MODEL,
    text: {
      format: {
        type: 'json_schema',
        name: 'intent',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['company', 'role'],
          properties: {
            company: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
    instructions: '사용자 입력에서 회사명과 직무를 추출해 반환하세요.',
    input: userInput,
  });
  const parsed = parseJsonText(getResponseText(data));
  return {
    company: requireString(parsed.company, 'company', 200),
    role: requireString(parsed.role, 'role', 200),
  };
}

async function handleCollectCompanyInfoLegacy(payload) {
  const company = requireString(payload.company, 'company', 200);
  const role = requireString(payload.role, 'role', 200);
  const today = new Date().toISOString().slice(0, 10);

  const searchData = await callOpenAI('/responses', {
    model: process.env.RESEARCH_MODEL || DEFAULT_RESEARCH_MODEL,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    instructions: `당신은 한국 취업 시장과 기업 분석에 강한 리서치 컨설턴트입니다.
반드시 최신 웹 검색 결과를 근거로 ${today} 기준 리서치를 작성하세요.
추측과 일반론을 줄이고, 지원자가 자기소개서와 면접 준비에 바로 쓸 수 있는 분석을 제공하세요.
URL, 링크, 출처명, 언론사명은 결과에 포함하지 마세요.`,
    input: `${company}의 ${role} 직무 지원자를 위한 전문 기업 리서치를 수행하세요.
다음 항목을 모두 포함해 상세히 분석하세요: 기업 요약, 인재상, JD 핵심 역량, 비즈니스 인사이트, 직무 적합 분석, 채용 신호, 리스크, 최신 뉴스 3건, 조직문화.`,
  });

  const rawResearch = getResponseText(searchData);
  if (!rawResearch) throw new Error('기업 정보를 가져오지 못했습니다.');

  const structureData = await callOpenAI('/responses', {
    model: process.env.RESEARCH_MODEL || DEFAULT_RESEARCH_MODEL,
    text: {
      format: {
        type: 'json_schema',
        name: 'company_research_report',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'traits', 'jdKeywords', 'businessInsights', 'roleFitAnalysis', 'hiringSignals', 'risks', 'news', 'culture'],
          properties: {
            summary: { type: 'string' },
            traits: { type: 'array', items: { type: 'string' } },
            jdKeywords: { type: 'array', items: { type: 'string' } },
            businessInsights: { type: 'array', items: { type: 'string' } },
            roleFitAnalysis: { type: 'array', items: { type: 'string' } },
            hiringSignals: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            news: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'summary', 'date'],
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
            culture: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    instructions: '아래 리서치 내용을 지정된 JSON 스키마로 정확히 변환하세요. URL, 링크, 출처명은 제외하세요.',
    input: rawResearch,
  });

  const rawText = getResponseText(structureData);
  if (!rawText) throw new Error('기업 정보 구조화에 실패했습니다.');
  const parsed = parseJsonText(rawText);
  return normalizeResearchReport(parsed, company, role);
}

async function handleCollectCompanyInfo(payload) {
  const company = requireString(payload.company, 'company', 200);
  const role = requireString(payload.role, 'role', 200);
  const today = new Date().toISOString().slice(0, 10);

  const data = await callOpenAI('/responses', buildCollectCompanyInfoRequest({ company, role, today }));
  const rawText = getResponseText(data);
  if (!rawText) throw new Error('기업 정보 구조화에 실패했습니다.');
  const parsed = parseJsonText(rawText);
  return normalizeResearchReport(parsed, company, role);
}

export function buildChatRequest({ messages = [], researchReport = {}, userExperiences = [] } = {}) {
  const normalizedMessages = requireArray(messages, 'messages', 30).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: requireString(m.content, 'message.content', 10000),
  }));
  const normalizedExperiences = Array.isArray(userExperiences)
    ? userExperiences.slice(0, 20).map((item, i) => {
        const text = typeof item === 'string' ? item : String(item.text || '');
        const cat = typeof item === 'object' && item.category ? `[${item.category}] ` : '';
        return `${i + 1}. ${cat}${text.slice(0, 2000)}`;
      })
    : [];

  const systemPrompt = `당신은 한국 취업 준비생을 돕는 자기소개서·면접 대화형 코치입니다.
사용자의 질문 의도를 먼저 파악하고, 기업 정보와 지원자 경험을 함께 사용해 답하세요.
대화는 여러 턴으로 이어질 수 있으므로 이전 대화 맥락을 유지하세요.

[기업 정보]
기업: ${String(researchReport.company || '미상').slice(0, 200)}
직무: ${String(researchReport.role || '미상').slice(0, 200)}
인재상: ${(researchReport.traits || []).join(', ').slice(0, 800)}
JD 핵심 역량: ${(researchReport.jdKeywords || []).join(', ').slice(0, 800)}
조직문화: ${(researchReport.culture || []).join(', ').slice(0, 800)}

[지원자 스펙·경험]
${normalizedExperiences.join('\n') || '저장된 경험이 없습니다.'}

응답 원칙:
- 기본 답변은 결론부터 짧고 직접적으로 말하세요.
- 사용자가 자세한 설명, 초안, 예시, 구조, 비교를 요청한 경우에만 길게 답하세요.
- 리서치 내용을 길게 반복하지 말고, 사용자의 판단이나 다음 행동에 필요한 내용만 말하세요.
- 지원자 경험이 있으면 반드시 그 경험 중 관련성이 높은 내용을 먼저 근거로 삼으세요.
- 질문이 넓으면 선택지를 제시하고, 질문이 구체적이면 바로 구체적으로 답하세요.
- 고정 형식으로만 답하지 말고 질문에 맞춰 분석, 질문, 요약, 소재, 문장 중 적절한 형태를 선택하세요.
- 경험 정보가 부족할 때만 MY 탭에 경험을 추가하라고 안내하세요.`;

  return {
    model: DEFAULT_AI_MODEL,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    instructions: systemPrompt,
    input: normalizedMessages,
  };
}

async function handleChat(payload) {
  const data = await callOpenAI('/responses', buildChatRequest(payload));
  return { message: getResponseText(data) || '' };
}
async function handleWriteDraft(payload) {
  const questionText = requireString(payload.questionText, 'questionText', 3000);
  const targetLength = optionalString(payload.targetLength, 100);
  const lengthTarget = getEssayLengthTarget(targetLength);
  const context = buildEssayContext({
    researchReport: payload.researchReport || {},
    debateMessages: Array.isArray(payload.debateMessages) ? payload.debateMessages : [],
    userExperiences: Array.isArray(payload.userExperiences) ? payload.userExperiences : [],
  });
  const body = buildWriteDraftRequest({ context, questionText, targetLength });
  const data = await callOpenAI('/responses', body);
  const result = normalizeEssayResponse(parseJsonText(getResponseText(data)));
  return result;
}

async function handleWriteDrafts(payload) {
  const rawQuestions = requireArray(payload.questions, 'questions', 10);
  const questions = rawQuestions
    .map((question, fallbackIndex) => ({
      index: Number.isInteger(question?.index) ? question.index : fallbackIndex,
      questionText: requireString(question?.questionText, `questions[${fallbackIndex}].questionText`, 3000),
      targetLength: optionalString(question?.targetLength, 100),
    }));
  const context = buildEssayContext({
    researchReport: payload.researchReport || {},
    debateMessages: Array.isArray(payload.debateMessages) ? payload.debateMessages : [],
    userExperiences: Array.isArray(payload.userExperiences) ? payload.userExperiences : [],
  });

  const result = await requestEssayBatchJson({ context, questions });
  const requestedIndexes = new Set(questions.map(question => question.index));
  const essays = result.essays.filter(essay => requestedIndexes.has(essay.index));

  return { essays };
}

async function handleReviseEssay(payload) {
  const questionText = requireString(payload.questionText, 'questionText', 3000);
  const currentDraft = requireString(payload.currentDraft, 'currentDraft', 10000);
  const revisionRequest = requireString(payload.revisionRequest, 'revisionRequest', 3000);
  const targetLength = optionalString(payload.targetLength, 100);
  const lengthTarget = getEssayLengthTarget(targetLength);
  const context = buildEssayContext({
    researchReport: payload.researchReport || {},
    debateMessages: Array.isArray(payload.debateMessages) ? payload.debateMessages : [],
    userExperiences: Array.isArray(payload.userExperiences) ? payload.userExperiences : [],
  });

  const systemPrompt =
    '당신은 한국 취업 자기소개서 편집 코치입니다. 현재 초안을 사용자의 수정 요청에 맞게 전체 초안으로 다시 작성하세요. 반환은 JSON 하나만 허용하며 형식은 {"draft": string, "evidenceSummary": string[]} 입니다.';
  const basePrompt = `${context}

[작성 문항]
${questionText}

[글자수 제한]
${buildLengthInstruction(lengthTarget)}

[현재 초안]
${currentDraft}

[수정 요청]
${revisionRequest}

[수정 기준]
- 요청 방향을 우선 반영하되, 직무 연결성과 경험 근거를 유지하세요.
- 단순 첨삭 설명이 아니라 수정 완료된 전체 초안을 draft에 넣으세요.
- evidenceSummary에는 이번 수정에서 강화한 근거를 3~5개로 짧게 쓰세요.`;

  const result = await requestEssayJson({ systemPrompt, userPrompt: basePrompt });
  return result;
}

export default async function handler(req, res) {
  const requestId = getRequestId();
  const requestStartedAt = nowMs();
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return jsonResponse(res, { error: 'Method not allowed.' }, 405);
  }

  if (
    !getEnv(process.env, 'OPENAI_API_KEY')
    || !getEnv(process.env, 'SUPABASE_URL')
    || !getEnv(process.env, 'SUPABASE_ANON_KEY')
  ) {
    console.error('Worker environment is not configured.');
    return jsonResponse(res, { error: 'Server is not configured.' }, 500);
  }

  try {
    const contentLength = Number(req.headers['content-length'] || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(res, { error: 'Request body is too large.' }, 400);
    }

    const authStartedAt = nowMs();
    const user = await verifySupabaseUser(req);
    const authDurationMs = nowMs() - authStartedAt;
    if (!user?.id) {
      console.warn('Worker request unauthorized', {
        requestId,
        authDurationMs,
        totalMs: nowMs() - requestStartedAt,
      });
      return jsonResponse(res, { error: 'Unauthorized.' }, 401);
    }

    const rawPath = req.query.path ?? req.url?.split('?')[0].split('/').slice(2);
    const pathStr = resolveWorkerPath(rawPath);
    const payload = req.body || {};
    const routeStartedAt = nowMs();
    const questionCount = Array.isArray(payload.questions) ? payload.questions.length : undefined;
    const payloadSize = JSON.stringify(payload).length;

    console.info('Worker request start', {
      requestId,
      path: pathStr,
      contentLength,
      payloadSize,
      questionCount,
      authDurationMs,
    });

    let responseBody;
    let status = 200;

    if (pathStr === '/parse-intent') {
      responseBody = await handleParseIntent(payload);
    } else if (pathStr === '/collect-company-info') {
      responseBody = await handleCollectCompanyInfo(payload);
    } else if (pathStr === '/chat') {
      responseBody = await handleChat(payload);
    } else if (pathStr === '/write-draft') {
      responseBody = await handleWriteDraft(payload);
    } else if (pathStr === '/write-drafts') {
      responseBody = await handleWriteDrafts(payload);
    } else if (pathStr === '/revise-essay') {
      responseBody = await handleReviseEssay(payload);
    } else {
      responseBody = { error: 'Not found.' };
      status = 404;
    }

    console.info('Worker request complete', {
      requestId,
      path: pathStr,
      status,
      routeDurationMs: nowMs() - routeStartedAt,
      totalMs: nowMs() - requestStartedAt,
      responseSize: JSON.stringify(responseBody || {}).length,
    });
    return jsonResponse(res, responseBody, status);
  } catch (error) {
    console.error('Handler error', {
      requestId,
      message: error.message,
      statusCode: error.statusCode || 400,
      totalMs: nowMs() - requestStartedAt,
    });
    return jsonResponse(res, { error: error.message || 'Request failed.' }, error.statusCode || 400);
  }
}
