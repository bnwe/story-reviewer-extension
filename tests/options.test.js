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
        <option value="custom">Custom</option>
      </select>
      <input id="apiKey" type="password" />
      <input id="customEndpoint" type="url" />
      <div id="customEndpointGroup" style="display: none;"></div>
      <button id="toggleApiKey">Show</button>
      <button id="testConnection">Test Connection</button>
      <button id="saveSettings">Save Settings</button>
      <button id="resetSettings">Reset Settings</button>
      <span id="connectionStatus" class="status"></span>
      <div id="statusMessage" class="status-message"></div>
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
        customEndpoint: ''
      });
    });

    test('should load existing settings on init', async () => {
      const savedSettings = {
        apiProvider: 'anthropic',
        apiKey: 'test-key',
        customEndpoint: ''
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
    test('should show custom endpoint field when custom provider selected', () => {
      const options = new OptionsManager();
      const providerSelect = document.getElementById('apiProvider');
      const customEndpointGroup = document.getElementById('customEndpointGroup');

      providerSelect.value = 'custom';
      options.handleProviderChange();

      expect(customEndpointGroup.style.display).toBe('flex');
    });

    test('should hide custom endpoint field for standard providers', () => {
      const options = new OptionsManager();
      const providerSelect = document.getElementById('apiProvider');
      const customEndpointGroup = document.getElementById('customEndpointGroup');

      providerSelect.value = 'openai';
      options.handleProviderChange();

      expect(customEndpointGroup.style.display).toBe('none');
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
          customEndpoint: ''
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

  describe('Settings Management', () => {
    test('should save settings successfully', async () => {
      const options = new OptionsManager();
      const statusMessage = document.getElementById('statusMessage');
      
      document.getElementById('apiProvider').value = 'openai';
      document.getElementById('apiKey').value = 'test-key';
      
      // Mock successful storage
      mockChrome.storage.sync.set.mockImplementation((settings, callback) => {
        callback();
      });
      
      await options.saveSettings();
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      }, expect.any(Function));
      
      expect(statusMessage.textContent).toBe('Settings saved successfully!');
      expect(statusMessage.className).toBe('status-message success');
    });

    test('should handle save failure', async () => {
      const options = new OptionsManager();
      const statusMessage = document.getElementById('statusMessage');
      
      // Mock storage failure
      mockChrome.storage.sync.set.mockImplementation((settings, callback) => {
        mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });
      
      await options.saveSettings();
      
      expect(statusMessage.textContent).toBe('Failed to save settings: Storage quota exceeded');
      expect(statusMessage.className).toBe('status-message error');
    });

    test('should reset settings to defaults', async () => {
      const options = new OptionsManager();
      const statusMessage = document.getElementById('statusMessage');
      
      // Mock confirm dialog
      global.confirm = jest.fn(() => true);
      
      // Mock successful storage
      mockChrome.storage.sync.set.mockImplementation((settings, callback) => {
        callback();
      });
      
      await options.resetSettings();
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        options.defaultSettings,
        expect.any(Function)
      );
      
      expect(statusMessage.textContent).toBe('Settings reset to defaults');
      expect(statusMessage.className).toBe('status-message success');
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
        customEndpoint: ''
      }, expect.any(Function));
    });
  });

  describe('Utility Functions', () => {
    test('should get current settings from form', () => {
      const options = new OptionsManager();
      
      document.getElementById('apiProvider').value = 'anthropic';
      document.getElementById('apiKey').value = 'test-key';
      document.getElementById('customEndpoint').value = 'https://api.example.com';
      
      const settings = options.getCurrentSettings();
      
      expect(settings).toEqual({
        apiProvider: 'anthropic',
        apiKey: 'test-key',
        customEndpoint: 'https://api.example.com'
      });
    });

    test('should display provider names correctly', () => {
      const options = new OptionsManager();
      
      expect(options.getProviderDisplayName('openai')).toBe('OpenAI');
      expect(options.getProviderDisplayName('anthropic')).toBe('Anthropic (Claude)');
      expect(options.getProviderDisplayName('custom')).toBe('Custom API');
      expect(options.getProviderDisplayName('unknown')).toBe('unknown');
    });
  });
});