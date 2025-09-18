# Project Structure & Organization

## Directory Layout

### Core Extension Components
- **`background/`** - Background script handling API calls, message routing, and extension lifecycle
- **`content/`** - Content scripts injected into Azure DevOps pages for DOM manipulation and extraction
- **`popup/`** - Extension popup interface (browser toolbar button)
- **`options/`** - Settings/configuration page for API keys and prompts
- **`feedback/`** - Dedicated feedback display window with copyable snippets
- **`shared/`** - Shared constants, utilities, and cross-component code

### Supporting Files
- **`icons/`** - Extension icons in multiple sizes (16, 32, 48, 128px)
- **`tests/`** - Jest test suite with comprehensive mocks and utilities
- **`docs/`** - Project documentation, requirements, and technical specs
- **`screenshots/`** - UI screenshots for README and documentation

## File Naming Conventions

### JavaScript Files
- **Component files**: `component-name.js` (kebab-case)
- **Test files**: `component-name.test.js`
- **Utility files**: `utility-name.js`
- **Constants**: `constants.js`

### HTML/CSS Files
- **HTML pages**: `page-name.html`
- **Stylesheets**: `page-name.css` (co-located with HTML)

## Code Organization Patterns

### Content Scripts
- **Main extractor**: `content-script.js` - DOM manipulation and extraction logic
- **Utilities**: `extraction-utils.js` - Reusable extraction and validation functions
- **Cross-browser compatibility**: Use `browserAPI` abstraction layer

### Background Scripts
- **Message handling**: Centralized message routing between components
- **API integration**: Separate functions for each AI provider
- **Storage management**: Browser extension storage operations

### Shared Components
- **Constants**: Global configuration and default templates
- **Cross-browser APIs**: Compatibility layer for Firefox/Chrome differences

## Configuration Files

### Extension Configuration
- **`manifest.json`** - Extension manifest, permissions, and metadata
- **`package.json`** - NPM dependencies, scripts, and project metadata

### Development Configuration
- **`.gitignore`** - Version control exclusions
- **ESLint config** - Embedded in `package.json`
- **Jest config** - Embedded in `package.json` with `tests/setup.js`

## Documentation Structure

### Core Documentation
- **`README.md`** - Main project documentation with setup and usage
- **`docs/`** - Detailed technical documentation and requirements

### Development Documentation
- **`docs/technical/`** - Architecture, deployment, and technical specifications
- **`docs/stories/`** - User stories and acceptance criteria
- **`docs/epics/`** - Feature epics and high-level requirements

## Asset Organization

### Icons
- Multiple sizes for different contexts (toolbar, settings, notifications)
- Consistent branding across all icon sizes

### Screenshots
- UI demonstration images for documentation
- Feature showcase for README and store listings

## Testing Structure

### Test Organization
- **Unit tests**: One test file per component
- **Mocks**: Centralized in `tests/setup.js`
- **Utilities**: Shared test helpers and mock factories
- **Coverage**: Comprehensive coverage of core functionality