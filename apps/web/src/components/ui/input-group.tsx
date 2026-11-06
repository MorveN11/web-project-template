'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// InputGroup — border, focus ring, alignment variants for inline
// addons (icons, buttons, text labels). `InputGroupInput` and
// `InputGroupTextarea` strip the wrapper's border / padding so the
// addon edges line up flush. `InputGroupAddon`'s `align` prop pins
// the addon to one of the four sides via `order-*`.

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'group/input-group relative flex w-full min-w-0 items-center border-2 border-foreground bg-background outline-none focus-within:border-foreground focus-within:ring-2 focus-within:ring-primary/40 has-[[data-slot][aria-invalid=true]]:border-destructive has-[textarea]:h-auto has-[textarea]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  'flex h-auto cursor-text items-center justify-center gap-2 py-2 text-xs text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-3',
        'inline-end': 'order-last pr-3',
        'block-start': 'order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3.5',
        'block-end': 'order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3.5',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
);

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-2.5 shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
