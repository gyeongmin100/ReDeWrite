import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import {
  getNextEditingIndexAfterDelete,
  getSavedExperiences,
} from '../services/experienceEditorUtils.mjs';

export default function MyScreen({ user, onSignOut, onUpdateUser }) {
  const [addingExp, setAddingExp] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);

  const handleSaveExp = async () => {
    if (!draftText.trim()) return;
    const updated = getSavedExperiences(user.experiences, editingIdx, draftText);
    setAddingExp(false);
    setEditingIdx(null);
    setDraftText('');
    if (onUpdateUser) onUpdateUser(updated);
  };

  const handleEditExp = (idx) => {
    setEditingIdx(idx);
    setDraftText(user.experiences[idx]);
    setAddingExp(false);
  };

  const handleAddExp = () => {
    setAddingExp(true);
    setEditingIdx(null);
    setDraftText('');
  };

  const handleCancelEdit = () => {
    setAddingExp(false);
    setEditingIdx(null);
    setDraftText('');
  };

  const handleDeleteExp = (idx) => {
    const updated = user.experiences.filter((_, i) => i !== idx);
    const nextEditingIdx = getNextEditingIndexAfterDelete(editingIdx, idx);
    setEditingIdx(nextEditingIdx);
    if (nextEditingIdx === null) {
      setDraftText('');
    }
    if (onUpdateUser) onUpdateUser(updated);
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

          {/* Experience library */}
          <Text style={s.sectionLabel}>내 경험 라이브러리</Text>
          <View style={s.expCard}>
            {user.experiences.map((e, i, arr) => (
              <View
                key={`${e}-${i}`}
                style={[
                  s.expRow,
                  (i < arr.length - 1 || addingExp) && s.expBorder,
                  editingIdx === i && s.expRowEditing,
                ]}
              >
                {editingIdx === i ? (
                  <>
                    <Text style={s.expNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <TextInput
                      style={s.expInput}
                      value={draftText}
                      onChangeText={setDraftText}
                      multiline
                      autoFocus
                      placeholder="역할, 성과, 수치를 함께 적어주세요"
                      placeholderTextColor={t.faint}
                    />
                    <View style={s.inlineActions}>
                      <TouchableOpacity onPress={handleCancelEdit} style={s.iconBtn}>
                        <Ionicons name="close" size={16} color={t.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveExp}
                        style={[s.iconBtn, !draftText.trim() && s.btnDisabled]}
                        disabled={!draftText.trim()}
                      >
                        <Ionicons name="checkmark" size={17} color={t.primary} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.expNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[s.expText, { flex: 1 }]}>{e}</Text>
                    <TouchableOpacity onPress={() => handleEditExp(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="pencil-outline" size={15} color={t.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteExp(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 10 }}>
                      <Ionicons name="trash-outline" size={15} color={t.danger} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}

            {addingExp && (
              <View style={[s.expRow, s.expRowEditing]}>
                <Text style={s.expNum}>{String(user.experiences.length + 1).padStart(2, '0')}</Text>
                <TextInput
                  style={s.expInput}
                  placeholder="역할, 성과, 수치를 함께 적어주세요"
                  placeholderTextColor={t.faint}
                  value={draftText}
                  onChangeText={setDraftText}
                  multiline
                  autoFocus
                />
                <View style={s.inlineActions}>
                  <TouchableOpacity onPress={handleCancelEdit} style={s.iconBtn}>
                    <Ionicons name="close" size={16} color={t.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.iconBtn, !draftText.trim() && s.btnDisabled]}
                    onPress={handleSaveExp}
                    disabled={!draftText.trim()}
                  >
                    <Ionicons name="checkmark" size={17} color={t.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {!addingExp && editingIdx === null && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={handleAddExp}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={t.ink} />
              <Text style={s.addBtnText}>경험 추가</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={t.danger} />
            <Text style={s.signOutText}>로그아웃</Text>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerLogo}>Re<Text style={{ color: t.primary }}>De</Text>Write</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
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
  expRowEditing: { backgroundColor: t.surfaceAlt, alignItems: 'flex-start' },
  expBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  expNum: { fontSize: 11, color: t.faint, marginTop: 1, minWidth: 20 },
  expText: { flex: 1, fontSize: 12, color: t.inkSoft, lineHeight: 20 },
  expInput: {
    flex: 1,
    minHeight: 64,
    maxHeight: 120,
    fontSize: 12,
    color: t.ink,
    lineHeight: 20,
    textAlignVertical: 'top',
    padding: 0,
  },
  inlineActions: { flexDirection: 'row', gap: 6, marginTop: -4 },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    height: 44, borderRadius: 14, backgroundColor: t.surface,
    borderWidth: 1, borderColor: t.borderStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 22,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: t.ink },
  btnDisabled: { opacity: 0.5 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  signOutText: { fontSize: 13, color: t.danger, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 16 },
  footerLogo: { fontSize: 13, fontWeight: '700', color: t.ink },
  footerSub: { fontSize: 11, color: t.faint, marginTop: 4 },
});
