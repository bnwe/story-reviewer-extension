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

Goal of the story: snippets from the LLM's response, that can be copy pasted literaly into the story, will show a copy button on hover for copying to the clipboard

- The prompt to the LLM should tell it to create literal suggestions for improvement, where approriate. This means that it might e.g. suggest an additional Acceptance criterion. This should then be surrounded by a special xml tag, which can then be parsed by the browser extension.
- The parsing should then do the following:
  - Replace the special tags by proper html tags that lightly color the copyable text snippet
  - Show a small copy button on hovering this piece of text that allows the user to copy to clipboard

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
