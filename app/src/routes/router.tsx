import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { HomePage } from "./home";
import { DecompilePage } from "./decompile";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b px-6 py-4">
        <div className="mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <h1 className="text-lg font-semibold tracking-tight">
              Move Decompiler
            </h1>
            <Badge variant="secondary" className="font-mono text-[10px]">
              WASM
            </Badge>
          </Link>
          <a
            href="https://github.com/unconfirmedlabs/move-decompiler-zig"
            target="_blank"
            rel="noopener"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
  path: "/decompile/$packageId",
  component: DecompilePage,
});

const routeTree = rootRoute.addChildren([homeRoute, decompileRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
