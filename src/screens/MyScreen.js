import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

export default function MyScreen({ user, onSignOut }) {
  const confirmSignOut = () => {
    Alert.alert('로그아웃', '현재 계정에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: onSignOut },
    ]);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>MY</Text>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.name?.[0] ?? '?'}</Text>
          </View>
          <View>
            <Text style={s.name}>{user.name}</Text>
            <Text style={s.major}>{user.major}</Text>
            <Text style={s.email}>{user.email}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={confirmSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={t.danger} />
          <Text style={s.signOutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerLogo}>Re<Text style={{ color: t.primary }}>De</Text>Write</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 22 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: t.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.border,
    padding: 18,
    marginBottom: 28,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: t.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  name: { fontSize: 17, fontWeight: '700', color: t.ink },
  major: { fontSize: 12, color: t.muted, marginTop: 2 },
  email: { fontSize: 11, color: t.faint, marginTop: 2 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  signOutText: { fontSize: 13, color: t.danger, fontWeight: '600' },

  footer: { alignItems: 'center', marginTop: 16 },
  footerLogo: { fontSize: 13, fontWeight: '700', color: t.ink },
});
