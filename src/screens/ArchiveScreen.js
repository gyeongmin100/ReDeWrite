import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import { mockCompanies } from '../data/mockData';

export default function ArchiveScreen({ navigation, researches }) {
  const withEssay = researches.filter(r => r.essay);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>자소서함</Text>
        <Text style={s.sub}>저장된 초안 {withEssay.length}건</Text>

        {withEssay.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>✍︎</Text>
            <Text style={s.emptyTitle}>아직 저장된 자소서가 없어요</Text>
            <Text style={s.emptySub}>리서치를 진행하면 여기에 모입니다</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {withEssay.map(r => {
              const c = mockCompanies.find(c => c.id === r.companyId);
              const company = c ?? {
                name: r.name,
                color: t.primaryLight,
                textColor: t.primary,
                logo: r.name?.charAt(0) ?? 'R',
              };
              return (
                <TouchableOpacity
                  key={r.companyId}
                  style={s.card}
                  onPress={() => navigation.navigate('ResearchTab', { screen: 'Write', params: { companyId: r.companyId } })}
                  activeOpacity={0.75}
                >
                  <View style={s.cardHeader}>
                    <View style={[s.logo, { backgroundColor: company.color }]}>
                      <Text style={[s.logoText, { color: company.textColor }]}>{company.logo}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.companyName}>{company.name}</Text>
                      <Text style={s.essayMeta}>{r.essay.questionId} · {r.essay.draft.length}자</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={t.faint} />
                  </View>
                  <Text style={s.preview} numberOfLines={2}>{r.essay.draft}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 13, color: t.muted, marginBottom: 22 },
  emptyCard: {
    backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: t.borderStrong,
    padding: 40, alignItems: 'center',
  },
  emptyIcon: { fontSize: 30, marginBottom: 8 },
  emptyTitle: { fontSize: 13, fontWeight: '600', color: t.ink, marginBottom: 6 },
  emptySub: { fontSize: 12, color: t.muted },
  card: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  logo: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontWeight: '700', fontSize: 12 },
  companyName: { fontSize: 13, fontWeight: '700', color: t.ink },
  essayMeta: { fontSize: 11, color: t.muted },
  preview: { fontSize: 12, color: t.muted, lineHeight: 18 },
});
