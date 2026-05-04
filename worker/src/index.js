const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};

const MAX_BODY_BYTES = 32 * 1024;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

function requireString(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  if (value.length > maxLength) {
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

async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    throw new Error('Request body is too large.');
  }
  return request.json();
}

async function verifySupabaseUser(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${match[1]}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

async function callOpenAI(path, body, env) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('OpenAI request failed', { status: res.status, path });
    throw new Error('AI provider request failed.');
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

function asTextArray(value, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value.map(asText).filter(Boolean).slice(0, maxItems);
}

function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeNews(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      title: asText(item?.title),
      summary: asText(item?.summary),
      date: asText(item?.date),
    }))
    .filter(item => item.title)
    .slice(0, 5);
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(item => ({
      title: asText(item?.title),
      url: isHttpUrl(item?.url) ? item.url.trim() : '',
    }))
    .filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 8);
}

function getResponseText(data) {
  if (typeof data.output_text === 'string') return data.output_text;

  const message = (data.output || []).find(item => item.type === 'message');
  const textPart = message?.content?.find(part => part.type === 'output_text');
  return textPart?.text || '';
}

function getResponseSources(data) {
  const sources = [];

  for (const item of data.output || []) {
    if (item.type === 'web_search_call') {
      for (const source of item.action?.sources || []) {
        sources.push({ title: source.title, url: source.url });
      }
    }

    if (item.type === 'message') {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          if (annotation.type === 'url_citation') {
            sources.push({ title: annotation.title, url: annotation.url });
          }
        }
      }
    }
  }

  return normalizeSources(sources);
}

function normalizeResearchReport(parsed, company, role, fallbackSources = []) {
  return {
    company,
    role,
    summary: asText(parsed.summary),
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

function normalizeEssayResponse(parsed) {
  return {
    draft: asText(parsed.draft),
    evidenceSummary: asTextArray(parsed.evidenceSummary, 6),
  };
}

function buildEssayContext({ researchReport = {}, debateMessages = [], userExperiences = [] }) {
  const debateSummary = Array.isArray(debateMessages)
    ? debateMessages
      .slice(-12)
      .map(message => `${message.role === 'assistant' ? 'AI' : '지원자'}: ${String(message.content || '').slice(0, 700)}`)
      .join('\n')
    : '';

  const experiences = Array.isArray(userExperiences)
    ? userExperiences.slice(0, 10).map((item, index) => `${index + 1}. ${String(item).slice(0, 1000)}`).join('\n')
    : '';

  return `[기업/직무 리서치]
기업: ${String(researchReport.company || '미상').slice(0, 80)}
직무: ${String(researchReport.role || '미상').slice(0, 80)}
리서치 요약: ${String(researchReport.summary || '').slice(0, 1200)}
인재상: ${(researchReport.traits || []).join(', ').slice(0, 700)}
JD 핵심 역량: ${(researchReport.jdKeywords || []).join(', ').slice(0, 700)}
직무 연결 전략: ${(researchReport.roleFitAnalysis || []).join(' / ').slice(0, 1200)}
채용 신호: ${(researchReport.hiringSignals || []).join(' / ').slice(0, 1000)}
주의 리스크: ${(researchReport.risks || []).join(' / ').slice(0, 800)}

[Debate 대화]
${debateSummary || '저장된 Debate 대화가 없습니다.'}

[지원자 MY 경험]
${experiences || '저장된 지원자 경험이 없습니다.'}`;
}

async function handleParseIntent(payload, env) {
  const userInput = requireString(payload.userInput, 'userInput', 1200);

  const data = await callOpenAI('/chat/completions', {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '사용자 입력에서 회사명과 직무를 추출해 JSON으로만 반환하세요. 형식은 반드시 {"company": string, "role": string} 입니다. 직무가 불명확하면 가장 일반적인 직무명으로 추정하세요.',
      },
      { role: 'user', content: userInput },
    ],
  }, env);

  const parsed = parseJsonText(data.choices?.[0]?.message?.content);
  return {
    company: requireString(parsed.company, 'company', 80),
    role: requireString(parsed.role, 'role', 80),
  };
}

async function handleCollectCompanyInfo(payload, env) {
  const company = requireString(payload.company, 'company', 80);
  const role = requireString(payload.role, 'role', 80);

  const today = new Date().toISOString().slice(0, 10);
  const data = await callOpenAI('/responses', {
    model: env.RESEARCH_MODEL || 'gpt-5-mini',
    tools: [
      {
        type: 'web_search',
        user_location: {
          type: 'approximate',
          country: 'KR',
          timezone: 'Asia/Seoul',
        },
      },
    ],
    tool_choice: 'auto',
    instructions: `당신은 한국 취업 시장과 기업 분석에 강한 리서치 컨설턴트입니다.
반드시 최신 웹 검색 결과를 근거로 ${today} 기준 리서치를 작성하세요.
추측과 일반론을 줄이고, 지원자가 자기소개서와 면접 준비에 바로 쓸 수 있는 분석을 제공하세요.
반환은 JSON 하나만 허용합니다. URL, 링크, 출처명, 언론사명은 결과 JSON에 포함하지 마세요.`,
    input: `${company}의 ${role} 직무 지원자를 위한 전문 기업 리서치를 작성하세요.
포함할 내용:
- 기업/사업 방향 요약
- 인재상 키워드와 직무 핵심역량
- 최근 12개월 중심 뉴스 3~5건. 각 뉴스는 title, summary, date만 포함
- 사업/시장 인사이트
- ${role} 직무와 연결되는 지원 전략
- 채용에서 강조할 신호
- 지원자가 조심해야 할 리스크
- 조직문화 키워드`,
    text: {
      format: {
        type: 'json_schema',
        name: 'company_research_report',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'summary',
            'traits',
            'jdKeywords',
            'businessInsights',
            'roleFitAnalysis',
            'hiringSignals',
            'risks',
            'news',
            'culture',
          ],
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
  }, env);

  const parsed = parseJsonText(getResponseText(data));
  return normalizeResearchReport(parsed, company, role);
}

async function handleChat(payload, env) {
  const messages = requireArray(payload.messages, 'messages', 20).map(message => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: requireString(message.content, 'message.content', 1200),
  }));
  const researchReport = payload.researchReport || {};
  const userExperiences = Array.isArray(payload.userExperiences)
    ? payload.userExperiences.slice(0, 10).map(item => String(item).slice(0, 1000))
    : [];

  const systemPrompt = `당신은 한국 취업 준비생을 돕는 자기소개서·면접 대화형 코치입니다.
사용자의 질문 의도를 먼저 파악하고, 기업 리서치와 지원자 경험을 함께 사용해 답하세요.
대화는 멀티턴으로 이어질 수 있으므로 이전 대화 맥락을 유지하세요.

[기업 정보]
기업: ${String(researchReport.company || '미상').slice(0, 80)}
직무: ${String(researchReport.role || '미상').slice(0, 80)}
인재상: ${(researchReport.traits || []).join(', ').slice(0, 500)}
JD 핵심 역량: ${(researchReport.jdKeywords || []).join(', ').slice(0, 500)}
조직문화: ${(researchReport.culture || []).join(', ').slice(0, 500)}

[지원자 경험]
${userExperiences.map((item, index) => `${index + 1}. ${item}`).join('\n')}

답변 원칙:
- 지원자 경험이 있으면 반드시 그 경험 중 관련성이 높은 내용을 먼저 근거로 삼으세요.
- 질문이 넓으면 2~3개 선택지를 제시하고, 질문이 구체적이면 바로 구체적으로 답하세요.
- 고정 양식으로만 답하지 말고 질문에 맞춰 분석, 질문, 요약, 소재화, 문장화 중 적절한 형태를 선택하세요.
- 불필요하게 길게 쓰지 말되, 사용자가 초안이나 구조를 요구하면 충분히 구체적으로 작성하세요.
- 경험 정보가 부족할 때만 MY 탭에 경험을 추가하라고 안내하세요.`;

  const data = await callOpenAI('/chat/completions', {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  }, env);

  return { message: data.choices?.[0]?.message?.content || '' };
}

async function handleWriteDraft(payload, env) {
  const questionText = requireString(payload.questionText, 'questionText', 2000);
  const targetLength = optionalString(payload.targetLength, 40);
  const context = buildEssayContext({
    researchReport: payload.researchReport || {},
    debateMessages: Array.isArray(payload.debateMessages) ? payload.debateMessages : [],
    userExperiences: Array.isArray(payload.userExperiences) ? payload.userExperiences : [],
  });

  const data = await callOpenAI('/chat/completions', {
    model: env.WRITE_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 한국 취업 자기소개서 전문 코치입니다. 사용자의 실제 자소서 문항에 맞춰 기업 리서치, Debate 대화, MY 경험을 근거로 자연스러운 초안을 작성하세요. 반환은 JSON 하나만 허용하며 형식은 {"draft": string, "evidenceSummary": string[]} 입니다.',
      },
      {
        role: 'user',
        content: `${context}

[작성 문항]
${questionText}

[글자 수 제한]
${targetLength || '문항에 적힌 제한을 우선 따르세요.'}

작성 기준:
- 지원자 경험을 과장하지 말고, 저장된 경험과 Debate에서 확인된 소재를 우선 사용하세요.
- 기업명/직무/인재상/JD 키워드가 자연스럽게 드러나야 합니다.
- 문항이 지원동기, 성장과정, 직무역량, 입사 후 포부 중 무엇인지 판단해 구조를 달리하세요.
- evidenceSummary에는 초안에 반영한 핵심 근거를 3~5개로 짧게 쓰세요.`,
      },
    ],
  }, env);

  return normalizeEssayResponse(parseJsonText(data.choices?.[0]?.message?.content));
}

async function handleReviseEssay(payload, env) {
  const questionText = requireString(payload.questionText, 'questionText', 2000);
  const currentDraft = requireString(payload.currentDraft, 'currentDraft', 5000);
  const revisionRequest = requireString(payload.revisionRequest, 'revisionRequest', 1000);
  const targetLength = optionalString(payload.targetLength, 40);
  const context = buildEssayContext({
    researchReport: payload.researchReport || {},
    debateMessages: Array.isArray(payload.debateMessages) ? payload.debateMessages : [],
    userExperiences: Array.isArray(payload.userExperiences) ? payload.userExperiences : [],
  });

  const data = await callOpenAI('/chat/completions', {
    model: env.WRITE_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 한국 취업 자기소개서 편집 코치입니다. 현재 초안을 사용자의 수정 요청에 맞게 다시 작성하세요. 기업 리서치, Debate 대화, MY 경험과 충돌하지 않게 수정하고, 반환은 JSON 하나만 허용합니다. 형식은 {"draft": string, "evidenceSummary": string[]} 입니다.',
      },
      {
        role: 'user',
        content: `${context}

[작성 문항]
${questionText}

[글자 수 제한]
${targetLength || '문항에 적힌 제한을 우선 따르세요.'}

[현재 초안]
${currentDraft}

[수정 요청]
${revisionRequest}

수정 기준:
- 요청한 방향을 우선 반영하되, 핵심 경험과 직무 연결성은 유지하세요.
- 단순 첨삭 설명이 아니라 수정 완료된 전체 초안을 draft에 넣으세요.
- evidenceSummary에는 이번 수정에서 강화한 근거를 3~5개로 짧게 쓰세요.`,
      },
    ],
  }, env);

  return normalizeEssayResponse(parseJsonText(data.choices?.[0]?.message?.content));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      console.error('Worker environment is not configured.');
      return jsonResponse({ error: 'Server is not configured.' }, 500);
    }

    const user = await verifySupabaseUser(request, env);
    if (!user?.id) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    try {
      const url = new URL(request.url);
      const payload = await readJson(request);

      if (url.pathname === '/parse-intent') {
        return jsonResponse(await handleParseIntent(payload, env));
      }

      if (url.pathname === '/collect-company-info') {
        return jsonResponse(await handleCollectCompanyInfo(payload, env));
      }

      if (url.pathname === '/chat') {
        return jsonResponse(await handleChat(payload, env));
      }

      if (url.pathname === '/write-draft') {
        return jsonResponse(await handleWriteDraft(payload, env));
      }

      if (url.pathname === '/revise-essay') {
        return jsonResponse(await handleReviseEssay(payload, env));
      }

      return jsonResponse({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error('Worker request failed', { message: error.message });
      return jsonResponse({ error: 'Request failed.' }, 400);
    }
  },
};
