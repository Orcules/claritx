CREATE TABLE IF NOT EXISTS batch_jobs (
    id VARCHAR(255) PRIMARY KEY, -- batch_id from Vertex
    status VARCHAR(50) NOT NULL, -- 'submitted', 'processing', 'completed', 'failed'
    gcs_input_uri TEXT,
    gcs_output_uri TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    item_count INTEGER,
    asset_type VARCHAR(20)
);
