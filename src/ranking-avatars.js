export async function attachRankingAvatars(db, rows, ownProfile) {
  const fallback = rows.map(row => ({ ...row, avatar_url: row.advisor_id === ownProfile.user_id ? ownProfile.avatar_url || '' : '' }));
  if (!rows.length) return fallback;
  try {
    const directory = await db.rpc('get_mvp_advisor_avatars');
    if (directory.error) return fallback;
    const ids = new Set(rows.map(row => row.advisor_id));
    const photos = (directory.data || []).filter(photo => ids.has(photo.advisor_id) && photo.avatar_path);
    if (!photos.length) return fallback;
    const paths = [...new Set(photos.map(photo => photo.avatar_path))];
    const signed = await db.storage.from('advisor-profile-photos').createSignedUrls(paths, 3600);
    if (signed.error) return fallback;
    const urls = new Map((signed.data || []).filter(item => !item.error && item.signedUrl).map(item => [item.path, item.signedUrl]));
    const avatars = new Map(photos.map(photo => [photo.advisor_id, urls.get(photo.avatar_path)]));
    return fallback.map(row => ({ ...row, avatar_url: avatars.get(row.advisor_id) || row.avatar_url }));
  } catch {
    return fallback;
  }
}
