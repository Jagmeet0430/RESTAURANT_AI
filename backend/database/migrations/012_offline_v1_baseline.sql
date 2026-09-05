CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    checksum VARCHAR(128),
    baseline BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phone_verifications (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 1,
    blocked_until TIMESTAMP,
    verification_token_hash TEXT,
    token_used_at TIMESTAMP,
    ip_address VARCHAR(80),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created
ON phone_verifications(phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_token_hash
ON phone_verifications(verification_token_hash)
WHERE verification_token_hash IS NOT NULL;

INSERT INTO schema_migrations (
    migration_name,
    baseline
)
VALUES (
    'offline-v1-baseline',
    TRUE
)
ON CONFLICT (migration_name) DO NOTHING;