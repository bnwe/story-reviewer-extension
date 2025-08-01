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

  static detectWorkItemType(url, title) {
    const lowerTitle = (title || '').toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    // Detect based on URL parameters
    if (lowerUrl.includes('witd=user%20story') || lowerUrl.includes('witd=user+story')) {
      return 'User Story';
    }
    
    if (lowerUrl.includes('witd=bug')) {
      return 'Bug';
    }
    
    if (lowerUrl.includes('witd=task')) {
      return 'Task';
    }
    
    // Detect based on title patterns
    if (lowerTitle.includes('as a ') && lowerTitle.includes('i want')) {
      return 'User Story';
    }
    
    return 'Unknown';
  }

  static validateExtractedContent(content) {
    const issues = [];
    
    if (!content.title || content.title.length < 5) {
      issues.push('Title is missing or too short');
    }
    
    if (!content.description || content.description.length < 10) {
      issues.push('Description is missing or too short');
    }
    
    // Check for user story format if it's a user story
    const workItemType = this.detectWorkItemType(content.url, content.title);
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
    
    // Try to extract additional fields
    enhanced.workItemId = this.extractWorkItemId(document);
    enhanced.state = this.extractWorkItemState(document);
    enhanced.assignedTo = this.extractAssignedTo(document);
    enhanced.tags = this.extractTags(document);
    
    return enhanced;
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
      '[aria-label*="State"] input',
      '.work-item-form-state input',
      '.workitem-state-dropdown input'
    ];
    
    for (const selector of stateSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value.trim();
      }
    }
    
    return null;
  }

  static extractAssignedTo(document) {
    const assigneeSelectors = [
      '[aria-label*="Assigned To"] input',
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
}