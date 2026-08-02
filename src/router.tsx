import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { BrandLogo } from "./components/BrandLogo";

/** Branded loading screen shown while routes resolve. */
function BrandLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <BrandLogo tagline className="animate-pulse" markClassName="h-9 w-9" />
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: BrandLoading,
  });

  return router;
};

  return router;
};
