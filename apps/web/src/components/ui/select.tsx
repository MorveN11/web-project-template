'use client';

import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** Options to render. The first option is rendered with `value=""` if `placeholder` is set. */
  options: SelectOption[];
  /** Placeholder text shown as the empty-value option. Omit to render no placeholder. */
  placeholder?: string;
  /** Optional fixed width override. Default: `w-full` (form). Set to `toolbar` for filter bars. */
  width?: 'toolbar' | 'form';
}

/**
 * Native `<select>` wrapped with the chevron + padding pattern.
 *
 * Why a wrapper:
 *   - Browsers render the native chevron ON TOP of the option text
 *     (overriding `padding-right`). `appearance-none` strips it so
 *     our own chevron can sit clear via `pr-10` (40px right padding).
 *   - Without this, the option label collides with the chevron at
 *     narrow widths. The fix must be applied at EVERY `<select>`
 *     site — hence the shared primitive. Native `<select>` outside
 *     this component is a bug.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, width = 'form', ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        data-slot="select"
        className={cn(
          'h-11 appearance-none border-2 border-foreground bg-background px-3 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive [&_option]:text-sm',
          width === 'toolbar' ? 'max-w-45 truncate' : 'w-full',
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
