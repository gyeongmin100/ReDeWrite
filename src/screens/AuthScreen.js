import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { tokens as t } from '../theme/tokens';
import { supabase } from '../services/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

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
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });

    setLoading(false);

    if (err) {
      setError('인증 코드 발송에 실패했습니다. 이메일을 확인해 주세요.');
      return;
    }

    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    });

    setLoading(false);

    if (err) {
      setError('코드가 올바르지 않습니다.');
      return;
    }

    if (data?.session) {
      onSignIn(mapSessionToUser(data.session));
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (signInError) {
      setGoogleLoading(false);
      setError('구글 로그인 시작에 실패했습니다.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== 'success') {
      setGoogleLoading(false);
      if (result.type !== 'cancel') {
        setError('구글 로그인이 완료되지 않았습니다.');
      }
      return;
    }

    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get('code');

    if (!code) {
      setGoogleLoading(false);
      setError('구글 로그인 응답을 확인할 수 없습니다.');
      return;
    }

    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    setGoogleLoading(false);

    if (exchangeError || !sessionData?.session) {
      setError('구글 로그인 세션 생성에 실패했습니다.');
      return;
    }

    onSignIn(mapSessionToUser(sessionData.session));
  };

  const isBusy = loading || googleLoading;

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
              style={[s.googleBtn, isBusy && s.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color={t.ink} />
              ) : (
                <Text style={s.googleBtnText}>Google로 계속하기</Text>
              )}
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.divider} />
              <Text style={s.dividerText}>또는 이메일로 로그인</Text>
              <View style={s.divider} />
            </View>

            {step === 'email' ? (
              <>
                <TextInput
                  style={s.input}
                  placeholder="이메일 주소"
                  placeholderTextColor={t.faint}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="send"
                  editable={!isBusy}
                  onSubmitEditing={handleSendOtp}
                />
                {error ? <Text style={s.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[s.primaryBtn, (!email.trim() || isBusy) && s.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={!email.trim() || isBusy}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>인증 코드 받기</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.otpHint}>이메일로 받은 6자리 코드를 입력하세요.</Text>
                <Text style={s.otpEmail}>{email}</Text>
                <TextInput
                  style={s.input}
                  placeholder="6자리 코드"
                  placeholderTextColor={t.faint}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  editable={!isBusy}
                  onSubmitEditing={handleVerifyOtp}
                  autoFocus
                />
                {error ? <Text style={s.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[s.primaryBtn, (!otp.trim() || isBusy) && s.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={!otp.trim() || isBusy}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>로그인</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setStep('email');
                    setError('');
                    setOtp('');
                  }}
                  disabled={isBusy}
                >
                  <Text style={s.backText}>이메일 다시 입력</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={s.terms}>
              계속 진행하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
            </Text>
            <Text style={s.powered}>Powered by Supabase Auth</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
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
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: 16,
    fontSize: 15,
    color: t.ink,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  divider: { flex: 1, height: 1, backgroundColor: t.border },
  dividerText: { fontSize: 11, color: t.faint },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  otpHint: { fontSize: 14, color: t.muted, textAlign: 'center' },
  otpEmail: { fontSize: 13, fontWeight: '600', color: t.ink, textAlign: 'center', marginBottom: 4 },
  errorText: { fontSize: 12, color: t.danger, textAlign: 'center' },
  backText: { fontSize: 13, color: t.primary, textAlign: 'center', paddingVertical: 4 },
  terms: { fontSize: 11, color: t.faint, textAlign: 'center', lineHeight: 17 },
  powered: { fontSize: 10, color: t.faint, textAlign: 'center' },
});
