// Pagination primitives. Soft navigation via `next/link` keeps chrome
// mounted on `?page=N` clicks; the disabled state renders a plain
// `<a>` so it stays shareable and accessible. See `data-pagination.tsx`
// for the consumer.
//
// Token palette uses shadcn-generic colors so forks don't have to
// redefine a bespoke design system to drop these in.

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const paginationVariants = cva(
  'inline-flex shrink-0 items-center justify-center border-2 border-foreground font-display text-xs uppercase tracking-wider transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      size: {
        default:
          'h-11 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        // 44px square = WCAG/Apple minimum touch target.
        icon: 'size-11',
      },
    },
    defaultVariants: {
      size: 'icon',
    },
  },
);

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<VariantProps<typeof paginationVariants>, 'size'> &
  React.ComponentProps<'a'>;

function PaginationLink({ className, isActive, size = 'icon', href, ...props }: PaginationLinkProps) {
  const cls = cn(
    paginationVariants({ size }),
    isActive
      ? 'bg-foreground text-background'
      : 'bg-background text-foreground hover:-translate-y-0.5 hover:bg-muted hover:shadow-[4px_4px_0_0_var(--foreground)]',
    className,
  );
  if (href === undefined) {
    return (
      <a
        aria-current={isActive ? 'page' : undefined}
        aria-disabled={props['aria-disabled']}
        data-slot="pagination-link"
        data-active={isActive}
        className={cls}
        {...props}
      />
    );
  }
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cls}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('pl-2!', className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn('pr-2!', className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        'flex size-11 items-center justify-center border-2 border-transparent font-mono text-xs text-muted-foreground',
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
