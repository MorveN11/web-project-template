import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Editorial section primitive — heavy top border + optional eyebrow
// + title header + content. Used for marketing pages to keep
// spacing rhythm consistent. Background variants map to shadcn
// palette tokens:
//   - `default`: page background (white / dark)
//   - `paper`: muted (slightly off-background)
//   - `ink`: dark surface with light foreground text (CTA bands)

interface Props {
  eyebrow?: string;
  titulo?: ReactNode;
  /** Optional numeric label (e.g. "01", "02") for sections that
   * read as a TOC for crawlers and skimmers. */
  numero?: string;
  children: ReactNode;
  className?: string;
  contenidoClassName?: string;
  variant?: 'default' | 'paper' | 'ink';
}

const VARIANT_BG: Record<NonNullable<Props['variant']>, string> = {
  default: 'bg-background',
  paper: 'bg-muted',
  ink: 'bg-foreground text-background',
};

export function Section({
  eyebrow,
  titulo,
  numero,
  children,
  className,
  contenidoClassName,
  variant = 'default',
}: Props) {
  const bg = VARIANT_BG[variant];
  return (
    <section className={cn('border-t-2 border-foreground', bg, className)}>
      {eyebrow || titulo || numero ? (
        <header className="container mx-auto grid grid-cols-1 gap-2 px-4 pt-12 pb-8 md:grid-cols-12 md:items-end md:pt-16 md:pb-12">
          {numero ? (
            <span
              className="text-xs uppercase tracking-wider text-primary md:col-span-2"
              aria-hidden="true"
            >
              {numero}
            </span>
          ) : null}
          <div className="md:col-span-10">
            {eyebrow ? <p className="text-xs uppercase tracking-wider text-primary">{eyebrow}</p> : null}
            {titulo ? (
              <h2 className="mt-2 font-display text-4xl leading-[0.95] tracking-wider md:text-6xl">{titulo}</h2>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn('container mx-auto px-4 pb-16 md:pb-24', contenidoClassName)}>{children}</div>
    </section>
  );
}
