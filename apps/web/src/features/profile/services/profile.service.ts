import { apiClient } from '@/lib/api-client';
import type { Profile } from '../types';

export async function getMyProfile(token: string) {
  return apiClient.get<Profile>('/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
