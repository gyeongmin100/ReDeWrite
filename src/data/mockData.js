export const mockUser = {
  name: '공석훈',
  major: '특성화고 전자과 / 산업기능요원',
  email: 'kshun@redewrite.app',
  experiences: [
    '재학 중 PCB 조립 프로젝트 — 1mm 미세 오차를 잡기 위해 측정·납땜·검사 4단계 작업 표준을 만들고 팀 4명을 리드. 불량률 6%→1.2%.',
    'NCS 자동차정비 자격증 취득 과정에서 현장 실습 240시간. 정비 매뉴얼을 디지털화해 같은 반 후배 12명이 활용함.',
    '동아리 부장 2년. 신입 회원 모집·운영비 관리·주1회 활동 기록을 엑셀로 정리. 2년 연속 우수 동아리 선정.',
    '편의점 야간 알바 8개월. 발주 누락이 잦은 점포에서 카테고리별 체크리스트를 만들어 누락률을 절반으로 줄임.',
  ],
};

export const mockCompanies = [
  {
    id: 'samsung-prod',
    name: '삼성전자 생산직',
    short: '삼성전자',
    logo: 'S',
    color: '#1428A0',
    textColor: '#fff',
    role: '스마트팩토리경영부 · 특성화고 · 반도체 공정',
    deadline: 'D-9',
    traits: ['정밀성·꼼꼼함', '협업 분석 능력', '문제 해결 의지', '학습 의지'],
    jd: '반도체 생산 라인의 안정적 운영과 품질 관리를 담당합니다.',
    questions: [
      { id: 'q1', text: '지원 동기 및 입사 후 포부를 작성해 주세요. (최대 800자)' },
      { id: 'q2', text: '본인의 강점과 그것이 직무에 어떻게 기여할 수 있는지 서술해 주세요. (최대 600자)' },
    ],
  },
  {
    id: 'sk-hynix',
    name: 'SK하이닉스 Maintenance',
    short: 'SK하이닉스',
    logo: 'SK',
    color: '#FF7A00',
    textColor: '#fff',
    role: '설비유지보수 · 청주캠퍼스',
    deadline: 'D-21',
    traits: ['책임감', '기술 학습', '안전 의식', '팀워크'],
    jd: '반도체 제조 설비의 예지보전 및 즉시 조치를 담당합니다.',
    questions: [
      { id: 'q1', text: '설비 관련 경험과 본인의 강점을 작성해 주세요. (최대 600자)' },
    ],
  },
];

export const initialResearches = [
  {
    companyId: 'samsung-prod',
    name: '삼성전자 생산직',
    role: '스마트팩토리경영부 · 특성화고 · 반도체 공정',
    pipeline: ['done', 'active', 'pending'],
    completedSteps: 3,
    researchReport: null,
    readResult: {
      overall: 80,
      traits: [
        { name: '정밀성·꼼꼼함', score: 94, experienceIdx: 0, evidence: 'PCB 4단계 표준 / 불량률 6→1.2%' },
        { name: '협업 분석 능력', score: 88, experienceIdx: 1, evidence: 'NCS 매뉴얼 디지털화·후배 12명 활용' },
        { name: '문제 해결 의지', score: 76, experienceIdx: 3, evidence: '편의점 누락률 50% 감소' },
        { name: '학습 의지', score: 62, experienceIdx: 0, evidence: '기록은 있으나 정량 데이터 부족' },
      ],
    },
    bestFit: null,
    essay: null,
  },
];
