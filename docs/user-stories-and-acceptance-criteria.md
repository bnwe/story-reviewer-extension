# User Stories and Acceptance Criteria

- **User Story 1: Extract User Story Content**
  - As a Product Owner, I want the extension to extract the user story content from Azure DevOps, so that I can receive feedback on it.

  - **Acceptance Criteria:**
    1. The extension identifies and extracts the user story content from the current tab.
    2. The extracted content is accurately captured for analysis.

- **User Story 2: Provide Feedback**
  - As a Product Owner, I want the extension to provide feedback on my user story, so that I can improve its quality.

  - **Acceptance Criteria:**
    1. The extension sends the extracted content to the LLM via REST API.
    2. The feedback is displayed to the user in a clear and actionable format.
    3. Users can copy feedback snippets to the clipboard.