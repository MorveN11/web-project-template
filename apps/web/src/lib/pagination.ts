// Parser for `?page=N&pageSize=M` query strings, used by Server
// Components. Single source of truth: any page that reads these
// query params consumes this helper — no inline re-invention.
//
// `parsePaginationParams` validates basic ranges (>=1) and falls
// back to defaults on NaN/negatives. The api rejects invalid input
// anyway, but failing here avoids a 400 round-trip from a malformed
// link.
//
// The href construction (`buildCatalogHref` + friends) lives inside
// the data filter UIs (`<DataPagination>`, `<FilterToolbar>`).
// This file only owns the entry side (parse), not the output side.

import { DEFAULT_PAGE_SIZE, type PaginationResponse } from '@app/shared-types';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationDefaults {
  pageSize?: number;
}

export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>,
  defaults: PaginationDefaults = {},
): PaginationParams {
  const defaultPageSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const rawSize = Array.isArray(searchParams.pageSize) ? searchParams.pageSize[0] : searchParams.pageSize;
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const parsedSize = Number.parseInt(rawSize ?? '', 10);
  return {
    page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
    pageSize: Number.isFinite(parsedSize) && parsedSize >= 1 ? parsedSize : defaultPageSize,
  };
}

/**
 * Empty `PaginationResponse<T>` for the search page — convenience
 * wrapper when an action returns `null` so the consumer can read
 * `result.data.items` without optional-chaining every step.
 */
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
