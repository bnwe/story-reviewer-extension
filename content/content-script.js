// Content script for Azure DevOps Story Reviewer extension
// Runs on Azure DevOps work item pages to extract user story content

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

class AzureDevOpsStoryExtractor {
  constructor() {
    this.isInitialized = false;
    this.extractButton = null;
    this.init();
  }

  init() {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtractor());
    } else {
      this.setupExtractor();
    }
  }

  setupExtractor() {
    // Check if we're on a work item page
    if (!this.isWorkItemPage()) {
      return;
    }

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
    // Create extraction button and inject into page
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

    // Extract description with enhanced handling
    const descriptionSelectors = [
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
          content.description = (descElement.value || descElement.textContent || descElement.innerHTML).trim();
        }
        if (content.description) break;
      }
    }

    // Extract acceptance criteria with enhanced handling
    const acSelectors = [
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
          content.acceptanceCriteria = (acElement.value || acElement.textContent || acElement.innerHTML).trim();
        }
        if (content.acceptanceCriteria) break;
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