import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, clearAccount, useHouseholdOp, useMe, type Household, type Invite } from "../data/account";
import { toast } from "../state/toast";

const value = (e: FormEvent, name: string) => ((e.currentTarget as HTMLFormElement).elements.namedItem(name) as HTMLInputElement).value.trim();

function SignInForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const email = value(e, "email"), password = value(e, "password");
    const { error } = mode === "in"
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: value(e, "name") });
    setBusy(false);
    if (error) setMsg(error.status === 401 ? "Zły e-mail albo hasło." : error.message || "Nie udało się. Spróbuj ponownie.");
    else toast(mode === "in" ? "Zalogowano" : "Konto założone");
  };

  return (
    <form className="panel" onSubmit={submit} aria-label={mode === "in" ? "Logowanie" : "Zakładanie konta"}>
      <div className="row" role="group" aria-label="Rodzaj">
        <button type="button" className="chip" aria-pressed={mode === "in"} onClick={() => setMode("in")}>Mam konto</button>
        <button type="button" className="chip" aria-pressed={mode === "up"} onClick={() => setMode("up")}>Nowe konto</button>
      </div>
      {mode === "up" && (
        <>
          <label className="text-[.85rem] font-bold" htmlFor="accName">Imię</label>
          <input className="field" id="accName" name="name" required autoComplete="name" />
        </>
      )}
      <label className="text-[.85rem] font-bold" htmlFor="accEmail">E-mail</label>
      <input className="field" id="accEmail" name="email" type="email" required autoComplete="email" />
      <label className="text-[.85rem] font-bold" htmlFor="accPass">Hasło{mode === "up" && " (min. 8 znaków)"}</label>
      <input className="field" id="accPass" name="password" type="password" required minLength={8}
        autoComplete={mode === "in" ? "current-password" : "new-password"} />
      <button className="btn primary" type="submit" disabled={busy}>{mode === "in" ? "Zaloguj się" : "Załóż konto"}</button>
      <p className="m-0 min-h-[1.3em] text-[.9rem] text-paprika" role="status">{msg}</p>
    </form>
  );
}

function NoHousehold() {
  const op = useHouseholdOp();
  return (
    <>
      <form className="panel" onSubmit={e => { e.preventDefault(); op.mutate({ op: "create", name: value(e, "hhName") }); }}>
        <label className="text-[.85rem] font-bold" htmlFor="hhName">Nowe gospodarstwo</label>
        <input className="field" id="hhName" name="hhName" placeholder="np. Dom" required maxLength={80} />
        <button className="btn primary" type="submit" disabled={op.isPending}>Utwórz</button>
      </form>
      <form className="panel" onSubmit={e => { e.preventDefault(); op.mutate({ op: "join", code: value(e, "hhCode") }); }}>
        <label className="text-[.85rem] font-bold" htmlFor="hhCode">Kod zaproszenia od domownika</label>
        <input className="field" id="hhCode" name="hhCode" placeholder="XXXX-XXXX" required maxLength={20} autoComplete="off" autoCapitalize="characters" />
        <button className="btn" type="submit" disabled={op.isPending}>Dołącz</button>
      </form>
      {op.error && <p className="m-0 text-[.9rem] text-paprika" role="status">{op.error.message}</p>}
    </>
  );
}

function HouseholdPanel({ h, onLeft }: { h: Household; onLeft: () => void }) {
  const op = useHouseholdOp();
  const [invite, setInvite] = useState<Invite | null>(null);
  const makeInvite = () => op.mutate({ op: "invite" }, { onSuccess: r => setInvite(r as Invite) });
  const leave = () => {
    const last = h.members.length === 1;
    if (confirm(last ? `Jesteś ostatnią osobą w „${h.name}”. Gospodarstwo zostanie usunięte razem ze spiżarnią i planem. Kontynuować?` : `Opuścić „${h.name}”?`)) {
      op.mutate({ op: "leave" }, { onSuccess: onLeft });
    }
  };
  return (
    <div className="panel">
      <strong>{h.name}</strong>
      <ul className="m-0 grid list-none gap-1 p-0">
        {h.members.map(m => (
          <li key={m.id} className="flex items-center justify-between gap-2">
            <span>{m.name} <span className="text-[.85rem] text-muted">{m.email}</span></span>
            {m.role === "owner" && <span className="badge b-ok">właściciel</span>}
          </li>
        ))}
      </ul>
      <button className="btn" onClick={makeInvite} disabled={op.isPending}>Zaproś domownika</button>
      {invite && (
        <p className="m-0" role="status">
          Kod: <strong className="font-display text-[1.2rem] tracking-wider">{invite.code}</strong>
          <span className="block text-[.85rem] text-muted">Ważny do {new Date(invite.expiresAt).toLocaleDateString("pl-PL")}. Domownik wpisuje go w Ustawieniach po założeniu konta.</span>
        </p>
      )}
      <button className="btn ghost" onClick={leave} disabled={op.isPending}>Opuść gospodarstwo</button>
      {op.error && <p className="m-0 text-[.9rem] text-paprika" role="status">{op.error.message}</p>}
    </div>
  );
}

interface Props {
  /** The signed-in user's household (null: signed in without one), each time it is loaded. */
  onHousehold: (h: Household | null) => void;
  /** After signing out or leaving the household: the data on the phone belongs to someone else now. */
  onGone: () => void;
  /** Writes that haven't reached the server; signing out drops them. */
  pending: number;
}

/** "Konto": sign in/up, then create or join a household and invite others. */
export function AccountSection({ onHousehold, onGone, pending }: Props) {
  const qc = useQueryClient();
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const [signingOut, setSigningOut] = useState(false);
  const me = useMe(signedIn && !signingOut); // paused while signing out, so it doesn't refetch with a dead session
  useEffect(() => { if (!signedIn) setSigningOut(false); }, [signedIn]);
  const household = me.data ? me.data.household : undefined;
  // report once per loaded household (id), "none" (null), or nothing yet (undefined)
  const householdKey = household === undefined ? undefined : household?.id ?? null;
  useEffect(() => { if (household !== undefined) onHousehold(household); }, [householdKey]);

  const signOut = async () => {
    if (pending && !confirm(`${pending} zmian nie dotarło jeszcze na serwer i przepadnie. Wylogować mimo to?`)) return;
    setSigningOut(true);
    await authClient.signOut();
    clearAccount(qc);
    onGone();
    toast("Wylogowano");
  };

  return (
    <div className="section">
      <h3>Konto</h3>
      {session.isPending ? <p className="count">Sprawdzam…</p> : !signedIn ? <SignInForm /> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {session.data!.user.name} <span className="text-[.85rem] text-muted">{session.data!.user.email}</span>
              {me.data?.user.role === "admin" && <span className="badge b-warn ml-2">admin</span>}
            </span>
            <button className="btn ghost" onClick={() => void signOut()}>Wyloguj</button>
          </div>
          {me.isPending ? <p className="count">Wczytuję gospodarstwo…</p>
            : me.error ? <p className="text-[.9rem] text-paprika">{me.error.message}</p>
            : me.data?.household ? <HouseholdPanel h={me.data.household} onLeft={onGone} /> : <NoHousehold />}
        </>
      )}
    </div>
  );
}
