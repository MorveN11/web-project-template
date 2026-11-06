import type { ReactNode } from 'react';

// Top-level chrome switcher. Renders whatever chrome (navbar, footer,
// admin sidebar) wraps the page tree, decided once per route. Lives
// in `components/` (not `app/`) per the component-location convention
// — `app/` should hold route files only.
//
// The default implementation just renders children. Forks that need
// route-aware chrome branch on `usePathname()` here, then mount their
// own `<Navbar>` / `<Footer>` / `<AdminSidebar>` accordingly. Keeping
// the gate dumb means there's nothing to override when a fork ships
// no chrome: `app/layout.tsx` still mounts `<ChromeGate>`.

interface Props {
  children: ReactNode;
}

export function ChromeGate({ children }: Props) {
  return <>{children}</>;
}
