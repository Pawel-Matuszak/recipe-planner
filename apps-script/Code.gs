/**
 * Obiadki API — Google Apps Script web app bound to the "Obiadki2" spreadsheet.
 *
 * GET  ?action=all&token=…              → { ok, data: { main, pantry, plan, extra } }
 * POST body (text/plain JSON) {token, action, ...} → { ok, result } | { error, message }
 *
 * Setup: run `setupToken` once from the editor, copy the token from the log,
 * then Deploy → New deployment → Web app (Execute as: me, Who has access: Anyone).
 */

const TABS = { main: "Main", pantry: "Spiżarnia", plan: "Plan2", extra: "Zakupy_extra" };
const RECIPE_FIELDS = { done: /^było robione/, rate: /^ocena$/, notes: /^notatki$/ };

function doGet(e) {
  return handle_((e && e.parameter) || {});
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ error: "bad_json" });
  }
  return handle_(body);
}

function setupToken() {
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  PropertiesService.getScriptProperties().setProperty("API_TOKEN", token);
  Logger.log("API_TOKEN: " + token);
}

function handle_(p) {
  const token = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!token || p.token !== token) return out_({ error: "unauthorized" });
  if (p.action === "all") return out_({ ok: true, data: readAll_() });

  const fn = ACTIONS[p.action];
  if (!fn) return out_({ error: "unknown_action", message: String(p.action) });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const result = fn(p);
    SpreadsheetApp.flush();
    return out_({ ok: true, result: result === undefined ? null : result });
  } catch (err) {
    return out_({ error: "server", message: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- reading ---------- */

function sheet_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error("Brak zakładki: " + name);
  return s;
}

function cell_(v) {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return v === null || v === undefined ? "" : String(v);
}

function table_(name) {
  const s = sheet_(name);
  const lastRow = s.getLastRow();
  const lastCol = s.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  const rows = s.getRange(1, 1, lastRow, lastCol).getValues().map((r) => r.map(cell_));
  // drop trailing rows with no text (unchecked checkboxes only)
  while (rows.length > 1 && rows[rows.length - 1].every((c) => c === "" || c === "FALSE")) rows.pop();
  return rows;
}

function readAll_() {
  return {
    main: table_(TABS.main),
    pantry: table_(TABS.pantry),
    plan: table_(TABS.plan),
    extra: table_(TABS.extra),
  };
}

/* ---------- helpers ---------- */

function norm_(s) {
  return String(s === null || s === undefined ? "" : s).trim().toLowerCase();
}

function headerIndex_(s, test) {
  const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  for (let i = 0; i < headers.length; i++) if (test.test(norm_(headers[i]))) return i + 1;
  throw new Error("Brak kolumny " + test + " w " + s.getName());
}

function findRow_(s, col, key) {
  const n = s.getLastRow();
  if (n < 2) return 0;
  const vals = s.getRange(2, col, n - 1, 1).getValues();
  const k = norm_(key);
  for (let i = 0; i < vals.length; i++) if (norm_(vals[i][0]) === k) return i + 2;
  return 0;
}

function nextRow_(s, col) {
  // first row after the last non-empty cell in `col` (checkbox columns don't count)
  const n = s.getLastRow();
  if (n < 2) return 2;
  const vals = s.getRange(1, col, n, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim() !== "") return i + 2;
  return 2;
}

/* ---------- actions ---------- */

const ACTIONS = {
  setRecipeField(p) {
    const s = sheet_(TABS.main);
    const pattern = RECIPE_FIELDS[p.field];
    if (!pattern) throw new Error("Nieznane pole: " + p.field);
    const keyCol = headerIndex_(s, p.by === "name" ? /^nazwa$/ : /^id$/);
    const row = findRow_(s, keyCol, p.key);
    if (!row) throw new Error("Nie znaleziono przepisu: " + p.key);
    let value = p.value;
    if (p.field === "done") value = value === true;
    if (p.field === "rate") value = value ? Math.max(1, Math.min(5, Number(value))) : "";
    if (p.field === "notes") value = String(value || "");
    s.getRange(row, headerIndex_(s, pattern)).setValue(value);
  },

  setPantry(p) {
    const s = sheet_(TABS.pantry);
    const row = findRow_(s, 1, p.name);
    if (row) s.getRange(row, 3).setValue(p.have === true);
    else s.getRange(nextRow_(s, 1), 1, 1, 4).setValues([[String(p.name).trim(), "Inne", p.have === true, false]]);
  },

  addPantry(p) {
    const s = sheet_(TABS.pantry);
    const row = findRow_(s, 1, p.name);
    if (row) s.getRange(row, 3).setValue(true);
    else s.getRange(nextRow_(s, 1), 1, 1, 4).setValues([[String(p.name).trim(), String(p.dzial || "Inne"), true, false]]);
  },

  addPlan(p) {
    const s = sheet_(TABS.plan);
    const row = nextRow_(s, 1);
    s.getRange(row, 1).setNumberFormat("@");
    s.getRange(row, 1, 1, 5).setValues([[String(p.date), String(p.meal), String(p.id || ""), String(p.text || ""), false]]);
  },

  removePlan(p) {
    const s = sheet_(TABS.plan);
    const rows = table_(TABS.plan);
    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      if (r[0] === String(p.date) && norm_(r[1]) === norm_(p.meal) && norm_(r[2]) === norm_(p.id) && norm_(r[3]) === norm_(p.text)) {
        s.deleteRow(i + 1);
        return;
      }
    }
  },

  addExtra(p) {
    const s = sheet_(TABS.extra);
    const rows = table_(TABS.extra).slice(1);
    const open = rows.filter((r) => r[1] !== "TRUE").map((r) => norm_(r[0]));
    (p.items || []).forEach((item) => {
      if (open.indexOf(norm_(item)) >= 0) return;
      s.getRange(nextRow_(s, 1), 1, 1, 2).setValues([[String(item).trim(), false]]);
      open.push(norm_(item));
    });
  },

  setExtra(p) {
    const s = sheet_(TABS.extra);
    const row = findRow_(s, 1, p.item);
    if (row) s.getRange(row, 2).setValue(p.bought === true);
  },

  clearBoughtExtra() {
    const s = sheet_(TABS.extra);
    const rows = table_(TABS.extra);
    for (let i = rows.length - 1; i >= 1; i--) if (rows[i][1] === "TRUE") s.deleteRow(i + 1);
  },
};
