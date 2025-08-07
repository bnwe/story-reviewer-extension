# Epic: Comprehensive Popup Redesign

## Epic Overview

**Epic Title:** Enhance the Feedback dialog through formatting and additional functionality

**Epic ID:** EPIC-002

**Epic Goal:** Improve usability of the feedback dialog through formatting, offer copy-snippet functionality and show full prompt

## Existing System Context

### Status quo
- Even if LLM output contains html, it is not shown
- AI Feedback section shows the preview prompt, but not the actual prompt sent
- copy is only possible for the entire output

## Enhancement Details

### Enhancement Scope
- Support for html output formatting
- add copy-snippet buttons
- show actual prompt that was sent

## Stories Breakdown

### Story 1: Output formatting with HTML
- Update the default prompt to prompt for an HTML output
- The LLM's response is shown formatted in the feedback dialog

### Story 2: Show full prompt instead of prompt preview
- in the feedback dialog the prompt preview is removed, since it has no value for the user
- instead there is a button "Show Prompt" that shows the exact prompt that was sent to the LLM (not the template, but the actual prompt that was sent in the request)
- there is another button "Show Response" that shows the actual response of the LLM (showing the html tags not rendered)
- The two buttons show the respective text by expanding to below. Collapsing is also possible.

### Story 3: Copy to clipboard of snippets in the output

## Compatibility Requirements

### Browser Compatibility
- Maintain Firefox Manifest V2 compatibility
- Ensure Chrome compatibility (existing cross-browser support)
- Test across different browser versions

### Extension Integration
- Preserve existing content script integration
- Maintain background script communication
- Keep storage API usage patterns
- Ensure options page consistency

### Performance Requirements
- Maintain fast popup load times (<200ms)
- Ensure smooth animations (60fps)
- Keep memory usage minimal
- Preserve existing extraction performance

## Technical Considerations

### Existing Patterns to Preserve
- Cross-browser API usage (`typeof browser !== 'undefined' ? browser : chrome`)
- CSS custom properties architecture
- Message passing with content scripts
- Storage API usage patterns
- Error handling approaches
