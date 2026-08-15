// Centralized brand + contact metadata. Single source of truth for
// the app's identity across layout metadata, JSON-LD structured data
// and marketing copy. Forks override the placeholder values with their
// own business info.

import { BRAND as BRAND_BASE } from '@/lib/brand';

// Re-export so callers can `import { BRAND } from '@/lib/contact'`
// and get the full brand + contact object together.
export const BRAND = BRAND_BASE;

export const ADDRESS = {
  street: '<your-street-address>',
  city: '<your-city>',
  region: '<your-region>',
  postalCode: '<your-postal-code>',
  country: '<your-country>',
  countryCode: '<ISO-3166-1-alpha-2>',
} as const;

export const EMAIL = '<your-support-email>';

export const PHONE = {
  display: '<your-display-phone>',
  tel: '<+E164>',
} as const;

export const CHANNELS = {
  whatsapp: '<+E164>',
  facebook: '<facebook-handle>',
  instagram: '<instagram-handle>',
  linkedin: '<linkedin-url>',
} as const;

export const SOCIAL = {
  facebook: 'https://facebook.com/<your-handle>',
  instagram: 'https://instagram.com/<your-handle>',
  linkedin: 'https://linkedin.com/company/<your-handle>',
} as const;

export function mailtoLink(): string {
  return `mailto:${EMAIL}`;
}

export function whatsappLink(message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${CHANNELS.whatsapp.replace(/[^\d]/g, '')}?text=${text}`;
}

export function whatsappLinkContextual(context: string): string {
  return whatsappLink(`Hola, te escribo desde ${BRAND.shortName}: ${context}`);
}
