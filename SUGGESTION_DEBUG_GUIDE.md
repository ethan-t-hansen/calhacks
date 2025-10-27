# Debugging AI Suggestions in Quill Editor

## Key Fixes Applied

### 1. Fixed Yjs Text Field Name Mismatch

- **Problem**: Frontend used `getText("quill")` but backend expected `getText("content")`
- **Fix**: Changed frontend to use `getText("content")` to match backend
- **Impact**: Backend can now read document content for generating suggestions

### 2. Added Position Context

- **Problem**: Absolute positioned toolbar had no reference point
- **Fix**: Added `position: "relative"` to parent containers
- **Impact**: Toolbar and diff popup now position correctly

### 3. Added Debug Indicators

- Console logs for selection events
- Visual indicators in the status bar showing "Toolbar visible" and "Suggestion active"

## How Suggestions Work with Quill

### Text Selection Flow

1. **Select text** in the Quill editor by clicking and dragging
2. Quill fires `selection-change` event with range info
3. Our handler extracts:
    - `range.index`: Starting position
    - `range.length`: Number of characters selected
    - `quill.getText(range.index, range.length)`: The actual text
4. Toolbar appears below the selection

### Applying Suggestions

When you accept a suggestion:

```javascript
quill.deleteText(range.index, range.length); // Remove original
quill.insertText(range.index, suggested); // Insert suggestion
```

This triggers Yjs to:

1. Detect the change in the bound text field
2. Create an update event
3. Emit to server via socket
4. Server broadcasts to other clients
5. Other clients apply the update

## Testing Steps

### Step 1: Verify Editor Loads

1. Open your app in the browser
2. Navigate to a document
3. **Check**: Green indicator shows "Synced"
4. **Check**: You can type in the editor

### Step 2: Test Selection Detection

1. Type some text: "The quick brown fox"
2. Click and drag to select "quick"
3. **Open browser console** (F12)
4. **Expected console output**:

```
Selection detected: { range: { index: 4, length: 5 }, text: "quick", length: 5 }
Setting toolbar position: { top: 123, left: 456 }
Toolbar should be visible now
```

5. **Expected visual**: Status bar shows "Toolbar visible"
6. **Expected UI**: Toolbar appears below selected text

### Step 3: Check Toolbar Rendering

If toolbar doesn't appear but console shows "Toolbar should be visible now":

**Check 1**: Inspect toolbar DOM

```javascript
// In browser console
document.querySelector('input[placeholder="improve this writing"]');
```

Should return the input element if rendered.

**Check 2**: Check toolbar visibility prop
The toolbar renders when: `showToolbar && !currentSuggestion`

**Check 3**: Check position values

```javascript
// In browser console after selection
console.log("Toolbar should be at:", toolbarPosition);
```

### Step 4: Request a Suggestion

1. Select text: "The cat walked slow"
2. Wait for toolbar to appear
3. Click "Suggest" button (or press Enter)
4. **Expected console output**:

```
Fetching suggestion for: "The cat walked slow"
```

5. **Expected visual**: Status bar shows "Suggestion active"
6. **Expected**: Diff popup appears, text streams in

### Step 5: Network Check

If suggestion doesn't stream:

**Check API connection**:

```bash
curl -X POST http://localhost:3001/completions/suggest \
  -H "Content-Type: application/json" \
  -d '{"doc_id":"test","user_id":"test","prompt":"improve this","context":"hello world"}'
```

Should stream back improved text.

**Check browser network tab**:

1. Open DevTools → Network tab
2. Request a suggestion
3. Look for POST to `/completions/suggest`
4. Check response (should stream)

### Step 6: Accept/Reject

1. Once suggestion streams in completely
2. Buttons should be enabled (not grayed out)
3. Click "Accept"
4. **Expected**: Original text replaced with suggestion
5. **Expected**: Diff popup disappears
6. Press Ctrl/Cmd+Z to undo

## Common Issues

### Issue 1: Toolbar Not Appearing

**Symptoms**: Selection detected in console but no toolbar
**Possible causes**:

- Toolbar positioned off-screen (check position values in console)
- CSS z-index conflict
- Parent container cutting off overflow

**Debug**:

```javascript
// Check if toolbar exists in DOM
document.querySelector(".bg-white.border.border-gray-300");

// Force visible for testing
const toolbar = document.querySelector('[placeholder="improve this writing"]')?.parentElement;
if (toolbar) {
    toolbar.style.position = "fixed";
    toolbar.style.top = "100px";
    toolbar.style.left = "100px";
    toolbar.style.zIndex = "9999";
}
```

### Issue 2: Suggestions Not Loading

**Symptoms**: Toolbar works but clicking "Suggest" does nothing
**Check**:

1. Browser console for errors
2. Network tab for failed requests
3. API server logs
4. Backend reading correct Yjs field (now should be "content")

**Verify backend can read content**:

```bash
# In backend, add console.log in handleSuggestStream
console.log("Document content:", documentContent);
```

### Issue 3: Diff Not Showing

**Symptoms**: Suggestion loads but diff popup doesn't appear
**Check**:

```javascript
// Check currentSuggestion state
console.log("Current suggestion:", currentSuggestion);
```

### Issue 4: Can't Apply Suggestion

**Symptoms**: Accept button doesn't work
**Check**:

- Quill ref is valid: `console.log("Quill:", quillRef.current)`
- Range is valid: `console.log("Range:", currentSuggestion.range)`

## Manual Testing Commands

### Test in Browser Console

```javascript
// Trigger selection manually
const quill = document.querySelector(".ql-editor").__quill;
quill.setSelection(0, 5); // Select first 5 characters

// Check toolbar state
console.log("Show toolbar:", showToolbar);
console.log("Toolbar position:", toolbarPosition);
console.log("Selected text:", selectedText);
```

## Expected File Structure

```
apps/web/app/components/
  - CollaborativeEditor.tsx  (main editor with selection tracking)
  - SuggestionToolbar.tsx    (prompt input and suggest button)
  - SuggestionDiff.tsx       (diff view with accept/reject)

apps/web/app/hooks/
  - useStreamingSuggestion.ts (fetch from API)
  - useSuggestions.ts         (state management)
```

## Success Criteria

When working correctly:

1. ✅ Select text → console logs appear → toolbar appears
2. ✅ Enter prompt → click Suggest → diff popup appears
3. ✅ Text streams in word by word
4. ✅ Click Accept → text replaced in editor
5. ✅ Other connected clients see the change
6. ✅ Ctrl+Z undoes the suggestion

## Next Steps After Basic Testing

1. Test with longer text selections
2. Test rapid selection changes
3. Test concurrent suggestions (if multiple users)
4. Test with network throttling (slow streaming)
5. Test undo/redo multiple times
6. Test rejection then new suggestion
