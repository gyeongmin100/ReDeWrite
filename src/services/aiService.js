import { supabase } from './supabaseClient';
import { normalizeResearchReport } from './researchReportUtils.js';

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

const WORKER_REQUEST_TIMEOUT_MS = 120000;

async function callWorker(path, payload) {
  const url = getWorkerUrl(path);
  if (!url) {
    throw new Error('AI Worker가 설정되지 않았습니다.');
  }

  const startedAt = Date.now();
  const payloadSize = JSON.stringify(payload || {}).length;
  const accessToken = await getAccessToken();
  const authDurationMs = Date.now() - startedAt;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WORKER_REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    console.warn('AI worker request exception:', {
      path,
      durationMs: Date.now() - startedAt,
      authDurationMs,
      payloadSize,
      errorName: error?.name,
      errorMessage: error?.message,
    });
    if (error?.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  console.info('AI worker request timing:', {
    path,
    status: res.status,
    durationMs: Date.now() - startedAt,
    authDurationMs,
    payloadSize,
    responseSize: JSON.stringify(data || {}).length,
  });

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



export async function chatWithAI(messages, researchReport, userExperiences) {
  const data = await callWorker('/chat', {
    messages,
    researchReport,
    userExperiences,
  });
  return data.message;
}

export async function generateEssayDraft({
  questionText,
  targetLength,
  researchReport,
  debateMessages,
  userExperiences,
}) {
  return callWorker('/write-draft', {
    questionText,
    targetLength,
    researchReport,
    debateMessages,
    userExperiences,
  });
}

export async function generateEssayDrafts({
  questions,
  researchReport,
  debateMessages,
  userExperiences,
}) {
  return callWorker('/write-drafts', {
    questions,
    researchReport,
    debateMessages,
    userExperiences,
  });
}

export async function reviseEssayDraft({
  questionText,
  targetLength,
  currentDraft,
  revisionRequest,
  researchReport,
  debateMessages,
  userExperiences,
}) {
  return callWorker('/revise-essay', {
    questionText,
    targetLength,
    currentDraft,
    revisionRequest,
    researchReport,
    debateMessages,
    userExperiences,
  });
}
