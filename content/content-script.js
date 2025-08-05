// Content script for Azure DevOps Story Reviewer extension
// Runs on Azure DevOps work item pages to extract user story content

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

class AzureDevOpsStoryExtractor {
  constructor() {
    this.isInitialized = false;
    this.extractButton = null;
    this.observer = null;
    this.isCreatingButton = false;
    this.init();
  }

  init() {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtractor());
    } else {
      this.setupExtractor();
    }

    // Set up observers for SPA navigation
    this.setupNavigationObserver();
  }

  setupNavigationObserver() {
    // Watch for URL changes in SPA
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => this.reinitialize(), 500); // Delay to allow page to load
      }
    }).observe(document, { subtree: true, childList: true });

    // Also watch for DOM changes that might indicate page content has changed
    this.observer = new MutationObserver((mutations) => {
      const hasRelevantChanges = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.classList?.contains('expandable-search-header') || 
           node.querySelector?.('.expandable-search-header'))
        )
      );
      
      if (hasRelevantChanges && !this.extractButton && !this.isCreatingButton) {
        setTimeout(() => this.setupExtractor(), 100);
      }
    });
    
    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }

  reinitialize() {
    this.cleanup();
    this.setupExtractor();
  }

  cleanup() {
    // Remove existing buttons
    const existingButtons = document.querySelectorAll('#story-feedback-btn');
    existingButtons.forEach(button => button.remove());
    
    // Remove button containers
    const buttonContainers = document.querySelectorAll('div[style*="inline-flex"]');
    buttonContainers.forEach(container => {
      if (container.querySelector('#story-feedback-btn')) {
        container.remove();
      }
    });
    
    this.feedbackButton = null;
    this.isInitialized = false;
    this.isCreatingButton = false;
  }

  setupExtractor() {
    // Check if we're on a work item page
    if (!this.isWorkItemPage()) {
      return;
    }

    // Prevent concurrent button creation
    if (this.isCreatingButton) {
      return;
    }

    // Clean up any existing buttons first
    this.cleanup();

    this.createExtractButton();
    this.isInitialized = true;
    console.log('Azure DevOps Story Extractor initialized');
  }

  isWorkItemPage() {
    // Check if current page is a work item page in Azure DevOps
    const url = window.location.href;
    return (
      (url.includes('dev.azure.com') || url.includes('visualstudio.com')) &&
      (url.includes('_workitems') || url.includes('workitems'))
    );
  }

  createExtractButton() {
    // Prevent concurrent button creation
    if (this.isCreatingButton) {
      return;
    }
    
    this.isCreatingButton = true;
    
    // Wait for search header to be available with retry logic
    this.waitForSearchHeader().then(searchHeader => {
      // Double-check we still need to create the button
      if (document.querySelector('#story-feedback-btn')) {
        this.isCreatingButton = false;
        return;
      }
      
      if (searchHeader) {
        this.createInlineButton(searchHeader);
      } else {
        console.warn('Search header not found after retries, falling back to fixed positioning');
        this.createFixedExtractButton();
      }
      
      this.isCreatingButton = false;
    }).catch(error => {
      console.error('Error creating extract button:', error);
      this.isCreatingButton = false;
    });
  }

  waitForSearchHeader(maxRetries = 10, delay = 200) {
    return new Promise((resolve) => {
      let retries = 0;
      
      const checkForHeader = () => {
        const searchHeader = document.querySelector('.flex-row.expandable-search-header');
        if (searchHeader) {
          resolve(searchHeader);
          return;
        }
        
        retries++;
        if (retries < maxRetries) {
          setTimeout(checkForHeader, delay);
        } else {
          resolve(null);
        }
      };
      
      checkForHeader();
    });
  }

  createInlineButton(searchHeader) {
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: inline-flex;
      gap: 0.5rem;
      margin-right: 0.75rem;
    `;


    // Create feedback button
    const feedbackButton = document.createElement('button');
    feedbackButton.id = 'story-feedback-btn';
    feedbackButton.textContent = 'Get Feedback';
    feedbackButton.style.cssText = `
      padding: 0.5rem 0.75rem;
      background: #2563eb;
      color: white;
      border: 1px solid #2563eb;
      border-radius: 0.375rem;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      -webkit-font-smoothing: antialiased;
    `;

    // Button event listeners

    feedbackButton.addEventListener('click', () => this.openFeedbackWindow());
    feedbackButton.addEventListener('mouseenter', () => {
      feedbackButton.style.background = '#1d4ed8';
      feedbackButton.style.borderColor = '#1d4ed8';
    });
    feedbackButton.addEventListener('mouseleave', () => {
      feedbackButton.style.background = '#2563eb';
      feedbackButton.style.borderColor = '#2563eb';
    });

    // Add button to container
    buttonContainer.appendChild(feedbackButton);

    // Insert container as first child of search header
    searchHeader.insertBefore(buttonContainer, searchHeader.firstChild);
    this.feedbackButton = feedbackButton;
  }

  createFixedExtractButton() {
    // Fallback method for fixed positioning when search header not found
    const feedbackButton = document.createElement('button');
    feedbackButton.id = 'story-feedback-btn';
    feedbackButton.textContent = 'Get Feedback';
    feedbackButton.style.cssText = `
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 10000;
      padding: 0.75rem 1rem;
      background: #2563eb;
      color: white;
      border: 1px solid #2563eb;
      border-radius: 0.5rem;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      -webkit-font-smoothing: antialiased;
    `;

    feedbackButton.addEventListener('click', () => this.openFeedbackWindow());
    feedbackButton.addEventListener('mouseenter', () => {
      feedbackButton.style.background = '#1d4ed8';
      feedbackButton.style.borderColor = '#1d4ed8';
      feedbackButton.style.transform = 'translateY(-1px)';
      feedbackButton.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
    });
    feedbackButton.addEventListener('mouseleave', () => {
      feedbackButton.style.background = '#2563eb';
      feedbackButton.style.borderColor = '#2563eb';
      feedbackButton.style.transform = 'translateY(0)';
      feedbackButton.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    });

    document.body.appendChild(feedbackButton);
    this.feedbackButton = feedbackButton;
  }

  openFeedbackWindow() {
    // First extract current content if not already extracted
    this.extractStoryContent(true);
    
    // Open feedback window
    const feedbackUrl = chrome.runtime.getURL('feedback/feedback.html');
    const windowFeatures = 'width=1000,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no';
    
    try {
      window.open(feedbackUrl, 'storyFeedback', windowFeatures);
    } catch (error) {
      console.error('Failed to open feedback window:', error);
      this.showExtractionError('Failed to open feedback window. Please check popup blocker settings.');
    }
  }

  extractStoryContent(silent = false) {
    try {
      const content = this.getStoryContentFromDOM();
      
      // Validate extracted content accuracy
      let validation = { isValid: true, issues: [], workItemType: 'Unknown' };
      if (typeof ExtractionUtils !== 'undefined') {
        validation = ExtractionUtils.validateExtractedContent(content);
      }
      
      // Check if we have minimum required content
      const hasMinimumContent = content.title || content.description || content.acceptanceCriteria;
      
      if (hasMinimumContent) {
        // Add validation results to content
        content.validation = validation;
        
        // Send extracted content to background script
        browserAPI.runtime.sendMessage({
          type: 'STORY_CONTENT_EXTRACTED',
          content: content
        }, (response) => {
          if (response && response.success) {
            this.showExtractionSuccess(content, validation, silent);
          } else {
            if (!silent) this.showExtractionError('Failed to store extracted content');
          }
        });
      } else {
        this.showExtractionError('No story content found on this page');
      }
    } catch (error) {
      console.error('Error extracting story content:', error);
      this.handleExtractionError(error);
    }
  }

  handleExtractionError(error) {
    // Enhanced error handling with specific error types
    let errorMessage = 'Error occurred during extraction: ';
    
    if (error.name === 'SecurityError') {
      errorMessage += 'Permission denied. Please ensure extension has access to this page.';
    } else if (error.message.includes('querySelector')) {
      errorMessage += 'Page structure not recognized. This may not be a supported Azure DevOps page.';
    } else {
      errorMessage += error.message;
    }
    
    this.showExtractionError(errorMessage);
  }

  getStoryContentFromDOM() {
    const content = {
      title: '',
      description: '',
      acceptanceCriteria: '',
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };

    // Extract title - try multiple selectors for different Azure DevOps layouts
    const titleSelectors = [
      '[data-testid="work-item-form-title"] input',
      '.work-item-form-title input',
      '.workitem-title-textbox',
      'input[aria-label*="Title"]',
      '.wit-form .workitem-title input'
    ];
    
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.value) {
        content.title = titleElement.value.trim();
        break;
      }
    }

    // Extract description with enhanced handling for rich text editor
    const descriptionSelectors = [
      '.rooster-editor[aria-label="Description"]',
      '[aria-label="Description"].rooster-editor',
      '.rooster-editor.text-element',
      '[data-testid="work-item-form-description"]',
      '.work-item-form-description',
      '.workitem-description',
      '[aria-label*="Description"]',
      '.html-editor-container',
      '.richeditor-container'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector);
      if (descElement) {
        // Use ExtractionUtils for enhanced content extraction
        if (typeof ExtractionUtils !== 'undefined') {
          content.description = ExtractionUtils.extractRichTextContent(descElement);
        } else {
          // Handle contenteditable divs properly - extract HTML formatting
          if (descElement.contentEditable === 'true' || descElement.getAttribute('contenteditable') === 'true') {
            content.description = descElement.innerHTML.trim();
          } else {
            content.description = (descElement.value || descElement.textContent || descElement.innerHTML).trim();
          }
        }
        if (content.description && 
            content.description !== 'Click to add Description.' &&
            !content.description.includes('Click to add Description.') &&
            content.description !== '<div><br> </div>') {
          break;
        }
      }
    }

    // Extract acceptance criteria with enhanced handling for rich text editor
    const acSelectors = [
      '.rooster-editor[aria-label="Acceptance Criteria"]',
      '[aria-label="Acceptance Criteria"].rooster-editor',
      '.rooster-editor[aria-label*="Acceptance"]',
      '[aria-label*="Acceptance"].rooster-editor',
      '[data-testid="work-item-form-acceptance-criteria"]',
      '.work-item-form-acceptance-criteria',
      '.workitem-acceptance-criteria',
      '[aria-label*="Acceptance Criteria"]',
      '[aria-label*="Acceptance"]'
    ];

    for (const selector of acSelectors) {
      const acElement = document.querySelector(selector);
      if (acElement) {
        if (typeof ExtractionUtils !== 'undefined') {
          content.acceptanceCriteria = ExtractionUtils.extractRichTextContent(acElement);
        } else {
          // Handle contenteditable divs properly - extract HTML formatting
          if (acElement.contentEditable === 'true' || acElement.getAttribute('contenteditable') === 'true') {
            content.acceptanceCriteria = acElement.innerHTML.trim();
          } else {
            content.acceptanceCriteria = (acElement.value || acElement.textContent || acElement.innerHTML).trim();
          }
        }
        // Filter out placeholder text and empty HTML
        if (content.acceptanceCriteria && 
            !content.acceptanceCriteria.includes('Click to add') && 
            content.acceptanceCriteria !== '<div><br> </div>' &&
            content.acceptanceCriteria.length > 0) {
          break;
        }
      }
    }

    // Enhanced content with additional fields if ExtractionUtils is available
    if (typeof ExtractionUtils !== 'undefined') {
      const enhancedContent = ExtractionUtils.enhanceContentExtraction(content, document);
      return enhancedContent;
    }

    return content;
  }

  showExtractionSuccess(content, validation, silent = false) {
    if (silent) {
      // Silent extraction - no logging for security
      if (validation && validation.issues.length > 0) {
        console.warn('Validation issues:', validation.issues);
      }
      return;
    }
    
    let message = 'Story content extracted successfully!';
    
    // Add validation details to success message
    if (validation && !validation.isValid && validation.issues.length > 0) {
      message += ` (${validation.issues.length} validation issues found)`;
    }
    
    this.createNotification(message, 'success');
    
    // Content extracted successfully
    if (validation && validation.issues.length > 0) {
      console.warn('Validation issues:', validation.issues);
    }
  }

  showExtractionError(message) {
    this.createNotification(
      `Extraction failed: ${message}`,
      'error'
    );
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 10001;
      padding: 0.75rem 1rem;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 0.5rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      max-width: 320px;
      border: 1px solid ${type === 'success' ? '#10b981' : '#ef4444'};
      animation: slideInRight 0.3s ease-out;
      -webkit-font-smoothing: antialiased;
    `;
    notification.textContent = message;

    // Add CSS animation keyframes if not already added
    if (!document.querySelector('#story-reviewer-animations')) {
      const style = document.createElement('style');
      style.id = 'story-reviewer-animations';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);

    return notification;
  }
}

// Initialize the story extractor when the script loads
new AzureDevOpsStoryExtractor();