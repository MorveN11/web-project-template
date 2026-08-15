/**
 * schema.org JSON-LD estructurado para la home page.
 *
 * Renderiza UN `<script type="application/ld+json">` con `@graph` que
 * contiene `WebSite` + `LocalBusiness` en el mismo documento. Single-graph
 * layout garantiza que las referencias `@id` (`#website`, `#organization`)
 * se resuelvan siempre — sin depender de que Google parsee varios scripts
 * y conecte IDs entre ellos.
 *
 * - `WebSite.name` debe coincidir con el App name declarado en Google Cloud
 *   Console → OAuth consent screen (ver `BRAND.shortName`).
 * - `alternateName` / `legalName` cubren el nombre completo del footer
 *   para que el brand check de Google no reporte "no coincide".
 * - Sanitización: `<` → `<` per Next.js docs para prevenir XSS.
 * - `#organization` lo declara `LocalBusiness` y lo referencian
 *   `WebSite.publisher` / `copyrightHolder` / `creator`.
 * - `#website` lo declara `WebSite` y se usa como `@id` canónico.
 */
import type { Graph, LocalBusiness, SearchAction, WebSite, WithContext } from 'schema-dts';
import { ADDRESS, BRAND, EMAIL, PHONE, SOCIAL } from '@/lib/contact';
import { env } from '@/lib/env/client';

const SITE_LD_TYPE = 'application/ld+json' as const;

// `query-input` is in schema.org but schema-dts v2 doesn't expose it.
// Type-extend so we keep compile-time safety on the rest of the object.
type SearchActionWithQueryInput = SearchAction & { 'query-input': string };

function searchActionWithQueryInput(url: string): SearchActionWithQueryInput {
  return {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${url}/buscar?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  };
}

function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
}

function escapeScript(value: object): string {
  // Per Next.js docs: scrub `<` to prevent HTML injection from JSON-LD payloads.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function getWebsiteLd(): WithContext<WebSite> {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    name: BRAND.shortName,
    alternateName: BRAND.name,
    url,
    inLanguage: 'es-BO',
    description: BRAND.description,
    publisher: { '@id': `${url}/#organization` },
    copyrightHolder: { '@id': `${url}/#organization` },
    creator: { '@id': `${url}/#organization` },
    // SearchAction — habilita el sitelinks searchbox en SERP de Google.
    // Apunta al endpoint `/buscar?q=...`. Hoy es placeholder; Google solo
    // muestra la search box cuando el URL resuelve.
    potentialAction: searchActionWithQueryInput(url),
  };
}

export function getOrganizationLd(): WithContext<LocalBusiness> {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}/#organization`,
    name: BRAND.shortName,
    legalName: BRAND.name,
    url,
    logo: `${url}${BRAND.logo.mark}`,
    image: `${url}${BRAND.logo.rounded}`,
    email: EMAIL,
    telephone: PHONE.tel,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ADDRESS.street,
      addressLocality: ADDRESS.city,
      addressRegion: ADDRESS.region,
      postalCode: ADDRESS.postalCode,
      addressCountry: ADDRESS.countryCode,
    },
    sameAs: [SOCIAL.facebook, SOCIAL.instagram, SOCIAL.linkedin],
  };
}

export function getHomeGraphLd(): Graph {
  return {
    '@context': 'https://schema.org',
    '@graph': [getWebsiteLd(), getOrganizationLd()],
  };
}

export function HomeStructuredData(): React.JSX.Element {
  const graph = getHomeGraphLd();
  return (
    <script
      type={SITE_LD_TYPE}
      // JSON-LD is the documented Next.js pattern — `dangerouslySetInnerHTML`
      // is the only way to embed a JSON object literal as a child.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: escapeScript(graph) }}
    />
  );
}
