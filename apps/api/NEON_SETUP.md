1. Edit `.env` and add your Neon connection string:
    ```
    DATABASE_URL=postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
    ```

## Initialize the Database Schema

1. Connect to your Neon database using the Neon Console SQL Editor or any PostgreSQL client
2. Run the SQL commands from `schema.sql` to create all necessary tables and indexes

Alternatively, you can use the Neon CLI:

```bash
# Install Neon CLI
npm install -g @neondatabase/cli

# Login to Neon
neon auth

# Run the schema
neon sql --file schema.sql
```

## 4. Verify the Setup

1. Start your API server:

    ```bash
    npm run dev
    ```

2. Check the health endpoint:

    ```bash
    curl http://localhost:3001/health
    ```

3. You should see "Database connection initialized successfully" in the console logs

## 5. Test Persistence Endpoints

The following API endpoints are now available for persistence:

- `GET /documents/:documentId/suggestions` - Get suggestions for a document
- `GET /documents/:documentId/chat` - Get chat messages for a document
- `GET /documents/:documentId/threads` - Get side chat threads for a document
- `GET /documents/:documentId/activity` - Get activity log for a document

## Database Schema Overview

The database includes the following tables:

- **yjs_document_states** - Stores Yjs document states for periodic persistence
- **yjs_updates** - Stores Yjs updates for immediate persistence
- **suggestions** - Stores AI suggestions with status tracking
- **chat_messages** - Stores chat messages and replies
- **side_chat_threads** - Stores side chat thread metadata
- **side_chat_messages** - Stores messages within side chat threads
- **activity_logs** - Stores user activity for analytics

## Features

- **Automatic persistence** of Yjs document updates
- **Activity logging** for user actions
- **Suggestion management** with status tracking
- **Chat persistence** with threading support
- **Side chat threads** for contextual discussions
- **Optimized indexes** for fast queries
- **Data cleanup** functions for maintenance

## Troubleshooting

### Connection Issues

- Verify your `DATABASE_URL` is correct
- Check that your Neon project is active
- Ensure SSL mode is set to `require`

### Schema Issues

- Make sure all tables were created successfully
- Check the Neon Console for any SQL errors
- Verify indexes were created properly

### Performance Issues

- Monitor query performance in the Neon Console
- Consider adding additional indexes for your specific use cases
- Use the cleanup function to remove old data periodically
