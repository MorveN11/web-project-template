// Shared OpenAPI response shapes. The error envelope is identical
// across every feature (api always returns `{ error: { code, message } }`),
// so the response wrappers live here and feature routers spread them
// into their `responses` blocks.

import { apiErrorSchema } from '@app/shared-types';

const errorEnvelope = {
  content: { 'application/json': { schema: apiErrorSchema } },
  description: 'error envelope',
};

// 401 — caller is not authenticated (missing/invalid Bearer token).
export const unauthorizedResponse = { 401: errorEnvelope };

// 403 — caller is authenticated but lacks the required role.
export const forbiddenResponse = { 403: errorEnvelope };

// 404 — resource not found by id.
export const notFoundResponse = { 404: errorEnvelope };

// 409 — conflicting state (duplicate key, version mismatch, etc.).
export const conflictResponse = { 409: errorEnvelope };

// Convenience unions — common multi-status combos used by most routes.
export const authErrorResponses = { ...unauthorizedResponse, ...forbiddenResponse };
export const resourceResponses = { ...notFoundResponse, ...conflictResponse };