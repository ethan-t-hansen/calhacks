-- Yjs Document States (periodic persistence)
CREATE TABLE IF NOT EXISTS yjs_document_states (
    document_id VARCHAR(255) PRIMARY KEY,
    state_vector BYTEA NOT NULL,
    update_data BYTEA NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yjs Updates (immediate persistence)
CREATE TABLE IF NOT EXISTS yjs_updates (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    update_data BYTEA NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    INDEX idx_yjs_updates_document_id (document_id),
    INDEX idx_yjs_updates_timestamp (timestamp)
);

-- Suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suggestion TEXT NOT NULL,
    target_range_anchor INTEGER NOT NULL,
    target_range_head INTEGER NOT NULL,
    target_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    INDEX idx_suggestions_document_id (document_id),
    INDEX idx_suggestions_status (status),
    INDEX idx_suggestions_timestamp (timestamp)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message TEXT NOT NULL,
    reply_to VARCHAR(255),
    thread_id VARCHAR(255),
    INDEX idx_chat_messages_document_id (document_id),
    INDEX idx_chat_messages_thread_id (thread_id),
    INDEX idx_chat_messages_timestamp (timestamp)
);

-- -- Side Chat Threads
-- CREATE TABLE IF NOT EXISTS side_chat_threads (
--     id VARCHAR(255) PRIMARY KEY,
--     document_id VARCHAR(255) NOT NULL,
--     created_by VARCHAR(255) NOT NULL,
--     timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     title VARCHAR(500) NOT NULL,
--     anchor_position INTEGER NOT NULL,
--     anchor_text TEXT NOT NULL,
--     resolved BOOLEAN NOT NULL DEFAULT FALSE,
--     INDEX idx_side_chat_threads_document_id (document_id),
--     INDEX idx_side_chat_threads_resolved (resolved),
--     INDEX idx_side_chat_threads_timestamp (timestamp)
-- );

-- -- Side Chat Messages
-- CREATE TABLE IF NOT EXISTS side_chat_messages (
--     id VARCHAR(255) PRIMARY KEY,
--     thread_id VARCHAR(255) NOT NULL,
--     document_id VARCHAR(255) NOT NULL,
--     user_id VARCHAR(255) NOT NULL,
--     timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     message TEXT NOT NULL,
--     INDEX idx_side_chat_messages_thread_id (thread_id),
--     INDEX idx_side_chat_messages_document_id (document_id),
--     INDEX idx_side_chat_messages_timestamp (timestamp),
--     FOREIGN KEY (thread_id) REFERENCES side_chat_threads(id) ON DELETE CASCADE
-- );

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
