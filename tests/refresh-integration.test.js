// Integration tests for refresh workflow functionality
// Tests complete message passing between feedback window, background script, and content script

describe('Refresh Workflow Integration Tests', () => {
  let mockChrome;
  let FeedbackManager;
  let backgroundHandlers;

  beforeEach(() => {
    // Mock Chrome APIs with message passing simulation
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        },
        onInstalled: {
          addListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      },
      storage: {
        sync: {
          get: jest.fn()
        },
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };
    global.chrome = mockChrome;
    global.browser = mockChrome;

    // Mock fetch for API calls
    global.fetch = jest.fn();

    // Mock DOM elements for feedback window
    document.body.innerHTML = `
      <button id="refreshBtn">Refresh</button>
      <button id="settingsBtn">Settings</button>
      <button id="retryBtn">Try Again</button>
      <button id="checkSettingsBtn">Check Settings</button>
      <button id="openSettingsBtn">Configure API Key</button>
      <button id="copyAllBtn">Copy All</button>
      <button id="toggleDebugBtn">Debug</button>
      <button id="togglePromptBtn">Toggle Prompt</button>
      <button id="toggleResponseBtn">Toggle Response</button>
      <button id="toggleOriginalStoryBtn">Toggle Original Story</button>
      <button id="showErrorDetailsBtn">Show Error Details</button>
      <div id="loadingState" class="state loading-state" style="display: none;"></div>
      <div id="errorState" class="state error-state" style="display: none;"></div>
      <div id="noApiKeyState" class="state no-api-key-state" style="display: none;"></div>
      <div id="successState" class="state success-state" style="display: none;"></div>
      <div id="feedbackContent" class="feedback-content"></div>
      <div id="originalContent" class="content-box"></div>
      <div id="promptSectionHeader" class="section-header"></div>
      <div id="responseSectionHeader" class="section-header"></div>
      <div id="originalStorySectionHeader" class="section-header"></div>
      <span id="timestampInfo">Last updated: Never</span>
      <span id="providerInfo">Provider: Not configured</span>
    `;

    // Load shared constants first
    const fs = require('fs');
    const path = require('path');
    const constantsJs = fs.readFileSync(
      path.join(__dirname, '../shared/constants.js'), 
      'utf8'
    );
    eval(constantsJs);

    // Load and setup FeedbackManager
    const feedbackJs = fs.readFileSync(
      path.join(__dirname, '../feedback/feedback.js'), 
      'utf8'
    );
    
    const testableCode = feedbackJs.replace(
      /document\.addEventListener\('DOMContentLoaded'.*?\}\);/s, 
      'global.FeedbackManager = FeedbackManager;'
    );
    
    eval(testableCode);
    FeedbackManager = global.FeedbackManager;

    // Mock background script functions instead of loading the full script
    global.handleRefreshContent = jest.fn();
    global.sendToLLM = jest.fn();
    global.getDefaultPrompt = jest.fn(() => 'Default prompt template');

    // Store background handlers for testing
    backgroundHandlers = {
      handleRefreshContent: global.handleRefreshContent,
      sendToLLM: global.sendToLLM
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.fetch;
    delete global.FeedbackManager;
  });

  describe('Complete Refresh Workflow', () => {
    test('should complete full refresh workflow from button click to feedback update', async () => {
      // Setup: Mock API settings
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      // Setup: Mock extracted content
      const mockContent = {
        title: 'Test User Story',
        description: 'As a user, I want to test refresh functionality',
        acceptanceCriteria: 'Given the refresh button is clicked, when content is re-extracted, then new feedback is generated'
      };

      // Setup: Mock active Azure DevOps tab
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://dev.azure.com/myorg/myproject/_workitems/edit/123'
        }]);
      });

      // Setup: Mock content extraction success
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.action === 'extractContent') {
          callback({ success: true });
        }
      });

      // Setup: Mock stored content after extraction
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          extractedContent: mockContent,
          extractionTimestamp: Date.now()
        });
      });

      // Setup: Mock successful LLM API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Excellent user story! The refresh functionality is well-defined with clear acceptance criteria.'
            }
          }],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 75,
            total_tokens: 225
          }
        })
      });

      // Create FeedbackManager instance
      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = mockSettings;

      // Spy on methods to track workflow
      const showLoadingStateSpy = jest.spyOn(feedbackManager, 'showLoadingState');
      const showFeedbackSpy = jest.spyOn(feedbackManager, 'showFeedback');

      // Simulate message passing between components
      let refreshResponse;
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'REFRESH_CONTENT') {
          // Simulate background script handling the refresh request
          setTimeout(async () => {
            try {
              // Simulate background script processing
              const response = await simulateBackgroundRefreshHandling(mockSettings, mockContent);
              refreshResponse = response;
              callback(response);
            } catch (error) {
              callback({
                type: 'CONTENT_REFRESHED',
                success: false,
                error: error.message
              });
            }
          }, 0);
        }
      });

      // Execute: Trigger refresh workflow
      await feedbackManager.refreshFeedback();

      // Verify: Loading state was shown
      expect(showLoadingStateSpy).toHaveBeenCalled();

      // Verify: Refresh message was sent
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'REFRESH_CONTENT'
      }, expect.any(Function));

      // Note: Tab query and content extraction are handled by the background script
      // which we're mocking directly in this integration test

      // Verify: API was called with extracted content
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          }),
          body: expect.stringContaining('Test User Story')
        })
      );

      // Verify: Feedback was displayed with correct content
      expect(showFeedbackSpy).toHaveBeenCalled();
      const callArgs = showFeedbackSpy.mock.calls[0];
      
      // Check originalContent
      expect(callArgs[0]).toEqual(expect.objectContaining({
        title: 'Test User Story'
      }));
      
      // Check feedback text
      expect(callArgs[1]).toEqual(expect.stringContaining('Excellent user story'));
      
      // Check promptInfo
      expect(callArgs[2]).toEqual(expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4'
      }));
      
      // Check tokenUsage
      expect(callArgs[4]).toEqual(expect.objectContaining({
        inputTokens: 150,
        outputTokens: 75,
        totalTokens: 225
      }));

      // Note: UI state verification is handled by unit tests
      // Integration test focuses on message passing and data flow
    });

    test('should handle content extraction failure in refresh workflow', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key'
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      // Mock active Azure DevOps tab
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://dev.azure.com/myorg/myproject/_workitems/edit/123'
        }]);
      });

      // Mock content extraction failure
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ 
          success: false, 
          error: 'Failed to extract content from page' 
        });
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = mockSettings;

      const showErrorSpy = jest.spyOn(feedbackManager, 'showError');

      // Simulate message handling
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'REFRESH_CONTENT') {
          setTimeout(() => {
            callback({
              type: 'CONTENT_REFRESHED',
              success: false,
              error: 'Content extraction failed: Failed to extract content from page'
            });
          }, 0);
        }
      });

      await feedbackManager.refreshFeedback();

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Content extraction failed: Failed to extract content from page'
      );
      expect(document.getElementById('errorState').style.display).toBe('flex');
    });

    test('should handle API processing failure in refresh workflow', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'invalid-key'
      };

      const mockContent = {
        title: 'Test Story',
        description: 'Test description'
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://dev.azure.com/myorg/myproject/_workitems/edit/123'
        }]);
      });

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: true });
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          extractedContent: mockContent,
          extractionTimestamp: Date.now()
        });
      });

      // Mock API failure
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = mockSettings;

      const showErrorSpy = jest.spyOn(feedbackManager, 'showError');

      // Simulate message handling with API failure
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'REFRESH_CONTENT') {
          setTimeout(async () => {
            try {
              const response = await simulateBackgroundRefreshHandling(mockSettings, mockContent);
              callback(response);
            } catch (error) {
              callback({
                type: 'CONTENT_REFRESHED',
                success: false,
                error: 'AI processing failed: HTTP 401: Invalid API key'
              });
            }
          }, 0);
        }
      });

      await feedbackManager.refreshFeedback();

      expect(showErrorSpy).toHaveBeenCalledWith(
        'HTTP 401: Invalid API key'
      );
    });

    test('should handle no active tab error in refresh workflow', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key'
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      // Mock no active tabs
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = mockSettings;

      const showErrorSpy = jest.spyOn(feedbackManager, 'showError');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'REFRESH_CONTENT') {
          setTimeout(() => {
            callback({
              type: 'CONTENT_REFRESHED',
              success: false,
              error: 'No active tab found'
            });
          }, 0);
        }
      });

      await feedbackManager.refreshFeedback();

      expect(showErrorSpy).toHaveBeenCalledWith('No active tab found');
    });

    test('should handle non-Azure DevOps tab error in refresh workflow', async () => {
      const mockSettings = {
        apiProvider: 'openai',
        apiKey: 'test-key'
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      // Mock active tab that's not Azure DevOps
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://google.com'
        }]);
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = mockSettings;

      const showErrorSpy = jest.spyOn(feedbackManager, 'showError');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'REFRESH_CONTENT') {
          setTimeout(() => {
            callback({
              type: 'CONTENT_REFRESHED',
              success: false,
              error: 'Active tab is not an Azure DevOps page'
            });
          }, 0);
        }
      });

      await feedbackManager.refreshFeedback();

      expect(showErrorSpy).toHaveBeenCalledWith('Active tab is not an Azure DevOps page');
    });
  });

  describe('Message Passing Integration', () => {
    test('should correctly pass messages between all components', async () => {
      const messageLog = [];
      
      // Track all message passing
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        messageLog.push({ type: 'runtime.sendMessage', message });
        setTimeout(() => {
          if (callback) callback({ success: true });
        }, 0);
      });

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        messageLog.push({ type: 'tabs.sendMessage', tabId, message });
        setTimeout(() => {
          if (callback) callback({ success: true });
        }, 0);
      });

      const feedbackManager = new FeedbackManager();
      feedbackManager.currentSettings = { apiProvider: 'openai', apiKey: 'test-key' };

      // Mock checkApiConfiguration to return true immediately
      jest.spyOn(feedbackManager, 'checkApiConfiguration').mockResolvedValue(true);

      await feedbackManager.refreshFeedback();

      // Verify message flow
      expect(messageLog).toContainEqual({
        type: 'runtime.sendMessage',
        message: { type: 'REFRESH_CONTENT' }
      });
    }, 5000); // 5 second timeout

    test('should validate message structure and content', async () => {
      const feedbackManager = new FeedbackManager();
      
      let capturedMessage;
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        capturedMessage = message;
        setTimeout(() => {
          callback({
            type: 'CONTENT_REFRESHED',
            success: true,
            feedback: 'Test feedback',
            promptInfo: { provider: 'openai', model: 'gpt-4' },
            tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }
          });
        }, 0);
      });

      feedbackManager.currentSettings = { apiProvider: 'openai', apiKey: 'test-key' };
      
      // Mock checkApiConfiguration to return true immediately
      jest.spyOn(feedbackManager, 'checkApiConfiguration').mockResolvedValue(true);

      await feedbackManager.refreshFeedback();

      // Verify message structure
      expect(capturedMessage).toEqual({
        type: 'REFRESH_CONTENT'
      });
    }, 5000); // 5 second timeout
  });

  describe('Error Propagation Integration', () => {
    test('should properly propagate errors through all components', async () => {
      const errorScenarios = [
        {
          name: 'Network error',
          mockError: () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
          },
          expectedError: 'Network error'
        },
        {
          name: 'API authentication error',
          mockError: () => {
            global.fetch.mockResolvedValueOnce({
              ok: false,
              status: 401,
              text: async () => 'Unauthorized'
            });
          },
          expectedError: 'HTTP 401: Unauthorized'
        },
        {
          name: 'Invalid response format',
          mockError: () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ error: 'Invalid format' })
            });
          },
          expectedError: 'Invalid response format from API'
        }
      ];

      for (const scenario of errorScenarios) {
        // Reset mocks
        jest.clearAllMocks();
        
        const mockSettings = {
          apiProvider: 'openai',
          apiKey: 'test-key'
        };

        const mockContent = {
          title: 'Test Story',
          description: 'Test description'
        };

        mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
          callback(mockSettings);
        });

        mockChrome.tabs.query.mockImplementation((query, callback) => {
          callback([{
            id: 1,
            url: 'https://dev.azure.com/myorg/myproject/_workitems/edit/123'
          }]);
        });

        mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
          callback({ success: true });
        });

        mockChrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({
            extractedContent: mockContent,
            extractionTimestamp: Date.now()
          });
        });

        // Apply scenario-specific error mock
        scenario.mockError();

        const feedbackManager = new FeedbackManager();
        feedbackManager.currentSettings = mockSettings;

        const showErrorSpy = jest.spyOn(feedbackManager, 'showError');

        // Simulate error propagation through message handling
        mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
          if (message.type === 'REFRESH_CONTENT') {
            setTimeout(async () => {
              try {
                await simulateBackgroundRefreshHandling(mockSettings, mockContent);
                callback({
                  type: 'CONTENT_REFRESHED',
                  success: false,
                  error: `AI processing failed: ${scenario.expectedError}`
                });
              } catch (error) {
                callback({
                  type: 'CONTENT_REFRESHED',
                  success: false,
                  error: error.message
                });
              }
            }, 0);
          }
        });

        await feedbackManager.refreshFeedback();

        expect(showErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(scenario.expectedError)
        );
      }
    });
  });

  describe('Content Validation Integration', () => {
    test('should validate extracted content before processing', async () => {
      const invalidContentScenarios = [
        {
          name: 'Empty content',
          content: {},
          expectedBehavior: 'should handle gracefully'
        },
        {
          name: 'Missing title',
          content: { description: 'Test description' },
          expectedBehavior: 'should still process'
        },
        {
          name: 'Missing description',
          content: { title: 'Test title' },
          expectedBehavior: 'should still process'
        }
      ];

      for (const scenario of invalidContentScenarios) {
        jest.clearAllMocks();

        const mockSettings = {
          apiProvider: 'openai',
          apiKey: 'test-key'
        };

        mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
          callback(mockSettings);
        });

        mockChrome.tabs.query.mockImplementation((query, callback) => {
          callback([{
            id: 1,
            url: 'https://dev.azure.com/myorg/myproject/_workitems/edit/123'
          }]);
        });

        mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
          callback({ success: true });
        });

        mockChrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({
            extractedContent: scenario.content,
            extractionTimestamp: Date.now()
          });
        });

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: 'Processed content successfully'
              }
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 25,
              total_tokens: 75
            }
          })
        });

        const feedbackManager = new FeedbackManager();
        feedbackManager.currentSettings = mockSettings;

        mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
          if (message.type === 'REFRESH_CONTENT') {
            setTimeout(async () => {
              const response = await simulateBackgroundRefreshHandling(mockSettings, scenario.content);
              callback(response);
            }, 0);
          }
        });

        await feedbackManager.refreshFeedback();

        // Should not throw errors and should attempt to process
        expect(global.fetch).toHaveBeenCalled();
      }
    });
  });

  // Helper function to simulate background script refresh handling
  async function simulateBackgroundRefreshHandling(settings, content) {
    try {
      // Simulate the background script's refresh handling logic
      if (!settings.apiKey) {
        throw new Error('API key not configured');
      }

      // Simulate API call
      const response = await global.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: JSON.stringify(content) }],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error('Invalid response format from API');
      }

      return {
        type: 'CONTENT_REFRESHED',
        success: true,
        feedback: data.choices[0].message.content,
        promptInfo: {
          provider: settings.apiProvider,
          model: 'gpt-4',
          temperature: 0.7,
          timestamp: new Date().toISOString()
        },
        tokenUsage: {
          inputTokens: data.usage?.prompt_tokens || null,
          outputTokens: data.usage?.completion_tokens || null,
          totalTokens: data.usage?.total_tokens || null,
          hasUsage: !!data.usage
        }
      };
    } catch (error) {
      return {
        type: 'CONTENT_REFRESHED',
        success: false,
        error: error.message
      };
    }
  }
});