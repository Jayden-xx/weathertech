CREATE TABLE gemini_control(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL DEFAULT '',lease_until INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0,attempt INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE gemini_calls(id TEXT PRIMARY KEY,at INTEGER NOT NULL,session TEXT,status TEXT,tokens INTEGER);
--> statement-breakpoint
CREATE INDEX gemini_calls_at ON gemini_calls(at);
--> statement-breakpoint
CREATE TABLE chat_sessions(id TEXT PRIMARY KEY,expires INTEGER NOT NULL,busy INTEGER NOT NULL DEFAULT 0,plan TEXT,plan_id TEXT,context TEXT);
