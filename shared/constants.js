// Shared constants for the Azure DevOps Story Reviewer extension
// This file centralizes constants used across multiple components

// Default prompt template used for all AI providers
const DEFAULT_PROMPT_TEMPLATE = `You are an experienced Product Manager, Product Owner, Software Engineer and QA Engineer. Please provide feedback on this Azure DevOps work item. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

Work Item Details:
<workitem>
{{formattedContent}}
</workitem>

Please provide your feedback in HTML format with clear sections for different aspects of the work item. Use proper HTML tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> to structure your response. This will improve readability and allow for better formatting.

Consider the following aspects in your review:
- **Work Item Type**: {{workItemType}} - tailor your feedback appropriately
- **Effort Estimation**: {{storyPoints}} story points - assess if this aligns with complexity
- **Priority**: {{priority}} - evaluate if this matches business importance

When providing specific text suggestions that can be copied and pasted directly into the Azure DevOps work item (such as additional acceptance criteria, improved descriptions, or refined user story text), wrap these copyable snippets in <copyable></copyable> tags. For example:
- If suggesting a new acceptance criterion: <copyable>Given X when Y then Z</copyable>
- If suggesting improved wording: <copyable>As a user, I want to...</copyable>
- If suggesting additional details: <copyable>The system should validate...</copyable>

Only use copyable tags for literal text that can be directly copied into Azure DevOps work items, not for explanatory text or analysis.

Inside the copyable tags please use regular HTML formatting, so that formatting is transfered to Azure DevOps as well. E.g. for lists use <ul> or <ol> tags etc.

Example: <p>Here are some improved acceptance criteria:</p><ol><li>User is presented option to cancel or continue</li><li>After canceling, the draft is discarded.</li></ol>

Important note: You are only to respond with the HTML as described. No further notes, or comments. Not markdown, only HTML.`;

// Function to get the default prompt template
function getDefaultPromptTemplate() {
  return DEFAULT_PROMPT_TEMPLATE;
}

// Export for different module systems (Manifest V2 compatibility)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for tests)
  module.exports = {
    DEFAULT_PROMPT_TEMPLATE,
    getDefaultPromptTemplate
  };
}

// Make available globally for browser extension contexts
if (typeof window !== 'undefined') {
  window.StoryReviewerConstants = {
    DEFAULT_PROMPT_TEMPLATE,
    getDefaultPromptTemplate
  };
}