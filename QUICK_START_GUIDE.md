# Quick Start Guide: Testing Live Editing and AI Suggestions

## Setup

### 1. Install Dependencies

```bash
cd apps/web
pnpm install

cd ../api
npm install
```

### 2. Environment Setup

Ensure your `.env` file in `apps/api` has the necessary API keys for the AI completion service.

### 3. Start Services

Terminal 1 - API Server:

```bash
cd apps/api
npm run dev
```

Terminal 2 - Web App:

```bash
cd apps/web
pnpm dev
```

## Testing Collaborative Editing

### Test 1: Real-time Synchronization

1. Open browser to `http://localhost:3000`
2. Navigate to a document
3. Open the same document URL in a second browser window or incognito tab
4. Type text in Window 1
5. **Expected**: Text should appear in Window 2 in real-time
6. Type text in Window 2
7. **Expected**: Text should appear in Window 1 in real-time

### Test 2: Connection Status

1. Check the connection indicator at the top of the editor
2. **Expected**: Green indicator showing "Synced"
3. Kill the API server
4. **Expected**: Red indicator showing "Connecting..."
5. Restart the API server
6. **Expected**: Green indicator returns, document syncs

### Test 3: Multiple Users

1. Open document in 3+ browser tabs
2. Type in different tabs simultaneously
3. **Expected**: All changes merge correctly without conflicts

## Testing AI Suggestions

### Test 1: Basic Suggestion Flow

1. Type some text: "The cat walked slow"
2. Select the text by clicking and dragging
3. **Expected**: Suggestion toolbar appears below the selection
4. Click "Suggest" or press Enter (uses default prompt)
5. **Expected**:
    - Toolbar disappears
    - Diff popup appears showing streaming suggestion
    - Text streams in word by word
6. **Expected Final Suggestion**: "The cat walked slowly"
7. Review the diff:
    - Green highlighting shows added words
    - Red strikethrough shows removed words
8. Click "Accept"
9. **Expected**: Original text replaced with suggestion

### Test 2: Custom Prompt

1. Select text: "Hello world"
2. In the toolbar, type: "make this more formal"
3. Click "Suggest"
4. **Expected**: Suggestion like "Good afternoon" or "Greetings"
5. Click "Accept" to apply or "Reject" to dismiss

### Test 3: Undo Functionality

1. Select and improve text with a suggestion
2. Accept the suggestion
3. Press Ctrl+Z (or Cmd+Z on Mac)
4. **Expected**: Text reverts to original version
5. Press Ctrl+Y (or Cmd+Shift+Z on Mac)
6. **Expected**: Suggestion is re-applied

### Test 4: Suggestion Streaming

1. Select a longer paragraph (50+ words)
2. Request suggestion with prompt "improve clarity"
3. **Expected**:
    - Words appear progressively in the diff view
    - Accept/Reject buttons remain disabled during streaming
    - Once complete, buttons become enabled

### Test 5: Multiple Selections

1. Select text and request suggestion
2. While suggestion is streaming, click elsewhere in document
3. **Expected**: Diff popup remains visible
4. Accept or reject the suggestion
5. Make a new selection
6. **Expected**: New toolbar appears for new selection

### Test 6: Collaborative Suggestions

1. Open document in two windows
2. Window 1: Select text and accept a suggestion
3. **Expected**: Window 2 receives the updated text via Yjs sync
4. Window 2: The change appears as if another user typed it

## Troubleshooting

### Suggestions Not Loading

- Check browser console for errors
- Verify API server is running on port 3001
- Check `/completions/suggest` endpoint is accessible
- Verify AI API keys are configured

### Collaborative Editing Not Syncing

- Check both clients show green "Synced" indicator
- Verify WebSocket connection in browser dev tools (Network tab)
- Check API server logs for connection messages
- Ensure both clients are in the same document (same URL)

### Toolbar Not Appearing

- Ensure text is actually selected (not just cursor placement)
- Check browser console for React errors
- Verify selection range has length > 0

### Diff Popup Positioned Incorrectly

- This can happen with scrolled content
- Try scrolling document to top
- Known issue documented in IMPLEMENTATION_SUMMARY.md

## Expected Behavior Summary

### Working Features

- Real-time collaborative text editing
- WebSocket-based Yjs synchronization
- Text selection toolbar with prompt input
- Streaming AI suggestions
- Word-by-word diff visualization
- Accept/reject suggestion controls
- Undo/redo with Quill history
- Suggestions broadcast to all collaborators when accepted

### Keyboard Shortcuts

- Ctrl/Cmd + Z: Undo
- Ctrl/Cmd + Y (or Cmd + Shift + Z): Redo
- Enter in toolbar: Submit suggestion request
- Esc: (Not implemented) Could close toolbar

## API Endpoints Used

- `POST /completions/suggest`: Streaming AI text suggestions
- WebSocket events:
    - `join`: Join document room
    - `leave`: Leave document room
    - `update`: Send Yjs update
    - `yjs`: Receive Yjs update from others
    - `yjs-sync-request`: Request document state
    - `yjs-sync-response`: Receive document state
    - `awareness`: User presence/typing indicators
    - `chat`: Chat messages (separate feature)

## Next Steps

After verifying the implementation works:

1. Consider adding keyboard shortcuts (Cmd+K for suggestions)
2. Improve suggestion position calculation for scrolled content
3. Add suggestion history/audit log
4. Implement confidence scoring for suggestions
5. Add multiple concurrent suggestions support
