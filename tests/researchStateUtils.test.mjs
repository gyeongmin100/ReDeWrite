import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCollectingResearchReportMarker,
  buildResearchInsertPayload,
  buildResearchPatchPayload,
  deriveInitialResearchFields,
  normalizeResearchRecord,
} from '../src/services/researchStateUtils.mjs';

test('deriveInitialResearchFields splits the first token as company before AI parsing completes', () => {
  assert.deepEqual(
    deriveInitialResearchFields('  네이버   서비스기획 인턴  '),
    { name: '네이버', role: '서비스기획 인턴' },
  );
  assert.deepEqual(
    deriveInitialResearchFields('카카오'),
    { name: '카카오', role: '' },
  );
});

test('normalizeResearchRecord fills missing DB defaults and marks empty reports retryable', () => {
  const normalized = normalizeResearchRecord({
    company_id: 'company-1',
    name: '테스트기업',
    role: null,
    pipeline: null,
    completed_steps: null,
    research_report: null,
  });

  assert.equal(normalized.companyId, 'company-1');
  assert.equal(normalized.name, '테스트기업');
  assert.equal(normalized.role, '');
  assert.deepEqual(normalized.pipeline, ['active', 'pending', 'pending']);
  assert.equal(normalized.completedSteps, 1);
  assert.equal(normalized.researchReport, null);
  assert.equal(normalized.status, 'failed');
  assert.match(normalized.errorMessage, /분석에 실패/);
});

test('normalizeResearchRecord restores pending research metadata for resume', () => {
  const normalized = normalizeResearchRecord({
    company_id: 'company-pending',
    name: 'Samsung DS planner',
    role: '',
    pipeline: ['active', 'pending', 'pending'],
    completed_steps: 1,
    research_report: {
      status: 'collecting',
      query: 'Samsung DS planner',
      requestedAt: '2026-05-11T00:00:00.000Z',
    },
  });

  assert.equal(normalized.status, 'collecting');
  assert.equal(normalized.query, 'Samsung DS planner');
  assert.equal(normalized.researchReport, null);
});

test('normalizeResearchRecord preserves ready reports', () => {
  const normalized = normalizeResearchRecord({
    company_id: 'company-2',
    name: '완료기업',
    role: '전략기획',
    pipeline: ['done', 'done', 'done'],
    completed_steps: 3,
    research_report: '최근 리포트',
  });

  assert.equal(normalized.status, 'ready');
  assert.equal(normalized.errorMessage, null);
  assert.equal(normalized.researchReport, '최근 리포트');
});

test('buildResearchInsertPayload stores pending research rows before worker completion', () => {
  const payload = buildResearchInsertPayload(
    {
      companyId: 'company-3',
      name: '진행기업',
      role: '',
      pipeline: ['active', 'pending', 'pending'],
      completedSteps: 1,
      researchReport: null,
      status: 'collecting',
      query: '吏꾪뻾湲곗뾽 PM',
      createdAt: '2026-05-11T00:00:00.000Z',
    },
    'user-1',
  );

  assert.deepEqual(payload, {
    user_id: 'user-1',
    company_id: 'company-3',
    name: '진행기업',
    role: '',
    pipeline: ['active', 'pending', 'pending'],
    completed_steps: 1,
    research_report: {
      status: 'collecting',
      query: '吏꾪뻾湲곗뾽 PM',
      requestedAt: '2026-05-11T00:00:00.000Z',
    },
  });
});

test('buildResearchPatchPayload maps app fields to DB columns and ignores UI-only fields', () => {
  const payload = buildResearchPatchPayload({
    name: '패치기업',
    role: 'PM',
    researchReport: '새 리포트',
    errorMessage: 'UI only',
    status: 'ready',
  });

  assert.deepEqual(payload, {
    name: '패치기업',
    role: 'PM',
    research_report: '새 리포트',
  });
});

test('buildCollectingResearchReportMarker keeps interrupted report generation retryable', () => {
  const marker = buildCollectingResearchReportMarker({
    query: 'Samsung DS planner',
    requestedAt: '2026-05-11T00:00:00.000Z',
    lastError: 'Network request failed',
  });

  assert.deepEqual(marker, {
    status: 'collecting',
    query: 'Samsung DS planner',
    requestedAt: '2026-05-11T00:00:00.000Z',
    lastError: 'Network request failed',
  });

  const normalized = normalizeResearchRecord({
    company_id: 'company-retry',
    name: 'Samsung',
    role: 'DS planner',
    pipeline: ['active', 'pending', 'pending'],
    completed_steps: 1,
    research_report: marker,
  });

  assert.equal(normalized.status, 'collecting');
  assert.equal(normalized.query, 'Samsung DS planner');
  assert.equal(normalized.researchReport, null);
});
