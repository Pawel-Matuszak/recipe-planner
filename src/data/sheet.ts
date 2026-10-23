// Hooks the components use: the model, writes, sync status and switching the data source.
import { useIsMutating, useMutation, useMutationState, useQuery, type QueryClient } from "@tanstack/react-query";
import type { Action } from "../actions";
import { buildModel, type Model, type Recipe } from "../model";
import { toast } from "../state/toast";
import { config, DEMO_URL, errorMessage, SERVER_URL, setConfig } from "./backend";
import { persister, resumeWrites, SHEET, stateKey } from "./queryClient";
import { store } from "./storage";

export function useSheet() {
  const c = config.value;
  return useQuery({ queryKey: c ? stateKey(c) : ["all", "", ""], enabled: !!c, select: buildModel });
}

/** The current model, or null while nothing is loaded yet. */
export const useModel = (): Model | null => useSheet().data ?? null;

export function useRecipe(id: string | null): Recipe | undefined {
  const m = useModel();
  return id ? m?.recipes.find(r => r.id === id) : undefined;
}

/** Optimistic write: shows up immediately, survives reloads, reaches the server when it can. */
export function useAct() {
  const { mutate } = useMutation<void, Error, Action>({ mutationKey: SHEET });
  return mutate;
}

export interface SyncStatus {
  kind: "setup" | "connecting" | "busy" | "ok" | "error";
  hasData: boolean;
  demo: boolean;
  pending: number;
  message: string; // shown in the banner
}

export function useSyncStatus(): SyncStatus {
  const q = useSheet();
  const pending = useIsMutating({ mutationKey: SHEET });
  const writeErrors = useMutationState({ filters: { mutationKey: SHEET, status: "pending" }, select: m => m.state.failureReason });
  const c = config.value;
  const hasData = !!q.data;
  let kind: SyncStatus["kind"] = "connecting";
  if (!c) kind = "setup";
  else if (q.isFetching) kind = "busy";
  else if (q.isError) kind = "error";
  else if (q.isSuccess) kind = "ok";
  const writeError = writeErrors.find(Boolean);
  const message = q.isError && !q.isFetching
    ? errorMessage(q.error, "Nie udało się pobrać danych.")
    : writeError ? errorMessage(writeError, "") : "";
  return { kind, hasData, demo: c?.url === DEMO_URL, pending, message };
}

export async function refresh(qc: QueryClient, manual: boolean) {
  const c = config.value;
  if (!c) return;
  void qc.resumePausedMutations();
  void resumeWrites(qc);
  await qc.refetchQueries({ queryKey: stateKey(c) });
  if (manual && qc.getQueryState(stateKey(c))?.status === "success") toast("Odświeżono");
}

/** Drops everything tied to the previous data source (cached data and unsent writes). */
function resetData(qc: QueryClient) {
  qc.getMutationCache().clear();
  qc.clear();
}

/** Switches to the signed-in user's household. Keeps cached data and queued writes when it is the same household. */
export function connectServer(qc: QueryClient, household: string) {
  const c = config.value;
  if (c?.url === SERVER_URL && c.household === household) return void refresh(qc, false);
  resetData(qc);
  setConfig({ url: SERVER_URL, household });
}

export function connectDemo(qc: QueryClient) {
  if (config.value?.url !== DEMO_URL) resetData(qc);
  setConfig({ url: DEMO_URL });
}

/** Forgets the data source and everything stored on the phone (after signing out or leaving the household). */
export function forget(qc: QueryClient) {
  resetData(qc);
  void persister.removeClient();
  store.clear();
  setConfig(null);
}
