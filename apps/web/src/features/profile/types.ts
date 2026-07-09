import type { CurrentSession } from './actions';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export type SessionSnapshot = CurrentSession | null;
