// Centralized brand metadata. Single source of truth for the app's
// identity across layout metadata, PWA manifest, robots.txt and
// JSON-LD structured data. Forks override the placeholder values.

export const BRAND = {
  shortName: '<your-app-name>',
  name: '<your-app-name>',
  description: '<one-sentence description>',
  logo: {
    mark: '/logo-mark.webp',
    rounded: '/logo-rounded.webp',
  },
} as const;
