# Obiadki (recipe-planner)

Mobilna apka (PWA) do moich przepisów zapisanych w Google Sheets. Pokazuje, co mogę ugotować z tego, co mam w domu,
prowadzi listę dań do ugotowania i sama składa listę zakupów.

- **Przepisy:** wyszukiwarka, filtry (czas, typ, kategoria, „jeszcze nie robione”) i **„Mogę zrobić teraz”**, czyli sortowanie od najmniejszej liczby brakujących składników. Do tego **Losuj** dla dni bez pomysłu.
- **Karta przepisu:** składniki oznaczone jako mam / brak (dotknięcie przełącza), linki do przepisu, „brakujące na listę zakupów”, dodawanie do listy do ugotowania, ocena i notatka.
- **Plan (do ugotowania):** lista dań bez przypisanych dni, z przepisów albo wpisanych jako tekst. Odhaczenie oznacza danie jako ugotowane.
- **Zakupy:** braki do wszystkich dań z listy do ugotowania, pogrupowane według działów, plus pozycje dopisane ręcznie.
- **Spiżarnia:** co mam w domu. Pozycje „zawsze mam” (sól, olej…) nie liczą się jako braki.

Działa offline: dane są zapisane w telefonie, a zmiany czekają w kolejce i wysyłają się po powrocie sieci.

## Architektura

```
iPhone (PWA, GitHub Pages) ──fetch + token──▶ Apps Script web app ──▶ arkusz „Obiadki2”
```

- `src/`: frontend (Vite + Preact + TypeScript, TanStack Query, Tailwind CSS).
  - `model.ts`: czyste funkcje (braki, filtry, lista zakupów). Cały arkusz jest ładowany raz i filtrowany w telefonie.
  - `actions.ts`: zapisy stosowane lokalnie (optymistycznie) i w trybie demo.
  - `data/`: klient Apps Script (`backend.ts`) i TanStack Query (`queryClient.ts`, `sheet.ts`). Dane i niewysłane zmiany są zapisywane w `localStorage` przez persister, więc apka działa offline, a zmiany wysyłają się po kolei po powrocie sieci.
  - `state/`: stan interfejsu (Preact signals): zakładka, filtry, otwarty przepis.
  - `components/`: widoki w Preact.
- `apps-script/Code.gs`: backend przypięty do arkusza. `GET ?action=all` zwraca cały arkusz, a `POST` przyjmuje akcje z `src/actions.ts`.
- Arkusz: zakładki `Main` (przepisy, kolumny rozpoznawane po nagłówkach), `Spiżarnia`, `Plan2` i `Zakupy_extra`.

Adres skryptu i token **nie są w repo**. Wpisuje się je raz w Ustawieniach apki i zostają w pamięci telefonu.

## Wdrożenie backendu (raz)

1. Otwórz arkusz „Obiadki2” → **Rozszerzenia → Apps Script**.
2. Wklej zawartość `apps-script/Code.gs` do `Code.gs` (zastąp całość) i zapisz.
3. Wybierz funkcję `setupToken` → **Uruchom** i zaakceptuj uprawnienia.
   Token zobaczysz w **Dzienniku wykonywania**. Skopiuj go.
4. **Wdróż → Nowe wdrożenie → Aplikacja internetowa**:
   - Wykonuj jako: **Ja**
   - Kto ma dostęp: **Każdy**
5. Skopiuj adres kończący się na `/exec`.
6. Otwórz apkę i wpisz adres oraz token w **Ustawieniach**.

Po zmianie `Code.gs`: **Wdróż → Zarządzaj wdrożeniami → edytuj → Wersja: Nowa wersja**. Adres zostaje ten sam.

Bezpieczeństwo: każdy, kto zna adres **i** token, może czytać i zmieniać przepisy w arkuszu. Nie udostępniaj tokenu.
Żeby go zmienić, uruchom ponownie `setupToken` i wpisz nowy token w apce.

## Instalacja na iPhonie

Otwórz https://pawel-matuszak.github.io/recipe-planner/ w Safari → Udostępnij → **Do ekranu początkowego**.

## Rozwój

```bash
npm install
npm run dev:mock   # apka na przykładowych danych, bez arkusza
npm run dev        # apka z prawdziwym arkuszem (adres i token w Ustawieniach)
npm test           # testy modelu, akcji, synchronizacji i widoków (vitest)
npm run build      # build produkcyjny do dist/
npm run icons      # wygeneruj ikony PWA do public/icons
```

Push do `main` uruchamia testy, build i deploy na GitHub Pages (`.github/workflows/deploy.yml`).
W ustawieniach repo: **Settings → Pages → Source: GitHub Actions**.
