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
    const existingButtons = document.querySelectorAll('#story-extractor-btn');
    existingButtons.forEach(button => button.remove());
    this.extractButton = null;
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
      if (document.querySelector('#story-extractor-btn')) {
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
    // Create extraction button and inject inline
    const extractButton = document.createElement('button');
    extractButton.id = 'story-extractor-btn';
    extractButton.textContent = 'Extract Story Content';
    extractButton.style.cssText = `
      margin-right: 8px;
      padding: 6px 12px;
      background-color: #0078d4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    `;

    extractButton.addEventListener('click', () => this.extractStoryContent());
    extractButton.addEventListener('mouseenter', () => {
      extractButton.style.backgroundColor = '#106ebe';
    });
    extractButton.addEventListener('mouseleave', () => {
      extractButton.style.backgroundColor = '#0078d4';
    });

    // Insert button as first child of search header (to the left of search field)
    searchHeader.insertBefore(extractButton, searchHeader.firstChild);
    this.extractButton = extractButton;
  }

  createFixedExtractButton() {
    // Fallback method for fixed positioning when search header not found
    const extractButton = document.createElement('button');
    extractButton.id = 'story-extractor-btn';
    extractButton.textContent = 'Extract Story Content';
    extractButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      padding: 10px 15px;
      background-color: #0078d4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    extractButton.addEventListener('click', () => this.extractStoryContent());
    extractButton.addEventListener('mouseenter', () => {
      extractButton.style.backgroundColor = '#106ebe';
    });
    extractButton.addEventListener('mouseleave', () => {
      extractButton.style.backgroundColor = '#0078d4';
    });

    document.body.appendChild(extractButton);
    this.extractButton = extractButton;
  }

  extractStoryContent() {
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
            this.showExtractionSuccess(content, validation);
          } else {
            this.showExtractionError('Failed to store extracted content');
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

  showExtractionSuccess(content, validation) {
    let message = 'Story content extracted successfully!';
    
    // Add validation details to success message
    if (validation && !validation.isValid && validation.issues.length > 0) {
      message += ` (${validation.issues.length} validation issues found)`;
    }
    
    const notification = this.createNotification(message, 'success');
    
    // Log detailed extraction results
    console.log('Extracted content:', content);
    if (validation && validation.issues.length > 0) {
      console.warn('Validation issues:', validation.issues);
    }
  }

  showExtractionError(message) {
    const notification = this.createNotification(
      `Extraction failed: ${message}`,
      'error'
    );
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 10001;
      padding: 12px 16px;
      background-color: ${type === 'success' ? '#107c10' : '#d13438'};
      color: white;
      border-radius: 4px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      max-width: 300px;
    `;
    notification.textContent = message;

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