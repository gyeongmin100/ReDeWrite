import { supabase } from './supabaseClient';
import { normalizeResearchReport } from './researchReportUtils.mjs';

const AI_WORKER_URL = process.env.EXPO_PUBLIC_AI_WORKER_URL;

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
    throw new Error('AI Worker가 설정되지 않았습니다.');
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
  const data = await callWorker('/parse-intent', { userInput });
  return { company: data.company, role: data.role };
}

export async function collectCompanyInfo(company, role) {
  const data = await callWorker('/collect-company-info', { company, role });
  return normalizeResearchReport({
    company,
    role,
    ...data,
  });
}

export async function runResearch(userInput) {
  const { company, role } = await parseIntent(userInput);
  const report = await collectCompanyInfo(company, role);
  return { company, role, ...report };
}

export async function chatWithAI(messages, researchReport, userExperiences) {
  const data = await callWorker('/chat', {
    messages,
    researchReport,
    userExperiences,
  });
  return data.message;
}
