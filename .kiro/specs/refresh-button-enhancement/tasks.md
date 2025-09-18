# Implementation Plan

- [x] 1. Add refresh message constants to shared constants
  - Add new message type constants `REFRESH_CONTENT` and `CONTENT_REFRESHED` to `shared/constants.js`
  - Ensure constants follow existing naming conventions in the file
  - _Addresses: Requirement 1 - Acceptance Criteria 1_

- [x] 2. Implement refresh message handler in background script
  - Add message handler for `REFRESH_CONTENT` in `background/background.js`
  - Implement logic to forward content extraction request to active tab
  - Process extracted content through existing AI API workflow
  - Send `CONTENT_REFRESHED` response back to feedback window
  - _Addresses: Requirement 1 - Acceptance Criteria 1, 2, 3_

- [x] 3. Enhance refresh button functionality in feedback window
  - Modify refresh button click handler in `feedback/feedback.js` to send `REFRESH_CONTENT` message
  - Add loading state management during refresh operation
  - Implement handler for `CONTENT_REFRESHED` response to update feedback display
  - _Addresses: Requirement 1 - Acceptance Criteria 1, 4_

- [x] 4. Add comprehensive unit tests for refresh functionality
  - Enhance `tests/feedback.test.js` to test refresh button click and message sending
  - Add tests to `tests/background.test.js` for refresh message handling and workflow
  - Test error scenarios including content extraction failures and API errors
  - Verify UI state management during refresh operations
  - _Addresses: All acceptance criteria through test validation_

- [x] 5. Test end-to-end refresh workflow integration
  - Create integration test that verifies complete refresh workflow from button click to feedback update
  - Test message passing between feedback window, background script, and content script
  - Validate that refresh uses existing content extraction and API processing logic
  - Ensure error handling works correctly across all components
  - _Addresses: Complete workflow validation for Requirement 1_

- [x] 6. Fix refresh button bug when feedback window is active
  - Fixed issue where refresh failed with "Active tab is not an Azure DevOps page" when feedback window was active
  - Store Azure DevOps tab ID when opening feedback window in `content/content-script.js`
  - Pass tab ID in REFRESH_CONTENT message from `feedback/feedback.js`
  - Use specific tab ID instead of active tab in `background/background.js` handleRefreshContent function
  - Updated tests to include tabs.get mock and corrected error message
  - _Addresses: Bug fix for refresh functionality when feedback window has focus_

- [x] 7. Fix popup "Get Feedback" button failure
  - Fixed critical bug where "Get Feedback" button in popup failed with "Failed to open feedback window"
  - Root cause: Content script tried to use `chrome.tabs.query()` API which is not available in content script context
  - Solution: Moved tab ID storage to background script using new `STORE_TAB_ID` message
  - Added `STORE_TAB_ID` message handler in background script to store tab ID from sender.tab.id
  - Updated content script to send `STORE_TAB_ID` message instead of directly accessing tabs API
  - Added new message constant to `shared/constants.js`
  - _Addresses: Critical bug fix for popup functionality_

- [x] 8. Fix refresh not updating "Original Story" content
  - Fixed bug where refresh button updated feedback but not the "Original Story" section
  - Root cause: Background script's `handleRefreshContent` function didn't include `extractedContent` in response
  - Solution: Added `extractedContent: storedData.extractedContent` to the refresh response in background script
  - Updated tests to expect the new `extractedContent` field in refresh responses
  - Now when refresh is clicked, both the feedback and original story content are updated with newly extracted data
  - _Addresses: Bug fix for refresh functionality to update all content sections_