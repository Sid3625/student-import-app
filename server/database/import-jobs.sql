
CREATE TABLE IF NOT EXISTS import_jobs (
    id BIGSERIAL PRIMARY KEY,
    queue_job_id VARCHAR(100) UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN (
            'queued',
            'processing',
            'completed',
            'failed'
        )),

    total_records BIGINT NOT NULL DEFAULT 0,
    processed_records BIGINT NOT NULL DEFAULT 0,
    inserted_records BIGINT NOT NULL DEFAULT 0,
    skipped_records BIGINT NOT NULL DEFAULT 0,
    failed_records BIGINT NOT NULL DEFAULT 0,

    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at
    ON import_jobs (created_at DESC);
