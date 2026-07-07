import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeResearchReport,
} from '../src/services/researchReportUtils.mjs';

test('normalizeResearchReport preserves professional sections and strips display links', () => {
  const report = normalizeResearchReport({
    company: '삼성전자',
    role: '마케팅',
    summary: '반도체와 AI 수요를 중심으로 사업 포트폴리오를 재정비하고 있다.',
    traits: ['고객 지향', '데이터 기반 사고'],
    jdKeywords: ['시장 분석', '캠페인 운영'],
    businessInsights: ['AI 반도체 수요 확대가 브랜드 메시지에 영향을 준다.'],
    roleFitAnalysis: ['마케팅 직무는 기술 이해와 고객 언어 변환 능력이 중요하다.'],
    hiringSignals: ['글로벌 협업 경험을 강조해야 한다.'],
    risks: ['메모리 업황 변동성을 고려해야 한다.'],
    news: [
      {
        title: '삼성전자, AI 반도체 투자 확대',
        summary: 'AI 반도체 경쟁력 강화를 위한 투자를 발표했다. 출처: kakaocrop.com https://example.com/news',
        date: '2026-05-01',
        url: 'https://example.com/news',
        source: 'Example News',
      },
    ],
    sources: [
      { title: '삼성전자 공식 뉴스룸', url: 'https://news.samsung.com' },
    ],
  });

  assert.equal(report.company, '삼성전자');
  assert.equal(report.role, '마케팅');
  assert.equal(report.businessInsights[0], 'AI 반도체 수요 확대가 브랜드 메시지에 영향을 준다.');
  assert.equal(report.roleFitAnalysis[0], '마케팅 직무는 기술 이해와 고객 언어 변환 능력이 중요하다.');
  assert.equal(report.hiringSignals[0], '글로벌 협업 경험을 강조해야 한다.');
  assert.equal(report.risks[0], '메모리 업황 변동성을 고려해야 한다.');
  assert.equal(report.news[0].summary.includes('https://'), false);
  assert.equal(report.news[0].summary.includes('kakaocrop.com'), false);
  assert.equal(report.news[0].summary.includes('출처'), false);
  assert.equal('url' in report.news[0], false);
  assert.equal('source' in report.news[0], false);
  assert.deepEqual(report.sources, []);
});

test('normalizeResearchReport converts markdown links to plain text before display', () => {
  const report = normalizeResearchReport({
    company: '카카오',
    role: '서비스기획',
    summary: '사업 재편 내용은 [카카오 IR](https://example.com/ir)을 참고하면 된다 ([](https://kakaocrop.com)).',
    traits: ['[사용자 중심](https://example.com/trait)', '[](https://kakaocrop.com)'],
    news: [
      {
        title: '[카카오, 서비스 개편](https://example.com/news)',
        summary: '신규 기능을 공개했다 ([](https://kakaocrop.com)).',
        date: '2026-05-01',
      },
    ],
  });

  assert.equal(report.summary, '사업 재편 내용은 카카오 IR을 참고하면 된다.');
  assert.deepEqual(report.traits, ['사용자 중심']);
  assert.equal(report.news[0].title, '카카오, 서비스 개편');
  assert.equal(report.news[0].summary, '신규 기능을 공개했다.');
});
