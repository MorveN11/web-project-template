// Item repository — the EF-Core-style fluent facade over Prisma.
// Service holds business rules (authz, mapping, Result errors). Repo holds
// fluent query shapes (filters, paging, includes). Routes never see either
// of them — only DTOs come out of the service.

import type { Database, Item } from '@app/db';

export interface ListOptions {
  limit: number;
  offset: number;
}

export interface CreateInput {
  name: string;
  description: string | null;
  ownerId: string;
}

export interface UpdateInput {
  name?: string;
  description?: string | null;
}

export class ItemRepository {
  // ponytail: passing the full Prisma client keeps the typing tight and
  // lets the repo call `db.item.findMany` directly — adding a thin repo
  // wrapper buys isolation between the service and the schema without
  // paying the indirection cost of a separate IDatabase abstraction.
  constructor(private readonly db: Database) {}

  list(opts: ListOptions): Promise<Item[]> {
    return this.db.item.findMany({
      take: opts.limit,
      skip: opts.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(): Promise<number> {
    return this.db.item.count();
  }

  findById(id: string): Promise<Item | null> {
    return this.db.item.findUnique({ where: { id } });
  }

  findManyByOwner(ownerId: string, opts: ListOptions): Promise<Item[]> {
    return this.db.item.findMany({
      where: { ownerId },
      take: opts.limit,
      skip: opts.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CreateInput): Promise<Item> {
    return this.db.item.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: input.ownerId,
      },
    });
  }

  update(id: string, input: UpdateInput): Promise<Item> {
    return this.db.item.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  remove(id: string): Promise<Item> {
    return this.db.item.delete({ where: { id } });
  }
}
