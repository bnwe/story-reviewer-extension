# Component Interactions

- **Data Flow:**
  1. User opens a user story in Azure DevOps.
  2. User manually initiates the feedback process via the extension.
  3. Extension extracts story content and sends it to the LLM via REST API.
  4. LLM analyzes content and returns feedback.
  5. Extension displays feedback in a separate browser window.

- **Handling Long-Running Queries:**
  - Implement asynchronous API calls to handle long response times.
  - Use loading indicators to inform users of ongoing processing.
  - Ensure the UI can handle and display large text responses efficiently.