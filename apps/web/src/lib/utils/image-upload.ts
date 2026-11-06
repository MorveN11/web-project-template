// Cross-cutting image-upload constraints — single source of truth for
// the web client. Mirrors the api's upload-pipeline env limits
// (`UPLOAD_MAX_FILES_PER_REQUEST`, `UPLOAD_MAX_FILE_SIZE_MB`). Drift
// is possible if the api env is changed at runtime — review both
// sides together when bumping either.

export const IMAGE_UPLOAD_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const IMAGE_UPLOAD_MAX_FILES = 10;
export const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type ImageUploadMime = (typeof IMAGE_UPLOAD_ACCEPT)[number];
