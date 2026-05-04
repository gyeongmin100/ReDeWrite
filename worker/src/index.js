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
      url: isHttpUrl(item?.url) ? item.url.trim() : '',
      source: asText(item?.source),
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
    sources: normalizeSources(parsed.sources?.length ? parsed.sources : fallbackSources),
  };
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
    include: ['web_search_call.action.sources'],
    instructions: `당신은 한국 취업 시장과 기업 분석에 강한 리서치 컨설턴트입니다.
반드시 최신 웹 검색 결과를 근거로 ${today} 기준 리서치를 작성하세요.
추측과 일반론을 줄이고, 지원자가 자기소개서와 면접 준비에 바로 쓸 수 있는 분석을 제공하세요.
반환은 JSON 하나만 허용합니다. 뉴스에는 실제 기사 또는 출처 페이지 URL을 포함하세요.`,
    input: `${company}의 ${role} 직무 지원자를 위한 전문 기업 리서치를 작성하세요.
포함할 내용:
- 기업/사업 방향 요약
- 인재상 키워드와 직무 핵심역량
- 최근 12개월 중심 뉴스 3~5건. 각 뉴스는 title, summary, date, source, url 포함
- 사업/시장 인사이트
- ${role} 직무와 연결되는 지원 전략
- 채용에서 강조할 신호
- 지원자가 조심해야 할 리스크
- 조직문화 키워드
- 사용한 주요 출처`,
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
            'sources',
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
                required: ['title', 'summary', 'date', 'source', 'url'],
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  date: { type: 'string' },
                  source: { type: 'string' },
                  url: { type: 'string' },
                },
              },
            },
            culture: { type: 'array', items: { type: 'string' } },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'url'],
                properties: {
                  title: { type: 'string' },
                  url: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, env);

  const fallbackSources = getResponseSources(data);
  const parsed = parseJsonText(getResponseText(data));
  return normalizeResearchReport(parsed, company, role, fallbackSources);
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

  const systemPrompt = `당신은 취업 자기소개서 전문 컨설턴트입니다.
기업 리서치 정보와 지원자 경험을 바탕으로 자기소개서 소재와 방향을 조언하세요.

[기업 정보]
기업: ${String(researchReport.company || '미상').slice(0, 80)}
직무: ${String(researchReport.role || '미상').slice(0, 80)}
인재상: ${(researchReport.traits || []).join(', ').slice(0, 500)}
JD 핵심 역량: ${(researchReport.jdKeywords || []).join(', ').slice(0, 500)}
조직문화: ${(researchReport.culture || []).join(', ').slice(0, 500)}

[지원자 경험]
${userExperiences.map((item, index) => `${index + 1}. ${item}`).join('\n')}

답변은 실용적으로 400자 이내로 작성하세요. 사용자의 경험이 있다면 해당 경험을 직접 인용하며 구체적으로 조언하세요. 경험이 없으면 MY 탭에서 경험을 추가하도록 안내하세요.`;

  const data = await callOpenAI('/chat/completions', {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  }, env);

  return { message: data.choices?.[0]?.message?.content || '' };
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

      return jsonResponse({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error('Worker request failed', { message: error.message });
      return jsonResponse({ error: 'Request failed.' }, 400);
    }
  },
};
