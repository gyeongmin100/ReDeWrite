const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// API Key 없을 때 fallback mock 데이터
const MOCK_REPORT = {
  company: '삼성전자',
  role: 'SW개발자',
  traits: ['도전', '창의', '협력', '전문성'],
  jdKeywords: ['Java', 'Spring', 'MSA', '팀워크'],
  news: [
    { title: '삼성전자, 2025 하반기 대졸 공채 시작', summary: '삼성전자가 하반기 대졸 신입 공채를 시작했습니다.', date: '2025.05.01' },
    { title: '삼성전자 DS부문 반도체 투자 확대', summary: '삼성전자가 반도체 설비 투자를 대폭 늘린다고 발표했습니다.', date: '2025.04.28' },
    { title: '삼성전자 글로벌 AI 경쟁력 강화', summary: '삼성전자가 AI 기반 제품 라인업을 확장한다고 밝혔습니다.', date: '2025.04.20' },
  ],
  culture: ['성과중심', '수평적 소통', '글로벌', '빠른 의사결정'],
};

function buildMockReport(company, role) {
  return { ...MOCK_REPORT, company, role };
}

// Step 1: 자유입력에서 회사명/직무 파싱
export async function parseIntent(userInput) {
  if (!OPENAI_API_KEY) {
    // mock fallback: 입력 텍스트에서 단순 추출 시도
    return { company: '삼성전자', role: 'SW개발자' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '사용자 입력에서 회사명과 직무를 추출해 JSON으로 반환하세요. 반드시 { "company": string, "role": string } 형식만 반환. 직무가 불명확하면 일반적인 직무명으로 유추하세요.',
        },
        { role: 'user', content: userInput },
      ],
    }),
  });

  if (!res.ok) throw new Error(`parseIntent API error: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return { company: parsed.company, role: parsed.role };
}

// Step 2: 기업정보 수집 (web_search_preview 포함)
export async function collectCompanyInfo(company, role) {
  if (!OPENAI_API_KEY) {
    return buildMockReport(company, role);
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `${company} ${role} 관련 인재상, JD 핵심역량, 최근 뉴스 3건, 조직문화를 조사해서 다음 JSON 형식으로 반환하세요:
{
  "traits": ["인재상 키워드1", "인재상 키워드2", ...],
  "jdKeywords": ["JD 역량1", "JD 역량2", ...],
  "news": [
    {"title": "뉴스 제목", "summary": "한 줄 요약", "date": "YYYY.MM.DD"},
    ...
  ],
  "culture": ["조직문화1", "조직문화2", ...]
}
반드시 JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON.`,
    }),
  });

  if (!res.ok) {
    console.warn('collectCompanyInfo API error:', res.status, '— using mock data');
    return buildMockReport(company, role);
  }

  const data = await res.json();
  // Responses API 응답 구조: data.output 배열에서 message 타입 찾기
  const messageOutput = data.output?.find(o => o.type === 'message');
  const rawText = messageOutput?.content?.[0]?.text ?? '';

  try {
    // JSON 코드블록이 있으면 제거
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      company,
      role,
      traits: parsed.traits ?? [],
      jdKeywords: parsed.jdKeywords ?? [],
      news: parsed.news ?? [],
      culture: parsed.culture ?? [],
    };
  } catch {
    console.warn('collectCompanyInfo JSON parse error — using mock data');
    return buildMockReport(company, role);
  }
}

// 통합 함수
export async function runResearch(userInput) {
  const { company, role } = await parseIntent(userInput);
  const report = await collectCompanyInfo(company, role);
  return { company, role, ...report };
}

// Debate AI 응답
export async function chatWithAI(messages, researchReport, userExperiences) {
  if (!OPENAI_API_KEY) {
    // fallback mock 응답
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    return `"${lastUserMsg}"에 대한 분석입니다.\n\n${researchReport?.company ?? '해당 기업'}의 인재상(${(researchReport?.traits ?? []).slice(0, 2).join(', ')})을 기준으로, 귀하의 경험 중 "${(userExperiences ?? [])[0]?.slice(0, 30) ?? '첫 번째 경험'}..."이 가장 적합한 소재입니다. 구체적인 수치와 과정을 중심으로 작성하면 효과적입니다.`;
  }

  const systemPrompt = `당신은 취업 자소서 전문 컨설턴트입니다.
아래 기업 리서치 정보와 지원자 경험을 바탕으로 자소서 작성을 도와주세요.

[기업 정보]
기업: ${researchReport?.company ?? '미상'}
직무: ${researchReport?.role ?? '미상'}
인재상: ${(researchReport?.traits ?? []).join(', ')}
JD 핵심역량: ${(researchReport?.jdKeywords ?? []).join(', ')}
조직문화: ${(researchReport?.culture ?? []).join(', ')}

[지원자 경험]
${(userExperiences ?? []).map((e, i) => `${i + 1}. ${e}`).join('\n')}

답변은 간결하고 실용적으로, 200자 이내로 해주세요. 구체적인 소재 추천이나 문장 예시를 제공하면 더 좋습니다.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) throw new Error(`chatWithAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
