import { apiClient } from '@/lib/api-client';
import type { Profile } from '../types';

// Service-layer function. Token passed explicitly so this file stays
// dependency-free of `'use server'` helpers — the action in
// `../actions.ts` resolves the token via `getCurrentToken()` and feeds
// it in. Tests can call this directly with a stub token.
//
// Self-sync now happens inside `getCurrentSession` in
// `@/features/auth/actions` — no per-render call from the layout.

export async function getMyProfile(token: string) {
  // Hits the api's `GET /users/me` — returns the local DB row, not
  // Clerk metadata. Exercises the full pipeline: api auth → repo →
  // Prisma → wire DTO.
  return apiClient.get<Profile>('/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}