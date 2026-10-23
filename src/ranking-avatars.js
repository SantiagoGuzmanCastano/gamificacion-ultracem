const SIGNED_URL_SECONDS = 3600;
// Signed URLs are reused until 15 minutes before expiry, so the 50-minute renewal still re-signs them.
const REUSE_MARGIN_MS = 15 * 60 * 1000;
const signedUrlCaches = new WeakMap();

async function signPaths(db, paths) {
  if (!signedUrlCaches.has(db)) signedUrlCaches.set(db, new Map());
  const cache = signedUrlCaches.get(db);
  const now = Date.now();
  const missing = paths.filter(path => !(cache.get(path)?.expiresAt - now > REUSE_MARGIN_MS));
  if (missing.length) {
    const signed = await db.storage.from('advisor-profile-photos').createSignedUrls(missing, SIGNED_URL_SECONDS);
    if (signed.error) return null;
    for (const item of signed.data || []) {
      if (!item.error && item.signedUrl) cache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_SECONDS * 1000 });
    }
  }
  return new Map(paths.filter(path => cache.has(path)).map(path => [path, cache.get(path).url]));
}

export async function attachRankingAvatars(db, rows, ownProfile) {
  const fallback = rows.map(row => ({ ...row, avatar_url: row.advisor_id === ownProfile.user_id ? ownProfile.avatar_url || '' : '' }));
  if (!rows.length) return fallback;
  try {
    const directory = await db.rpc('get_mvp_advisor_avatars');
    if (directory.error) return fallback;
    const ids = new Set(rows.map(row => row.advisor_id));
    const photos = (directory.data || []).filter(photo => ids.has(photo.advisor_id) && photo.avatar_path);
    if (!photos.length) return fallback;
    const urls = await signPaths(db, [...new Set(photos.map(photo => photo.avatar_path))]);
    if (!urls) return fallback;
    const avatars = new Map(photos.map(photo => [photo.advisor_id, urls.get(photo.avatar_path)]));
    return fallback.map(row => ({ ...row, avatar_url: avatars.get(row.advisor_id) || row.avatar_url }));
  } catch {
    return fallback;
  }
}
