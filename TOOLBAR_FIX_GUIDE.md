# Toolbar Visibility Fix - Solved!

## Problems Identified and Fixed

### Problem 1: Toolbar Disappears Immediately (Mouse Selection)

**Root Cause**: When you clicked or moved the mouse after selecting text, the editor lost focus and Quill fired `selection-change` with `range = null`, which cleared the toolbar.

**Fix**: Modified selection handler to distinguish between:

- `range === null` → Editor lost focus (keep toolbar open)
- `range.length === 0` → User clicked to clear selection (hide toolbar)

### Problem 2: Toolbar Steals Focus

**Root Cause**: Clicking on the toolbar input/button caused the editor to lose focus, clearing the selection.

**Fix**: Added `onMouseDown` preventDefault on toolbar container and buttons to prevent focus loss.

### Problem 3: No Way to Close Toolbar

**Root Cause**: Once toolbar appeared, no clear way to dismiss it.

**Fix**:

- Added Escape key handler to close toolbar
- Added close button (✕) to toolbar UI
- Close button has tooltip "Close (Esc)"

## What Changed

### CollaborativeEditor.tsx

1. **Selection handler** now tracks 3 states:
    - Text selected → show toolbar
    - Editor lost focus → keep toolbar (don't hide)
    - Selection cleared → hide toolbar

2. **Added Escape key handler**:
    - Press Escape to close toolbar
    - Press Escape to reject suggestion

3. **Added close handler**: `handleCloseToolbar()` function

4. **Better logging**: Shows range, oldRange, and source in console

### SuggestionToolbar.tsx

1. **Prevent focus loss**:
    - Container has `onMouseDown` with `preventDefault()`
    - Button has `onMouseDown` with `preventDefault()`
    - Input has `onFocus` with `stopPropagation()`

2. **Added close button**:
    - X button on the right
    - Tooltip shows "Close (Esc)"
    - Also has preventDefault to avoid focus loss

3. **Escape key handling**: Added Escape key detection

## Testing Instructions

### Test 1: Mouse Selection (Should Work Now!)

1. Type some text: "The quick brown fox jumps"
2. **Click and drag** to select "quick brown"
3. **Expected**:
    - Console logs: `Selection detected: { range: { index: 4, length: 11 }, text: "quick brown", ... }`
    - Yellow debug box appears (top right)
    - **Toolbar appears below selection with input field and "Suggest" button**
    - Status bar shows: `Selection: 4:11 | Toolbar: YES`

4. **Move your mouse** or **click elsewhere on page** (not in editor)
5. **Expected**:
    - Console logs: `Editor lost focus, keeping toolbar open`
    - **Toolbar stays visible** (THIS WAS THE BUG!)

6. **Click in the toolbar input field**
7. **Expected**:
    - Input gets focus
    - **Toolbar still visible**
    - You can type a prompt

### Test 2: Keyboard Selection (Should Work Now!)

1. Place cursor at start of text
2. Press **Shift + Right Arrow** multiple times to select text
3. **Expected**:
    - Console logs show selection events
    - Toolbar appears
    - Status bar shows selection range

### Test 3: Using the Toolbar

1. Select text
2. Wait for toolbar to appear
3. **Option A: Use default prompt**
    - Just click "Suggest" button
    - Uses "improve this writing" as prompt

4. **Option B: Custom prompt**
    - Click in input field
    - Type: "make this more concise"
    - Click "Suggest" or press Enter

5. **Expected**:
    - Toolbar disappears
    - Diff popup appears
    - Text streams in
    - Status bar shows: `Suggestion: YES`

### Test 4: Closing the Toolbar

1. Select text to show toolbar
2. **Option A: Press Escape**
    - Toolbar closes immediately
3. **Option B: Click X button**
    - Toolbar closes immediately

4. **Option C: Click in editor to clear selection**
    - Select text
    - Click elsewhere in editor (not on toolbar)
    - Console shows: `Selection cleared by user`
    - Toolbar closes

### Test 5: Full Workflow

1. Select text: "The cat walked slow"
2. Toolbar appears
3. Type in input: "fix grammar"
4. Press Enter (or click "Suggest")
5. Watch diff appear with streaming text
6. Click "Accept"
7. Text should change to "The cat walked slowly"
8. Press Ctrl+Z to undo
9. Text reverts

## Console Output Guide

When working correctly, you should see:

```
Selection change event: { range: { index: 4, length: 5 }, oldRange: null, source: "user" }
Selection detected: { range: { index: 4, length: 5 }, text: "quick", length: 5 }
Setting toolbar position: { top: 123, left: 456 } editorRect: DOMRect {...} bounds: {...}
Toolbar should be visible now
```

If you move mouse after selecting:

```
Selection change event: { range: null, oldRange: { index: 4, length: 5 }, source: "user" }
Editor lost focus, keeping toolbar open
```

If you click in editor to clear:

```
Selection change event: { range: { index: 10, length: 0 }, oldRange: { index: 4, length: 5 }, source: "user" }
Selection cleared by user
```

## Visual Indicators

**Status Bar** (top of editor):

- Shows connection status
- Shows selection range (e.g., `4:11`)
- Shows toolbar state (`YES` or `no`)
- Shows suggestion state (`YES` or `no`)

**Debug Box** (yellow, top-right corner):

- Only appears when toolbar should be visible
- Shows the calculated position
- If this appears but toolbar doesn't, check console for position values

**Toolbar** (near selection):

- White box with rounded corners
- Shadow for depth
- Contains:
    - Input field (placeholder: "improve this writing")
    - Blue "Suggest" button
    - Gray X close button

## Keyboard Shortcuts

| Key                | Action                            |
| ------------------ | --------------------------------- |
| Escape             | Close toolbar / Reject suggestion |
| Enter (in toolbar) | Submit suggestion request         |
| Ctrl/Cmd + Z       | Undo accepted suggestion          |
| Shift + Arrows     | Select text with keyboard         |

## Troubleshooting

### Toolbar Still Not Appearing

**Check 1**: Look for yellow debug box

- If yellow box appears → toolbar is rendering but positioned wrong
- If no yellow box → selection not being detected

**Check 2**: Console logs

```javascript
// Should see these when selecting:
"Selection change event: ...";
"Selection detected: ...";
"Toolbar should be visible now";
```

**Check 3**: Inspect DOM

```javascript
// In browser console
document.querySelector('input[placeholder="improve this writing"]');
// Should return HTMLInputElement if rendered
```

**Check 4**: Force position

```javascript
const toolbar = document.querySelector('input[placeholder="improve this writing"]')?.parentElement;
if (toolbar) {
    toolbar.style.top = "200px";
    toolbar.style.left = "200px";
    toolbar.style.background = "red";
}
```

### Toolbar Appears But Can't Click It

**Check**: Make sure you're clicking **on** the toolbar, not near it.

- The `onMouseDown` preventDefault should prevent focus loss
- If clicking still clears it, check browser console for errors

### Suggestion Not Streaming

**Check 1**: API endpoint

```bash
curl -X POST http://localhost:3001/completions/suggest \
  -H "Content-Type: application/json" \
  -d '{"doc_id":"test","user_id":"test","prompt":"improve","context":"hello"}'
```

**Check 2**: Browser Network tab

- Look for POST to `/completions/suggest`
- Status should be 200
- Response should stream

**Check 3**: Backend logs

- Should see "handleSuggestStream" logs
- Should show document content being read

## Summary of Key Fixes

1. ✅ **Don't hide toolbar when editor loses focus** (range === null)
2. ✅ **Prevent toolbar from stealing focus** (onMouseDown preventDefault)
3. ✅ **Keep toolbar visible when interacting with it**
4. ✅ **Add Escape key to close toolbar**
5. ✅ **Add close button (X) to toolbar**
6. ✅ **Better console logging for debugging**
7. ✅ **Fixed positioning** (position: fixed instead of absolute)

The toolbar should now stay visible and usable! Test it out and let me know if you see any issues.
