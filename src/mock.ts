// Example data for demo mode (`npm run dev:mock`, or "Wypróbuj na przykładowych danych" in Settings).
import { iso, type Tables } from "./model";

const H = ["Obrazek", "Nazwa", "Typ", "Trudność", "Było robione?", "Link", "Kategoria 1", "Kateogria 2", "Archived", "ID", "Czas (min)", "Składniki", "Składniki sprawdzone", "Ocena", "Notatki"];
const r = (id: string, name: string, typ: string, diff: string, done: boolean, link: string, k1: string, k2: string, czas: number, ing: string, rate = "") =>
  ["", name, typ, diff, done ? "TRUE" : "FALSE", link, k1, k2, "FALSE", id, String(czas), ing, "FALSE", rate, ""];

export function demoTables(): Tables {
  const today = iso(new Date());
  return {
    main: [
      H,
      r("r001", "Carbonara", "Danie główne", "Średni", true, "https://www.youtube.com/watch?v=qoHnwOHLiMk", "Makaron", "", 20, "makaron; boczek; jajka; parmezan; pieprz", "5"),
      r("r002", "Leczo", "Danie główne", "Łatwy", true, "https://aniagotuje.pl/przepis/leczo-z-kielbasa-i-cukinia", "Mięso", "Warzywa", 60, "kiełbasa; cukinia; papryka; cebula; pomidory; koncentrat pomidorowy; olej"),
      r("r003", "Pasta rosa", "Danie główne", "Łatwy", true, "https://cookingmydreams.com/penne-rosa-pink-pasta-sauce/", "Makaron", "Wegetariańskie", 30, "makaron; passata pomidorowa; śmietanka 30%; cebula; czosnek; oliwa; parmezan"),
      r("r004", "Szakszuka", "Śniadanie", "Łatwy", true, "", "Jajka", "Wegetariańskie", 25, "jajka; pomidory z puszki; papryka; cebula; czosnek; feta"),
      r("r005", "Chili con carne", "Danie główne", "Łatwy", false, "", "Mięso", "Ryż", 60, "mięso mielone; fasola czerwona; pomidory z puszki; cebula; czosnek; papryka; ryż"),
      r("r006", "Egg fried rice", "Danie główne", "Łatwy", false, "", "Ryż", "Jajka", 15, "ryż; jajka; dymka; sos sojowy; olej"),
      r("r007", "Pesto", "Danie główne", "Łatwy", false, "https://aniagotuje.pl/przepis/pesto", "Makaron", "Wegetariańskie", 15, "bazylia; orzeszki piniowe; parmezan; oliwa; czosnek; makaron"),
      r("r008", "Overnight oats", "Śniadanie", "Łatwy", true, "", "Owoce", "", 5, "płatki owsiane; mleko; jogurt grecki; miód"),
      r("r009", "Placki ziemniaczane", "Danie główne", "Łatwy", false, "", "Warzywa", "Pomysł", 40, "ziemniaki; cebula; jajka; mąka; olej; śmietana"),
      r("r010", "Chocolate lava cake", "Deser", "Łatwy", true, "", "Ciasto", "", 20, "gorzka czekolada; masło; jajka; cukier; mąka"),
    ],
    pantry: [
      ["Składnik", "Dział", "Mam", "Zawsze mam"],
      ...([
        ["bazylia", "Warzywa i owoce"], ["cebula", "Warzywa i owoce", 1], ["czosnek", "Warzywa i owoce", 1], ["cukinia", "Warzywa i owoce"],
        ["dymka", "Warzywa i owoce"], ["papryka", "Warzywa i owoce"], ["pomidory", "Warzywa i owoce"], ["ziemniaki", "Warzywa i owoce", 1],
        ["boczek", "Mięso i ryby"], ["kiełbasa", "Mięso i ryby"], ["mięso mielone", "Mięso i ryby"],
        ["feta", "Nabiał i jajka"], ["jajka", "Nabiał i jajka", 1], ["jogurt grecki", "Nabiał i jajka"], ["masło", "Nabiał i jajka", 1],
        ["mleko", "Nabiał i jajka", 1], ["parmezan", "Nabiał i jajka", 1], ["śmietana", "Nabiał i jajka"], ["śmietanka 30%", "Nabiał i jajka"],
        ["makaron", "Makaron, ryż, kasze", 1], ["płatki owsiane", "Makaron, ryż, kasze", 1], ["ryż", "Makaron, ryż, kasze", 1],
        ["fasola czerwona", "Puszki i słoiki"], ["koncentrat pomidorowy", "Puszki i słoiki", 1], ["passata pomidorowa", "Puszki i słoiki"], ["pomidory z puszki", "Puszki i słoiki", 1],
        ["miód", "Sosy i przyprawy", 1], ["pieprz", "Sosy i przyprawy", 0, 1], ["sos sojowy", "Sosy i przyprawy", 1], ["sól", "Sosy i przyprawy", 0, 1],
        ["cukier", "Pieczenie", 0, 1], ["gorzka czekolada", "Pieczenie"], ["mąka", "Pieczenie", 1],
        ["olej", "Inne", 0, 1], ["oliwa", "Inne", 0, 1], ["orzeszki piniowe", "Inne"],
      ] as [string, string, number?, number?][]).map(([n, d, have, always]) => [n, d, have ? "TRUE" : "FALSE", always ? "TRUE" : "FALSE"]),
    ],
    plan: [
      ["Data", "Posiłek", "ID przepisu", "Tekst", "Ugotowane"],
      [today, "", "r001", "", "TRUE"],
      [today, "", "r008", "", "FALSE"],
      [today, "", "r005", "", "FALSE"],
      [today, "", "", "kanapki z szynką", "FALSE"],
      [today, "", "r002", "", "FALSE"],
    ],
    extra: [["Pozycja", "Kupione"], ["papier do pieczenia", "FALSE"]],
  };
}
