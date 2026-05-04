import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

export default function HomeScreen({ navigation, user, researches }) {
  const featured = researches[0];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>Re<Text style={{ color: t.primary }}>De</Text>Write</Text>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={t.muted} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={s.greeting}>
          <View>
            <Text style={s.greetSub}>안녕하세요</Text>
            <Text style={s.greetName}>{user.name}님 👋</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.name[0]}</Text>
          </View>
        </View>

        {/* Search bar */}
        <TouchableOpacity style={s.searchBar} onPress={() => navigation.getParent()?.navigate('ResearchTab', { screen: 'Search' })} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={17} color={t.faint} />
          <Text style={s.searchText}>기업명을 검색해보세요</Text>
        </TouchableOpacity>

        {/* Section label */}
        <Text style={s.sectionLabel}>진행 중인 리서치</Text>

        {/* Featured card */}
        {featured && (
          <TouchableOpacity
            style={s.featuredCard}
            onPress={() => navigation.getParent()?.navigate('ResearchTab', {
              screen: 'Research',
              params: { companyId: featured.companyId },
            })}
            activeOpacity={0.85}
          >
            <Text style={s.featuredMeta}>◎ {featured.completedSteps}/6단계 진행 중</Text>
            <Text style={s.featuredName}>{featured.name}</Text>
            <Text style={s.featuredRole}>{featured.role}</Text>
            <View style={s.progressRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View
                  key={i}
                  style={[s.progressDot, { backgroundColor: i < featured.completedSteps ? '#fff' : 'rgba(255,255,255,0.25)' }]}
                />
              ))}
            </View>
          </TouchableOpacity>
        )}

        {/* R/D/W shortcuts */}
        <View style={s.rdwRow}>
          {(() => {
            const stages = [
              { p: 'R', label: 'Read', sub: '기업 리포트', screen: 'Read', status: featured?.pipeline[0] },
              { p: 'D', label: 'Debate', sub: 'AI 분석', screen: 'Debate', status: featured?.pipeline[1] },
              { p: 'W', label: 'Write', sub: '자소서 초안', screen: 'Write', status: featured?.pipeline[2] },
            ];
            return stages.map(item => {
              const done = item.status === 'done';
              const active = item.status === 'active';
              const locked = item.status === 'pending' || !featured;
              return (
                <TouchableOpacity
                  key={item.p}
                  style={[s.rdwCard, locked && { opacity: 0.4 }]}
                  onPress={() => !locked && navigation.getParent()?.navigate('ResearchTab', {
                    screen: item.screen,
                    params: { companyId: featured.companyId },
                  })}
                  activeOpacity={locked ? 1 : 0.75}
                  disabled={locked}
                >
                  <View style={[s.rdwBadge, done && { backgroundColor: t.surfaceAlt }, active && { backgroundColor: t.primary }]}>
                    {done
                      ? <Ionicons name="checkmark" size={18} color={t.muted} />
                      : <Text style={[s.rdwBadgeText, done && { color: t.muted }]}>{item.p}</Text>
                    }
                  </View>
                  <Text style={s.rdwLabel}>{item.label}</Text>
                  <Text style={s.rdwSub}>{item.sub}</Text>
                </TouchableOpacity>
              );
            });
          })()}
        </View>

        {/* Recent activity */}
        <View style={s.activityHeader}>
          <Text style={s.sectionLabel}>최근 활동</Text>
          <Text style={s.more}>더보기</Text>
        </View>
        <View style={s.activityCard}>
          {[
            { label: '삼성전자 인재상 분석 완료', time: '1시간 전' },
            { label: '자소서 소재 분석 (3차 추정)', time: '어제' },
            { label: '편의점 야간 경험 → Best Fit 추가', time: '2일 전' },
          ].map((item, i, arr) => (
            <View key={i} style={[s.activityRow, i < arr.length - 1 && s.activityBorder]}>
              <View style={s.dot} />
              <Text style={s.activityLabel}>{item.label}</Text>
              <Text style={s.activityTime}>{item.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginBottom: 22 },
  logo: { fontSize: 19, fontWeight: '700', color: t.ink, letterSpacing: -0.4 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  greeting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greetSub: { fontSize: 12, color: t.muted, marginBottom: 4 },
  greetName: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: t.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border,
    marginBottom: 22,
  },
  searchText: { fontSize: 13, color: t.faint },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: t.muted, letterSpacing: 0.8, marginBottom: 10 },
  featuredCard: {
    backgroundColor: t.primary, borderRadius: 18, padding: 18, marginBottom: 12,
  },
  featuredMeta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 8 },
  featuredName: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5, lineHeight: 28, marginBottom: 6 },
  featuredRole: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  rdwRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  rdwCard: {
    flex: 1, backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border,
    padding: 14, alignItems: 'center', gap: 8,
  },
  rdwBadge: { width: 38, height: 38, borderRadius: 11, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  rdwBadgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rdwLabel: { fontSize: 12, fontWeight: '700', color: t.ink },
  rdwSub: { fontSize: 10, color: t.muted },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  more: { fontSize: 11, color: t.faint },
  activityCard: { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.primary },
  activityLabel: { flex: 1, fontSize: 13, color: t.ink, fontWeight: '500' },
  activityTime: { fontSize: 11, color: t.faint },
});
