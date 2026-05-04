export function buildProfileUpsertPayload(user = {}) {
  return {
    id: String(user.id || ''),
    name: typeof user.name === 'string' ? user.name : '',
    major: typeof user.major === 'string' ? user.major : '',
    experiences: Array.isArray(user.experiences) ? user.experiences : [],
  };
}
