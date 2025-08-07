# Azure DevOps Story Reviewer

A browser extension that extracts user story content from Azure DevOps work items and provides AI-powered feedback to improve story quality and completeness.

## Features

- **Smart Content Extraction**: Automatically extracts user stories, acceptance criteria, and metadata from Azure DevOps work items
- **AI-Powered Feedback**: Get intelligent suggestions to improve story quality using AI
- **Customizable**: Choose your model from OpenAI, Anthropic Claude, or Mistral and customize model temperature
- **Rich Text Support**: Handles various Azure DevOps text editors including Monaco editor and rich text fields
- **Validation**: Built-in validation for user story format and completeness
- **Cross-Browser Support**: Works with Firefox and Chrome-based browsers
- **Secure**: API keys stored locally, no data sent to third parties except chosen AI providers

## Copyable Snippets

The extension provides intelligent **copyable snippets** for feedback that contains actionable text you can directly paste into Azure DevOps work items. It supports both plain text and html for pasting back.

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/azure-devops-story-reviewer.git
   cd azure-devops-story-reviewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in your browser:

   **Firefox:**
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

   **Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project folder

### From Browser Store

*Coming soon - extension will be available on Firefox Add-ons and Chrome Web Store*

## Setup

1. Click the extension icon in your browser toolbar
2. Go to "Options" 
3. Configure your AI provider:
   - **OpenAI**: Enter your OpenAI API key
   - **Anthropic**: Enter your Anthropic API key  
   - **Mistral**: Enter your Mistral API key
4. Test the connection to ensure everything works
5. Settings are automatically saved as you make changes

## Usage

1. Navigate to any Azure DevOps work item page
2. The extension will automatically detect work items and add a "Get Feedback" button
3. Click "Get Feedback" to extract content and receive AI-powered suggestions for improvement
4. Review the feedback in the dedicated feedback window
5. Click individual **copyable snippets** (green highlighted text) to copy specific suggestions
6. Use "Copy Feedback" to copy all feedback to clipboard
7. View "LLM details" to see technical information about the AI analysis

### Supported Work Item Types

- User Stories
- Bugs  
- Tasks
- Features
- Any custom work item types

### Supported Azure DevOps Domains

- `https://dev.azure.com/*`
- `https://*.visualstudio.com/*`

## Development

### Prerequisites

- Node.js 14+ and npm
- Modern web browser (Firefox 78+ or Chrome 88+)

### Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Start development: `npm run dev`

### Project Structure

```
├── background/          # Background script for API calls
├── content/            # Content scripts for Azure DevOps integration
├── feedback/           # Feedback display interface
├── options/            # Extension options/settings page
├── popup/              # Extension popup interface
├── tests/              # Jest test suite
├── manifest.json       # Extension manifest
└── package.json        # Project configuration
```

### Testing

Run the full test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### Linting

Check code quality:
```bash
npm run lint
```

Auto-fix issues:
```bash
npm run lint:fix
```

### Building

Create production build:
```bash
npm run build
```

Package for distribution:
```bash
npm run package
```

## Configuration

### API Providers

The extension supports multiple AI providers:

| Provider | API Endpoint | Required |
|----------|-------------|----------|
| OpenAI | `https://api.openai.com/v1/chat/completions` | API Key |
| Anthropic | `https://api.anthropic.com/v1/messages` | API Key |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | API Key |

### Permissions

The extension requires these permissions:

- `activeTab`: Read current tab content
- `storage`: Store API keys and settings
- `https://dev.azure.com/*`: Access Azure DevOps pages
- `https://*.visualstudio.com/*`: Access Azure DevOps pages

## Privacy & Security

- API keys are stored locally in your browser using secure extension storage
- No user data is collected or sent to extension developers
- Content is only sent to your chosen AI provider for feedback
- All communication uses HTTPS encryption
- Extension only runs on Azure DevOps domains

## Contributing

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Ensure linting passes: `npm run lint`
6. Commit changes: `git commit -m "Add amazing feature"`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Planned Features

- Show token usage
- Offer more variables (e.g. implementation details)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for better user stories**