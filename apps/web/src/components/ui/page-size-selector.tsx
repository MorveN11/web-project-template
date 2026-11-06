'use client';

import { useRouter } from 'next/navigation';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption } from '@app/shared-types';
import { ChevronDown } from 'lucide-react';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import { hrefWithQuery } from '@/lib/url';

// PageSize selector — drop-in for any `<DataPagination>` host.
// Native `<select>` (mobile-friendly, keyboard-accessible). On
// change, navigates to the same `basePath` with `?pageSize=<n>` +
// preserved extras. Drops `?page=` so the visitor lands on page 1 of
// the new size (the previous page index may not exist).

interface Props {
  currentPageSize: number;
  basePath: string;
  defaultPageSize?: number;
  extraQueryParams?: Record<string, string>;
  /** Extra classes for alignment inside the host paginator. */
  className?: string;
}

function buildHref(
  basePath: string,
  size: PageSizeOption,
  defaultPageSize: number,
  extraQueryParams?: Record<string, string>,
): string {
  const params: Record<string, unknown> = {};
  if (extraQueryParams) {
    for (const [k, v] of Object.entries(extraQueryParams)) params[k] = v;
  }
  if (size !== defaultPageSize) params.pageSize = size;
  return hrefWithQuery(basePath, params);
}

export function PageSizeSelector({
  currentPageSize,
  basePath,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  extraQueryParams,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number.parseInt(event.target.value, 10) as PageSizeOption;
    const href = buildHref(basePath, next, defaultPageSize, extraQueryParams);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div
      className={cn(
        'relative inline-flex h-9 items-stretch border-2 border-foreground bg-card transition-colors hover:bg-muted focus-within:bg-muted [&:has(select:disabled)]:opacity-50',
        className,
      )}
    >
      <span className="flex items-center px-3 text-xs uppercase tracking-wider text-foreground">Show</span>
      <span className="relative flex items-center border-l-2 border-foreground">
        <select
          value={String(currentPageSize)}
          onChange={handleChange}
          disabled={isPending}
          aria-label="Results per page"
          className="h-full appearance-none bg-transparent pl-2 pr-7 text-xs uppercase tracking-wider text-foreground focus:outline-none disabled:cursor-not-allowed"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 size-4 text-foreground"
          strokeWidth={3}
        />
      </span>
    </div>
  );
}
