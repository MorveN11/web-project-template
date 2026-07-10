// Prisma row → DTO. Wire shape stays decoupled from storage shape so the
// two can evolve independently. The `ItemDto` type lives in
// @app/shared-types so api + web share the contract.

import type { Item } from '@app/db';
import type { ItemDto } from '@app/shared-types';

export type { ItemDto };

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
