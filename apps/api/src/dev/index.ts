// Dev-only helpers. Mounted only when NODE_ENV !== 'production'.
//
// See routes.ts for the security model — the handler itself also
// re-checks NODE_ENV as defense in depth.

export { devRoutes } from './routes';