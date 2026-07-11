// Item service. Owns business rules + Result<T>. Calls the repository,
// never the database directly.

import type { PaginationResponse } from '@app/shared-types';
import type { ClerkAuthContext } from '@/auth/clerk';
import { err, errConflict, errForbidden, errInternal, errNotFound, ok, type Result } from '@/core/result';
import { logger } from '@/logger';
import { type ItemDto, toItemDto } from './mappers';
import type { ItemRepository } from './repository';
import type { CreateItemBody, ListItemsQuery, UpdateItemBody } from './schemas';

export class ItemService {
  constructor(private readonly items: ItemRepository) {}

  async list(q: ListItemsQuery): Promise<Result<PaginationResponse<ItemDto>>> {
    try {
      const [rows, total] = await Promise.all([
        this.items.list({ limit: q.limit, offset: q.offset }),
        this.items.count(),
      ]);

      // Translate the wire `limit/offset` query to the friendlier
      // `page/pageSize` envelope. Floor (not ceil) on the page number —
      // `offset=0` is page 1, not page 0.
      const page = Math.floor(q.offset / q.limit) + 1;
      const pageSize = q.limit;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return ok({
        items: rows.map(toItemDto),
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: q.offset + q.limit < total,
        hasPreviousPage: q.offset > 0,
      });
    } catch (cause) {
      logger.error({ cause, q }, 'item.list failed');
      return err(errInternal(cause));
    }
  }

  async getById(id: string): Promise<Result<ItemDto>> {
    try {
      const row = await this.items.findById(id);
      if (!row) return err(errNotFound(`item ${id} not found`));
      return ok(toItemDto(row));
    } catch (cause) {
      logger.error({ cause, id }, 'item.getById failed');
      return err(errInternal(cause));
    }
  }

  async create(auth: ClerkAuthContext, body: CreateItemBody): Promise<Result<ItemDto>> {
    try {
      const row = await this.items.create({
        name: body.name,
        description: body.description ?? null,
        ownerId: auth.userId,
      });
      return ok(toItemDto(row));
    } catch (cause) {
      logger.error({ cause, body }, 'item.create failed');
      return err(errConflict('could not create item'));
    }
  }

  async update(auth: ClerkAuthContext, id: string, body: UpdateItemBody): Promise<Result<ItemDto>> {
    try {
      const existing = await this.items.findById(id);
      if (!existing) return err(errNotFound(`item ${id} not found`));
      if (existing.ownerId !== auth.userId) return err(errForbidden('not your item'));

      const row = await this.items.update(id, {
        name: body.name,
        description: body.description,
      });
      return ok(toItemDto(row));
    } catch (cause) {
      logger.error({ cause, id, body }, 'item.update failed');
      return err(errInternal(cause));
    }
  }

  async remove(auth: ClerkAuthContext, id: string): Promise<Result<void>> {
    try {
      const existing = await this.items.findById(id);
      if (!existing) return err(errNotFound(`item ${id} not found`));
      if (existing.ownerId !== auth.userId) return err(errForbidden('not your item'));

      await this.items.remove(id);
      return ok(undefined);
    } catch (cause) {
      logger.error({ cause, id }, 'item.remove failed');
      return err(errInternal(cause));
    }
  }
}
