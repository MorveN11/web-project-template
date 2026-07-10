import { apiClient } from '@/lib/api-client';
import type { Profile } from '../types';

export async function getMyProfile(token: string) {
  return apiClient.get<Profile>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
