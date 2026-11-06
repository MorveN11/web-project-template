// Pagination envelope factory. Single source of truth for building
// the `PaginationResponse<T>` shape every paginated endpoint returns
// (mirrors the common C#-style `PagedList<T>` shape).
//
// Replaces the inline `{ items, page, pageSize, total, totalPages,
// hasNextPage, hasPreviousPage }` literal that was duplicated in
// every `service.ts`. Future paginated endpoints call this only:
//
//   return ok(toPaginationResponse(items, query.page, query.pageSize, total));
//
// `totalPages` is `max(1, ceil(total / pageSize))` because a page
// with no items still has 1 page (the empty one) — this matches
// the `DataPagination` rendering contract on the web side (no
// controls rendered when `totalPages <= 1`).

import type { PaginationResponse } from '@app/shared-types';

export interface PaginationRequest<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function toPaginationResponse<T>({ items, total, page, pageSize }: PaginationRequest<T>): PaginationResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function emptyPaginationResponse<T>(page: number, pageSize: number): PaginationResponse<T> {
  return {
    items: [],
    page,
    pageSize,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}
