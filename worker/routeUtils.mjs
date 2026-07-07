export function resolveWorkerPath(rawPath) {
  const parts = Array.isArray(rawPath)
    ? rawPath
    : String(rawPath || '').split('/');

  const normalized = parts
    .map(part => String(part || '').trim())
    .filter(Boolean);

  if (normalized[0] === 'api') {
    normalized.shift();
  }

  return `/${normalized.join('/')}`;
}
