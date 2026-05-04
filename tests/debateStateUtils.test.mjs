import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInitialDebateMessages,
  shouldShowWriteButton,
} from '../src/services/debateStateUtils.mjs';

test('buildInitialDebateMessages restores saved messages before default greeting', () => {
  const saved = [{ role: 'assistant', content: '저장된 답변' }, { role: 'user', content: '내 질문' }];

  assert.equal(
    buildInitialDebateMessages({ bestFit: { messages: saved }, name: '삼성전자', role: '마케팅' })[0].content,
    '저장된 답변',
  );
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
