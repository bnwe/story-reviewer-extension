// Background script for Azure DevOps Story Reviewer extension
// Handles extension lifecycle and communication between content scripts and popup

/* global getDefaultPromptTemplate, DEFAULT_PROMPT_TEMPLATE */

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Azure DevOps Story Reviewer extension installed');
});

// Handle messages from content scripts and options page
browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      // Remove any potential API key information from error text
      const sanitizedErrorText = sanitizeErrorMessage(errorText);
      throw new Error(`HTTP ${response.status}: ${sanitizedErrorText}`);
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
      error: isNetworkError ? 'Network error - check your internet connection' : error.message,
      errorDetails: {
        originalError: error.message,
        isNetworkError: isNetworkError,
        timestamp: new Date().toISOString(),
        requestData: {
          provider: settings.apiProvider,
          model: settings.model,
          hasApiKey: !!settings.apiKey,
          endpoint: getApiUrl(settings.apiProvider)
        },
        troubleshooting: getTroubleshootingSteps(error, isNetworkError)
      }
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
    const payloadData = getFeedbackPayload(settings.apiProvider, content, effectivePrompt, settings.model, settings.temperature, settings.maxTokens);
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
      // Remove any potential API key information from error text
      const sanitizedErrorText = sanitizeErrorMessage(errorText);
      throw new Error(`HTTP ${response.status}: ${sanitizedErrorText}`);
    }
    
    const result = await response.json();
    const feedback = extractFeedbackFromResponse(settings.apiProvider, result);
    const tokenUsage = extractTokenUsageFromResponse(settings.apiProvider, result);
    
    return { 
      success: true, 
      feedback: feedback,
      rawResponse: feedback, // Store raw response for display
      tokenUsage: tokenUsage, // Add token usage information
      promptInfo: {
        provider: settings.apiProvider,
        model: actualModel,
        temperature: settings.temperature || 0.7,
        isCustom: isCustomPrompt,
        promptPreview: effectivePrompt,
        actualPrompt: actualPrompt,
        timestamp: new Date().toISOString(),
        hasVariables: effectivePrompt.includes('{{'),
        tokenUsage: tokenUsage // Also include in promptInfo for compatibility
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
    let errorActualPrompt = actualPrompt;
    let errorActualModel = actualModel;
    try {
      const effectivePrompt = await getEffectivePrompt();
      const isCustomPrompt = await isUsingCustomPrompt(effectivePrompt);
      // Try to get actual prompt and model if it wasn't generated before error
      if (!errorActualPrompt) {
        try {
          const payloadData = getFeedbackPayload(settings.apiProvider, content, effectivePrompt, settings.model, settings.temperature, settings.maxTokens);
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
      promptInfo: promptInfo,
      errorDetails: {
        originalError: error.message,
        isNetworkError: isNetworkError,
        timestamp: new Date().toISOString(),
        requestData: {
          provider: settings.apiProvider,
          model: (errorActualModel || actualModel || settings.model),
          hasApiKey: !!settings.apiKey,
          promptLength: (errorActualPrompt ? errorActualPrompt.length : 0)
        },
        troubleshooting: getTroubleshootingSteps(error, isNetworkError)
      }
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
  // Access the shared constants - in background script context, these are loaded globally
  if (typeof getDefaultPromptTemplate !== 'undefined') {
    return getDefaultPromptTemplate();
  } else if (typeof window !== 'undefined' && window.StoryReviewerConstants) {
    return window.StoryReviewerConstants.getDefaultPromptTemplate();
  } else {
    // Fallback for any edge cases
    return DEFAULT_PROMPT_TEMPLATE;
  }
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
  
  // Extract content object if available
  const content = variables.content || variables;
  
  // Standard variables
  const standardVars = {
    storyContent: variables.storyContent || '',
    formattedContent: content.formattedContent || variables.storyContent || '',
    timestamp: new Date().toISOString(),
    provider: variables.provider || 'unknown',
    feedbackType: 'General Review'
  };
  
  // Azure DevOps specific variables
  const azureDevOpsVars = {
    workItemId: content.workItemId || '',
    workItemType: content.workItemType || 'Unknown',
    state: content.state || '',
    assignedTo: content.assignedTo || '',
    priority: content.priority || '',
    storyPoints: content.storyPoints ? String(content.storyPoints) : '',
    areaPath: content.areaPath || '',
    iterationPath: content.iterationPath || '',
    implementationDetails: content.implementationDetails || '',
    createdDate: content.createdDate || '',
    modifiedDate: content.modifiedDate || '',
    originalEstimate: content.originalEstimate ? String(content.originalEstimate) + 'h' : '',
    remainingWork: content.remainingWork ? String(content.remainingWork) + 'h' : '',
    completedWork: content.completedWork ? String(content.completedWork) + 'h' : '',
    activity: content.activity || '',
    tags: content.tags && content.tags.length > 0 ? content.tags.join(', ') : '',
    title: content.title || '',
    description: content.description || '',
    acceptanceCriteria: content.acceptanceCriteria || ''
  };
  
  // Merge all variables
  const allVars = { ...standardVars, ...azureDevOpsVars, ...variables };
  
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
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
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
  // Get default models if none provided (should match options.js)
  const defaultModels = {
    openai: 'gpt-4.1',
    anthropic: 'claude-sonnet-4-20250514', 
    mistral: 'mistral-medium-latest'
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

function getFeedbackPayload(provider, content, promptTemplate, model = null, temperature = 0.7, maxTokens = 10000) {
  // Convert content to string if it's an object
  let contentString = '';
  if (typeof content === 'object' && content !== null) {
    // Use the formatted content if available, otherwise build it
    if (content.formattedContent) {
      contentString = content.formattedContent;
    } else {
      if (content.title) contentString += `Title: ${content.title}\n`;
      if (content.description) contentString += `Description: ${content.description}\n`;
      if (content.acceptanceCriteria) contentString += `Acceptance Criteria: ${content.acceptanceCriteria}\n`;
      if (!contentString) contentString = JSON.stringify(content, null, 2);
    }
  } else {
    contentString = String(content);
  }

  // Substitute variables in the prompt template
  const finalPrompt = substituteVariables(promptTemplate, {
    storyContent: contentString,
    provider: provider,
    content: content
  });

  // Get default models if none provided (should match options.js)
  const defaultModels = {
    openai: 'gpt-4.1',
    anthropic: 'claude-sonnet-4-20250514',
    mistral: 'mistral-medium-latest'
  };
  
  const selectedModel = model || defaultModels[provider];

  // Ensure temperature is a valid number
  const validTemperature = typeof temperature === 'number' && !isNaN(temperature) ? temperature : 0.7;
  // Ensure maxTokens is a valid number
  const validMaxTokens = typeof maxTokens === 'number' && !isNaN(maxTokens) && maxTokens > 0 ? maxTokens : 10000;

  let payload;
  switch (provider) {
    case 'openai':
      payload = {
        model: selectedModel,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        max_tokens: validMaxTokens,
        temperature: validTemperature
      };
      break;
    case 'anthropic':
      // Anthropic doesn't use temperature, uses 'temperature' parameter but it's optional
      // We'll include it for consistency but Claude API may ignore it
      payload = {
        model: selectedModel,
        max_tokens: validMaxTokens,
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
        max_tokens: validMaxTokens,
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

function extractTokenUsageFromResponse(provider, response) {
  try {
    switch (provider) {
      case 'openai':
        // OpenAI format: { usage: { prompt_tokens: X, completion_tokens: Y, total_tokens: Z } }
        if (response.usage) {
          return {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            hasUsage: true
          };
        }
        break;
      case 'anthropic':
        // Anthropic format: { usage: { input_tokens: X, output_tokens: Y } }
        if (response.usage) {
          return {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            hasUsage: true
          };
        }
        break;
      case 'mistral':
        // Mistral format: { usage: { prompt_tokens: X, completion_tokens: Y, total_tokens: Z } }
        if (response.usage) {
          return {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            hasUsage: true
          };
        }
        break;
      case 'custom':
        // Try to detect common token usage formats for custom endpoints
        if (response.usage) {
          // Try OpenAI format first
          if (response.usage.prompt_tokens !== undefined && response.usage.completion_tokens !== undefined) {
            return {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens || (response.usage.prompt_tokens + response.usage.completion_tokens),
              hasUsage: true
            };
          }
          // Try Anthropic format
          if (response.usage.input_tokens !== undefined && response.usage.output_tokens !== undefined) {
            return {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.input_tokens + response.usage.output_tokens,
              hasUsage: true
            };
          }
        }
        break;
    }
    
    // No token usage found
    return {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      hasUsage: false
    };
    
  } catch (error) {
    console.warn('Failed to extract token usage:', error);
    return {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      hasUsage: false,
      error: error.message
    };
  }
}

// Get troubleshooting steps based on error type and settings
function getTroubleshootingSteps(error, isNetworkError) {
  const steps = [];
  
  if (isNetworkError) {
    steps.push('Check your internet connection');
    steps.push('Verify the extension has permission to access the API endpoint');
    steps.push('Try disabling any VPN or proxy settings temporarily');
    return steps;
  }
  
  const errorMessage = error.message.toLowerCase();
  
  // API key related errors
  if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || 
      errorMessage.includes('invalid api key') || errorMessage.includes('authentication')) {
    steps.push('Verify your API key is correct and active');
    steps.push('Check that your API key has the necessary permissions');
    steps.push('Ensure the API key matches the selected provider');
    return steps;
  }
  
  // Rate limiting errors
  if (errorMessage.includes('rate limit') || errorMessage.includes('429') ||
      errorMessage.includes('quota') || errorMessage.includes('too many requests')) {
    steps.push('You have exceeded the API rate limits');
    steps.push('Wait a few minutes before trying again');
    steps.push('Consider upgrading your API plan if this happens frequently');
    return steps;
  }
  
  // Payment/billing errors
  if (errorMessage.includes('billing') || errorMessage.includes('payment') ||
      errorMessage.includes('insufficient funds') || errorMessage.includes('402')) {
    steps.push('Check your API account billing status');
    steps.push('Verify you have available credits or valid payment method');
    steps.push('Contact your API provider support if billing issues persist');
    return steps;
  }
  
  // Model not found errors
  if (errorMessage.includes('model') && (errorMessage.includes('not found') ||
      errorMessage.includes('invalid') || errorMessage.includes('404'))) {
    steps.push('The specified model may not be available');
    steps.push('Try using a different model (check your settings)');
    steps.push('Verify the model name is spelled correctly');
    return steps;
  }
  
  // Request too large errors
  if (errorMessage.includes('too large') || errorMessage.includes('413') ||
      errorMessage.includes('context length') || errorMessage.includes('token limit')) {
    steps.push('The user story content is too long for the model');
    steps.push('Try reducing the max tokens setting');
    steps.push('Consider using a model with larger context window');
    return steps;
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('502') ||
      errorMessage.includes('503') || errorMessage.includes('504') ||
      errorMessage.includes('internal server error')) {
    steps.push('The API service is experiencing issues');
    steps.push('Wait a few minutes and try again');
    steps.push('Check the API provider\'s status page for outages');
    return steps;
  }
  
  // Generic fallback
  steps.push('Check your API settings in the extension options');
  steps.push('Try testing the API connection in settings');
  steps.push('Review the error details below for more information');
  
  return steps;
}

// Sanitize error messages to remove any potential API key information
function sanitizeErrorMessage(errorText) {
  if (!errorText || typeof errorText !== 'string') {
    return errorText;
  }
  
  // Remove any API key patterns that might appear in error messages
  // This covers various common API key formats that might be exposed
  const sanitized = errorText
    // Remove strings that look like API keys (sk-, pk-, etc. followed by alphanumeric)
    .replace(/\b(?:sk|pk|api_key|apikey|token)[-_]?[a-zA-Z0-9]{10,}\b/gi, '[API_KEY_REMOVED]')
    // Remove Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9._-]{10,}/gi, 'Bearer [TOKEN_REMOVED]')
    // Remove long base64-like strings that could be keys (20+ chars of alphanumeric/+/=)
    .replace(/\b[a-zA-Z0-9+/=]{20,}\b/g, '[KEY_REMOVED]')
    // Remove any remaining patterns that look like obfuscated keys (multiple asterisks)
    .replace(/\*{3,}/g, '[KEY_REMOVED]');
  
  return sanitized;
}