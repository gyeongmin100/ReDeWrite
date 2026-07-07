import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    name: meta.full_name || meta.name || (email ? email.split('@')[0] : '사용자'),
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
        <Text style={s.logo}>
          Re<Text style={{ color: t.primary }}>De</Text>Write
        </Text>
        <Text style={s.headline}>시작하려는 당신의{'\n'}리서치 파트너</Text>
        <TouchableOpacity
          style={[s.googleBtn, googleLoading && s.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.8}
        >
          {googleLoading ? (
            <ActivityIndicator color={t.ink} />
          ) : (
            <View style={s.googleBtnInner}>
              <Image
                source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                style={s.googleLogo}
              />
              <Text style={s.googleBtnText}>Google로 로그인</Text>
            </View>
          )}
        </TouchableOpacity>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 24,
  },
  logo: { fontSize: 40, fontWeight: '700', color: t.ink },
  headline: { fontSize: 18, fontWeight: '500', color: t.muted, lineHeight: 26 },
  googleBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleLogo: { width: 20, height: 20 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: t.ink },
  btnDisabled: { opacity: 0.5 },
  errorText: { fontSize: 12, color: t.danger, textAlign: 'center' },

});
