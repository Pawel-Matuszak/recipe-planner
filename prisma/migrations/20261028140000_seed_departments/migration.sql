-- Store sections the app offers; databases not filled by the import only had "Inne".
INSERT INTO "department" ("name", "sort_order") VALUES
  ('Warzywa i owoce', 0),
  ('Mięso i ryby', 1),
  ('Nabiał i jajka', 2),
  ('Pieczywo', 3),
  ('Makaron, ryż, kasze', 4),
  ('Puszki i słoiki', 5),
  ('Sosy i przyprawy', 6),
  ('Pieczenie', 7),
  ('Inne', 8)
ON CONFLICT ("name") DO NOTHING;
