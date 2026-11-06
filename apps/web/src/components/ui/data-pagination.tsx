// Canonical paginator for Server Components. Takes the api's
// `PaginationResponse<T>` plus the `basePath` of the page. Builds
// `?page=` URLs internally: omits `?page=` on page 1, omits
// `?pageSize=` when it matches the default. Layout responsive:
// below `sm` the three slices (counter / paginator / selector)
// stack vertically; `sm+` puts them in one row with the counter
// on the left, paginator centered, selector on the right.
//
// No client state on this component — the `<a>` elements preserve
// SSR + cmd-click. The single client island is `<PageSizeSelector>`
// (the `<select>` needs onChange).

import { DEFAULT_PAGE_SIZE, type PaginationResponse } from '@app/shared-types';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { hrefWithQuery } from '@/lib/url';
import { PageSizeSelector } from './page-size-selector';

export interface DataPaginationProps<T> {
  /** Paginated envelope returned by the api. */
  response: PaginationResponse<T>;
  /** Page path (e.g. `'/app/admin/inbox'`). */
  basePath: string;
  /** Default page size; if `response.pageSize` matches, omitted from the href. */
  defaultPageSize?: number;
  /**
   * Query params to preserve across pagination (e.g. `q` in a search
   * page). The keys are passed straight through; the caller is
   * responsible for URL-encoding values.
   */
  extraQueryParams?: Record<string, string>;
  className?: string;
}

function buildPageItems(currentPage: number, totalPages: number, siblings: number): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [];
  const items: (number | 'ellipsis')[] = [];
  const left = Math.max(2, currentPage - siblings);
  const right = Math.min(totalPages - 1, currentPage + siblings);

  items.push(1);
  if (left > 2) items.push('ellipsis');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('ellipsis');
  if (totalPages > 1) items.push(totalPages);
  return items;
}

export function DataPagination<T>({
  response: { page, totalPages, pageSize, total },
  basePath,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  extraQueryParams,
  className,
}: DataPaginationProps<T>) {
  const hasMultiplePages = totalPages > 1;
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const items = buildPageItems(page, totalPages, 1);

  const hrefFor = (target: number): string => {
    const params: Record<string, unknown> = {};
    if (extraQueryParams) {
      for (const [k, v] of Object.entries(extraQueryParams)) params[k] = v;
    }
    if (target !== 1) params.page = target;
    if (pageSize !== defaultPageSize) params.pageSize = pageSize;
    return hrefWithQuery(basePath, params);
  };

  return (
    <div
      className={cn(
        'mt-6 flex flex-col gap-3',
        'sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between',
        !hasMultiplePages && 'sm:justify-end',
        className,
      )}
    >
      {hasMultiplePages ? (
        <p className="text-xs uppercase tracking-wider text-muted-foreground sm:whitespace-nowrap">
          Page <span className="font-bold text-foreground">{page}</span>
          <span className="mx-1">/</span>
          <span>{totalPages}</span>
          <span className="mx-2">·</span>
          <span>
            {total} {total === 1 ? 'result' : 'results'}
          </span>
        </p>
      ) : null}
      {hasMultiplePages ? (
        <Pagination className="mx-0 w-full justify-center sm:w-auto">
          <PaginationContent className="flex-wrap">
            <PaginationItem>
              <PaginationPrevious
                href={hasPrevious ? hrefFor(page - 1) : undefined}
                aria-disabled={!hasPrevious}
                tabIndex={hasPrevious ? undefined : -1}
                className={cn(!hasPrevious && 'pointer-events-none opacity-40')}
              />
            </PaginationItem>

            {items.map((item, idx) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href={hrefFor(item)}
                    isActive={item === page}
                    aria-label={`Go to page ${item}`}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                href={hasNext ? hrefFor(page + 1) : undefined}
                aria-disabled={!hasNext}
                tabIndex={hasNext ? undefined : -1}
                className={cn(!hasNext && 'pointer-events-none opacity-40')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
      <PageSizeSelector
        currentPageSize={pageSize}
        basePath={basePath}
        defaultPageSize={defaultPageSize}
        extraQueryParams={extraQueryParams}
        className="self-end"
      />
    </div>
  );
}
