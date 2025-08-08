// Utility functions for Azure DevOps content extraction
// Handles different layouts, rich text formatting, and edge cases
// Used by content-script.js for extraction operations

class ExtractionUtils {
  
  static sanitizeContent(content) {
    if (!content) return '';
    
    // Remove HTML tags but preserve line breaks
    const withLineBreaks = content.replace(/<br\s*\/?>/gi, '\n')
                                  .replace(/<\/p>/gi, '\n')
                                  .replace(/<p[^>]*>/gi, '');
    
    // Strip remaining HTML tags
    const textOnly = withLineBreaks.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    return textOnly.replace(/\s+/g, ' ')
                   .replace(/\n\s+/g, '\n')
                   .trim();
  }

  static extractRichTextContent(element) {
    if (!element) return '';
    
    // Handle Monaco Editor (code editor used in Azure DevOps)
    const monacoEditor = element.querySelector('.monaco-editor');
    if (monacoEditor) {
      const textArea = monacoEditor.querySelector('textarea');
      if (textArea) return textArea.value;
      
      // Fallback to reading from editor lines
      const lines = monacoEditor.querySelectorAll('.view-line');
      return Array.from(lines).map(line => line.textContent).join('\n');
    }
    
    // Handle rich text editors - preserve HTML formatting
    const richTextEditor = element.querySelector('[contenteditable="true"]');
    if (richTextEditor) {
      return richTextEditor.innerHTML.trim();
    }
    
    // Handle standard input/textarea elements
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value;
    }
    
    // For direct contenteditable elements, preserve HTML
    if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
      return element.innerHTML.trim();
    }
    
    // Handle div with text content - fallback to sanitized content
    return this.sanitizeContent(element.innerHTML || element.textContent);
  }

  static detectWorkItemType(title, document) {
    // Method 1: Extract from page title (most reliable)
    if (title) {
      const titleMatch = title.match(/^(User Story|Bug|Task|Feature|Epic|Test Case|Product Backlog Item)/i);
      if (titleMatch) {
        return titleMatch[1];
      }
    }
    
    // Method 2: Extract from header link (secondary method)
    if (document) {
      const headerLinks = document.querySelectorAll('a[href*="_workitems"]');
      for (const link of headerLinks) {
        const linkText = link.textContent?.trim();
        if (linkText) {
          const linkMatch = linkText.match(/^(USER STORY|BUG|TASK|FEATURE|EPIC|TEST CASE|PRODUCT BACKLOG ITEM)\s+\d+/i);
          if (linkMatch) {
            // Normalize the text to proper case
            return linkMatch[1].toLowerCase()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        }
      }
    }
    
    // Method 3: Extract from image alt text
    if (document) {
      const workItemImage = document.querySelector('img[alt*="User Story"], img[alt*="Bug"], img[alt*="Task"], img[alt*="Feature"], img[alt*="Epic"]');
      if (workItemImage) {
        const altText = workItemImage.getAttribute('alt');
        if (altText) {
          return altText;
        }
      }
    }
    
    // Method 4: Detect based on title patterns (last resort)
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('as a ') && lowerTitle.includes('i want')) {
      return 'User Story';
    }
    
    return 'Unknown';
  }

  static validateExtractedContent(content, document) {
    const issues = [];
    
    if (!content.title || content.title.length < 5) {
      issues.push('Title is missing or too short');
    }
    
    if (!content.description || content.description.length < 10) {
      issues.push('Description is missing or too short');
    }
    
    // Check for user story format if it's a user story
    const workItemType = this.detectWorkItemType(content.title, document);
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
  }

  static enhanceContentExtraction(baseContent, document) {
    const enhanced = { ...baseContent };
    
    try {
      // Try to extract additional fields with error handling
      enhanced.workItemId = this.safeExtract(() => this.extractWorkItemId(document));
      enhanced.state = this.safeExtract(() => this.extractWorkItemState(document));
      enhanced.assignedTo = this.safeExtract(() => this.extractAssignedTo(document));
      enhanced.tags = this.safeExtract(() => this.extractTags(document), []);
      enhanced.priority = this.safeExtract(() => this.extractPriority(document));
      enhanced.storyPoints = this.safeExtract(() => this.extractStoryPoints(document));
      enhanced.areaPath = this.safeExtract(() => this.extractAreaPath(document));
      enhanced.iterationPath = this.safeExtract(() => this.extractIterationPath(document));
      enhanced.implementationDetails = this.safeExtract(() => this.extractImplementationDetails(document));
      enhanced.workItemType = this.safeExtract(() => this.detectWorkItemType(baseContent.title, document), 'Unknown');
      enhanced.createdDate = this.safeExtract(() => this.extractCreatedDate(document));
      enhanced.modifiedDate = this.safeExtract(() => this.extractModifiedDate(document));
      enhanced.originalEstimate = this.safeExtract(() => this.extractOriginalEstimate(document));
      enhanced.remainingWork = this.safeExtract(() => this.extractRemainingWork(document));
      enhanced.completedWork = this.safeExtract(() => this.extractCompletedWork(document));
      enhanced.activity = this.safeExtract(() => this.extractLatestActivity(document));
      enhanced.risk = this.safeExtract(() => this.extractRisk(document));
      enhanced.valueArea = this.safeExtract(() => this.extractValueArea(document));
      
      // Validate and clean up extracted data
      enhanced.extractionStatus = this.validateExtractionResults(enhanced);
      
    } catch (error) {
      console.warn('Error during content extraction enhancement:', error);
      enhanced.extractionStatus = {
        hasErrors: true,
        errors: [error.message],
        extractedFields: Object.keys(enhanced).filter(key => enhanced[key] !== null && enhanced[key] !== undefined)
      };
    }
    
    return enhanced;
  }

  static safeExtract(extractionFunction, defaultValue = null) {
    try {
      const result = extractionFunction();
      return result !== null && result !== undefined ? result : defaultValue;
    } catch (error) {
      console.warn('Safe extraction failed:', error);
      return defaultValue;
    }
  }

  static validateExtractionResults(content) {
    const status = {
      hasErrors: false,
      errors: [],
      warnings: [],
      extractedFields: [],
      missingFields: []
    };

    const expectedFields = [
      'workItemId', 'state', 'assignedTo', 'priority', 'workItemType',
      'areaPath', 'iterationPath', 'implementationDetails'
    ];

    // Check which fields were successfully extracted
    for (const field of expectedFields) {
      if (content[field] !== null && content[field] !== undefined && content[field] !== '') {
        status.extractedFields.push(field);
      } else {
        status.missingFields.push(field);
      }
    }

    // Add warnings for missing critical fields
    if (!content.workItemId) {
      status.warnings.push('Work Item ID could not be extracted - this may indicate page structure changes');
    }

    if (!content.state) {
      status.warnings.push('Work item state not found');
    }

    return status;
  }

  static extractWorkItemId(document) {
    const idSelectors = [
      '.work-item-form-id',
      '[data-testid="work-item-id"]',
      '.workitem-id'
    ];
    
    for (const selector of idSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const match = element.textContent.match(/\d+/);
        if (match) return match[0];
      }
    }
    
    // Extract from URL as fallback
    const urlMatch = window.location.href.match(/workitems\/edit\/(\d+)/);
    return urlMatch ? urlMatch[1] : null;
  }

  static extractWorkItemState(document) {
    const stateSelectors = [
      'input[id*="Stat"]',
      '[aria-label="Assigned To"] ~ * input[value*="Will not implement"]',
      'input[value*="Active"], input[value*="New"], input[value*="Resolved"], input[value*="Closed"], input[value*="Will not implement"]'
    ];
    
    for (const selector of stateSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    // Try finding by ID pattern that matches Azure DevOps state inputs
    const stateInputs = document.querySelectorAll('input[id*="State"], input[id*="Stat"]');
    for (const input of stateInputs) {
      if (input.value && input.value.trim()) {
        return input.value.trim();
      }
    }
    
    return null;
  }

  static extractAssignedTo(document) {
    const assigneeSelectors = [
      'input[aria-label="Assigned To"]',
      'input[id*="identity-picker"]',
      '.work-item-form-assignedto input',
      '.workitem-assignedto input'
    ];
    
    for (const selector of assigneeSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractTags(document) {
    const tagSelectors = [
      '[aria-label*="Tags"] input',
      '.work-item-form-tags input',
      '.workitem-tags input'
    ];
    
    for (const selector of tagSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.split(';').map(tag => tag.trim()).filter(tag => tag);
      }
    }
    
    return [];
  }

  static extractPriority(document) {
    const prioritySelectors = [
      'input[id*="Priority"]',
      'input[aria-label*="Priority"]',
      '.work-item-form-priority input',
      '.workitem-priority input',
      '[data-testid="priority"] input'
    ];
    
    for (const selector of prioritySelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractStoryPoints(document) {
    const storyPointsSelectors = [
      'input[id*="Story-Points"]',
      'input[aria-label*="Story Points"]',
      'input[aria-label*="Effort"]',
      '.work-item-form-storypoints input',
      '.workitem-storypoints input',
      '[data-testid="story-points"] input',
      '[data-testid="effort"] input'
    ];
    
    for (const selector of storyPointsSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        const points = parseFloat(element.value);
        return isNaN(points) ? null : points;
      }
    }
    
    return null;
  }

  static extractAreaPath(document) {
    const areaPathSelectors = [
      'input[id*="Area"]',
      'input[aria-label*="Area Path"]',
      'input[aria-label*="Area"]',
      '.work-item-form-area input',
      '.workitem-area input'
    ];
    
    for (const selector of areaPathSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractIterationPath(document) {
    const iterationSelectors = [
      'input[id*="ration"]',
      'input[id*="Iteration"]',
      'input[aria-label*="Iteration Path"]',
      'input[aria-label*="Iteration"]',
      'input[aria-label*="Sprint"]',
      '.work-item-form-iteration input',
      '.workitem-iteration input'
    ];
    
    for (const selector of iterationSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractImplementationDetails(document) {
    const implementationSelectors = [
      '.rooster-editor[aria-label="Implementation Details"]',
      '[aria-label="Implementation Details"].rooster-editor',
      '.rooster-editor[aria-label*="Implementation"]',
      '[aria-label*="Implementation"].rooster-editor',
      '[data-testid="work-item-form-implementation"]',
      '.work-item-form-implementation',
      '.workitem-implementation',
      '[aria-label*="Implementation Details"]',
      '[aria-label*="Technical Details"]',
      '[aria-label*="Development Notes"]'
    ];

    for (const selector of implementationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = this.extractRichTextContent(element);
        // Filter out placeholder text
        if (content && 
            !content.includes('Click to add') && 
            content !== '<div><br> </div>' &&
            content.trim().length > 0) {
          return content;
        }
      }
    }
    
    return null;
  }

  static extractCreatedDate(document) {
    const dateSelectors = [
      '[aria-label*="Created Date"] input',
      '[aria-label*="Created"] input',
      '.work-item-form-created input',
      '.workitem-created input'
    ];
    
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractModifiedDate(document) {
    const dateSelectors = [
      '[aria-label*="Changed Date"] input',
      '[aria-label*="Modified Date"] input',
      '[aria-label*="Updated"] input',
      '.work-item-form-changed input',
      '.workitem-changed input'
    ];
    
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractOriginalEstimate(document) {
    const estimateSelectors = [
      '[aria-label*="Original Estimate"] input',
      '[aria-label*="Estimated"] input',
      '.work-item-form-original-estimate input',
      '.workitem-original-estimate input'
    ];
    
    for (const selector of estimateSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        const estimate = parseFloat(element.value);
        return isNaN(estimate) ? null : estimate;
      }
    }
    
    return null;
  }

  static extractRemainingWork(document) {
    const remainingSelectors = [
      '[aria-label*="Remaining Work"] input',
      '[aria-label*="Remaining"] input',
      '.work-item-form-remaining input',
      '.workitem-remaining input'
    ];
    
    for (const selector of remainingSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        const remaining = parseFloat(element.value);
        return isNaN(remaining) ? null : remaining;
      }
    }
    
    return null;
  }

  static extractCompletedWork(document) {
    const completedSelectors = [
      '[aria-label*="Completed Work"] input',
      '[aria-label*="Completed"] input',
      '.work-item-form-completed input',
      '.workitem-completed input'
    ];
    
    for (const selector of completedSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        const completed = parseFloat(element.value);
        return isNaN(completed) ? null : completed;
      }
    }
    
    return null;
  }

  static extractLatestActivity(document) {
    // Try to extract the most recent activity/comment from the discussion
    const activitySelectors = [
      '.work-item-form-discussion .discussion-thread .discussion-comment:last-child',
      '.work-item-discussion .discussion-item:last-child',
      '.discussion-thread .comment:last-child'
    ];
    
    for (const selector of activitySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = this.sanitizeContent(element.textContent || element.innerHTML);
        if (content && content.length > 0 && content.length < 500) {
          return content;
        }
      }
    }
    
    return null;
  }

  static extractRisk(document) {
    const riskSelectors = [
      'input[id*="Risk"]',
      'input[aria-label*="Risk"]',
      '.work-item-form-risk input',
      '.workitem-risk input'
    ];
    
    for (const selector of riskSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractValueArea(document) {
    const valueAreaSelectors = [
      'input[id*="Value-area"]',
      'input[aria-label*="Value area"]',
      'input[aria-label*="Value Area"]',
      '.work-item-form-valuearea input',
      '.workitem-valuearea input'
    ];
    
    for (const selector of valueAreaSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static formatContentForTemplate(content) {
    if (!content) return '';
    
    const formattedContent = [];
    
    // Basic information
    if (content.workItemId) {
      formattedContent.push(`Work Item ID: ${content.workItemId}`);
    }
    
    if (content.workItemType) {
      formattedContent.push(`Type: ${content.workItemType}`);
    }
    
    if (content.title) {
      formattedContent.push(`Title: ${content.title}`);
    }
    
    if (content.state) {
      formattedContent.push(`State: ${content.state}`);
    }
    
    if (content.assignedTo) {
      formattedContent.push(`Assigned To: ${content.assignedTo}`);
    }
    
    if (content.priority) {
      formattedContent.push(`Priority: ${content.priority}`);
    }
    
    if (content.storyPoints) {
      formattedContent.push(`Story Points: ${content.storyPoints}`);
    }
    
    if (content.risk) {
      formattedContent.push(`Risk: ${content.risk}`);
    }
    
    if (content.valueArea) {
      formattedContent.push(`Value Area: ${content.valueArea}`);
    }
    
    // Area and iteration
    if (content.areaPath) {
      formattedContent.push(`Area Path: ${content.areaPath}`);
    }
    
    if (content.iterationPath) {
      formattedContent.push(`Iteration: ${content.iterationPath}`);
    }
    
    // Time tracking
    if (content.originalEstimate) {
      formattedContent.push(`Original Estimate: ${content.originalEstimate}h`);
    }
    
    if (content.remainingWork) {
      formattedContent.push(`Remaining Work: ${content.remainingWork}h`);
    }
    
    if (content.completedWork) {
      formattedContent.push(`Completed Work: ${content.completedWork}h`);
    }
    
    // Content sections
    if (content.description) {
      formattedContent.push('', 'Description:', content.description);
    }
    
    if (content.acceptanceCriteria) {
      formattedContent.push('', 'Acceptance Criteria:', content.acceptanceCriteria);
    }
    
    if (content.implementationDetails) {
      formattedContent.push('', 'Implementation Details:', content.implementationDetails);
    }
    
    if (content.activity) {
      formattedContent.push('', 'Latest Activity:', content.activity);
    }
    
    // Tags and dates
    if (content.tags && content.tags.length > 0) {
      formattedContent.push('', `Tags: ${content.tags.join(', ')}`);
    }
    
    if (content.createdDate) {
      formattedContent.push('', `Created: ${content.createdDate}`);
    }
    
    if (content.modifiedDate) {
      formattedContent.push(`Modified: ${content.modifiedDate}`);
    }
    
    return formattedContent.join('\n').trim();
  }
}