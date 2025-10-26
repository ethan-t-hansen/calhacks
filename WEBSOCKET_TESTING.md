# WebSocket Broadcasting System - Testing Guide

## Setup

1. **Start the API server:**

    ```bash
    cd apps/api
    npm run dev
    ```

2. **Start the web app:**

    ```bash
    cd apps/web
    npm run dev
    ```

3. **Set up Neon database:**
    - Create a Neon account at [console.neon.tech](https://console.neon.tech/)
    - Create a new project
    - Copy the connection string to `apps/api/.env`:
        ```
        DATABASE_URL=postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
        ```
    - Run the schema from `apps/api/schema.sql` in your Neon database

## Testing the WebSocket System

### 1. Basic Room Management

1. Open the web app at `http://localhost:3000`
2. Fill in user information:
    - Document ID: `test-doc-1`
    - User ID: `user-1`
    - Name: `Alice`
    - Color: Choose any color
3. Click "Join Room" to test the HTTP endpoint
4. Click "Get Room Info" to see room details
5. Click "Get Room Stats" to see all rooms

### 2. WebSocket Connection

1. Fill in user information (same as above)
2. Click "Connect WebSocket" - you should see "Connected" status
3. Click "Send Test Message" to send a test message
4. Check the WebSocket Messages section to see incoming messages

### 3. AI Generation (Streaming)

1. Ensure WebSocket is connected
2. In the AI Generation section:
    - Select "Suggestion" or "Chat"
    - For Chat, choose "Shared" or "Private" visibility
    - Enter a prompt like "Help me improve this text"
    - Click "Generate Suggestion" or "Generate Chat"
3. Watch the WebSocket Messages section for streaming AI content:
    - `ai:suggestion:start` - AI generation started
    - `ai:suggestion:chunk` - Streaming chunks
    - `ai:suggestion:complete` - Final suggestion

### 4. Multi-User Testing

1. Open multiple browser tabs/windows
2. Connect different users to the same document:
    - Tab 1: User ID `user-1`, Name `Alice`
    - Tab 2: User ID `user-2`, Name `Bob`
3. Send messages from one user and see them appear in other tabs
4. Generate AI content and see it broadcast to all users

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check
- `GET /rooms` - Get all room statistics
- `GET /rooms/:documentId` - Get specific room info
- `POST /rooms/:documentId/join` - Join a room (HTTP)
- `POST /ai/suggest` - Generate AI suggestions
- `POST /ai/chat` - Generate AI chat responses
- `POST /diff/accept` - Accept a suggestion
- `POST /diff/reject` - Reject a suggestion

### WebSocket Endpoint

- `GET /ws/:documentId?userId=:userId&name=:name&color=:color` - Real-time collaboration

## Message Types

### WebSocket Messages

- `user_presence` - User join/leave notifications
- `yjs_update` - Document synchronization
- `suggest` - AI suggestions
- `chat` - Chat messages
- `ai:suggestion:start` - AI suggestion generation started
- `ai:suggestion:chunk` - AI suggestion streaming chunks
- `ai:suggestion:complete` - AI suggestion completed
- `ai:chat:start` - AI chat generation started
- `ai:chat:chunk` - AI chat streaming chunks
- `ai:chat:complete` - AI chat completed
- `suggestion:accepted` - Suggestion was accepted
- `suggestion:rejected` - Suggestion was rejected

## Troubleshooting

### WebSocket Connection Issues

- Check that the API server is running on port 3001
- Verify all required parameters (userId, name, color) are provided
- Check browser console for WebSocket errors

### AI Generation Issues

- Ensure OpenAI API key is set in environment variables
- Check that WebSocket is connected before generating AI content
- Verify the prompt is not empty

### Database Issues

- Confirm DATABASE_URL is correctly set
- Check that all tables were created from schema.sql
- Verify Neon project is active

## Features Implemented

✅ **WebSocket Server Setup** - Real-time bidirectional communication
✅ **Room Management** - Document-based room isolation
✅ **AI Broadcasting** - Streaming AI content to multiple users
✅ **Message Types** - All message types from the plan
✅ **Persistence** - Neon database integration
✅ **Multi-User Support** - Real-time collaboration
✅ **Suggestion System** - AI-powered text suggestions
✅ **Chat System** - Private and shared chat functionality
✅ **Activity Logging** - User activity tracking
✅ **Error Handling** - Robust error management

## Next Steps

- Add Yjs document synchronization
- Implement cursor position awareness
- Add suggestion acceptance/rejection UI
- Create document editor interface
- Add user authentication
- Implement suggestion diff application
