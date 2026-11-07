CREATE TABLE gateway_control (
 id INTEGER PRIMARY KEY,
 last_start INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 blocked_until INTEGER NOT NULL DEFAULT 0,
 owner TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE gateway_calls (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX gateway_calls_at ON gateway_calls(at);
--> statement-breakpoint
CREATE TABLE forecast_cache (
 k TEXT PRIMARY KEY,
 page TEXT NOT NULL,
 code TEXT NOT NULL,
 issue TEXT NOT NULL,
 payload TEXT NOT NULL,
 success INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX forecast_region ON forecast_cache(page, code, issue);
--> statement-breakpoint
CREATE TABLE forecast_errors (
 k TEXT PRIMARY KEY,
 kind TEXT NOT NULL,
 message TEXT NOT NULL,
 until_at INTEGER NOT NULL,
 attempt INTEGER NOT NULL
);
