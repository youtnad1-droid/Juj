import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { RootData } from "@/lib/queries";

const root = getRouteApi("__root__");

export function useAuth() {
  const { session } = root.useLoaderData() as RootData;
  return { user: session.user, ready: true };
}

export function useRootData() {
  return root.useLoaderData() as RootData;
}

/** Re-reads the cookie session after login/logout. */
export function useRefreshSession() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    qc.removeQueries({ queryKey: ["session"] });
    qc.removeQueries({ queryKey: ["favorites"] });
    await router.invalidate();
  };
}
