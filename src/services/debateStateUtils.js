export function buildInitialDebateMessages(research = {}) {
  const savedMessages = research?.bestFit?.messages;
  if (Array.isArray(savedMessages) && savedMessages.length > 0) {
    return savedMessages;
  }

  const company = research?.name ?? research?.researchReport?.company ?? '기업';
  const role = research?.role ?? research?.researchReport?.role ?? '';

  return [{
    role: 'assistant',
    content: `${company} ${role} 리서치 완료!\n어떤 걸 먼저 분석할까요?`,
  }];
}

export function shouldShowWriteButton(messages = []) {
  return messages.some(message => message.role === 'user');
}
