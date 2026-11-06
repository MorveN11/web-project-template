// URL-building utilities used across the web app.
//
// `toQueryString` is the canonical way to turn a flat params object
// into a `?key=value&...` tail. It skips `undefined` and empty-string
// values, and stringifies every other value (`true` → `"true"`, `0` →
// `"0"`). Empty input yields `""`. Used by every service method that
// hits a paginated / filtered GET endpoint.
//
// `hrefWithQuery` wraps it for `<a href>` builders that need the
// full `path?qs` shape with the `?` separator only when there are
// params.
//
// Both helpers are pure functions of their inputs and safe to call
// from server components, client components, and server actions
// alike — they do not touch `window`, `location`, or any other
// browser-only API.

/// Build a `?key=value&...` query string from a flat params object.
/// Skips `undefined` and empty-string values. Empty input returns
/// `""` (no leading `?`).
export function toQueryString(params: object): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/// Build a full href: `${basePath}${toQueryString(params)}`.
/// Returns `basePath` unchanged when params is empty / undefined.
export function hrefWithQuery(basePath: string, params: object | undefined): string {
  if (!params) return basePath;
  return `${basePath}${toQueryString(params)}`;
}
