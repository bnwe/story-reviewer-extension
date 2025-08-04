# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands
- `npm test` - Run the Jest test suite
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Generate test coverage reports
- `npm run lint` - Check code quality with ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run build` - Run full build (lint + test)
- `npm run dev` - Start development mode with web-ext
- `npm run package` - Package extension for distribution

### Running Individual Tests
- `npm test -- tests/specific-file.test.js` - Run a single test file
- `npm test -- --testNamePattern="test name"` - Run specific test by name

## Architecture Overview

This is a **Firefox browser extension** that extracts user story content from Azure DevOps work items and provides AI-powered feedback. The extension follows a client-server architecture with multiple AI provider support.

### Core Components

1. **Content Scripts** (`content/`)
   - `content-script.js` - Main content script with `AzureDevOpsStoryExtractor` class
   - `extraction-utils.js` - Utility functions for enhanced content extraction
   - Runs on Azure DevOps pages to inject extraction buttons and extract work item content

2. **Background Script** (`background/background.js`)
   - Handles API communication with OpenAI, Anthropic, or custom endpoints
   - Manages extension lifecycle and message passing
   - Implements custom prompt template system with variable substitution
   - Stores extracted content in browser storage

3. **UI Components**
   - `popup/` - Extension popup interface
   - `options/` - Settings page for API configuration
   - `feedback/` - Dedicated feedback display window

4. **Test Suite** (`tests/`)
   - Comprehensive Jest tests for all components
   - Uses jsdom for DOM testing
   - Coverage reports in `tests/coverage/`

### Key Features

- **Multi-Provider AI Support**: OpenAI, Anthropic Claude, and custom endpoints
- **Rich Content Extraction**: Handles Azure DevOps rich text editors and Monaco editor
- **Custom Prompt Templates**: Template system with variable substitution (e.g., `{{storyContent}}`)
- **Content Validation**: Built-in validation for extracted content quality
- **Cross-Browser Compatibility**: Firefox-first with Chrome support

### Extension Permissions

The extension requires access to:
- `https://dev.azure.com/*` and `https://*.visualstudio.com/*` for Azure DevOps integration
- `https://api.openai.com/*` and `https://api.anthropic.com/*` for AI services
- `activeTab` and `storage` for functionality

### Content Extraction Flow

1. Content script detects Azure DevOps work item pages
2. Injects "Extract Story" and "Get Feedback" buttons into page header
3. Extracts title, description, and acceptance criteria from DOM
4. Validates extracted content and sends to background script
5. Background script calls configured AI provider with custom prompt
6. Feedback displayed in popup window or dedicated feedback page

### Development Notes

- Extension uses Manifest V2 format
- Built with vanilla JavaScript (no framework dependencies)
- Uses web-ext for development and packaging
- ESLint configured with Mozilla extension rules
- Test environment configured for webextensions API mocking