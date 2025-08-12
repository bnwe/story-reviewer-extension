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
      <button id="toggleOriginalStoryBtn"><span class="material-icons">expand_more</span>Toggle Original Story</button>
      <button id="showErrorDetailsBtn"><span class="material-icons">expand_more</span><span class="btn-text">Show Details</span></button>
      
      <div id="loadingState" class="state loading-state" style="display: flex;"></div>
      <div id="errorState" class="state error-state" style="display: none;"></div>
      <div id="noApiKeyState" class="state no-api-key-state" style="display: none;"></div>
      <div id="successState" class="state success-state" style="display: none;"></div>
      
      <div id="originalContent" class="content-box"></div>
      <div id="debugInfo" class="debug-info" style="display: none;">
        <div id="debugPromptType">Loading...</div>
        <div id="debugProvider">Loading...</div>
        <div id="debugModel">Loading...</div>
        <div id="debugTemperature">Loading...</div>
        <div id="debugTimestamp">Loading...</div>
        <div id="debugInputTokens">Loading...</div>
        <div id="debugOutputTokens">Loading...</div>
        <div id="debugTotalTokens">Loading...</div>
      </div>
      <div id="actualPromptSection" class="expandable-section">
        <div id="promptSectionHeader" class="section-header"></div>
        <div id="actualPromptContent" class="code-content" style="display: none;"></div>
      </div>
      <div id="originalStorySectionHeader" class="section-header"></div>
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
      <div id="errorDetailsSection" style="display: none;">
        <div id="troubleshootingSteps"></div>
        <div id="technicalErrorDetails"></div>
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

      const feedbackManager = new FeedbackManager(); // eslint-disable-line no-unused-vars
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

      const feedbackManager = new FeedbackManager(); // eslint-disable-line no-unused-vars
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

      // Mock successful LLM response and readiness check
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'testReadiness') {
          callback({
            success: true,
            ready: true,
            promptLength: 100,
            isCustomPrompt: false,
            hasDefaultPrompt: true
          });
        } else if (message.action === 'sendToLLM') {
          callback({
            success: true,
            feedback: 'This is great feedback for your story!'
          });
        }
      });

      const feedbackManager = new FeedbackManager(); // eslint-disable-line no-unused-vars
      await new Promise(resolve => setTimeout(resolve, 300)); // Increased timeout for readiness check

      // Should first call testReadiness then sendToLLM
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'testReadiness',
        settings: mockSettings
      }, expect.any(Function));
      
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

      const feedbackManager = new FeedbackManager(); // eslint-disable-line no-unused-vars
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.getElementById('errorState').style.display).toBe('flex');
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
          feedback: 'Excellent user story! Well structured and clear.',
          tokenUsage: {
            inputTokens: 150,
            outputTokens: 75,
            totalTokens: 225,
            hasUsage: true
          },
          promptInfo: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
            timestamp: new Date().toISOString()
          }
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

    test('should fix unclosed tags that are immediately followed by other tags', () => {
      const feedbackManager = new FeedbackManager();
      const malformedHtml = '<h4>Implementation Details</h4><p><copyable><ul><li>Test item</li></ul></copyable>';

      const fixed = feedbackManager.fixMalformedTags(malformedHtml);

      expect(fixed).toBe('<h4>Implementation Details</h4><copyable><ul><li>Test item</li></ul></copyable>');
      expect(fixed).not.toContain('<p><copyable>');
    });

    test('should remove unclosed tags at the end of content', () => {
      const feedbackManager = new FeedbackManager();
      const malformedHtml = '<h2>Title</h2><ul><li>Item 1</li><li>Item 2</li></ul><p>';

      const fixed = feedbackManager.fixMalformedTags(malformedHtml);

      expect(fixed).toBe('<h2>Title</h2><ul><li>Item 1</li><li>Item 2</li></ul>');
      expect(fixed).not.toContain('<p>');
    });

    test('should preserve properly closed tags', () => {
      const feedbackManager = new FeedbackManager();
      const validHtml = '<h2>Title</h2><p>This is a proper paragraph.</p><ul><li>Item</li></ul>';

      const fixed = feedbackManager.fixMalformedTags(validHtml);

      expect(fixed).toBe(validHtml);
    });

    test('should handle multiple unclosed tags', () => {
      const feedbackManager = new FeedbackManager();
      const malformedHtml = '<div><h3><p><span>Content</span></p></h3></div>';

      const fixed = feedbackManager.fixMalformedTags(malformedHtml);

      expect(fixed).toContain('<span>Content</span>');
      expect(fixed).toContain('</p>');
      expect(fixed).toContain('</h3>');
      expect(fixed).toContain('</div>');
    });

    test('should preserve self-closing tags', () => {
      const feedbackManager = new FeedbackManager();
      const htmlWithSelfClosing = '<p>Line 1<br>Line 2</p><hr><img>';

      const fixed = feedbackManager.fixMalformedTags(htmlWithSelfClosing);

      expect(fixed).toContain('<br>');
      expect(fixed).toContain('<hr>');
      expect(fixed).toContain('<img>');
    });

    test('should handle the specific example from the issue', () => {
      const feedbackManager = new FeedbackManager();
      const issueExample = `<h4>Implementation Details</h4>
<p><copyable>
<ul>
    <li>Ensure backward compatibility with existing apps that rely on the old language matching behavior.</li>
    <li>Update the language matching algorithm to prioritize exact matches over partial matches.</li>
    <li>Test the autofield with various language codes, including edge cases like unsupported languages.</li>
</ul>
</copyable>`;

      const fixed = feedbackManager.fixMalformedTags(issueExample);

      expect(fixed).not.toContain('<p><copyable>');
      expect(fixed).toContain('<copyable>');
      expect(fixed).toContain('</copyable>');
      expect(fixed).toContain('<ul>');
      expect(fixed).toContain('</ul>');
    });

    test('should integrate malformed tag fixing into sanitizeHtml', () => {
      const feedbackManager = new FeedbackManager();
      const malformedHtml = '<h2>Title</h2><p><div><span>Text';

      const sanitized = feedbackManager.sanitizeHtml(malformedHtml);

      expect(sanitized).toContain('<h2>Title</h2>');
      expect(sanitized).toContain('Text'); // Content should be preserved
      // The DOM parser will automatically close unclosed tags when parsing, 
      // but our fixMalformedTags should prevent problematic structures
      expect(sanitized).not.toContain('<p><div>'); // Should not have nested block elements
    });
  });

  describe('Nested Copyable Content Processing', () => {
    test('should handle paragraph content inside copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = '<copyable><p>As an app builder, I want an autofield that returns the App\'s current language.</p></copyable>';

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('As an app builder, I want an autofield');
      expect(result).not.toContain('<p><p>'); // No double wrapping
    });

    test('should handle list content inside copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<copyable>
        <ul>
          <li>First acceptance criterion</li>
          <li>Second acceptance criterion</li>
        </ul>
      </copyable>`;

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>First acceptance criterion</li>');
      expect(result).toContain('<li>Second acceptance criterion</li>');
      expect(result).toContain('</ul>');
    });

    test('should handle complex nested structure inside copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<copyable>
        <h4>Implementation Details</h4>
        <ul>
          <li>Ensure backward compatibility with existing apps</li>
          <li>Update the language matching algorithm</li>
          <li>Test with various language codes</li>
        </ul>
      </copyable>`;

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('<h4>Implementation Details</h4>');
      expect(result).toContain('<ul>');
      expect(result).toContain('Ensure backward compatibility');
      expect(result).toContain('Update the language matching');
      expect(result).toContain('Test with various language');
      expect(result).toContain('</ul>');
    });

    test('should handle plain text inside copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = '<copyable>Simple text content without HTML</copyable>';

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('Simple text content without HTML');
    });

    test('should handle mixed content inside copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<copyable>
        <p>Introduction text</p>
        <ul>
          <li>First point</li>
          <li>Second point</li>
        </ul>
        <p>Concluding text</p>
      </copyable>`;

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('Introduction text');
      expect(result).toContain('<ul>');
      expect(result).toContain('First point');
      expect(result).toContain('Second point');
      expect(result).toContain('</ul>');
      expect(result).toContain('Concluding text');
    });

    test('should fix malformed paragraph wrappers in copyable content', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<copyable>
        <p>
          <ul>
            <li>Item wrapped in paragraph</li>
            <li>Another item</li>
          </ul>
        </p>
      </copyable>`;

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('<ul>');
      expect(result).toContain('Item wrapped in paragraph');
      expect(result).not.toContain('<p><ul>'); // Should unwrap the paragraph
    });

    test('should process copyable tags correctly - debug version', () => {
      const feedbackManager = new FeedbackManager();
      const simpleContent = '<copyable><p>Test content</p></copyable>';

      // Test processCopyableTags directly with simple content
      const processed = feedbackManager.processCopyableTags(simpleContent);
      
      // This should definitely work
      expect(processed).toContain('class="copyable-snippet"');
      expect(processed).toContain('Test content');
      expect(processed).toContain('data-copy-html');
    });

    test('should handle the exact user-provided problematic example', () => {
      const feedbackManager = new FeedbackManager();
      // This is the exact content the user provided that was not working
      const content = `<h2>Suggested Copyable Content</h2>

<p>Improved user story description (replace current description):</p>
<copyable>
<p>As an app builder, I want an autofield that returns the App's current language so I can use the App language as a target language in AI Translation shapes.</p>
</copyable>`;

      const result = feedbackManager.formatFeedback(content);

      // Should contain the header
      expect(result).toContain('<h2>Suggested Copyable Content</h2>');
      
      // Should contain the copyable snippet with all required attributes
      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('data-copyable-id');
      expect(result).toContain('data-copy-html');
      expect(result).toContain('title="Click to copy"');
      
      // Should contain the actual content
      expect(result).toContain('As an app builder, I want an autofield');
      expect(result).toContain('AI Translation shapes');
      
      // The data-copy-html attribute should contain properly escaped content that can be copied to Azure DevOps
      const copyHtmlMatch = result.match(/data-copy-html="([^"]*)"/);
      expect(copyHtmlMatch).toBeTruthy();
      const copyableContent = copyHtmlMatch[1];
      expect(copyableContent).toContain('As an app builder');
      
      // The copyable content should be clickable
      expect(result).toMatch(/<span class="copyable-snippet"[^>]*>.*As an app builder.*<\/span>/);
    });

    test('should handle the original problematic example - debug version', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<h2>Suggested Copyable Content</h2>
      <p>Improved user story description (replace current description):</p>
      <copyable>
      <p>As an app builder, I want an autofield that returns the App's current language so I can use the App language as a target language in AI Translation shapes.</p>
      </copyable>`;

      // Test processCopyableTags directly first
      const processed = feedbackManager.processCopyableTags(content);
      expect(processed).toContain('class="copyable-snippet"');

      // Test full flow step by step
      const stripped = feedbackManager.stripMarkdownCodeBlocks(content);
      const withCopyable = feedbackManager.processCopyableTags(stripped);
      expect(withCopyable).toContain('class="copyable-snippet"');
      
      // Now test if sanitizeHtml preserves the copyable snippets
      const sanitized = feedbackManager.sanitizeHtml(withCopyable);
      expect(sanitized).toContain('class="copyable-snippet"');
      
      // Test full formatFeedback flow
      const result = feedbackManager.formatFeedback(content);
      expect(result).toContain('class="copyable-snippet"');
    });

    test('should handle empty or whitespace-only copyable tags', () => {
      const feedbackManager = new FeedbackManager();
      const content = '<copyable>   </copyable>';

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      // Should handle gracefully, even if content is minimal
    });

    test('should preserve formatting for Azure DevOps compatibility', () => {
      const feedbackManager = new FeedbackManager();
      const content = `<copyable>
        <strong>Bold text</strong> and <em>italic text</em>
        <ul>
          <li><strong>Bold list item</strong></li>
          <li><em>Italic list item</em></li>
        </ul>
      </copyable>`;

      const result = feedbackManager.processCopyableTags(content);

      expect(result).toContain('class="copyable-snippet"');
      expect(result).toContain('<strong>Bold text</strong>');
      expect(result).toContain('<em>italic text</em>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<strong>Bold list item</strong>');
      expect(result).toContain('<em>Italic list item</em>');
    });

    test('should handle multiple copyable tags in one content', () => {
      const feedbackManager = new FeedbackManager();
      const content = `
        <h2>First Section</h2>
        <copyable><p>First copyable content</p></copyable>
        <h2>Second Section</h2>
        <copyable><ul><li>Second copyable content</li></ul></copyable>
      `;

      const result = feedbackManager.processCopyableTags(content);

      const copyableMatches = result.match(/class="copyable-snippet"/g);
      expect(copyableMatches).toHaveLength(2);
      expect(result).toContain('First copyable content');
      expect(result).toContain('Second copyable content');
      expect(result).toContain('data-copyable-id="copyable-0"');
      expect(result).toContain('data-copyable-id="copyable-1"');
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

    test('should toggle original story content visibility', () => {
      const feedbackManager = new FeedbackManager();
      const content = document.getElementById('originalContent');
      const button = document.getElementById('toggleOriginalStoryBtn');
      const icon = button.querySelector('.material-icons');
      
      // Initially, the original story should be collapsed (display: none)
      expect(content.style.display).toBe('');
      expect(icon.textContent).toBe('expand_more');
      
      // Toggle to show content
      feedbackManager.toggleOriginalStoryContent();
      expect(content.style.display).toBe('block');
      expect(icon.textContent).toBe('expand_less');
      
      // Toggle to hide content again
      feedbackManager.toggleOriginalStoryContent();
      expect(content.style.display).toBe('none');
      expect(icon.textContent).toBe('expand_more');
    });
  });

  describe('Token Usage Display', () => {
    test('should display token usage information when available', () => {
      const feedbackManager = new FeedbackManager();
      const mockTokenUsage = {
        inputTokens: 250,
        outputTokens: 150,
        totalTokens: 400,
        hasUsage: true
      };
      
      feedbackManager.currentTokenUsage = mockTokenUsage;
      feedbackManager.updateTokenUsageInfo(mockTokenUsage);
      
      expect(document.getElementById('debugInputTokens').textContent).toBe('250');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('150');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('400');
      
      // Should not have unavailable class
      expect(document.getElementById('debugInputTokens').classList.contains('token-unavailable')).toBe(false);
      expect(document.getElementById('debugOutputTokens').classList.contains('token-unavailable')).toBe(false);
      expect(document.getElementById('debugTotalTokens').classList.contains('token-unavailable')).toBe(false);
    });

    test('should display "Not available" when token usage is not provided', () => {
      const feedbackManager = new FeedbackManager();
      const mockTokenUsage = {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        hasUsage: false
      };
      
      feedbackManager.updateTokenUsageInfo(mockTokenUsage);
      
      expect(document.getElementById('debugInputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('Not available');
      
      // Should have unavailable class
      expect(document.getElementById('debugInputTokens').classList.contains('token-unavailable')).toBe(true);
      expect(document.getElementById('debugOutputTokens').classList.contains('token-unavailable')).toBe(true);
      expect(document.getElementById('debugTotalTokens').classList.contains('token-unavailable')).toBe(true);
    });

    test('should handle null token usage gracefully', () => {
      const feedbackManager = new FeedbackManager();
      
      feedbackManager.updateTokenUsageInfo(null);
      
      expect(document.getElementById('debugInputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('Not available');
      
      // Should have unavailable class
      expect(document.getElementById('debugInputTokens').classList.contains('token-unavailable')).toBe(true);
      expect(document.getElementById('debugOutputTokens').classList.contains('token-unavailable')).toBe(true);
      expect(document.getElementById('debugTotalTokens').classList.contains('token-unavailable')).toBe(true);
    });

    test('should format large token counts with thousands separators', () => {
      const feedbackManager = new FeedbackManager();
      const mockTokenUsage = {
        inputTokens: 12345,
        outputTokens: 6789,
        totalTokens: 19134,
        hasUsage: true
      };
      
      feedbackManager.updateTokenUsageInfo(mockTokenUsage);
      
      expect(document.getElementById('debugInputTokens').textContent).toBe('12,345');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('6,789');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('19,134');
    });

    test('should display token usage from showFeedback method', () => {
      const feedbackManager = new FeedbackManager();
      const originalContent = { title: 'Test Story' };
      const feedback = 'Great feedback!';
      const promptInfo = { 
        provider: 'openai', 
        model: 'gpt-4',
        temperature: 0.7,
        timestamp: new Date().toISOString()
      };
      const rawResponse = 'Raw response';
      const tokenUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        hasUsage: true
      };

      feedbackManager.showFeedback(originalContent, feedback, promptInfo, rawResponse, tokenUsage);

      expect(feedbackManager.currentTokenUsage).toBe(tokenUsage);
      expect(document.getElementById('successState').style.display).toBe('block');
    });

    test('should update debug info with token usage when toggle is activated', () => {
      const feedbackManager = new FeedbackManager();
      const mockPromptInfo = {
        provider: 'anthropic',
        model: 'claude-3',
        temperature: 0.5,
        timestamp: new Date().toISOString()
      };
      const mockTokenUsage = {
        inputTokens: 300,
        outputTokens: 200,
        totalTokens: 500,
        hasUsage: true
      };
      
      feedbackManager.currentPromptInfo = mockPromptInfo;
      feedbackManager.currentTokenUsage = mockTokenUsage;
      
      feedbackManager.updateDebugInfo();
      
      expect(document.getElementById('debugProvider').textContent).toBe('Anthropic');
      expect(document.getElementById('debugModel').textContent).toBe('claude-3');
      expect(document.getElementById('debugTemperature').textContent).toBe('0.5');
      expect(document.getElementById('debugInputTokens').textContent).toBe('300');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('200');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('500');
    });

    test('should handle missing token usage in updateDebugInfo', () => {
      const feedbackManager = new FeedbackManager();
      const mockPromptInfo = {
        provider: 'mistral',
        model: 'mistral-medium',
        temperature: 0.8,
        timestamp: new Date().toISOString()
      };
      
      feedbackManager.currentPromptInfo = mockPromptInfo;
      feedbackManager.currentTokenUsage = null;
      
      feedbackManager.updateDebugInfo();
      
      expect(document.getElementById('debugProvider').textContent).toBe('Mistral AI');
      expect(document.getElementById('debugModel').textContent).toBe('mistral-medium');
      expect(document.getElementById('debugInputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugOutputTokens').textContent).toBe('Not available');
      expect(document.getElementById('debugTotalTokens').textContent).toBe('Not available');
    });
  });
});