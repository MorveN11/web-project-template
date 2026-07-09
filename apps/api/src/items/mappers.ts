// Prisma row → DTO. Wire shape stays decoupled from storage shape so the
// two can evolve independently.

import type { Item } from '@app/db';

export interface ItemDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export function toItemDto(row: Item): ItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
