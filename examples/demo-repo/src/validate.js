export function isPostcode(value) {
  return typeof value === 'string' && /^[0-9]{5}$/.test(value);
}

export function isProfileId(value) {
  return typeof value === 'string' && /^[a-z0-9-]{6,36}$/.test(value);
}

export function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const out = { ...profile };
  if (typeof out.email === 'string') out.email = out.email.trim().toLowerCase();
  if (out.age != null) out.age = Number(out.age);
  return out;
}
