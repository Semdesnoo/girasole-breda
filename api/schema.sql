CREATE TABLE IF NOT EXISTS reserveringen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aangemaakt TEXT NOT NULL DEFAULT (datetime('now')),
  dag TEXT NOT NULL,
  tijd TEXT NOT NULL,
  personen INTEGER NOT NULL CHECK (personen BETWEEN 1 AND 12),
  keuze TEXT NOT NULL,
  naam TEXT NOT NULL,
  telefoon TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw', 'bevestigd', 'afgewezen'))
);
CREATE INDEX IF NOT EXISTS reserveringen_dag ON reserveringen (dag, tijd);
CREATE TABLE IF NOT EXISTS instellingen (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pogingen (ip TEXT NOT NULL, soort TEXT NOT NULL, ts TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS pogingen_ip ON pogingen (ip, soort, ts);
