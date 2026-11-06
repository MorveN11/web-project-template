'use client';

// Reusable image uploader. Controlled component — parent owns the
// `items` state. Each item is either an existing remote image
// (`{ kind: 'existing', url, alt }`) the user can keep / remove, or
// a new local upload (`{ kind: 'new', file }`) the user can drop /
// pick / remove before submit.
//
// Validation runs client-side BEFORE the upload round-trip and only
// applies to newly dropped/picked files:
//   - MIME type against the `accept` prop
//   - per-file size against `maxBytesPerFile`
//   - total NEW-file count against `maxFiles` (existing items bypass
//     this — already accepted by the api on a previous save)
//
// Object URLs are created only for new `File` items and are revoked
// when items leave the list.

import { X } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_FILES,
  type ImageUploadMime,
} from '@/lib/utils/image-upload';

export type ImageItem =
  | { kind: 'existing'; url: string; alt: string | null }
  | { kind: 'new'; file: File; previewUrl: string };

export interface ImageUploaderProps {
  /** Controlled list of items (existing + new). */
  items: ImageItem[];
  onChange: (items: ImageItem[]) => void;
  /** Max NEW files accepted (default `IMAGE_UPLOAD_MAX_FILES`). */
  maxFiles?: number;
  /** Max bytes per individual new file. */
  maxBytesPerFile?: number;
  /** Accepted MIME types. */
  accept?: readonly ImageUploadMime[];
  /** Hidden input `name`. Default `files`. */
  name?: string;
  disable?: boolean;
  /** Helper text. Defaults to a generic format/size summary. */
  description?: string;
  className?: string;
}

const MIME_LABEL: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function defaultDescription(accept: readonly string[], maxFiles: number, maxBytes: number): string {
  const mimes = accept.map((m) => MIME_LABEL[m] ?? m).join(', ');
  return `Drag up to ${maxFiles} files (${formatBytes(maxBytes)} each). Formats: ${mimes}.`;
}

export function ImageUploader({
  items,
  onChange,
  maxFiles = IMAGE_UPLOAD_MAX_FILES,
  maxBytesPerFile = IMAGE_UPLOAD_MAX_BYTES,
  accept = IMAGE_UPLOAD_ACCEPT,
  name = 'files',
  disable = false,
  description,
  className,
}: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const newCount = useMemo(() => items.filter((i) => i.kind === 'new').length, [items]);

  // Revoke object URLs on unmount / on remove. `URL.createObjectURL`
  // leaks the file handle otherwise — browsers can't reclaim them
  // until the tab closes. Tracked via ref (not an effect dep) so the
  // cleanup sees the latest `items` at actual unmount instead of the
  // stale value from the first render.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  function addFiles(files: File[]) {
    setError(null);
    if (files.length === 0) return;
    const remaining = maxFiles - newCount;
    if (remaining <= 0) {
      setError(`Up to ${maxFiles} new files per save.`);
      return;
    }
    const accepted: ImageItem[] = [];
    for (const file of files) {
      if (accepted.length >= remaining) {
        setError(`Up to ${maxFiles} new files per save.`);
        break;
      }
      if (!accept.includes(file.type as ImageUploadMime)) {
        setError(`Rejected ${file.name}: type ${file.type || 'unknown'} not allowed.`);
        continue;
      }
      if (file.size > maxBytesPerFile) {
        setError(`Rejected ${file.name}: ${formatBytes(file.size)} exceeds limit.`);
        continue;
      }
      accepted.push({ kind: 'new', file, previewUrl: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) onChange([...items, ...accepted]);
  }

  function removeItem(index: number) {
    const target = items[index];
    if (target && target.kind === 'new') URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((_, i) => i !== index));
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (disable) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    addFiles(files);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Label
        htmlFor="image-uploader-input"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-foreground bg-background p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-primary/40',
          disable && 'cursor-not-allowed opacity-50',
        )}
      >
        <p className="font-medium text-foreground">Drop images or click to pick</p>
        <p className="text-xs">{description ?? defaultDescription(accept, maxFiles, maxBytesPerFile)}</p>
        <input
          ref={inputRef}
          id="image-uploader-input"
          type="file"
          multiple
          accept={accept.join(',')}
          name={name}
          disabled={disable}
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </Label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, idx) => (
            <li
              key={item.kind === 'existing' ? item.url : item.previewUrl}
              className="group relative border-2 border-foreground bg-card"
            >
              <img
                src={item.kind === 'existing' ? item.url : item.previewUrl}
                alt={item.kind === 'existing' ? (item.alt ?? '') : item.file.name}
                className="aspect-square w-full object-cover"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                onClick={() => removeItem(idx)}
                disabled={disable}
                aria-label="Remove image"
                className="absolute right-1 top-1"
              >
                <X />
              </Button>
              {item.kind === 'new' ? (
                <span className="absolute bottom-1 left-1 bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-background">
                  New · {formatBytes(item.file.size)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
