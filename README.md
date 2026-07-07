# ReDeWrite

> 취준생을 위한 AI 기반 취업 준비 정보 통합 앱

중앙대학교 경영학부 **경영전략** 수업 프로젝트 과제로 제작한 앱입니다.

## 🎬 시연 영상

**[▶ 시연 영상 보기 (docs/시연영상.mp4)](docs/시연영상.mp4)**

> 링크를 클릭하면 GitHub 내장 플레이어로 바로 재생됩니다.

## 서비스 정의

분산된 채용 정보 탐색과 자소서·면접 준비 과정을 하나의 앱에서 AI와 함께 처리하는 서비스입니다.

핵심 컨셉: **Read(읽기) + Debate(토론) + Write(쓰기)**

## 제공 기능 (6단계)

| 단계 | 기능 | 설명 |
|---|---|---|
| 1 | **자기이해** | 경험 입력 → AI가 역량 키워드 추출 → 역량 프로필 생성 |
| 2 | **직무/산업 탐색** | 직무 리서치 리포트 자동 생성 + 나의 역량과 비교 → 직무 비교표 |
| 3 | **기업 리서치** ⭐ | 기업 사업현황·재무·조직문화 자동 분석 → 내 강점과 매칭 → 지원 전략서 |
| 4 | **서류 준비** | 해당 기업 합격 자소서 패턴 분석 → AI와 소재 토론 → 맞춤 자소서 초안 자동 생성 |
| 5 | **면접 준비** | 기업별 기출 질문 수집 → AI 모의 면접(질문-답변-피드백) → 면접 스크립트 정리 |
| 6 | **의사결정** | 합격 기업들의 연봉/복지/문화 비교 → 의사결정 리포트 생성 |

⭐ = 핵심 기능

## 기술 스택

- **앱**: React Native (Expo 54), React Navigation
- **인증/DB**: Supabase (Google 로그인 지원)
- **AI 백엔드**: Vercel Serverless Functions (`worker/`) — OpenAI API 프록시
- **빌드/배포**: EAS Build, expo-updates (OTA 업데이트)

## 프로젝트 구조

```
ReDeWrite/
├── App.js                  # 앱 엔트리
├── src/
│   ├── navigation/         # 탭/스택 내비게이션
│   ├── screens/            # 홈·리서치·토론·자소서 작성 등 화면
│   ├── services/           # AI 호출, 자소서/토론/리서치 상태 로직
│   ├── constants/          # 리서치 단계 정의
│   └── theme/              # 디자인 토큰
├── worker/                 # AI 백엔드 (Vercel Functions)
├── tests/                  # node:test 기반 유닛 테스트
└── docs/                   # 시연 영상 등 문서 자료
```

## 실행 방법

```bash
npm install
cp .env.example .env   # Supabase / AI Worker 환경변수 입력
npm start              # Expo dev client 실행
```

테스트:

```bash
node --test tests/*.test.mjs
```
