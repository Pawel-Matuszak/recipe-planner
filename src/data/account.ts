// Account and household: Better Auth on the client, plus the /api/household endpoint.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [adminClient()] });

export interface Member { id: string; name: string; email: string; role: "owner" | "member" }
export interface Household { id: string; name: string; role: "owner" | "member"; members: Member[] }
export interface Me { user: { id: string; name: string; email: string; role: string }; household: Household | null }
export interface Invite { code: string; expiresAt: string }

export type HouseholdOp = { op: "create"; name: string } | { op: "invite" } | { op: "join"; code: string } | { op: "leave" };

const HOUSEHOLD = ["household"] as const;

async function api<T>(init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/household", { credentials: "include", ...init });
  } catch {
    throw new Error("Brak połączenia z internetem.");
  }
  const body = await res.json().catch(() => ({ message: `Serwer odpowiedział kodem ${res.status}.` }));
  if (!res.ok || body.error) throw new Error(body.message ?? "Coś poszło nie tak.");
  return body.result as T;
}

export function useMe(signedIn: boolean) {
  // staleTime 0: the persisted copy shows instantly (also offline), but role and members are refetched on every open
  return useQuery({ queryKey: HOUSEHOLD, queryFn: () => api<Me>(), enabled: signedIn, retry: false, staleTime: 0 });
}

/** Household changes go straight to the server (they need a connection), then refresh `useMe`. */
export function useHouseholdOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op: HouseholdOp) => api<Household | Invite | null>({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op) }),
    onSuccess: (_r, op) => { if (op.op !== "invite") void qc.invalidateQueries({ queryKey: HOUSEHOLD }); },
  });
}

export function clearAccount(qc: ReturnType<typeof useQueryClient>) {
  qc.removeQueries({ queryKey: HOUSEHOLD });
}
