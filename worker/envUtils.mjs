const LEADING_BOM = /^\uFEFF/;

export function getEnv(env, name) {
  const value = env?.[name];
  return typeof value === 'string' ? value.replace(LEADING_BOM, '').trim() : '';
}

export function getHeaderSafeEnv(env, name) {
  return getEnv(env, name);
}
