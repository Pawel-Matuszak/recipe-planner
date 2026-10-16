import { useQueryClient } from "@tanstack/preact-query";
import { useState } from "preact/hooks";
import { config, DEMO_URL } from "../data/backend";
import { connect, connectDemo, forget, useSyncStatus } from "../data/sheet";
import { toast } from "../state/toast";
import { settingsOpen } from "../state/ui";

export function SettingsSheet() {
  const qc = useQueryClient();
  const s = useSyncStatus();
  const c = config.value;
  const first = !c;
  const real = c && c.url !== DEMO_URL ? c : null;
  const [msg, setMsg] = useState(s.kind === "error" ? s.message : "");

  const submit = async (e: Event) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    const url = (f.elements.namedItem("url") as HTMLInputElement).value.trim();
    const token = (f.elements.namedItem("token") as HTMLInputElement).value.trim();
    setMsg("Sprawdzam połączenie…");
    try {
      await connect(qc, { url, token });
      settingsOpen.value = false;
      toast("Połączono z arkuszem");
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <div class="wrap pt-3 pb-10">
      <div class="sticky top-0 z-[2] flex min-h-14 items-center bg-bg py-2">
        {!first && <button class="btn ghost" onClick={() => (settingsOpen.value = false)}>‹ Wróć</button>}
      </div>
      <h2>{first ? "Połącz z arkuszem" : "Ustawienia"}</h2>
      <p class="mt-2 mb-4 max-w-[60ch] text-muted">Apka czyta i zapisuje Twój arkusz „Obiadki2” przez skrypt Apps Script. Adres i token dostaniesz po wdrożeniu skryptu (instrukcja w README repozytorium).</p>
      <form class="panel" onSubmit={submit}>
        <label class="text-[.85rem] font-bold" for="cfgUrl">Adres wdrożenia (kończy się na /exec)</label>
        <input class="field" id="cfgUrl" name="url" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" defaultValue={real?.url ?? ""} required autocomplete="off" />
        <label class="text-[.85rem] font-bold" for="cfgToken">Token</label>
        <input class="field" id="cfgToken" name="token" type="password" placeholder="API_TOKEN ze skryptu" defaultValue={real?.token ?? ""} required autocomplete="off" />
        <button class="btn primary" type="submit">Zapisz i połącz</button>
        <p class="m-0 min-h-[1.3em] text-[.9rem] text-paprika" role="status">{msg}</p>
      </form>
      <div class="section">
        <h3>Bez arkusza</h3>
        <button class="btn" onClick={() => { connectDemo(qc); settingsOpen.value = false; }}>Wypróbuj na przykładowych danych</button>
        {s.demo && <p class="count">Działa tryb demo. Zmiany znikną po odświeżeniu strony.</p>}
      </div>
      {!first && (
        <div class="section">
          <h3>Pamięć telefonu</h3>
          <button class="btn ghost" onClick={() => { forget(qc); settingsOpen.value = false; }}>Zapomnij adres, token i zapisane dane</button>
        </div>
      )}
    </div>
  );
}
