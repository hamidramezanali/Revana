CREATE TABLE IF NOT EXISTS revana_journeys (
    key TEXT PRIMARY KEY,
    revision BIGINT NOT NULL CHECK (revision >= 0),
    body TEXT NOT NULL
);
