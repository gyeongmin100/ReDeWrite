import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

export default function MyScreen({ user, onSignOut }) {
  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>MY</Text>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.name[0]}</Text>
          </View>
          <View>
            <Text style={s.name}>{user.name}</Text>
            <Text style={s.major}>{user.major}</Text>
            <Text style={s.email}>{user.email}</Text>
          </View>
        </View>

        {/* Experience library */}
        <Text style={s.sectionLabel}>내 경험 라이브러리</Text>
        <View style={s.expCard}>
          {user.experiences.map((e, i, arr) => (
            <View key={i} style={[s.expRow, i < arr.length - 1 && s.expBorder]}>
              <Text style={s.expNum}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={s.expText}>{e}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={t.ink} />
          <Text style={s.addBtnText}>경험 추가</Text>
        </TouchableOpacity>

        {/* Settings */}
        <View style={s.menuCard}>
          {[
            { icon: 'settings-outline', label: '설정' },
            { icon: 'notifications-outline', label: '알림 관리' },
          ].map((item, i, arr) => (
            <TouchableOpacity key={i} style={[s.menuRow, i < arr.length - 1 && s.menuBorder]} activeOpacity={0.7}>
              <Ionicons name={item.icon} size={18} color={t.muted} />
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={t.faint} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={t.danger} />
          <Text style={s.signOutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerLogo}>Re<Text style={{ color: t.primary }}>De</Text>Write</Text>
          <Text style={s.footerSub}>v2.0 · 인재상 기반 자소서 코파일럿</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 18, marginBottom: 22 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  name: { fontSize: 17, fontWeight: '700', color: t.ink },
  major: { fontSize: 12, color: t.muted, marginTop: 2 },
  email: { fontSize: 11, color: t.faint, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: t.muted, letterSpacing: 0.8, marginBottom: 10 },
  expCard: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 12, overflow: 'hidden' },
  expRow: { flexDirection: 'row', gap: 10, padding: 14 },
  expBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  expNum: { fontSize: 11, color: t.faint, marginTop: 1, minWidth: 20 },
  expText: { flex: 1, fontSize: 12, color: t.inkSoft, lineHeight: 20 },
  addBtn: {
    height: 44, borderRadius: 14, backgroundColor: t.surface,
    borderWidth: 1, borderColor: t.borderStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 22,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: t.ink },
  menuCard: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 4, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  menuLabel: { flex: 1, fontSize: 13, color: t.ink, fontWeight: '500' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  signOutText: { fontSize: 13, color: t.danger, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 16 },
  footerLogo: { fontSize: 13, fontWeight: '700', color: t.ink },
  footerSub: { fontSize: 11, color: t.faint, marginTop: 4 },
});
