// Background script for Azure DevOps Story Reviewer extension
// Handles extension lifecycle and communication between content scripts and popup

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Azure DevOps Story Reviewer extension installed');
});

// Handle messages from content scripts and options page
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STORY_CONTENT_EXTRACTED') {
    // Store extracted content for popup access
    browserAPI.storage.local.set({
      extractedContent: message.content,
      extractionTimestamp: Date.now()
    });
    sendResponse({ success: true });
  } else if (message.action === 'testApiConnection') {
    // Handle API connection testing from options page
    testApiConnection(message.settings)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true; // Keep message channel open for async response
  } else if (message.action === 'sendToLLM') {
    // Handle LLM API requests
    sendToLLM(message.content, message.settings)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true; // Keep message channel open for async response
  }
  
  return true; // Keep message channel open for async response
});

// API connection testing function
async function testApiConnection(settings) {
  try {
    const apiUrl = getApiUrl(settings.apiProvider, settings.customEndpoint);
    const headers = getApiHeaders(settings.apiProvider, settings.apiKey);
    
    // Simple test message
    const testPayload = getTestPayload(settings.apiProvider);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testPayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Validate response structure based on provider
    if (validateApiResponse(settings.apiProvider, result)) {
      return { success: true, message: 'Connection successful!' };
    } else {
      throw new Error('Invalid response format from API');
    }
    
  } catch (error) {
    const isNetworkError = error.message.includes('fetch') || 
                          error.message.includes('network') ||
                          error.message.includes('aborted') ||
                          error.name === 'TypeError' ||
                          error.name === 'NetworkError';
    
    return { 
      success: false, 
      error: isNetworkError ? 'Network error - check your internet connection' : error.message
    };
  }
}

// Send content to LLM for feedback
async function sendToLLM(content, settings) {
  try {
    const apiUrl = getApiUrl(settings.apiProvider, settings.customEndpoint);
    const headers = getApiHeaders(settings.apiProvider, settings.apiKey);
    
    const payload = getFeedbackPayload(settings.apiProvider, content);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const feedback = extractFeedbackFromResponse(settings.apiProvider, result);
    
    return { 
      success: true, 
      feedback: feedback 
    };
    
  } catch (error) {
    const isNetworkError = error.message.includes('fetch') || 
                          error.message.includes('network') ||
                          error.message.includes('aborted') ||
                          error.name === 'TypeError' ||
                          error.name === 'NetworkError';
    
    return { 
      success: false, 
      error: isNetworkError ? 'Network error - check your internet connection' : error.message
    };
  }
}

// Helper functions for API integration
function getApiUrl(provider, customEndpoint = '') {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'custom':
      return customEndpoint;
    default:
      throw new Error('Unsupported API provider');
  }
}

function getApiHeaders(provider, apiKey) {
  const baseHeaders = {
    'Content-Type': 'application/json'
  };
  
  switch (provider) {
    case 'openai':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    case 'anthropic':
      return {
        ...baseHeaders,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
    case 'custom':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    default:
      throw new Error('Unsupported API provider');
  }
}

function getTestPayload(provider) {
  switch (provider) {
    case 'openai':
      return {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ],
        max_tokens: 10
      };
    case 'anthropic':
      return {
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ]
      };
    case 'custom':
      return {
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ],
        max_tokens: 10
      };
    default:
      throw new Error('Unsupported API provider');
  }
}

function getFeedbackPayload(provider, content) {
  // Convert content to string if it's an object
  let contentString = '';
  if (typeof content === 'object' && content !== null) {
    if (content.title) contentString += `Title: ${content.title}\n`;
    if (content.description) contentString += `Description: ${content.description}\n`;
    if (content.acceptanceCriteria) contentString += `Acceptance Criteria: ${content.acceptanceCriteria}\n`;
    if (!contentString) contentString = JSON.stringify(content, null, 2);
  } else {
    contentString = String(content);
  }

  const prompt = `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
${contentString}

Please provide your feedback in a structured format with clear sections for different aspects of the story.`;

  switch (provider) {
    case 'openai':
      return {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      };
    case 'anthropic':
      return {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      };
    case 'custom':
      return {
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000
      };
    default:
      throw new Error('Unsupported API provider');
  }
}

function validateApiResponse(provider, response) {
  if (!response) return false;
  
  switch (provider) {
    case 'openai':
      return !!(response.choices && response.choices.length > 0);
    case 'anthropic':
      return !!(response.content && response.content.length > 0);
    case 'custom':
      return !!(response.choices && response.choices.length > 0); // Assume OpenAI-compatible
    default:
      return false;
  }
}

function extractFeedbackFromResponse(provider, response) {
  switch (provider) {
    case 'openai':
      return response.choices[0].message.content;
    case 'anthropic':
      return response.content[0].text;
    case 'custom':
      return response.choices[0].message.content; // Assume OpenAI-compatible
    default:
      throw new Error('Unsupported API provider');
  }
}