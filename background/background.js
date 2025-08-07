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
    const apiUrl = getApiUrl(settings.apiProvider);
    const headers = getApiHeaders(settings.apiProvider, settings.apiKey);
    
    // Simple test message
    const testPayload = getTestPayload(settings.apiProvider, settings.model);
    
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
  let actualPrompt = null; // Declare at function scope
  let actualModel = null; // Declare at function scope
  
  try {
    const apiUrl = getApiUrl(settings.apiProvider);
    const headers = getApiHeaders(settings.apiProvider, settings.apiKey);
    
    // Get effective prompt (custom or default)
    const effectivePrompt = await getEffectivePrompt();
    const isCustomPrompt = await isUsingCustomPrompt(effectivePrompt);
    const payloadData = getFeedbackPayload(settings.apiProvider, content, effectivePrompt, settings.model, settings.temperature);
    const payload = payloadData.payload;
    actualPrompt = payloadData.actualPrompt;
    actualModel = payloadData.actualModel;
    
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
      feedback: feedback,
      rawResponse: feedback, // Store raw response for display
      promptInfo: {
        provider: settings.apiProvider,
        model: actualModel,
        temperature: settings.temperature || 0.7,
        isCustom: isCustomPrompt,
        promptPreview: effectivePrompt,
        actualPrompt: actualPrompt,
        timestamp: new Date().toISOString(),
        hasVariables: effectivePrompt.includes('{{')
      }
    };
    
  } catch (error) {
    const isNetworkError = error.message.includes('fetch') || 
                          error.message.includes('network') ||
                          error.message.includes('aborted') ||
                          error.name === 'TypeError' ||
                          error.name === 'NetworkError';
    
    // Try to get prompt info even on error for debugging
    let promptInfo = null;
    try {
      const effectivePrompt = await getEffectivePrompt();
      const isCustomPrompt = await isUsingCustomPrompt(effectivePrompt);
      // Try to get actual prompt and model if it wasn't generated before error
      let errorActualPrompt = actualPrompt;
      let errorActualModel = null;
      if (!errorActualPrompt) {
        try {
          const payloadData = getFeedbackPayload(settings.apiProvider, content, effectivePrompt, settings.model, settings.temperature);
          errorActualPrompt = payloadData.actualPrompt;
          errorActualModel = payloadData.actualModel;
        } catch (payloadError) {
          console.warn('Could not generate actual prompt for error response:', payloadError);
        }
      }
      
      promptInfo = {
        provider: settings.apiProvider,
        model: errorActualModel || actualModel || settings.model,
        temperature: settings.temperature || 0.7,
        isCustom: isCustomPrompt,
        promptPreview: effectivePrompt,
        actualPrompt: errorActualPrompt,
        timestamp: new Date().toISOString(),
        hasVariables: effectivePrompt.includes('{{'),
        error: true
      };
    } catch (promptError) {
      console.warn('Could not get prompt info for error response:', promptError);
    }
    
    return { 
      success: false, 
      error: isNetworkError ? 'Network error - check your internet connection' : error.message,
      promptInfo: promptInfo
    };
  }
}

// Get effective prompt (custom or default) with fallback mechanism
async function getEffectivePrompt() {
  try {
    // Get stored settings including custom prompt
    const settings = await getStoredPrompts();
    
    // Try to get the unified custom prompt
    const customPrompt = settings.customPrompt;
    if (customPrompt && validatePromptTemplate(customPrompt)) {
      return customPrompt;
    }
    
    // Fall back to default prompt
    const defaultPrompt = getDefaultPrompt();
    if (defaultPrompt) {
      return defaultPrompt;
    }
    
    // Emergency fallback - generic prompt
    return getEmergencyPrompt();
    
  } catch (error) {
    console.warn('Failed to load custom prompt, using default:', error);
    return getDefaultPrompt() || getEmergencyPrompt();
  }
}

// Get stored prompts from browser storage
function getStoredPrompts() {
  return new Promise((resolve) => {
    browserAPI.storage.sync.get(['customPrompt'], (result) => {
      if (browserAPI.runtime.lastError) {
        resolve({ customPrompt: null });
      } else {
        resolve(result);
      }
    });
  });
}

// Validate prompt template for basic syntax
function validatePromptTemplate(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return false;
  }
  
  // Check for unclosed template variables
  const openBraces = (prompt.match(/\{\{/g) || []).length;
  const closeBraces = (prompt.match(/\}\}/g) || []).length;
  
  return openBraces === closeBraces;
}

// Get default prompt (same for all providers)
function getDefaultPrompt() {
  return `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in HTML format with clear sections for different aspects of the story. Use proper HTML tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> to structure your response. This will improve readability and allow for better formatting.

When providing specific text suggestions that can be copied and pasted directly into the user story (such as additional acceptance criteria, improved descriptions, or refined user story text), wrap these copyable snippets in <copyable></copyable> tags. For example:
- If suggesting a new acceptance criterion: <copyable>Given X when Y then Z</copyable>
- If suggesting improved wording: <copyable>As a user, I want to...</copyable>
- If suggesting additional details: <copyable>The system should validate...</copyable>

Only use copyable tags for literal text that can be directly copied into Azure DevOps work items, not for explanatory text or analysis.

Inside the copyable tags please use regular HTML formatting, so that formatting is transfered to Azure Devops as well. E.g. for lists use <ul> or <ol> tags etc.

Example: <p>Here are some improved acceptance criteria:</p><ol><li>User is presented option to cancel or continue</li><li>After canceling, the draft is discarded.</li></ol>`;
}

// Emergency fallback prompt (last resort)
function getEmergencyPrompt() {
  return `Please review the following user story and provide feedback:

{{storyContent}}

Provide suggestions for improvement.`;
}

// Check if we're using a custom prompt vs default
async function isUsingCustomPrompt(effectivePrompt) {
  try {
    const defaultPrompt = getDefaultPrompt();
    return effectivePrompt !== defaultPrompt && effectivePrompt !== getEmergencyPrompt();
  } catch (error) {
    return false;
  }
}

// Variable substitution engine
function substituteVariables(template, variables) {
  let result = template;
  
  // Standard variables
  const standardVars = {
    storyContent: variables.storyContent || '',
    timestamp: new Date().toISOString(),
    provider: variables.provider || 'unknown',
    feedbackType: 'General Review'
  };
  
  // Merge with any additional variables
  const allVars = { ...standardVars, ...variables };
  
  // Replace variables in template
  for (const [key, value] of Object.entries(allVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

// Helper functions for API integration
function getApiUrl(provider) {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'mistral':
      return 'https://api.mistral.ai/v1/chat/completions';
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
    case 'mistral':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    default:
      throw new Error('Unsupported API provider');
  }
}

function getTestPayload(provider, model = null) {
  // Get default models if none provided
  const defaultModels = {
    openai: 'gpt-3.5-turbo',
    anthropic: 'claude-3-haiku-20240307', 
    mistral: 'mistral-tiny'
  };
  
  const selectedModel = model || defaultModels[provider];
  
  switch (provider) {
    case 'openai':
      return {
        model: selectedModel,
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ],
        max_tokens: 10
      };
    case 'anthropic':
      return {
        model: selectedModel,
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ]
      };
    case 'mistral':
      return {
        model: selectedModel,
        messages: [
          { role: 'user', content: 'Test connection. Reply with "OK" if you receive this.' }
        ],
        max_tokens: 10
      };
    default:
      throw new Error('Unsupported API provider');
  }
}

function getFeedbackPayload(provider, content, promptTemplate, model = null, temperature = 0.7) {
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

  // Substitute variables in the prompt template
  const finalPrompt = substituteVariables(promptTemplate, {
    storyContent: contentString,
    provider: provider
  });

  // Get default models if none provided
  const defaultModels = {
    openai: 'gpt-4',
    anthropic: 'claude-3-sonnet-20240229',
    mistral: 'mistral-medium'
  };
  
  const selectedModel = model || defaultModels[provider];

  // Ensure temperature is a valid number
  const validTemperature = typeof temperature === 'number' && !isNaN(temperature) ? temperature : 0.7;

  let payload;
  switch (provider) {
    case 'openai':
      payload = {
        model: selectedModel,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        max_tokens: 2000,
        temperature: validTemperature
      };
      break;
    case 'anthropic':
      // Anthropic doesn't use temperature, uses 'temperature' parameter but it's optional
      // We'll include it for consistency but Claude API may ignore it
      payload = {
        model: selectedModel,
        max_tokens: 2000,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        temperature: validTemperature
      };
      break;
    case 'mistral':
      payload = {
        model: selectedModel,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        max_tokens: 2000,
        temperature: validTemperature
      };
      break;
    default:
      throw new Error('Unsupported API provider');
  }

  return {
    payload: payload,
    actualPrompt: finalPrompt,
    actualModel: selectedModel
  };
}

function validateApiResponse(provider, response) {
  if (!response) return false;
  
  switch (provider) {
    case 'openai':
      return !!(response.choices && response.choices.length > 0);
    case 'anthropic':
      return !!(response.content && response.content.length > 0);
    case 'mistral':
      return !!(response.choices && response.choices.length > 0);
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
    case 'mistral':
      return response.choices[0].message.content;
    default:
      throw new Error('Unsupported API provider');
  }
}