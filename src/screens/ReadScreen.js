import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import { collectCompanyInfo } from '../services/aiService';
import { getNewsTargetUrl, normalizeResearchReport } from '../services/researchReportUtils.mjs';

function InsightList({ items }) {
  if (!items?.length) return null;

  return (
    <View style={s.insightList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={s.insightRow}>
          <Text style={s.insightBullet}>•</Text>
          <Text style={s.insightText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function InsightCard({ label, icon, items, tone = 'neutral' }) {
  if (!items?.length) return null;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Ionicons name={icon} size={15} color={tone === 'risk' ? t.warn : t.primary} />
        <Text style={s.cardLabelInline}>{label}</Text>
      </View>
      <InsightList items={items} />
    </View>
  );
}

export default function ReadScreen({ navigation, route, researches, updateResearch, user }) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rawReport = research?.researchReport ?? null;
  const companyName = research?.name ?? rawReport?.company ?? '기업';
  const role = research?.role ?? rawReport?.role ?? '';
  const report = rawReport ? normalizeResearchReport({ company: companyName, role, ...rawReport }) : null;

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await collectCompanyInfo(companyName, role);
      updateResearch(companyId, {
        researchReport: fetched,
        pipeline: ['active', 'pending', 'pending'],
      });
    } catch (err) {
      console.error('loadReport error:', err);
      setError('기업 정보를 불러오지 못했어요. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDebate = () => {
    updateResearch(companyId, {
      pipeline: ['done', 'active', 'pending'],
      completedSteps: Math.max(research?.completedSteps ?? 1, 2),
    });
    navigation.navigate('Debate', { companyId });
  };

  const openNewsUrl = async (newsItem) => {
    const url = getNewsTargetUrl(newsItem);
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('openNewsUrl error:', err);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.tag}>READ · 기업 리포트</Text>
        </View>

        <Text style={s.companyName}>{companyName}</Text>
        <Text style={s.role}>{role}</Text>

        {/* 리포트 없을 때 */}
        {!report && (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <Ionicons name="document-text-outline" size={28} color={t.faint} />
            </View>
            <Text style={s.emptyTitle}>기업 리포트가 없어요</Text>
            <Text style={s.emptyDesc}>AI가 인재상, JD 키워드, 최근 뉴스를 조사합니다</Text>

            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color={t.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={loadReport}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.primaryBtnText}>AI가 조사 중...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>AI로 기업 정보 불러오기</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 리포트 있을 때 */}
        {report && (
          <>
            {report.summary && (
              <View style={s.card}>
                <Text style={s.cardLabel}>리서치 요약</Text>
                <Text style={s.summaryText}>{report.summary}</Text>
              </View>
            )}

            {/* 인재상 */}
            {report.traits?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>인재상 키워드</Text>
                <View style={s.chips}>
                  {report.traits.map(tr => (
                    <View key={tr} style={s.chipPrimary}>
                      <Text style={s.chipPrimaryText}>{tr}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <InsightCard
              label="사업·시장 인사이트"
              icon="analytics-outline"
              items={report.businessInsights}
            />

            <InsightCard
              label="직무 연결 전략"
              icon="git-branch-outline"
              items={report.roleFitAnalysis}
            />

            <InsightCard
              label="채용 어필 신호"
              icon="radio-outline"
              items={report.hiringSignals}
            />

            <InsightCard
              label="주의 리스크"
              icon="warning-outline"
              items={report.risks}
              tone="risk"
            />

            {/* JD 핵심역량 */}
            {report.jdKeywords?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>JD 핵심역량</Text>
                <View style={s.chips}>
                  {report.jdKeywords.map(kw => (
                    <View key={kw} style={s.chipNeutral}>
                      <Text style={s.chipNeutralText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 최근 뉴스 */}
            {report.news?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>최근 뉴스</Text>
                <View style={{ gap: 10 }}>
                  {report.news.map((n, i) => (
                    <View key={i} style={[s.newsItem, i < report.news.length - 1 && s.newsItemBorder]}>
                      <View style={s.newsTop}>
                        {getNewsTargetUrl(n) ? (
                          <TouchableOpacity
                            style={s.newsTitleWrap}
                            onPress={() => openNewsUrl(n)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.newsTitleLink} numberOfLines={2}>{n.title}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={s.newsTitle} numberOfLines={2}>{n.title}</Text>
                        )}
                        <Text style={s.newsDate}>{n.date}</Text>
                      </View>
                      <Text style={s.newsSummary}>{n.summary}</Text>
                      {!!n.source && <Text style={s.newsSource}>{n.source}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 조직문화 */}
            {report.culture?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>조직문화</Text>
                <View style={s.chips}>
                  {report.culture.map(c => (
                    <View key={c} style={s.chipWarm}>
                      <Text style={s.chipWarmText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {report.sources?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>주요 출처</Text>
                <InsightList items={report.sources.map(source => source.title || source.url)} />
              </View>
            )}

            {/* Debate 시작 버튼 */}
            <TouchableOpacity style={s.primaryBtn} onPress={handleDebate} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Debate 시작 →</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, marginBottom: 14 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tag: { fontSize: 10, fontWeight: '700', color: t.primary, letterSpacing: 1.2 },
  companyName: { fontSize: 24, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 6 },
  role: { fontSize: 12, color: t.muted, marginBottom: 22 },

  // 카드
  card: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 0.8, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardLabelInline: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 0.8 },
  summaryText: { fontSize: 13, color: t.inkSoft, lineHeight: 21 },
  insightList: { gap: 8 },
  insightRow: { flexDirection: 'row', gap: 8 },
  insightBullet: { fontSize: 13, color: t.primary, lineHeight: 20 },
  insightText: { flex: 1, fontSize: 12, color: t.inkSoft, lineHeight: 20 },

  // 칩
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipPrimary: { paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chipPrimaryText: { fontSize: 13, fontWeight: '600', color: t.primary },
  chipNeutral: { paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chipNeutralText: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
  chipWarm: { paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: t.debateBg, alignItems: 'center', justifyContent: 'center' },
  chipWarmText: { fontSize: 13, fontWeight: '600', color: t.debateFg },

  // 뉴스
  newsItem: { paddingBottom: 10 },
  newsItemBorder: { borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: 10 },
  newsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  newsTitleWrap: { flex: 1 },
  newsTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: t.ink, lineHeight: 19 },
  newsTitleLink: { fontSize: 13, fontWeight: '700', color: t.primary, lineHeight: 19 },
  newsDate: { fontSize: 11, color: t.faint, flexShrink: 0 },
  newsSummary: { fontSize: 12, color: t.muted, lineHeight: 18 },
  newsSource: { fontSize: 11, color: t.faint, marginTop: 4 },

  // 빈 상태
  emptyCard: {
    backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border,
    padding: 24, alignItems: 'center', marginBottom: 14,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: t.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: t.ink, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: t.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF5F5', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA',
    padding: 10, marginBottom: 14, alignSelf: 'stretch',
  },
  errorText: { flex: 1, fontSize: 12, color: t.danger },

  // 버튼
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: t.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
