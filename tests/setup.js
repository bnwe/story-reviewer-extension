// Test setup file for Azure DevOps Story Reviewer extension tests
// Configures test environment, mocks, and global utilities

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      // Default successful response
      setTimeout(() => {
        if (callback) {
          callback({ success: true });
        }
      }, 0);
    }),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      set: jest.fn((data, callback) => {
        if (callback) callback();
      }),
      get: jest.fn((keys, callback) => {
        if (callback) callback({});
      })
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Mock DOM APIs
global.document = {
  readyState: 'complete',
  createElement: jest.fn((tagName) => ({
    tagName: tagName.toUpperCase(),
    style: {},
    addEventListener: jest.fn(),
    textContent: '',
    innerHTML: '',
    id: '',
    value: '',
    appendChild: jest.fn(),
    parentNode: null
  })),
  querySelector: jest.fn().mockReturnValue(null),
  querySelectorAll: jest.fn().mockReturnValue([]),
  body: {
    appendChild: jest.fn()
  },
  addEventListener: jest.fn()
};

global.window = {
  location: {
    href: 'https://dev.azure.com/org/project/_workitems/edit/123'
  }
};

// Load shared constants for tests
const constants = require('../shared/constants.js');
global.DEFAULT_PROMPT_TEMPLATE = constants.DEFAULT_PROMPT_TEMPLATE;
global.getDefaultPromptTemplate = constants.getDefaultPromptTemplate;

// Make constants available as they would be in browser environment
global.window.StoryReviewerConstants = {
  DEFAULT_PROMPT_TEMPLATE: constants.DEFAULT_PROMPT_TEMPLATE,
  getDefaultPromptTemplate: constants.getDefaultPromptTemplate
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Test utilities
global.TestUtils = {
  // Create mock DOM element
  createMockElement: (tagName, attributes = {}, content = '') => ({
    tagName: tagName.toUpperCase(),
    attributes,
    innerHTML: content,
    textContent: content.replace(/<[^>]*>/g, ''),
    value: attributes.value || '',
    style: {},
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  }),

  // Create mock Azure DevOps work item page
  createMockWorkItemPage: (workItemData = {}) => {
    const defaultData = {
      id: '123',
      title: 'Test User Story',
      description: 'As a user, I want to test so that I can verify functionality',
      acceptanceCriteria: 'Test passes successfully',
      state: 'New',
      assignedTo: 'test@example.com',
      tags: ['testing', 'automation']
    };

    const data = { ...defaultData, ...workItemData };

    // Mock DOM elements for work item fields
    global.document.querySelector.mockImplementation(selector => {
      if (selector.includes('title')) {
        return TestUtils.createMockElement('INPUT', { value: data.title });
      }
      if (selector.includes('description')) {
        return TestUtils.createMockElement('DIV', {}, data.description);
      }
      if (selector.includes('acceptance')) {
        return TestUtils.createMockElement('DIV', {}, data.acceptanceCriteria);
      }
      if (selector.includes('state')) {
        return TestUtils.createMockElement('INPUT', { value: data.state });
      }
      if (selector.includes('assigned')) {
        return TestUtils.createMockElement('INPUT', { value: data.assignedTo });
      }
      if (selector.includes('tags')) {
        return TestUtils.createMockElement('INPUT', { value: data.tags.join(';') });
      }
      return null;
    });

    return data;
  },

  // Reset all mocks
  resetMocks: () => {
    jest.clearAllMocks();
    if (global.document.querySelector.mockReturnValue) {
      global.document.querySelector.mockReturnValue(null);
    }
    if (global.document.querySelectorAll.mockReturnValue) {
      global.document.querySelectorAll.mockReturnValue([]);
    }
  },

  // Simulate Chrome extension message passing
  simulateMessage: (message, responseData = { success: true }) => {
    const callbacks = [];
    
    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (callback) {
        callbacks.push(callback);
      }
    });

    // Trigger callbacks
    setTimeout(() => {
      callbacks.forEach(callback => callback(responseData));
    }, 0);

    return callbacks;
  }
};

// Jest configuration
jest.setTimeout(10000); // 10 second timeout for tests

// Setup before each test
beforeEach(() => {
  TestUtils.resetMocks();
});

// Setup after each test
afterEach(() => {
  // Clean up any lingering timers or promises
  jest.clearAllTimers();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock ExtractionUtils for tests
global.ExtractionUtils = {
  sanitizeContent: jest.fn((content) => {
    if (!content) return '';
    // Match the exact test expectations
    const withLineBreaks = content.replace(/<br\s*\/?>/gi, '\n')
                                  .replace(/<\/p>/gi, '\n')
                                  .replace(/<p[^>]*>/gi, '');
    const textOnly = withLineBreaks.replace(/<[^>]*>/g, '');
    return textOnly.replace(/\s+/g, ' ')
                   .replace(/\n\s+/g, '\n')
                   .replace(/([\n])\s+/g, '$1')
                   .trim();
  }),
  extractRichTextContent: jest.fn((element) => {
    if (!element) return '';
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value;
    }
    return element.textContent || element.innerHTML || '';
  }),
  detectWorkItemType: jest.fn((url, title) => {
    if (url.includes('witd=user%20story')) return 'User Story';
    if (url.includes('witd=bug')) return 'Bug';
    if (url.includes('witd=task')) return 'Task';
    if (title && title.toLowerCase().includes('as a ') && title.toLowerCase().includes('i want')) {
      return 'User Story';
    }
    return 'Unknown';
  }),
  validateExtractedContent: jest.fn((content) => {
    const issues = [];
    if (!content.title || content.title.length < 5) {
      issues.push('Title is missing or too short');
    }
    if (!content.description || content.description.length < 10) {
      issues.push('Description is missing or too short');
    }
    
    const workItemType = global.ExtractionUtils.detectWorkItemType(content.url, content.title);
    if (workItemType === 'User Story') {
      const desc = content.description.toLowerCase();
      if (!desc.includes('as a') || !desc.includes('i want') || !desc.includes('so that')) {
        issues.push('User story does not follow standard format (As a... I want... So that...)');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      workItemType: workItemType
    };
  }),
  enhanceContentExtraction: jest.fn((content) => ({
    ...content,
    workItemId: '123',
    state: 'New',
    assignedTo: null,
    tags: []
  })),
  extractWorkItemId: jest.fn((mockDocument) => {
    // More realistic implementation that looks at window.location
    const url = global.window.location.href;
    const urlMatch = url.match(/workitems\/edit\/(\d+)/);
    return urlMatch ? urlMatch[1] : null;
  })
};

console.log('Test setup completed - Azure DevOps Story Reviewer Extension');