import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { HomePage } from "./home";
import { DecompilePage } from "./decompile";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b px-6 py-4">
        <div className="mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="size-6 rounded-md">
              <rect width="32" height="32" fill="currentColor" className="text-foreground" />
              <circle cx="8" cy="16" r="3.5" className="fill-background" />
              <circle cx="16" cy="16" r="3.5" className="fill-background" />
              <circle cx="24" cy="16" r="3.5" className="fill-background" />
            </svg>
            <h1 className="text-lg font-semibold tracking-tight">
              Move Decompiler
            </h1>
          </Link>
          <a
            href="https://github.com/unconfirmedlabs/move-decompiler-zig"
            target="_blank"
            rel="noopener"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const decompileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/d/$packageId",
  validateSearch: (search: Record<string, unknown>) => ({
    network: (search.network as string) || undefined,
  }),
  component: DecompilePage,
});

const routeTree = rootRoute.addChildren([homeRoute, decompileRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
