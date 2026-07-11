// Auth-related URLs that the actions module redirects to. Kept in a
// separate file so feature-specific code can import them without
// pulling the whole auth surface.

export const REDIRECT_URL = '/auth/iniciar-sesion';
// Destination when a user signs in but their role hasn't been set
// yet (e.g. webhook race, migration glitch, Clerk BAPI outage). Devs
// manually resolve these by setting the role via the api admin
// endpoint or the Clerk dashboard.
export const ROLE_ERROR_URL = '/auth/error-rol';
