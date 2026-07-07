import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDebatePendingBestFit,
  buildInitialDebateMessages,
  shouldResumePendingReply,
  shouldShowWriteButton,
} from '../src/services/debateStateUtils.mjs';

test('buildInitialDebateMessages restores saved messages before default greeting', () => {
  const saved = [{ role: 'assistant', content: '저장된 답변' }, { role: 'user', content: '내 질문' }];

  assert.equal(
    buildInitialDebateMessages({ bestFit: { messages: saved }, name: '삼성전자', role: '마케팅' })[0].content,
    '저장된 답변',
  );
});

test('buildDebatePendingBestFit stores user message and pending reply state', () => {
  const current = {
    messages: [{ role: 'assistant', content: '안내' }],
  };

  assert.deepEqual(
    buildDebatePendingBestFit(current, ' 내 경험 분석해줘 '),
    {
      messages: [
        { role: 'assistant', content: '안내' },
        { role: 'user', content: '내 경험 분석해줘' },
      ],
      pendingReply: true,
    },
  );
});

test('buildDebatePendingBestFit handles null saved debate state', () => {
  assert.deepEqual(
    buildDebatePendingBestFit(null, '첫 질문'),
    {
      messages: [{ role: 'user', content: '첫 질문' }],
      pendingReply: true,
    },
  );
});

test('buildDebatePendingBestFit preserves initial greeting on first user message', () => {
  const initialMessages = [{ role: 'assistant', content: '리서치 완료 안내' }];

  assert.deepEqual(
    buildDebatePendingBestFit(null, '첫 질문', initialMessages),
    {
      messages: [
        { role: 'assistant', content: '리서치 완료 안내' },
        { role: 'user', content: '첫 질문' },
      ],
      pendingReply: true,
    },
  );
});

test('shouldResumePendingReply only resumes when pending reply waits on last user message', () => {
  assert.equal(shouldResumePendingReply({
    pendingReply: true,
    messages: [{ role: 'user', content: '질문' }],
  }), true);

  assert.equal(shouldResumePendingReply({
    pendingReply: true,
    messages: [{ role: 'user', content: '질문' }, { role: 'assistant', content: '답변' }],
  }), false);

  assert.equal(shouldResumePendingReply({
    pendingReply: false,
    messages: [{ role: 'user', content: '질문' }],
  }), false);
});

test('buildInitialDebateMessages creates default greeting when no saved messages exist', () => {
  const messages = buildInitialDebateMessages({ name: '삼성전자', role: '마케팅' });

  assert.deepEqual(messages, [{
    role: 'assistant',
    content: '삼성전자 마케팅 리서치 완료!\n어떤 걸 먼저 분석할까요?',
  }]);
});

test('shouldShowWriteButton returns true after one user message', () => {
  assert.equal(shouldShowWriteButton([{ role: 'assistant', content: '안내' }]), false);
  assert.equal(shouldShowWriteButton([{ role: 'user', content: '질문' }]), true);
});
