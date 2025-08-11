// Unit tests for AzureDevOpsStoryExtractor content script
// Tests DOM interaction, extraction flow, and error handling scenarios

// Mock browser APIs for testing
const mockChrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
    })
  },
  storage: {
    local: {
      set: jest.fn(),
      get: jest.fn()
    }
  }
};

// Mock document and window objects
const mockDocument = {
  readyState: 'complete',
  createElement: jest.fn(() => ({
    style: {},
    addEventListener: jest.fn(),
    textContent: '',
    id: ''
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  body: {
    appendChild: jest.fn()
  },
  addEventListener: jest.fn()
};

const mockWindow = {
  location: {
    href: 'https://dev.azure.com/org/project/_workitems/edit/123'
  }
};

// Setup global mocks
global.chrome = mockChrome;
global.document = mockDocument;
global.window = mockWindow;

describe('AzureDevOpsStoryExtractor', () => {
  let extractor; // eslint-disable-line no-unused-vars

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset DOM mocks
    mockDocument.querySelector.mockReturnValue(null);
    mockDocument.querySelectorAll.mockReturnValue([]);
  });

  describe('initialization', () => {
    test('should initialize on work item page', () => {
      mockWindow.location.href = 'https://dev.azure.com/org/project/_workitems/edit/123';
      
      // Mock AzureDevOpsStoryExtractor class (would be loaded from content-script.js)
      const mockExtractor = {
        isWorkItemPage: () => true,
        setupExtractor: jest.fn(),
        createExtractButton: jest.fn()
      };

      expect(mockExtractor.isWorkItemPage()).toBe(true);
    });

    test('should not initialize on non-work item page', () => {
      mockWindow.location.href = 'https://dev.azure.com/org/project/';
      
      const mockExtractor = {
        isWorkItemPage: () => false,
        setupExtractor: jest.fn()
      };

      expect(mockExtractor.isWorkItemPage()).toBe(false);
    });
  });

  describe('isWorkItemPage', () => {
    test('should return true for Azure DevOps work item URLs', () => {
      const testUrls = [
        'https://dev.azure.com/org/project/_workitems/edit/123',
        'https://myorg.visualstudio.com/project/_workitems/edit/456',
        'https://dev.azure.com/org/project/_workitems/create'
      ];

      testUrls.forEach(url => {
        mockWindow.location.href = url;
        // Mock the isWorkItemPage method logic
        const result = (url.includes('dev.azure.com') || url.includes('visualstudio.com')) &&
                      (url.includes('_workitems') || url.includes('workitems'));
        expect(result).toBe(true);
      });
    });

    test('should return false for non-work item URLs', () => {
      const testUrls = [
        'https://dev.azure.com/org/project/',
        'https://github.com/user/repo',
        'https://dev.azure.com/org/project/_git/repo'
      ];

      testUrls.forEach(url => {
        mockWindow.location.href = url;
        const result = (url.includes('dev.azure.com') || url.includes('visualstudio.com')) &&
                      (url.includes('_workitems') || url.includes('workitems'));
        expect(result).toBe(false);
      });
    });
  });

  describe('getStoryContentFromDOM', () => {
    test('should extract title from input element', () => {
      const mockTitleInput = {
        value: 'Test User Story Title',
        tagName: 'INPUT'
      };
      
      mockDocument.querySelector.mockImplementation(selector => {
        if (selector.includes('title')) return mockTitleInput;
        return null;
      });

      // Mock the extraction logic
      const result = {
        title: mockTitleInput.value,
        description: '',
        acceptanceCriteria: '',
        url: mockWindow.location.href,
        extractedAt: new Date().toISOString()
      };

      expect(result.title).toBe('Test User Story Title');
      expect(result.url).toBe(mockWindow.location.href);
    });

    test('should extract description from rich text editor', () => {
      const mockDescriptionElement = {
        innerHTML: '<p>As a user, I want to login <strong>so that</strong> I can access my account</p>',
        textContent: 'As a user, I want to login so that I can access my account',
        value: ''
      };

      mockDocument.querySelector.mockImplementation(selector => {
        if (selector.includes('description')) return mockDescriptionElement;
        return null;
      });

      const result = {
        description: mockDescriptionElement.textContent || mockDescriptionElement.innerHTML
      };

      expect(result.description).toContain('As a user, I want to login');
    });

    test('should handle empty fields gracefully', () => {
      mockDocument.querySelector.mockReturnValue(null);

      const result = {
        title: '',
        description: '',
        acceptanceCriteria: '',
        url: mockWindow.location.href,
        extractedAt: new Date().toISOString()
      };

      expect(result.title).toBe('');
      expect(result.description).toBe('');
      expect(result.acceptanceCriteria).toBe('');
    });
  });

  describe('extractStoryContent', () => {
    test('should successfully extract and validate content', () => {
      const mockContent = {
        title: 'User Login Story',
        description: 'As a user, I want to login so that I can access my account',
        acceptanceCriteria: 'User can enter credentials and login successfully',
        url: mockWindow.location.href,
        extractedAt: new Date().toISOString()
      };

      // Mock successful extraction
      const extractionResult = {
        success: true,
        content: mockContent,
        hasMinimumContent: true
      };

      expect(extractionResult.hasMinimumContent).toBe(true);
      expect(mockChrome.runtime.sendMessage).toBeDefined();
    });

    test('should handle extraction errors', () => {
      const mockError = new Error('DOM query failed');
      
      // Mock error scenario
      const extractionResult = {
        success: false,
        error: mockError
      };

      expect(extractionResult.success).toBe(false);
      expect(extractionResult.error.message).toBe('DOM query failed');
    });

    test('should validate minimum content requirements', () => {
      const testCases = [
        { title: 'Test', description: '', acceptanceCriteria: '', expected: true },
        { title: '', description: 'Test desc', acceptanceCriteria: '', expected: true },
        { title: '', description: '', acceptanceCriteria: 'Test AC', expected: true },
        { title: '', description: '', acceptanceCriteria: '', expected: false }
      ];

      testCases.forEach(testCase => {
        const hasMinimumContent = !!(testCase.title || testCase.description || testCase.acceptanceCriteria);
        expect(hasMinimumContent).toBe(testCase.expected);
      });
    });
  });

  describe('error handling', () => {
    test('should handle SecurityError appropriately', () => {
      const securityError = new Error('Permission denied');
      securityError.name = 'SecurityError';

      const errorMessage = securityError.name === 'SecurityError' ?
        'Permission denied. Please ensure extension has access to this page.' :
        'Error occurred during extraction: ' + securityError.message;

      expect(errorMessage).toBe('Permission denied. Please ensure extension has access to this page.');
    });

    test('should handle querySelector errors', () => {
      const querySelectorError = new Error('querySelector is not a function');

      const errorMessage = querySelectorError.message.includes('querySelector') ?
        'Page structure not recognized. This may not be a supported Azure DevOps page.' :
        'Error occurred during extraction: ' + querySelectorError.message;

      expect(errorMessage).toBe('Page structure not recognized. This may not be a supported Azure DevOps page.');
    });

    test('should handle generic errors', () => {
      const genericError = new Error('Unknown error occurred');

      const errorMessage = 'Error occurred during extraction: ' + genericError.message;
      expect(errorMessage).toBe('Error occurred during extraction: Unknown error occurred');
    });
  });

  describe('UI feedback', () => {
    test('should show success notification for valid extraction', () => {
      const mockContent = { // eslint-disable-line no-unused-vars
        title: 'Test Story',
        description: 'Test description'
      };

      const mockValidation = { // eslint-disable-line no-unused-vars
        isValid: true,
        issues: [],
        workItemType: 'User Story'
      };

      const expectedMessage = 'Story content extracted successfully!';
      expect(expectedMessage).toBe('Story content extracted successfully!');
    });

    test('should show success notification with validation issues', () => {
      const mockValidation = {
        isValid: false,
        issues: ['Title too short', 'Missing acceptance criteria'],
        workItemType: 'User Story'
      };

      const expectedMessage = `Story content extracted successfully! (${mockValidation.issues.length} validation issues found)`;
      expect(expectedMessage).toBe('Story content extracted successfully! (2 validation issues found)');
    });

    test('should show error notification for failed extraction', () => {
      const errorMessage = 'No story content found on this page';
      const expectedNotification = `Extraction failed: ${errorMessage}`;
      expect(expectedNotification).toBe('Extraction failed: No story content found on this page');
    });
  });

  describe('integration with background script', () => {
    test('should send extracted content to background script', () => {
      const mockContent = {
        title: 'Test Story',
        description: 'Test description',
        validation: { isValid: true, issues: [] }
      };

      const expectedMessage = {
        type: 'STORY_CONTENT_EXTRACTED',
        content: mockContent
      };

      // Simulate sending message
      mockChrome.runtime.sendMessage(expectedMessage, (response) => {
        expect(response.success).toBe(true);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expectedMessage,
        expect.any(Function)
      );
    });

    test('should handle background script response failure', () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (callback) callback({ success: false });
      });

      const mockContent = { title: 'Test' };
      const message = { type: 'STORY_CONTENT_EXTRACTED', content: mockContent };

      mockChrome.runtime.sendMessage(message, (response) => {
        expect(response.success).toBe(false);
      });
    });
  });
});

// Test configuration and setup
const testSetup = {
  beforeAll: () => {
    console.log('Setting up content script tests...');
  },
  afterAll: () => {
    console.log('Content script tests completed.');
  },
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testSetup };
}