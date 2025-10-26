-- Yjs Document States (periodic persistence)
CREATE TABLE IF NOT EXISTS yjs_document_states (
    document_id VARCHAR(255) PRIMARY KEY,
    state_vector BYTEA NOT NULL,
    update_data BYTEA NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suggestion TEXT NOT NULL,
    target_range_anchor INTEGER NOT NULL,
    target_range_head INTEGER NOT NULL,
    target_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, user_id, timestamp),
    message TEXT NOT NULL,
    reply_to VARCHAR(255),
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('edit', 'suggest', 'chat', 'side_chat')),
    metadata JSONB,
    INDEX idx_activity_logs_document_id (document_id),
    INDEX idx_activity_logs_activity_type (activity_type),
    INDEX idx_activity_logs_timestamp (timestamp)
);

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    DELETE FROM yjs_updates WHERE timestamp < NOW() - INTERVAL '30 days';
    DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM suggestions WHERE status IN ('accepted', 'rejected') AND timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (this would need to be set up in Neon console)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');
