# Technology Stack

## Browser Extension Architecture

- **Manifest Version**: 2 (Firefox and Chrome compatible)
- **Extension Type**: Content script + background script architecture
- **Target Browsers**: Firefox 126+, Chrome 88+

## Core Technologies

- **JavaScript**: ES2021, no build transpilation
- **HTML/CSS**: Vanilla implementation with inline styles
- **APIs**: Chrome Extension APIs with cross-browser compatibility layer

## Key Libraries & Dependencies

### Development Dependencies
- **Jest**: Testing framework with jsdom environment
- **ESLint**: Code linting with Mozilla extension rules
- **web-ext**: Firefox extension development and packaging tool

### Runtime Dependencies
- **None**: Pure vanilla JavaScript implementation

## Project Structure

```
├── background/          # Background script for API calls and message handling
├── content/            # Content scripts for Azure DevOps DOM integration
├── feedback/           # Feedback display interface (popup window)
├── options/            # Extension settings/configuration page
├── popup/              # Extension popup interface
├── shared/             # Shared constants and utilities
├── tests/              # Jest test suite with mocks
├── icons/              # Extension icons (16, 32, 48, 128px)
└── manifest.json       # Extension manifest and permissions
```

## Build & Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Code quality
npm run lint
npm run lint:fix

# Build and package
npm run build          # Runs lint + test
npm run dev           # Development with web-ext
npm run package       # Create distribution package
```

## API Integration

- **OpenAI**: GPT models with temperature control
- **Anthropic**: Claude models 
- **Mistral**: Mistral models
- **Custom endpoints**: Extensible for other providers

## Cross-Browser Compatibility

Uses `browserAPI` abstraction:
```javascript
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
```

## Testing Strategy

- **Unit tests**: Jest with jsdom environment
- **Mocks**: Chrome extension APIs, DOM elements, Azure DevOps pages
- **Coverage**: Content scripts, background scripts, UI components
- **Test utilities**: Shared mocks and helpers in `tests/setup.js`