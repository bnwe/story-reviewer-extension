# High-Level Architecture

- **Technical Summary:**
  - The architecture will support a Firefox extension that extracts user story content from Azure DevOps, sends it to an LLM via REST API, and displays feedback in a separate browser window. It will handle long-running queries and large responses efficiently.

- **Architecture Style:**
  - **Client-Server Model:** The extension acts as a client, interacting with a server-side LLM via REST API.

- **Key Components:**
  1. **Browser Extension:** 
     - Extracts user story content from Azure DevOps.
     - Opens a separate browser window for feedback display.
  2. **REST API Client:**
     - Sends extracted content to the LLM.
     - Receives and processes feedback.
     - Supports asynchronous handling of long-running queries.
  3. **LLM Server:**
     - Analyzes user story content and provides feedback.