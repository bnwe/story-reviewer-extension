# Design Document

## Overview

The refresh button enhancement modifies the existing refresh button in the feedback window to trigger a complete workflow of content re-extraction from the Azure DevOps page and AI feedback regeneration. This design leverages the existing extension architecture and message passing system to implement the functionality with minimal changes to the current codebase.

## Architecture

The enhancement follows the existing extension's message-driven architecture:

1. **Feedback Window** (`feedback/feedback.js`) - Contains the refresh button and initiates the refresh process
2. **Background Script** (`background/background.js`) - Coordinates message passing between components
3. **Content Script** (`content/content-script.js`) - Re-extracts story content from the Azure DevOps DOM
4. **Extraction Utils** (`content/extraction-utils.js`) - Provides content extraction logic

## Components and Interfaces

### Feedback Window Enhancement

**File**: `feedback/feedback.js`

The existing refresh button will be enhanced with a click event handler that:
- Sends a message to the background script to initiate content re-extraction
- Updates the UI to show loading state during the operation
- Handles the response with new feedback content

**New Message Types**:
- `REFRESH_CONTENT` - Sent from feedback window to background script
- `CONTENT_REFRESHED` - Sent from background script back to feedback window with new feedback

### Background Script Enhancement

**File**: `background/background.js`

The background script will handle the new refresh workflow:
- Receive `REFRESH_CONTENT` message from feedback window
- Send `EXTRACT_CONTENT` message to the active Azure DevOps tab
- Receive extracted content from content script
- Process content through existing AI API logic
- Send `CONTENT_REFRESHED` message back to feedback window

### Content Script Integration

**File**: `content/content-script.js`

The content script will reuse existing extraction logic:
- Listen for `EXTRACT_CONTENT` messages from background script
- Use existing `extractStoryContent()` function to get current DOM content
- Send extracted content back to background script

No changes needed to extraction logic since it already handles current DOM state.

## Data Models

### Message Structure

```javascript
// Refresh initiation message
{
  type: 'REFRESH_CONTENT',
  tabId: number
}

// Content refreshed response
{
  type: 'CONTENT_REFRESHED',
  success: boolean,
  feedback?: string,
  error?: string
}
```

### Content Extraction

Reuses existing content extraction data model:
```javascript
{
  title: string,
  description: string,
  acceptanceCriteria: string[]
}
```

## Error Handling

The enhancement will integrate with existing error handling patterns:

1. **Content Extraction Errors**: If content extraction fails, the background script will send an error response to the feedback window
2. **API Errors**: Existing API error handling in the background script will be reused
3. **UI Error Display**: The feedback window will display error messages using existing error display mechanisms

## Testing Strategy

### Unit Tests

**New Test Files**:
- Enhance existing `tests/feedback.test.js` to cover refresh button functionality
- Add refresh workflow tests to `tests/background.test.js`

**Test Scenarios**:
- Refresh button click triggers correct message flow
- Content re-extraction and feedback regeneration
- Error handling for extraction and API failures
- UI state management during refresh operation

### Integration Tests

- End-to-end refresh workflow from button click to feedback display
- Message passing between all components
- Error propagation through the system

## Implementation Approach

### Phase 1: Message Infrastructure
1. Add new message types to `shared/constants.js`
2. Implement message handlers in background script
3. Add refresh message sender in feedback window

### Phase 2: UI Integration
1. Enhance refresh button click handler in feedback window
2. Add loading state management
3. Implement error display for refresh failures

### Phase 3: Testing and Validation
1. Add comprehensive unit tests
2. Test error scenarios and edge cases
3. Validate integration with existing functionality