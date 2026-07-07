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

export function buildDebatePendingBestFit(currentBestFit = {}, userText = '', initialMessages = []) {
  currentBestFit = currentBestFit && typeof currentBestFit === 'object' ? currentBestFit : {};
  const trimmed = typeof userText === 'string' ? userText.trim() : '';
  const savedMessages = Array.isArray(currentBestFit.messages) ? currentBestFit.messages : [];
  const messages = savedMessages.length > 0
    ? savedMessages
    : (Array.isArray(initialMessages) ? initialMessages : []);

  return {
    ...currentBestFit,
    messages: trimmed
      ? [...messages, { role: 'user', content: trimmed }]
      : messages,
    pendingReply: Boolean(trimmed),
  };
}

export function completeDebateBestFit(currentBestFit = {}, assistantText = '') {
  currentBestFit = currentBestFit && typeof currentBestFit === 'object' ? currentBestFit : {};
  const trimmed = typeof assistantText === 'string' ? assistantText.trim() : '';
  const messages = Array.isArray(currentBestFit.messages) ? currentBestFit.messages : [];

  return {
    ...currentBestFit,
    messages: trimmed
      ? [...messages, { role: 'assistant', content: trimmed }]
      : messages,
    pendingReply: false,
  };
}

export function failDebateBestFit(currentBestFit = {}, errorText = '') {
  currentBestFit = currentBestFit && typeof currentBestFit === 'object' ? currentBestFit : {};
  const trimmed = typeof errorText === 'string' ? errorText.trim() : '';
  const messages = Array.isArray(currentBestFit.messages) ? currentBestFit.messages : [];

  return {
    ...currentBestFit,
    messages: trimmed
      ? [...messages, { role: 'assistant', content: trimmed }]
      : messages,
    pendingReply: false,
  };
}

export function shouldResumePendingReply(bestFit = {}) {
  if (!bestFit?.pendingReply || !Array.isArray(bestFit.messages) || bestFit.messages.length === 0) {
    return false;
  }

  const lastMessage = bestFit.messages[bestFit.messages.length - 1];
  return lastMessage?.role === 'user' && Boolean(String(lastMessage.content || '').trim());
}

export function shouldShowWriteButton(messages = []) {
  return messages.some(message => message.role === 'user');
}
