// Extract scalar string fields from a FormData and validate them
// against a multipart zod schema. Skips File entries (those are
// handled by `ImageUploader` client-side; the api reads them
// directly from `c.req.parseBody()`). Repeated form fields of the
// same name (e.g. `keepImageUrls` for selective gallery updates)
// are collected into arrays so zod's `z.array(...)` schemas accept
// them. Throws on the first issue so `safeAction` surfaces the
// message via `result.error.message`.

import type { z } from 'zod';
import { badRequestError, type SafeActionError, type SafeActionResult } from '@/lib/safe-action';
import { firstZodMessage } from '@/lib/zod-error';

// Flatten a record of scalar form values into a FormData, skipping
// `undefined`/`null` so they don't arrive at the api as the string
// "undefined"/"null". Files and arrays (e.g. `keepImageUrls`) are
// appended by the caller after this returns.
export function valuesToFormData(values: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    data.append(key, String(value));
  }
  return data;
}

export function parseMultipartPayload<T>(formData: FormData, schema: z.ZodType<T>): T {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue; // skip File entries
    const decoded = decodeJsonIfStructured(value);
    const existing = payload[key];
    if (existing === undefined) {
      payload[key] = decoded;
    } else if (Array.isArray(existing) && Array.isArray(decoded)) {
      existing.push(...decoded);
    } else if (Array.isArray(existing)) {
      existing.push(decoded);
    } else if (Array.isArray(decoded)) {
      payload[key] = [existing, ...decoded];
    } else {
      payload[key] = [existing, decoded];
    }
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  return parsed.data;
}

/// `parseMultipartPayload` throws on a zod issue; unwrapped it escapes
/// the server action as a 500 instead of a form error. Returns the
/// error envelope the action should bail with, or `null` when the
/// payload is valid.
export function validateMultipart<T>(formData: FormData, schema: z.ZodType<T>): SafeActionResult<never> | null {
  try {
    parseMultipartPayload(formData, schema);
    return null;
  } catch (e) {
    const error: SafeActionError = badRequestError(e instanceof Error ? e.message : 'Invalid form data.');
    return { ok: false, error };
  }
}

/// Decode a single string value into an array/object when it's a
/// JSON-encoded payload — the form may serialize arrays (e.g.
/// `keepImageUrls`) as a single JSON-stringified field instead of
/// repeating the key. The heuristic requires a JSON-structural
/// character (`"` — every JSON string is quoted) so plain text
/// inputs that happen to start with `[` or `{` (e.g. a description
/// like "[Featured]") are never mangled into arrays/objects.
/// Exception: `[]` / `{}` carry no quotes but are unambiguous — an
/// empty gallery must decode to `[]`, not to the string "[]".
function decodeJsonIfStructured(value: string): unknown {
  if (value.indexOf('"') === -1 && value !== '[]' && value !== '{}') return value;
  const first = value[0];
  if (first !== '[' && first !== '{') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) return parsed;
  } catch {
    // not JSON — keep as string
  }
  return value;
}
