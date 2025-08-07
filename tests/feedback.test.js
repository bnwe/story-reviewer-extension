// Tests for feedback window functionality
// Test feedback display, clipboard operations, and API integration

describe('Feedback Window Tests', () => {
  let mockChrome;
  let FeedbackManager;

  beforeEach(() => {
    // Mock Chrome APIs
    mockChrome = {
      storage: {
        sync: {
          get: jest.fn()
        },
        local: {
          get: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn(),
        openOptionsPage: jest.fn(),
        lastError: null
      }
    };
    global.chrome = mockChrome;

    // Mock navigator.clipboard
    global.navigator = {
      clipboard: {
        writeText: jest.fn()
      }
    };

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn()
    };

    // Mock DOM elements
    document.body.innerHTML = `
      <button id="refreshBtn">Refresh</button>
      <button id="settingsBtn">Settings</button>
      <button id="retryBtn">Try Again</button>
      <button id="checkSettingsBtn">Check Settings</button>
      <button id="openSettingsBtn">Configure API Key</button>
      <button id="toggleDebugBtn">Debug</button>
      <button id="copyAllBtn">Copy All</button>
      <button id="exportBtn">Export</button>
      <button id="togglePromptBtn"><span class="material-icons">expand_more</span>Toggle Prompt</button>
      <button id="toggleResponseBtn"><span class="material-icons">expand_more</span>Toggle Response</button>
      
      <div id="loadingState" class="state loading-state" style="display: flex;"></div>
      <div id="errorState" class="state error-state" style="display: none;"></div>
      <div id="noApiKeyState" class="state no-api-key-state" style="display: none;"></div>
      <div id="successState" class="state success-state" style="display: none;"></div>
      
      <span id="errorMessage">Error message</span>
      <div id="originalContent" class="content-box"></div>
      <div id="debugInfo" class="debug-info" style="display: none;">
        <div id="debugPromptType">Loading...</div>
        <div id="debugProvider">Loading...</div>
        <div id="debugModel">Loading...</div>
        <div id="debugTimestamp">Loading...</div>
      </div>
      <div id="actualPromptSection" class="expandable-section">
        <div id="promptSectionHeader" class="section-header"></div>
        <div id="actualPromptContent" class="code-content" style="display: none;"></div>
      </div>
      <div id="rawResponseSection" class="expandable-section">
        <div id="responseSectionHeader" class="section-header"></div>
        <div id="rawResponseContent" class="code-content" style="display: none;"></div>
      </div>
      <div id="feedbackContent" class="feedback-content"></div>
      <span id="timestampInfo">Last updated: Never</span>
      <span id="providerInfo">Provider: Not configured</span>
      <div id="copyNotification" class="notification" style="display: none;">
        <span class="icon">✅</span>
        <span>Copied to clipboard!</span>
      </div>
    `;

    // Load FeedbackManager class
    const fs = require('fs');
    const path = require('path');
    const feedbackJs = fs.readFileSync(
      path.join(__dirname, '../feedback/feedback.js'), 
      'utf8'
    );
    
    // Remove the DOMContentLoaded listener for testing and expose class
    const testableCode = feedbackJs.replace(
      /document\.addEventListener\('DOMContentLoaded'.*?\}\);/s, 
      'global.FeedbackManager = FeedbackManager;'
    );
    
    eval(testableCode);
    FeedbackManager = global.FeedbackManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
    delete global.navigator;
    delete global.URL;
    delete global.FeedbackManager;
  });

  describe('Initialization', () => {
    test('should initialize and check API configuration', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(mockSettings);
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          extractedContent: { title: 'Test Story' },
          extractionTimestamp: Date.now()
        });
      });

      const feedbackManager = new FeedbackManager();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.getElementById('providerInfo').textContent).toBe('Provider: OpenAI');
    });

    test('should show no API key state when not configured', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: '',
        customEndpoint: ''
      };

      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(mockSettings);
      });

      const feedbackManager = new FeedbackManager();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.getElementById('noApiKeyState').style.display).toBe('flex');
      expect(document.getElementById('providerInfo').textContent).toBe('Provider: Not configured');
    });
  });

  describe('Content Loading', () => {
    test('should load extracted content successfully', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockContent = {
        title: 'Test User Story',
        description: 'This is a test description',
        acceptanceCriteria: 'AC1: Test criteria'
      };

      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(mockSettings);
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          extractedContent: mockContent,
          extractionTimestamp: Date.now()
        });
      });

      // Mock successful LLM response
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'sendToLLM') {
          callback({
            success: true,
            feedback: 'This is great feedback for your story!'
          });
        }
      });

      const feedbackManager = new FeedbackManager();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'sendToLLM',
        content: mockContent,
        settings: mockSettings
      }, expect.any(Function));
    });

    test('should handle missing content gracefully', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(mockSettings);
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No extracted content
      });

      const feedbackManager = new FeedbackManager();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.getElementById('errorState').style.display).toBe('flex');
      expect(document.getElementById('errorMessage').textContent).toContain('No story content found');
    });
  });

  describe('Feedback Generation', () => {
    test('should generate feedback successfully', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockContent = {
        title: 'Test Story',
        description: 'Test description'
      };

      mockChrome.storage.sync.get.mockImplementation((defaults, callback) => {
        callback(mockSettings);
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          extractedContent: mockContent,
          extractionTimestamp: Date.now()
        });
      });

      // Mock successful LLM response
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          success: true,
          feedback: 'Excellent user story! Well structured and clear.'
        });
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentContent = mockContent;
      feedbackManager.currentSettings = mockSettings;

      await feedbackManager.generateFeedback();

      expect(document.getElementById('successState').style.display).toBe('block');
      expect(document.getElementById('feedbackContent').innerHTML).toContain('Excellent user story');
    });

    test('should handle API errors gracefully', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'invalid-key',
        customEndpoint: ''
      };

      const mockContent = { title: 'Test Story' };

      // Mock failed LLM response
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          success: false,
          error: 'Invalid API key'
        });
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentContent = mockContent;
      feedbackManager.currentSettings = mockSettings;

      await feedbackManager.generateFeedback();

      expect(document.getElementById('errorState').style.display).toBe('flex');
      expect(document.getElementById('errorMessage').textContent).toBe('Invalid API key');
    });
  });

  describe('Clipboard Operations', () => {
    test('should copy feedback to clipboard successfully', async () => {
      const feedbackManager = new FeedbackManager();
      
      document.getElementById('feedbackContent').textContent = 'Test feedback content';
      global.navigator.clipboard.writeText.mockResolvedValue();

      await feedbackManager.copyAllFeedback();

      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Test feedback content');
      expect(document.getElementById('copyNotification').style.display).toBe('flex');
    });

    test('should handle clipboard API errors with fallback', async () => {
      const feedbackManager = new FeedbackManager();
      
      document.getElementById('feedbackContent').textContent = 'Test feedback content';
      global.navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));

      // Mock document.execCommand for fallback
      document.execCommand = jest.fn(() => true);

      await feedbackManager.copyAllFeedback();

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });


  describe('State Management', () => {
    test('should show loading state', () => {
      const feedbackManager = new FeedbackManager();
      feedbackManager.showLoadingState();

      expect(document.getElementById('loadingState').style.display).toBe('flex');
      expect(document.getElementById('errorState').style.display).toBe('none');
      expect(document.getElementById('successState').style.display).toBe('none');
    });

    test('should show error state with message', () => {
      const feedbackManager = new FeedbackManager();
      feedbackManager.showError('Test error message');

      expect(document.getElementById('errorState').style.display).toBe('flex');
      expect(document.getElementById('errorMessage').textContent).toBe('Test error message');
      expect(document.getElementById('loadingState').style.display).toBe('none');
    });

    test('should show feedback content', () => {
      const feedbackManager = new FeedbackManager();
      const originalContent = { title: 'Test Story', description: 'Test description' };
      const feedback = 'Great feedback!';

      feedbackManager.showFeedback(originalContent, feedback);

      expect(document.getElementById('successState').style.display).toBe('block');
      expect(document.getElementById('originalContent').innerHTML).toContain('Test Story');
      expect(document.getElementById('feedbackContent').innerHTML).toContain('Great feedback!');
    });
  });

  describe('Content Formatting', () => {
    test('should format object content correctly', () => {
      const feedbackManager = new FeedbackManager();
      const content = {
        title: 'Test Story',
        description: 'Test description',
        acceptanceCriteria: 'AC1: Test criteria'
      };

      const formatted = feedbackManager.formatContent(content);

      expect(formatted).toContain('<h3>Title:</h3>');
      expect(formatted).toContain('<p>Test Story</p>');
      expect(formatted).toContain('<h3>Description:</h3>');
      expect(formatted).toContain('<div>Test description</div>');
    });

    test('should format feedback text with markdown-like formatting', () => {
      const feedbackManager = new FeedbackManager();
      const feedback = '**Bold text**\n\n* List item\n1. Numbered item';

      const formatted = feedbackManager.formatFeedback(feedback);

      expect(formatted).toContain('<strong>Bold text</strong>');
      expect(formatted).toContain('* List item'); // The * is not at start of line after \n\n replacement
      expect(formatted).toContain('1. Numbered item');
    });

    test('should detect HTML content correctly', () => {
      const feedbackManager = new FeedbackManager();

      expect(feedbackManager.isHtmlContent('<p>HTML content</p>')).toBe(true);
      expect(feedbackManager.isHtmlContent('<h2>Title</h2>')).toBe(true);
      expect(feedbackManager.isHtmlContent('Plain text content')).toBe(false);
      expect(feedbackManager.isHtmlContent('**Bold text**')).toBe(false);
    });

    test('should render HTML content when detected', () => {
      const feedbackManager = new FeedbackManager();
      const htmlFeedback = '<h2>Feedback Summary</h2><p>This is <strong>excellent</strong> feedback.</p><ul><li>Point 1</li><li>Point 2</li></ul>';

      const formatted = feedbackManager.formatFeedback(htmlFeedback);

      expect(formatted).toContain('<h2>Feedback Summary</h2>');
      expect(formatted).toContain('<strong>excellent</strong>');
      expect(formatted).toContain('<ul><li>Point 1</li><li>Point 2</li></ul>');
    });

    test('should sanitize HTML content for security', () => {
      const feedbackManager = new FeedbackManager();
      const maliciousHtml = '<p>Safe content</p><script>alert("xss")</script><div onclick="alert()">Clickable</div>';

      const sanitized = feedbackManager.sanitizeHtml(maliciousHtml);

      expect(sanitized).toContain('<p>Safe content</p>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('<div>Clickable</div>'); // Should keep content but remove onclick
    });

    test('should remove non-allowed HTML tags but keep content', () => {
      const feedbackManager = new FeedbackManager();
      const htmlWithForbiddenTags = '<p>Safe content</p><video>Video content</video><canvas>Canvas content</canvas>';

      const sanitized = feedbackManager.sanitizeHtml(htmlWithForbiddenTags);

      expect(sanitized).toContain('<p>Safe content</p>');
      expect(sanitized).toContain('Video content'); // Content preserved
      expect(sanitized).toContain('Canvas content'); // Content preserved
      expect(sanitized).not.toContain('<video>'); // Tag removed
      expect(sanitized).not.toContain('<canvas>'); // Tag removed
    });

    test('should escape HTML in content', () => {
      const feedbackManager = new FeedbackManager();
      const content = '<script>alert("xss")</script>';

      const escaped = feedbackManager.escapeHtml(content);

      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });
  });

  describe('Provider Display Names', () => {
    test('should return correct display names for providers', () => {
      const feedbackManager = new FeedbackManager();

      expect(feedbackManager.getProviderDisplayName('openai')).toBe('OpenAI');
      expect(feedbackManager.getProviderDisplayName('anthropic')).toBe('Anthropic (Claude)');
      expect(feedbackManager.getProviderDisplayName('custom')).toBe('Custom API');
      expect(feedbackManager.getProviderDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('Collapsible Sections', () => {
    test('should toggle prompt content visibility', () => {
      const feedbackManager = new FeedbackManager();
      const mockPromptInfo = {
        actualPrompt: 'Test actual prompt content'
      };
      feedbackManager.currentPromptInfo = mockPromptInfo;

      // Initially hidden
      expect(document.getElementById('actualPromptContent').style.display).toBe('none');

      // Show content
      feedbackManager.togglePromptContent();
      expect(document.getElementById('actualPromptContent').style.display).toBe('block');
      expect(document.getElementById('togglePromptBtn').querySelector('.material-icons').textContent).toBe('expand_less');

      // Hide content
      feedbackManager.togglePromptContent();
      expect(document.getElementById('actualPromptContent').style.display).toBe('none');
      expect(document.getElementById('togglePromptBtn').querySelector('.material-icons').textContent).toBe('expand_more');
    });

    test('should toggle response content visibility', () => {
      const feedbackManager = new FeedbackManager();
      
      // Initially hidden
      expect(document.getElementById('rawResponseContent').style.display).toBe('none');

      // Show content
      feedbackManager.toggleResponseContent();
      expect(document.getElementById('rawResponseContent').style.display).toBe('block');
      expect(document.getElementById('toggleResponseBtn').querySelector('.material-icons').textContent).toBe('expand_less');

      // Hide content
      feedbackManager.toggleResponseContent();
      expect(document.getElementById('rawResponseContent').style.display).toBe('none');
      expect(document.getElementById('toggleResponseBtn').querySelector('.material-icons').textContent).toBe('expand_more');
    });

    test('should populate debug sections when showing feedback', () => {
      const feedbackManager = new FeedbackManager();
      const originalContent = { title: 'Test Story' };
      const feedback = '<h2>Test Feedback</h2>';
      const rawResponse = '<h2>Raw Response</h2><p>HTML content</p>';
      const promptInfo = { actualPrompt: 'Test prompt content' };

      feedbackManager.showFeedback(originalContent, feedback, promptInfo, rawResponse);

      expect(feedbackManager.currentRawResponse).toBe(rawResponse);
      expect(feedbackManager.currentPromptInfo).toBe(promptInfo);
      expect(document.getElementById('actualPromptContent').textContent).toBe('Test prompt content');
      expect(document.getElementById('rawResponseContent').textContent).toBe(rawResponse);
    });

    test('should handle missing data when populating debug sections', () => {
      const feedbackManager = new FeedbackManager();
      const originalContent = { title: 'Test Story' };
      const feedback = '<h2>Test Feedback</h2>';

      feedbackManager.showFeedback(originalContent, feedback, null, null);

      expect(document.getElementById('actualPromptContent').textContent).toBe('No actual prompt data available');
      expect(document.getElementById('rawResponseContent').textContent).toBe('No raw response data available');
    });

    test('should populate sections correctly with populateDebugSections method', () => {
      const feedbackManager = new FeedbackManager();
      const mockPromptInfo = { actualPrompt: 'Test prompt' };
      const mockRawResponse = 'Test response';
      
      feedbackManager.currentPromptInfo = mockPromptInfo;
      feedbackManager.currentRawResponse = mockRawResponse;
      
      feedbackManager.populateDebugSections();

      expect(document.getElementById('actualPromptContent').textContent).toBe('Test prompt');
      expect(document.getElementById('rawResponseContent').textContent).toBe('Test response');
    });
  });
});