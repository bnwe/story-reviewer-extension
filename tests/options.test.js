// Tests for options page functionality
// Test API key configuration, storage, and validation

describe('Options Page Tests', () => {
  let mockChrome;
  let OptionsManager;

  beforeEach(() => {
    // Mock Chrome APIs
    mockChrome = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn(),
        openOptionsPage: jest.fn(),
        lastError: null
      }
    };
    global.chrome = mockChrome;

    // Mock DOM elements
    document.body.innerHTML = `
      <select id="apiProvider">
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="mistral">Mistral</option>
      </select>
      <input id="apiKey" type="password" />
      <select id="modelSelect">
        <option value="">Select a model...</option>
      </select>
      <button id="toggleApiKey">Show</button>
      <button id="testConnection">Test Connection</button>
      <span id="connectionStatus" class="status"></span>
      <div id="statusMessage" class="status-message"></div>
      
      <!-- Prompt Management Elements -->
      <div class="prompt-tabs">
        <button class="prompt-tab active" data-provider="openai">OpenAI</button>
        <button class="prompt-tab" data-provider="anthropic">Anthropic</button>
        <button class="prompt-tab" data-provider="custom">Custom API</button>
      </div>
      <textarea id="customPrompt" rows="10"></textarea>
      <span id="promptCharCount">0</span>
      <button id="previewPrompt">Preview Prompt</button>
      <button id="resetPrompt">Reset to Default</button>
      <button id="exportPrompts">Export All Prompts</button>
      <button id="importPrompts">Import Prompts</button>
      <input type="file" id="importFile" accept=".json" style="display: none;">
      <div id="promptValidation" class="validation-message"></div>
      
      <!-- Preview Modal -->
      <div id="previewModal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Prompt Preview</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="previewText" class="preview-text"></div>
            <button id="copyPreview">Copy to Clipboard</button>
          </div>
        </div>
      </div>
      <input type="number" id="temperature" min="0" max="2" step="0.1" value="0.7" />
    `;

    // Load OptionsManager class by executing the file content
    const fs = require('fs');
    const path = require('path');
    const optionsJs = fs.readFileSync(
      path.join(__dirname, '../options/options.js'), 
      'utf8'
    );
    
    // Remove the DOMContentLoaded listener for testing and expose class
    const testableCode = optionsJs.replace(
      /document\.addEventListener\('DOMContentLoaded'.*?\}\);/s, 
      'global.OptionsManager = OptionsManager;'
    );
    
    eval(testableCode);
    OptionsManager = global.OptionsManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
    delete global.OptionsManager;
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      const options = new OptionsManager();
      expect(options.defaultSettings).toEqual({
        apiProvider: 'openai',
        apiKey: '',
        model: '',
        customPrompt: '',
        promptVersion: '1.0',
        promptBackups: [],
        temperature: 0.7,
        maxTokens: 10000
      });
    });

    test('should load existing settings on init', async () => {
      const savedSettings = {
        apiProvider: 'anthropic',
        apiKey: 'test-key',
        customPrompts: {},
        promptVersion: '1.0',
        promptBackups: []
      };
      
      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(savedSettings);
      });

      const options = new OptionsManager();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async init

      expect(document.getElementById('apiProvider').value).toBe('anthropic');
      expect(document.getElementById('apiKey').value).toBe('test-key');
    });
  });

  describe('Provider Selection', () => {
    test('should support mistral provider', () => {
      const options = new OptionsManager();
      expect(options.getProviderDisplayName('mistral')).toBe('Mistral AI');
    });
  });

  describe('API Key Visibility', () => {
    test('should toggle API key visibility', () => {
      const options = new OptionsManager();
      const apiKeyInput = document.getElementById('apiKey');
      const toggleBtn = document.getElementById('toggleApiKey');

      expect(apiKeyInput.type).toBe('password');
      expect(toggleBtn.textContent).toBe('Show');

      options.toggleApiKeyVisibility();

      expect(apiKeyInput.type).toBe('text');
      expect(toggleBtn.textContent).toBe('Hide');

      options.toggleApiKeyVisibility();

      expect(apiKeyInput.type).toBe('password');
      expect(toggleBtn.textContent).toBe('Show');
    });
  });

  describe('Connection Testing', () => {
    test('should show error when no API key provided', async () => {
      const options = new OptionsManager();
      const statusElement = document.getElementById('connectionStatus');
      
      document.getElementById('apiKey').value = '';
      
      await options.testConnection();
      
      expect(statusElement.textContent).toBe('Please enter an API key first');
      expect(statusElement.className).toBe('status error');
    });

    test('should test connection with valid settings', async () => {
      const options = new OptionsManager();
      const statusElement = document.getElementById('connectionStatus');
      const testBtn = document.getElementById('testConnection');
      
      document.getElementById('apiProvider').value = 'openai';
      document.getElementById('apiKey').value = 'test-key';
      
      // Mock successful API response
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true, message: 'Connection successful!' });
      });
      
      await options.testConnection();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'testApiConnection',
        settings: {
          apiProvider: 'openai',
          apiKey: 'test-key',
          model: '',
          customPrompt: '',
          temperature: 0.7,
          maxTokens: 10000
        }
      }, expect.any(Function));
      
      expect(statusElement.textContent).toBe('Connection successful!');
      expect(statusElement.className).toBe('status success');
    });

    test('should handle connection failure', async () => {
      const options = new OptionsManager();
      const statusElement = document.getElementById('connectionStatus');
      
      document.getElementById('apiProvider').value = 'openai';
      document.getElementById('apiKey').value = 'invalid-key';
      
      // Mock failed API response
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: false, error: 'Invalid API key' });
      });
      
      await options.testConnection();
      
      expect(statusElement.textContent).toBe('Connection failed: Invalid API key');
      expect(statusElement.className).toBe('status error');
    });
  });


  describe('Auto-save Functionality', () => {
    test('should auto-save on input changes', async () => {
      const options = new OptionsManager();
      
      // Mock successful storage
      mockChrome.storage.sync.set.mockImplementation((settings, callback) => {
        callback();
      });
      
      document.getElementById('apiKey').value = 'new-key';
      await options.autoSave();
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        apiProvider: 'openai',
        apiKey: 'new-key',
        model: '',
        customPrompt: '',
        temperature: 0.7,
        maxTokens: 10000
      }, expect.any(Function));
    });
  });

  describe('Utility Functions', () => {
    test('should get current settings from form', () => {
      const options = new OptionsManager();
      
      document.getElementById('apiProvider').value = 'anthropic';
      document.getElementById('apiKey').value = 'test-key';
      
      const settings = options.getCurrentSettings();
      
      expect(settings).toEqual({
        apiProvider: 'anthropic',
        apiKey: 'test-key',
        model: '',
        customPrompt: '',
        temperature: 0.7,
        maxTokens: 10000
      });
    });

    test('should display provider names correctly', () => {
      const options = new OptionsManager();
      
      expect(options.getProviderDisplayName('openai')).toBe('OpenAI');
      expect(options.getProviderDisplayName('anthropic')).toBe('Anthropic (Claude)');
      expect(options.getProviderDisplayName('mistral')).toBe('Mistral AI');
      expect(options.getProviderDisplayName('unknown')).toBe('unknown');
    });
  });
});