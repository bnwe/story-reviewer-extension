// Tests for background script functionality
// Test API integration, message handling, and LLM communication

/* global extractTokenUsageFromResponse */

describe('Background Script Tests', () => {
  let mockFetch;

  beforeEach(() => {
    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock Chrome APIs
    global.chrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        local: {
          set: jest.fn()
        }
      }
    };

    global.browser = global.chrome; // Cross-browser compatibility

    // Load background script and expose functions
    const fs = require('fs');
    const path = require('path');
    const backgroundJs = fs.readFileSync(
      path.join(__dirname, '../background/background.js'), 
      'utf8'
    );
    
    // Add global function exports at the end
    const testableCode = backgroundJs + `
      global.getApiUrl = getApiUrl;
      global.getApiHeaders = getApiHeaders;
      global.getTestPayload = getTestPayload;
      global.getFeedbackPayload = getFeedbackPayload;
      global.validateApiResponse = validateApiResponse;
      global.extractFeedbackFromResponse = extractFeedbackFromResponse;
      global.extractTokenUsageFromResponse = extractTokenUsageFromResponse;
      global.testApiConnection = testApiConnection;
      global.sendToLLM = sendToLLM;
      global.getDefaultPrompt = getDefaultPrompt;
      global.getEmergencyPrompt = getEmergencyPrompt;
      global.substituteVariables = substituteVariables;
    `;
    
    eval(testableCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
    delete global.chrome;
    delete global.browser;
  });

  describe('API URL Generation', () => {
    test('should return correct URL for OpenAI', () => {
      const url = getApiUrl('openai');
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    test('should return correct URL for Anthropic', () => {
      const url = getApiUrl('anthropic');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    test('should return correct URL for Mistral', () => {
      const url = getApiUrl('mistral');
      expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    });

    test('should throw error for unsupported provider', () => {
      expect(() => getApiUrl('unsupported')).toThrow('Unsupported API provider');
    });
  });

  describe('API Headers Generation', () => {
    test('should generate correct headers for OpenAI', () => {
      const headers = getApiHeaders('openai', 'test-key');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      });
    });

    test('should generate correct headers for Anthropic', () => {
      const headers = getApiHeaders('anthropic', 'test-key');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'test-key',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      });
    });

    test('should generate correct headers for Mistral', () => {
      const headers = getApiHeaders('mistral', 'test-key');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      });
    });
  });

  describe('Test Payload Generation', () => {
    test('should generate correct test payload for OpenAI', () => {
      const payload = getTestPayload('openai');
      expect(payload).toEqual({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ],
        max_tokens: 10
      });
    });

    test('should generate correct test payload for Anthropic', () => {
      const payload = getTestPayload('anthropic');
      expect(payload).toEqual({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ]
      });
    });

    test('should generate correct test payload for Mistral', () => {
      const payload = getTestPayload('mistral');
      expect(payload.model).toBe('mistral-tiny');
      expect(payload.messages).toBeDefined();
      expect(payload.max_tokens).toBe(10);
    });
  });

  describe('Token Usage Extraction', () => {
    test('should extract OpenAI token usage correctly', () => {
      const mockOpenAIResponse = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 75,
          total_tokens: 225
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('openai', mockOpenAIResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 150,
        outputTokens: 75,
        totalTokens: 225,
        hasUsage: true
      });
    });

    test('should extract Anthropic token usage correctly', () => {
      const mockAnthropicResponse = {
        content: [{ text: 'Test response' }],
        usage: {
          input_tokens: 120,
          output_tokens: 80
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('anthropic', mockAnthropicResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
        hasUsage: true
      });
    });

    test('should extract Mistral token usage correctly', () => {
      const mockMistralResponse = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('mistral', mockMistralResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        hasUsage: true
      });
    });

    test('should handle custom API with OpenAI format', () => {
      const mockCustomResponse = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 180,
          completion_tokens: 90,
          total_tokens: 270
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('custom', mockCustomResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 180,
        outputTokens: 90,
        totalTokens: 270,
        hasUsage: true
      });
    });

    test('should handle custom API with Anthropic format', () => {
      const mockCustomResponse = {
        content: [{ text: 'Test response' }],
        usage: {
          input_tokens: 160,
          output_tokens: 85
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('custom', mockCustomResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 160,
        outputTokens: 85,
        totalTokens: 245,
        hasUsage: true
      });
    });

    test('should handle missing usage information gracefully', () => {
      const mockResponseWithoutUsage = {
        choices: [{ message: { content: 'Test response' } }]
      };
      
      const tokenUsage = extractTokenUsageFromResponse('openai', mockResponseWithoutUsage);
      
      expect(tokenUsage).toEqual({
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        hasUsage: false
      });
    });

    test('should handle malformed responses gracefully', () => {
      const malformedResponse = null;
      
      const tokenUsage = extractTokenUsageFromResponse('openai', malformedResponse);
      
      expect(tokenUsage.inputTokens).toBe(null);
      expect(tokenUsage.outputTokens).toBe(null);
      expect(tokenUsage.totalTokens).toBe(null);
      expect(tokenUsage.hasUsage).toBe(false);
      expect(tokenUsage.error).toBeDefined(); // Error should be present
    });

    test('should handle custom API without total_tokens field', () => {
      const mockCustomResponse = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
          // total_tokens is missing
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('custom', mockCustomResponse);
      
      expect(tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150, // Should be calculated
        hasUsage: true
      });
    });

    test('should return error information when extraction fails', () => {
      // Mock console.warn to avoid test output
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // Create a response that will cause an error in processing
      const problematicResponse = {
        usage: {
          // Invalid structure that might cause an error
          get prompt_tokens() {
            throw new Error('Test error');
          }
        }
      };
      
      const tokenUsage = extractTokenUsageFromResponse('openai', problematicResponse);
      
      expect(tokenUsage.hasUsage).toBe(false);
      expect(tokenUsage.error).toBe('Test error');
      
      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe('Feedback Payload Generation', () => {
    test('should generate correct feedback payload for OpenAI', () => {
      const content = { title: 'Test Story', description: 'Test description' };
      const promptTemplate = 'Please review: {{storyContent}}';
      const result = getFeedbackPayload('openai', content, promptTemplate);
      
      expect(result.payload.model).toBe('gpt-4.1');
      expect(result.payload.messages[0].content).toContain('Test Story');
      expect(result.actualPrompt).toContain('Test Story');
      expect(result.payload.messages[0].content).toContain('Test description');
      expect(result.payload.max_tokens).toBe(10000);
      expect(result.payload.temperature).toBe(0.7);
    });

    test('should generate correct feedback payload for Anthropic', () => {
      const content = { title: 'Test Story', description: 'Test description' };
      const promptTemplate = 'Please review: {{storyContent}}';
      const result = getFeedbackPayload('anthropic', content, promptTemplate);
      
      expect(result.payload.model).toBe('claude-3-5-haiku-latest');
      expect(result.payload.messages[0].content).toContain('Test Story');
      expect(result.payload.max_tokens).toBe(10000);
      expect(result.actualPrompt).toContain('Test Story');
    });

    test('should include structured content in prompt', () => {
      const content = {
        title: 'User Story Title',
        description: 'Story description',
        acceptanceCriteria: 'AC1: Criteria'
      };
      const promptTemplate = 'Please review: {{storyContent}}';
      const result = getFeedbackPayload('openai', content, promptTemplate);
      
      expect(result.payload.messages[0].content).toContain('User Story Title');
      expect(result.payload.messages[0].content).toContain('Story description');
      expect(result.payload.messages[0].content).toContain('AC1: Criteria');
      expect(result.actualPrompt).toContain('User Story Title');
    });
  });

  describe('API Response Validation', () => {
    test('should validate OpenAI response correctly', () => {
      const validResponse = {
        choices: [
          { message: { content: 'Test response' } }
        ]
      };
      expect(validateApiResponse('openai', validResponse)).toBe(true);

      const invalidResponse = { error: 'Invalid request' };
      expect(validateApiResponse('openai', invalidResponse)).toBe(false);
    });

    test('should validate Anthropic response correctly', () => {
      const validResponse = {
        content: [
          { text: 'Test response' }
        ]
      };
      expect(validateApiResponse('anthropic', validResponse)).toBe(true);

      const invalidResponse = { error: 'Invalid request' };
      expect(validateApiResponse('anthropic', invalidResponse)).toBe(false);
    });

    test('should validate Mistral provider response', () => {
      const validResponse = {
        choices: [
          { message: { content: 'Test response' } }
        ]
      };
      expect(validateApiResponse('mistral', validResponse)).toBe(true);
    });
  });

  describe('Feedback Extraction', () => {
    test('should extract feedback from OpenAI response', () => {
      const response = {
        choices: [
          { message: { content: 'This is great feedback!' } }
        ]
      };
      const feedback = extractFeedbackFromResponse('openai', response);
      expect(feedback).toBe('This is great feedback!');
    });

    test('should extract feedback from Anthropic response', () => {
      const response = {
        content: [
          { text: 'This is excellent feedback!' }
        ]
      };
      const feedback = extractFeedbackFromResponse('anthropic', response);
      expect(feedback).toBe('This is excellent feedback!');
    });

    test('should extract feedback from Mistral provider response', () => {
      const response = {
        choices: [
          { message: { content: 'Mistral AI feedback!' } }
        ]
      };
      const feedback = extractFeedbackFromResponse('mistral', response);
      expect(feedback).toBe('Mistral AI feedback!');
    });
  });

  describe('Connection Testing', () => {
    test('should test connection successfully', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OK' } }]
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await testApiConnection(settings);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful!');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    test('should handle connection failure', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'invalid-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await testApiConnection(settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401: Unauthorized');
    });

    test('should handle network errors', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      mockFetch.mockRejectedValue(new Error('fetch failed'));

      const result = await testApiConnection(settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error - check your internet connection');
    });

    test('should handle invalid response format', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ error: 'Invalid format' })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await testApiConnection(settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid response format from API');
    });
  });

  describe('LLM Integration', () => {
    test('should send content to LLM successfully', async () => {
      const content = { title: 'Test Story', description: 'Test description' };
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Excellent user story!' } }]
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendToLLM(content, settings);

      expect(result.success).toBe(true);
      expect(result.feedback).toBe('Excellent user story!');
    });

    test('should handle LLM API errors', async () => {
      const content = { title: 'Test Story' };
      const settings = {
        apiProvider: 'openai',
        apiKey: 'invalid-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key')
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendToLLM(content, settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401: Invalid API key');
    });

    test('should handle different content formats', async () => {
      const stringContent = 'Simple string content';
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Good feedback!' } }]
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendToLLM(stringContent, settings);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Simple string content')
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await testApiConnection(settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    test('should handle fetch timeout errors', async () => {
      const settings = {
        apiProvider: 'openai',
        apiKey: 'test-key',
        customEndpoint: ''
      };

      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      const result = await testApiConnection(settings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error - check your internet connection');
    });
  });

  describe('Prompt Management', () => {
    test('should return default prompt with HTML formatting instruction', () => {
      const defaultPrompt = global.getDefaultPrompt();
      
      expect(defaultPrompt).toContain('HTML format');
      expect(defaultPrompt).toContain('<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>');
      expect(defaultPrompt).toContain('{{formattedContent}}');
      expect(defaultPrompt).toContain('improve readability and allow for better formatting');
    });

    test('should return emergency prompt as fallback', () => {
      const emergencyPrompt = global.getEmergencyPrompt();
      
      expect(emergencyPrompt).toContain('{{storyContent}}');
      expect(emergencyPrompt).toContain('feedback');
    });

    test('should substitute variables in template', () => {
      const template = 'Review: {{storyContent}} - Provider: {{provider}}';
      const variables = {
        storyContent: 'Test story content',
        provider: 'openai'
      };

      const result = global.substituteVariables(template, variables);

      expect(result).toBe('Review: Test story content - Provider: openai');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Review: {{storyContent}} - Missing: {{missing}}';
      const variables = {
        storyContent: 'Test content'
      };

      const result = global.substituteVariables(template, variables);

      expect(result).toContain('Test content');
      expect(result).toContain('{{missing}}'); // Should remain unchanged
    });

    test('should include standard variables automatically', () => {
      const template = 'Story: {{storyContent}} - Time: {{timestamp}}';
      const variables = {
        storyContent: 'Test story'
      };

      const result = global.substituteVariables(template, variables);

      expect(result).toContain('Test story');
      expect(result).not.toContain('{{timestamp}}'); // Should be substituted with actual timestamp
    });
  });
});