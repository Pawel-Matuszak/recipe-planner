import { useSignals } from "@preact/signals-react/runtime";
import { useQueryClient } from "@tanstack/react-query";
import type { Household } from "../data/account";
import { config, DEMO_URL, SERVER_URL } from "../data/backend";
import { connectDemo, connectServer, forget, useSyncStatus } from "../data/sheet";
import { settingsOpen } from "../state/ui";
import { AccountSection } from "./AccountSection";

export function SettingsSheet() {
  useSignals();
  const qc = useQueryClient();
  const s = useSyncStatus();
  const c = config.value;
  const first = !c;

  // signed in with a household: use it (instead of nothing or the demo), or follow a household switch made elsewhere
  const onHousehold = (h: Household | null) => {
    const cur = config.value;
    if (h && (cur?.url !== SERVER_URL || cur.household !== h.id)) {
      connectServer(qc, h.id);
      settingsOpen.value = false;
    } else if (h && cur?.url === SERVER_URL) {
      connectServer(qc, h.id); // same household: just resend queued writes and refresh (e.g. after signing in again)
    } else if (!h && cur?.url === SERVER_URL) {
      forget(qc);
    }
  };
  const onGone = () => { if (config.value?.url === SERVER_URL) forget(qc); };

  return (
    <div className="wrap pt-3 pb-10">
      <div className="sticky top-0 z-[2] flex min-h-14 items-center bg-bg py-2">
        {!first && <button className="btn ghost" onClick={() => (settingsOpen.value = false)}>‹ Wróć</button>}
      </div>
      <h2>{first ? "Witaj w Obiadkach" : "Ustawienia"}</h2>
      {first && <p className="mt-2 max-w-[60ch] text-muted">Zaloguj się, żeby zobaczyć przepisy, spiżarnię i listę zakupów swojego gospodarstwa. Domownicy dzielą jedną spiżarnię i plan.</p>}
      <AccountSection onHousehold={onHousehold} onGone={onGone} pending={s.pending} />
      {c?.url === DEMO_URL && <p className="count">Teraz działa tryb demo. Zaloguj się, żeby przełączyć się na swoje gospodarstwo.</p>}
      <div className="section">
        <h3>Bez konta</h3>
        <button className="btn" onClick={() => { connectDemo(qc); settingsOpen.value = false; }}>Wypróbuj na przykładowych danych</button>
        {s.demo && <p className="count">Zmiany w trybie demo znikną po odświeżeniu strony.</p>}
      </div>
      {!first && (
        <div className="section">
          <h3>Pamięć telefonu</h3>
          <button className="btn ghost" onClick={() => { forget(qc); settingsOpen.value = false; }}>Wyczyść zapisane dane</button>
        </div>
      )}
    </div>
  );
}
