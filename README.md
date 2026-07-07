# ReDeWrite

> 취준생을 위한 AI 기반 취업 준비 정보 통합 앱

중앙대학교 경영학부 **경영전략** 수업 프로젝트 과제로 제작한 앱입니다.

## 🎬 시연 영상

https://github.com/user-attachments/assets/f93df9a1-ce24-4c72-81a0-0023ce78b756



## 서비스 정의

분산된 채용 정보 탐색과 자소서·면접 준비 과정을 하나의 앱에서 AI와 함께 처리하는 서비스입니다.

핵심 컨셉: **Read(읽기) + Debate(토론) + Write(쓰기)**

## 제공 기능

| 단계 | 기능 | 설명 |
|---|---|---|
| 1 | **스펙 입력** | 사용자의 스펙(경험·경력·자격 등) 입력 기능 지원 |
| 2 | **기업/직무 선택** | 자신이 원하는 기업과 직무를 선택 |
| 3 | **AI 리서치** | Research Agent가 해당 기업과 직무에 대한 요약 리서치 정보 제공 |
| 4 | **AI 토론** | 리서치와 사용자 스펙을 바탕으로 Debate Agent와 토론 |
| 5 | **AI 자소서 작성** | 리서치와 토론 내용을 바탕으로 Write Agent가 자소서 작성 지원 |

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
