import { supabase } from './supabaseClient';

const AI_WORKER_URL = process.env.EXPO_PUBLIC_AI_WORKER_URL;

const MOCK_REPORT = {
  company: '삼성전자',
  role: 'SW개발자',
  traits: ['도전', '창의', '협력', '전문성'],
  jdKeywords: ['Java', 'Spring', 'MSA', '대규모 서비스'],
  news: [
    {
      title: '삼성전자, 2025 하반기 대규모 공채 시작',
      summary: '삼성전자가 하반기 대규모 신입 공채를 시작했습니다.',
      date: '2025.05.01',
    },
    {
      title: '삼성전자 DS부문 반도체 투자 확대',
      summary: '삼성전자가 반도체 설비 투자를 확대한다고 발표했습니다.',
      date: '2025.04.28',
    },
    {
      title: '삼성전자 글로벌 AI 경쟁력 강화',
      summary: '삼성전자가 AI 기반 제품 라인업을 확장한다고 밝혔습니다.',
      date: '2025.04.20',
    },
  ],
  culture: ['성과중심', '수평적 소통', '글로벌', '빠른 의사결정'],
};

function buildMockReport(company, role) {
  return { ...MOCK_REPORT, company, role };
}

function getWorkerUrl(path) {
  if (!AI_WORKER_URL) return null;
  return `${AI_WORKER_URL.replace(/\/$/, '')}${path}`;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('로그인이 필요합니다.');
  }
  return data.session.access_token;
}

async function callWorker(path, payload) {
  const url = getWorkerUrl(path);
  if (!url) {
    throw new Error('AI Worker endpoint is not configured.');
  }

  const accessToken = await getAccessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `AI Worker error: ${res.status}`);
  }

  return data;
}

export async function parseIntent(userInput) {
  if (!AI_WORKER_URL) {
    return { company: '삼성전자', role: 'SW개발자' };
  }

  const data = await callWorker('/parse-intent', { userInput });
  return { company: data.company, role: data.role };
}

export async function collectCompanyInfo(company, role) {
  if (!AI_WORKER_URL) {
    return buildMockReport(company, role);
  }

  const data = await callWorker('/collect-company-info', { company, role });
  return {
    company,
    role,
    traits: data.traits ?? [],
    jdKeywords: data.jdKeywords ?? [],
    news: data.news ?? [],
    culture: data.culture ?? [],
  };
}

export async function runResearch(userInput) {
  const { company, role } = await parseIntent(userInput);
  const report = await collectCompanyInfo(company, role);
  return { company, role, ...report };
}

export async function chatWithAI(messages, researchReport, userExperiences) {
  if (!AI_WORKER_URL) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const company = researchReport?.company ?? '해당 기업';
    const traits = (researchReport?.traits ?? []).slice(0, 2).join(', ');
    const firstExperience = (userExperiences ?? [])[0]?.slice(0, 30) ?? '첫 번째 경험';

    return `"${lastUserMsg}"에 대한 분석입니다.\n\n${company}의 인재상(${traits})을 기준으로 보면, "${firstExperience}..." 경험이 가장 적합한 소재입니다. 구체적인 수치와 과정 중심으로 작성하면 더 설득력 있습니다.`;
  }

  const data = await callWorker('/chat', {
    messages,
    researchReport,
    userExperiences,
  });
  return data.message;
}
