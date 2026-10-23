// TanStack Query setup: one query holds the household's whole state; every write is an optimistic, persisted, ordered mutation.
import { QueryClient, type Mutation } from "@tanstack/react-query";

type AnyMutation = Mutation<unknown, Error, unknown, unknown>;
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { applyAction, cloneState, type Action } from "../actions";
import type { State } from "../model";
import { toast } from "../state/toast";
import { backendFor, config, errorMessage, isTransient, type Config } from "./backend";
import { KEYS } from "./storage";

export const SHEET = ["sheet"] as const;
export const stateKey = (c: Config) => ["all", c.url, c.household ?? ""] as const;

const isPendingWrite = (m: AnyMutation) => m.state.status === "pending" && m.options.mutationKey?.[0] === SHEET[0];

/** Writes that haven't reached the server yet, oldest first. */
export const pendingActions = (qc: QueryClient) =>
  qc.getMutationCache().getAll().filter(isPendingWrite).map(m => m.state.variables as Action);

export function createQueryClient(): QueryClient {
  const qc: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        gcTime: Infinity,
        staleTime: 60_000,
        retry: 1,
        queryFn: async ({ queryKey }) => {
          const c = config.value;
          if (!c || c.url !== queryKey[1] || (c.household ?? "") !== queryKey[2]) throw new Error("stale connection");
          const fresh = await backendFor(c).all();
          // keep local changes that haven't reached the server yet
          const merged = cloneState(fresh);
          pendingActions(qc).forEach(a => applyAction(merged, a));
          return merged;
        },
      },
    },
  });

  // Defaults (not per-call options) so writes restored from storage after a reload can still run.
  qc.setMutationDefaults(SHEET, {
    scope: { id: "sheet" }, // one at a time, in order
    mutationFn: async (a: Action) => {
      const c = config.value;
      if (!c) throw new Error("no connection");
      await backendFor(c).send(a);
    },
    onMutate: async (a: Action) => {
      const c = config.value;
      if (!c) return;
      await qc.cancelQueries({ queryKey: ["all"] });
      qc.setQueryData<State>(stateKey(c), t => {
        if (!t) return t;
        const next = cloneState(t);
        applyAction(next, a);
        return next;
      });
    },
    retry: (_n, e) => isTransient(e),
    retryDelay: n => Math.min(1000 * 2 ** n, 30_000),
    onError: e => {
      if (isTransient(e)) return;
      toast(`${errorMessage(e, "Serwer odrzucił zmianę.")} Odświeżam dane.`);
      void qc.invalidateQueries({ queryKey: ["all"] });
    },
    onSettled: () => {
      // reconcile with the server once, after the last queued write, instead of after every tap
      if (qc.isMutating({ mutationKey: SHEET }) === 1) void qc.invalidateQueries({ queryKey: ["all"] });
    },
  });
  return qc;
}

export const persister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: KEYS.cache,
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: Infinity,
  buster: "3", // 3: database backend (cached sheet rows and their queued writes no longer fit)
  // keep every unsent write, including ones stuck retrying (default keeps only paused ones)
  dehydrateOptions: { shouldDehydrateMutation: (m: AnyMutation) => isPendingWrite(m) },
};

/** Restored writes come back as "pending"; continue them in their original order. */
export function resumeWrites(qc: QueryClient) {
  return Promise.all(qc.getMutationCache().getAll().filter(isPendingWrite).map(m => m.continue().catch(() => undefined)));
}
