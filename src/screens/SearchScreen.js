import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

const HINT_CHIPS = [
  '네이버 서비스기획 인턴',
  '삼성전자 회로설계',
  '현대차 생산관리',
  '카카오 백엔드 개발',
];

export default function SearchScreen({ navigation, startResearch }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const companyId = await startResearch(query.trim());
      navigation.navigate('Research', { companyId });
    } catch (err) {
      console.error('Research error:', err);
      setError('기업 정보를 불러오는 중 오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.inner}>
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.title}>새 리서치 시작</Text>
        </View>

        {/* 입력 */}
        <View style={s.inputWrap}>
          <Ionicons name="search-outline" size={18} color={t.muted} />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="예: 네이버 서비스기획 인턴"
            placeholderTextColor={t.faint}
            autoFocus
            editable={!loading}
            returnKeyType="search"
            onSubmitEditing={handleStart}
          />
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={t.faint} />
            </TouchableOpacity>
          )}
        </View>

        {/* 힌트 칩 */}
        <Text style={s.label}>입력 예시</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsScroll}
        >
          {HINT_CHIPS.map(chip => (
            <TouchableOpacity
              key={chip}
              style={s.hintChip}
              onPress={() => setQuery(chip)}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={s.hintChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 에러 */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={t.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <View style={s.loadingBox}>
            <ActivityIndicator size="small" color={t.primary} />
            <Text style={s.loadingText}>AI가 기업 정보를 수집하고 있어요. 다른 화면으로 이동해도 정보 수집은 계속됩니다.</Text>
          </View>
        )}

        {/* 리서치 시작 버튼 */}
        <TouchableOpacity
          style={[s.startBtn, (!query.trim() || loading) && s.startBtnDisabled]}
          onPress={handleStart}
          activeOpacity={0.85}
          disabled={!query.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={s.startBtnText}>리서치 시작</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: t.ink },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    height: 52, backgroundColor: t.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: t.borderStrong, marginBottom: 18,
  },
  input: { flex: 1, fontSize: 15, color: t.ink },
  label: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1, marginBottom: 10 },
  chipsScroll: { flexGrow: 0, marginBottom: 24 },
  chipsRow: { gap: 8, paddingRight: 4 },
  hintChip: {
    paddingHorizontal: 14, height: 34, borderRadius: 999,
    backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  hintChipText: { fontSize: 13, fontWeight: '500', color: t.inkSoft },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA',
    padding: 12, marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: t.danger, lineHeight: 18 },
  loadingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: t.primarySoft, borderRadius: 12, borderWidth: 1, borderColor: t.primaryLight,
    padding: 14, marginBottom: 14,
  },
  loadingText: { fontSize: 13, color: t.primary, fontWeight: '500' },
  startBtn: {
    height: 54, borderRadius: 14, backgroundColor: t.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 'auto', marginBottom: 16,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
