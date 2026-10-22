const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isValidProfileImage(file) {
  return Boolean(file && PROFILE_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_PROFILE_IMAGE_BYTES);
}

export function profileImageExtension(file) {
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
}

export const profileImageMaxBytes = MAX_PROFILE_IMAGE_BYTES;
