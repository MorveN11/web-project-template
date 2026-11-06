// Generic responsive table — `<table>` markup at `md+`, per-row card
// stack at `<md`. Two render surfaces driven by the same `rows`
// (single source of truth for the data).
//
// `hideOn` toggles column visibility on the table side. The mobile
// card is fully owned by the caller (`renderCard`) because per-page
// information priority differs (a product row needs price + stock
// pill; an inbox row needs date + name + action).
//
// Pure server component. Standard `<table>` semantics so screen
// readers and copy-paste behave identically.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveTableColumn<T> {
  key: string;
  label: ReactNode;
  /** Cell render. */
  render: (row: T) => ReactNode;
  /** Hide this column below the named breakpoint on the table side. */
  hideOn?: 'sm' | 'md' | 'lg';
  /** Extra classes for the `<td>` cell. */
  cellClassName?: string;
  /** Extra classes for the `<th>` header. */
  headerClassName?: string;
}

interface ResponsiveTableProps<T> {
  rows: T[];
  keyExtractor: (row: T) => string;
  columns: ResponsiveTableColumn<T>[];
  /** Per-row card for the `<md` view. */
  renderCard: (row: T) => ReactNode;
  /** Optional empty state (rendered when `rows.length === 0`). */
  emptyState?: ReactNode;
}

export function ResponsiveTable<T>({
  rows,
  keyExtractor,
  columns,
  renderCard,
  emptyState,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto border-2 border-foreground bg-background md:block">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-foreground bg-foreground text-[10px] uppercase tracking-wider text-background">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-3 text-left',
                    c.hideOn === 'md' && 'hidden md:table-cell',
                    c.hideOn === 'lg' && 'hidden lg:table-cell',
                    c.hideOn === 'sm' && 'hidden sm:table-cell',
                    c.headerClassName,
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-foreground/10 transition-colors hover:bg-muted last:border-b-0"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3',
                      c.hideOn === 'md' && 'hidden md:table-cell',
                      c.hideOn === 'lg' && 'hidden lg:table-cell',
                      c.hideOn === 'sm' && 'hidden sm:table-cell',
                      c.cellClassName,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={keyExtractor(row)}>{renderCard(row)}</li>
        ))}
      </ul>
    </>
  );
}
