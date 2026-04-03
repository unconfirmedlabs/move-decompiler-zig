import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { Header } from "@/components/header";
import { HomePage } from "./home";
import { DecompilePage } from "./decompile";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-svh flex-col overflow-hidden">
      <Header />
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const searchSchema = {
  validateSearch: (search: Record<string, unknown>) => ({
    network: (search.network as string) || undefined,
  }),
};

const decompileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/d/$packageId",
  ...searchSchema,
  component: DecompilePage,
});

const decompileModuleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/d/$packageId/$moduleName",
  ...searchSchema,
  component: DecompilePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  decompileRoute,
  decompileModuleRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
