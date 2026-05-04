import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canUseResearchUpdate,
  countMonthlyResearchUpdates,
  appendResearchUpdateHistory,
  getResearchUpdateUsageLabel,
} from '../src/services/researchUpdateQuota.mjs';

test('countMonthlyResearchUpdates counts current month updates across all researches', () => {
  const researches = [
    { researchReport: { updateHistory: ['2026-05-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z'] } },
    { researchReport: { updateHistory: ['2026-05-03T00:00:00.000Z'] } },
    { researchReport: null },
  ];

  assert.equal(countMonthlyResearchUpdates(researches, new Date('2026-05-05T00:00:00.000Z')), 2);
});

test('canUseResearchUpdate allows less than ten current month updates only', () => {
  const makeResearch = (count) => ({
    researchReport: {
      updateHistory: Array.from({ length: count }, (_, index) => `2026-05-0${index + 1}T00:00:00.000Z`),
    },
  });

  assert.equal(canUseResearchUpdate([makeResearch(9)], new Date('2026-05-10T00:00:00.000Z')), true);
  assert.equal(canUseResearchUpdate([makeResearch(10)], new Date('2026-05-10T00:00:00.000Z')), false);
});

test('appendResearchUpdateHistory preserves report fields and appends timestamp', () => {
  const report = { company: '삼성전자', updateHistory: ['2026-05-01T00:00:00.000Z'] };

  assert.deepEqual(
    appendResearchUpdateHistory(report, '2026-05-05T12:00:00.000Z'),
    { company: '삼성전자', updateHistory: ['2026-05-01T00:00:00.000Z', '2026-05-05T12:00:00.000Z'] },
  );
});

test('getResearchUpdateUsageLabel formats remaining updates out of monthly limit', () => {
  const research = {
    researchReport: {
      updateHistory: [
        '2026-05-01T00:00:00.000Z',
        '2026-05-02T00:00:00.000Z',
      ],
    },
  };

  assert.equal(getResearchUpdateUsageLabel([research], new Date('2026-05-10T00:00:00.000Z')), '8/10');
});
