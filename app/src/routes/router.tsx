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
          <Link to="/" className="hover:opacity-80 transition-opacity">
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
  path: "/decompile/$network/$packageId",
  component: DecompilePage,
});

const routeTree = rootRoute.addChildren([homeRoute, decompileRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
