import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { tokens as t } from '../theme/tokens';
import { supabase } from '../services/supabaseClient';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  webClientId: googleWebClientId,
  offlineAccess: false,
});

function mapSessionToUser(session) {
  const email = session.user.email ?? '';
  return {
    id: session.user.id,
    name: email ? email.split('@')[0] : '사용자',
    major: '',
    email,
    experiences: [],
  };
}

export default function AuthScreen({ onSignIn }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    if (!googleWebClientId) {
      setError('Google Web Client ID가 설정되지 않았습니다.');
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const userInfo = await GoogleSignin.signIn();
      const { idToken, accessToken } = await GoogleSignin.getTokens();

      if (!idToken || !accessToken) {
        throw new Error('Google token missing.');
      }

      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        access_token: accessToken,
      });

      if (signInError || !data?.session) {
        throw signInError ?? new Error('Supabase session missing.');
      }

      const session = data.session;
      const googleEmail = userInfo?.user?.email;
      onSignIn(mapSessionToUser({
        ...session,
        user: {
          ...session.user,
          email: session.user.email ?? googleEmail,
        },
      }));
    } catch (err) {
      if (err?.code !== statusCodes.SIGN_IN_CANCELLED) {
        setError('Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.inner}>
        <View style={s.top}>
          <Text style={s.logo}>
            Re<Text style={{ color: t.primary }}>De</Text>Write
          </Text>
          <Text style={s.headline}>경험을 가장 잘 보여주는 자소서</Text>
          <Text style={s.sub}>
            Read · Debate · Write 3단계로 인재상에 맞는 초안을 만듭니다.
          </Text>

          <View style={s.card}>
            {[
              { p: 'R', label: 'Read', sub: '인재상과 경험 매칭 분석' },
              { p: 'D', label: 'Debate', sub: 'AI 토론으로 Best Fit 추출' },
              { p: 'W', label: 'Write', sub: '근거 기반 자소서 초안 생성' },
            ].map((item, i, arr) => (
              <View key={item.p} style={[s.rdwRow, i < arr.length - 1 && s.rdwBorder]}>
                <View style={s.rdwBadge}>
                  <Text style={s.rdwBadgeText}>{item.p}</Text>
                </View>
                <View>
                  <Text style={s.rdwLabel}>{item.label}</Text>
                  <Text style={s.rdwSub}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={s.bottom}>
          <TouchableOpacity
            style={[s.googleBtn, googleLoading && s.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color={t.ink} />
            ) : (
              <Text style={s.googleBtnText}>Google로 계속하기</Text>
            )}
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <Text style={s.terms}>
            계속 진행하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
          </Text>
          <Text style={s.powered}>Powered by Supabase Auth</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  top: { flex: 1, justifyContent: 'center' },
  logo: { fontSize: 26, fontWeight: '700', color: t.ink, marginBottom: 32 },
  headline: { fontSize: 30, fontWeight: '700', color: t.ink, lineHeight: 38, marginBottom: 12 },
  sub: { fontSize: 14, color: t.muted, lineHeight: 22, marginBottom: 32 },
  card: { backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 18 },
  rdwRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rdwBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  rdwBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rdwBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rdwLabel: { fontSize: 13, fontWeight: '700', color: t.ink },
  rdwSub: { fontSize: 11, color: t.muted, marginTop: 2 },
  bottom: { gap: 8 },
  googleBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: t.ink },
  btnDisabled: { opacity: 0.5 },
  errorText: { fontSize: 12, color: t.danger, textAlign: 'center' },
  terms: { fontSize: 11, color: t.faint, textAlign: 'center', lineHeight: 17 },
  powered: { fontSize: 10, color: t.faint, textAlign: 'center' },
});
