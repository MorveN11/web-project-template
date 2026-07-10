// `health` feature — liveness/readiness probe. No auth.
//
// File layout:
//   routes.ts       Single GET that reports service status + DB reach.
//                   DB failure never throws — only flips `status` to
//                   `degraded` so the docker healthcheck still gets a
//                   200 with a degraded flag.
//
// Public surface: `healthRoutes` (mounted at `/health` by `src/index.ts`).
export { healthRoutes } from './routes';