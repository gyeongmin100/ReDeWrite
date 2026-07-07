const UPDATED_AT = '2026-05-13';

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  return res.status(200).send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ReDeWrite 개인정보처리방침</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --surface: #ffffff;
      --ink: #17191f;
      --muted: #5f6673;
      --line: #dfe3ea;
      --accent: #2251cc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }
    main {
      width: min(920px, calc(100% - 32px));
      margin: 0 auto;
      padding: 48px 0 64px;
    }
    article {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 36px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.2;
      letter-spacing: 0;
    }
    h2 {
      margin: 32px 0 10px;
      font-size: 20px;
      line-height: 1.35;
      letter-spacing: 0;
    }
    p, li { color: var(--muted); }
    p { margin: 0 0 12px; }
    ul { margin: 0; padding-left: 22px; }
    a { color: var(--accent); }
    .meta {
      color: var(--muted);
      border-bottom: 1px solid var(--line);
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    @media (max-width: 640px) {
      main { width: min(100% - 24px, 920px); padding: 24px 0 40px; }
      article { padding: 24px 18px; }
    }
  </style>
</head>
<body>
  <main>
    <article>
      <h1>ReDeWrite 개인정보처리방침</h1>
      <p class="meta">시행일 및 최종 업데이트: ${UPDATED_AT}</p>

      <p>ReDeWrite는 사용자의 개인정보를 중요하게 생각하며, Google Play 정책과 관련 법령에 따라 개인정보를 안전하게 처리하기 위해 본 개인정보처리방침을 공개합니다.</p>

      <h2>1. 수집하는 개인정보</h2>
      <p>ReDeWrite는 앱 기능 제공을 위해 다음 정보를 수집하거나 처리할 수 있습니다.</p>
      <ul>
        <li>Google 로그인으로 제공되는 이메일 주소, 이름, 프로필 정보</li>
        <li>Supabase 인증을 위한 사용자 식별자 및 로그인 세션 정보</li>
        <li>사용자가 앱에서 작성하거나 저장한 글, 리서치, 토론, 자기소개서 관련 입력 데이터</li>
        <li>앱 오류 확인 및 서비스 안정화를 위한 기본 요청 정보</li>
      </ul>

      <h2>2. 개인정보 이용 목적</h2>
      <p>수집된 정보는 다음 목적에만 사용됩니다.</p>
      <ul>
        <li>회원 로그인 및 사용자 식별</li>
        <li>사용자별 작성 내용 저장, 조회, 편집 기능 제공</li>
        <li>리서치, 토론, 글쓰기 보조 등 앱의 핵심 기능 제공</li>
        <li>서비스 오류 분석, 보안 유지, 악용 방지</li>
      </ul>

      <h2>3. 제3자 서비스 및 처리 위탁</h2>
      <p>ReDeWrite는 서비스 제공을 위해 다음 외부 서비스를 사용할 수 있습니다.</p>
      <ul>
        <li>Google: Google 로그인 및 사용자 인증</li>
        <li>Supabase: 사용자 인증, 세션 관리, 데이터 저장</li>
        <li>Vercel: 서버 API 호스팅 및 요청 처리</li>
        <li>AI API 제공자: 사용자가 요청한 글쓰기, 분석, 리서치 보조 기능 처리</li>
      </ul>
      <p>외부 서비스에는 앱 기능 수행에 필요한 범위의 데이터만 전달됩니다.</p>

      <h2>4. 개인정보 보관 및 삭제</h2>
      <p>사용자 데이터는 앱 기능 제공에 필요한 기간 동안 보관됩니다. 사용자가 계정 또는 데이터 삭제를 요청하는 경우, 법령상 보관이 필요한 경우를 제외하고 관련 데이터를 삭제합니다.</p>

      <h2>5. 보안</h2>
      <p>ReDeWrite는 인증 세션 저장, 접근 권한 관리, 서버 환경변수 관리 등 합리적인 보안 조치를 통해 사용자 정보를 보호합니다. 다만 인터넷 기반 서비스 특성상 절대적인 보안을 보장할 수는 없습니다.</p>

      <h2>6. 아동 개인정보</h2>
      <p>ReDeWrite는 아동을 주 대상으로 제공되는 앱이 아닙니다. 아동 개인정보가 부적절하게 수집된 사실을 확인하면 합리적인 범위에서 삭제 조치를 진행합니다.</p>

      <h2>7. 문의 및 삭제 요청</h2>
      <p>개인정보 관련 문의, 데이터 열람, 정정, 삭제 요청은 아래 이메일로 연락해 주세요.</p>
      <p><a href="mailto:im100km@naver.com">im100km@naver.com</a></p>

      <h2>8. 변경 사항</h2>
      <p>본 개인정보처리방침은 서비스 변경 또는 정책 변경에 따라 업데이트될 수 있습니다. 중요한 변경이 있는 경우 이 페이지를 통해 고지합니다.</p>
    </article>
  </main>
</body>
</html>`);
}
