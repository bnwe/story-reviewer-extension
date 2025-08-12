class FeedbackManager {
    constructor() {
        this.currentContent = null;
        this.currentSettings = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkApiConfiguration();
        this.loadFeedback();
    }
    
    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', this.refreshFeedback.bind(this));
        document.getElementById('settingsBtn').addEventListener('click', this.openSettings.bind(this));
        document.getElementById('retryBtn').addEventListener('click', this.retryFeedback.bind(this));
        document.getElementById('checkSettingsBtn').addEventListener('click', this.openSettings.bind(this));
        document.getElementById('openSettingsBtn').addEventListener('click', this.openSettings.bind(this));
        document.getElementById('copyAllBtn').addEventListener('click', this.copyAllFeedback.bind(this));
        document.getElementById('toggleDebugBtn').addEventListener('click', this.toggleDebugInfo.bind(this));
        document.getElementById('togglePromptBtn').addEventListener('click', this.togglePromptContent.bind(this));
        document.getElementById('toggleResponseBtn').addEventListener('click', this.toggleResponseContent.bind(this));
        document.getElementById('promptSectionHeader').addEventListener('click', this.togglePromptContent.bind(this));
        document.getElementById('responseSectionHeader').addEventListener('click', this.toggleResponseContent.bind(this));
        document.getElementById('toggleOriginalStoryBtn').addEventListener('click', this.toggleOriginalStoryContent.bind(this));
        document.getElementById('originalStorySectionHeader').addEventListener('click', this.toggleOriginalStoryContent.bind(this));
        document.getElementById('showErrorDetailsBtn').addEventListener('click', this.toggleErrorDetails.bind(this));
    }
    
    async checkApiConfiguration() {
        try {
            const settings = await this.getSettings();
            this.currentSettings = settings;
            
            const providerInfo = document.getElementById('providerInfo');
            if (settings.apiKey && settings.apiProvider) {
                const providerName = this.getProviderDisplayName(settings.apiProvider);
                const modelInfo = settings.model ? ` (${settings.model})` : '';
                providerInfo.textContent = `Provider: ${providerName}${modelInfo}`;
                return true;
            } else {
                providerInfo.textContent = 'Provider: Not configured';
                this.showNoApiKeyState();
                return false;
            }
        } catch (error) {
            console.error('Failed to check API configuration:', error);
            this.showError('Failed to load settings');
            return false;
        }
    }
    
    async loadFeedback() {
        try {
            // Get extracted content from storage
            const result = await this.getExtractedContent();
            
            if (!result.extractedContent) {
                this.showError('No story content found. Please extract a story first from Azure DevOps.');
                return;
            }
            
            this.currentContent = result.extractedContent;
            
            // Update timestamp
            const timestamp = result.extractionTimestamp ? 
                new Date(result.extractionTimestamp).toLocaleString() : 'Unknown';
            document.getElementById('timestampInfo').textContent = `Last updated: ${timestamp}`;
            
            // Check if we have API configuration
            const hasApiKey = await this.checkApiConfiguration();
            if (!hasApiKey) {
                return;
            }
            
            // Show loading state and wait for background script to be ready
            this.showLoadingState();
            await this.waitForBackgroundScriptReady();
            await this.generateFeedback();
            
        } catch (error) {
            console.error('Failed to load feedback:', error);
            
            // Create detailed error information for load failures
            const errorDetails = {
                originalError: error.message,
                isNetworkError: false,
                timestamp: new Date().toISOString(),
                requestData: {
                    provider: 'Unknown (failed to load)',
                    model: 'Unknown (failed to load)',
                    hasApiKey: false,
                    loadingPhase: 'Initial load'
                },
                troubleshooting: this.getTroubleshootingStepsForGeneralError(error)
            };
            
            this.showError('Failed to load story content', null, errorDetails);
        }
    }
    
    async generateFeedback() {
        try {
            if (!this.currentContent || !this.currentSettings) {
                throw new Error('Missing content or settings');
            }
            
            const response = await this.sendToLLM(this.currentContent, this.currentSettings);
            
            if (response.success) {
                this.showFeedback(this.currentContent, response.feedback, response.promptInfo, response.rawResponse, response.tokenUsage);
            } else {
                this.showError(response.error || 'Failed to generate feedback', response.promptInfo, response.errorDetails);
            }
            
        } catch (error) {
            console.error('Failed to generate feedback:', error);
            
            // Create detailed error information for race condition and other errors
            const errorDetails = {
                originalError: error.message,
                isNetworkError: false,
                timestamp: new Date().toISOString(),
                requestData: {
                    provider: this.currentSettings?.apiProvider || 'Unknown',
                    model: this.currentSettings?.model || 'Unknown',
                    hasApiKey: !!this.currentSettings?.apiKey,
                    hasContent: !!this.currentContent,
                    hasSettings: !!this.currentSettings
                },
                troubleshooting: this.getTroubleshootingStepsForGeneralError(error)
            };
            
            this.showError(error.message, null, errorDetails);
        }
    }
    
    async refreshFeedback() {
        const hasApiKey = await this.checkApiConfiguration();
        if (!hasApiKey) {
            return;
        }
        
        this.showLoadingState();
        await this.generateFeedback();
    }
    
    async retryFeedback() {
        await this.refreshFeedback();
    }
    
    openSettings() {
        chrome.runtime.openOptionsPage();
    }
    
    async copyAllFeedback() {
        try {
            const feedbackContent = document.getElementById('feedbackContent');
            const text = feedbackContent.textContent || feedbackContent.innerText;
            
            await navigator.clipboard.writeText(text);
            this.showCopyNotification();
            
        } catch (error) {
            console.error('Failed to copy feedback:', error);
            // Fallback for older browsers
            const feedbackContent = document.getElementById('feedbackContent');
            this.fallbackCopyTextToClipboard(feedbackContent.textContent);
        }
    }
    
    
    // State management methods
    showLoadingState() {
        this.hideAllStates();
        document.getElementById('loadingState').style.display = 'flex';
    }
    
    showError(_, promptInfo = null, errorDetails = null) {
        this.hideAllStates();
        // Note: message parameter is no longer displayed in the UI, error details contain the information
        document.getElementById('errorState').style.display = 'flex';
        
        // Store error information for detailed display
        this.currentPromptInfo = promptInfo;
        this.currentErrorDetails = errorDetails;
        
        // Show error details if available
        this.updateErrorDetails();
    }
    
    showNoApiKeyState() {
        this.hideAllStates();
        document.getElementById('noApiKeyState').style.display = 'flex';
    }
    
    showFeedback(originalContent, feedback, promptInfo = null, rawResponse = null, tokenUsage = null) {
        this.hideAllStates();
        
        // Store prompt info, raw response, and token usage for debug display
        this.currentPromptInfo = promptInfo;
        this.currentRawResponse = rawResponse;
        this.currentTokenUsage = tokenUsage;
        
        // Display original content
        const originalDiv = document.getElementById('originalContent');
        originalDiv.innerHTML = this.formatContent(originalContent);
        
        // Display feedback
        const feedbackDiv = document.getElementById('feedbackContent');
        feedbackDiv.innerHTML = this.formatFeedback(feedback);
        
        // Attach copy event listeners to copyable snippets
        this.attachCopyListeners();
        
        // Populate debug sections
        this.populateDebugSections();
        
        document.getElementById('successState').style.display = 'block';
    }
    
    hideAllStates() {
        const states = ['loadingState', 'errorState', 'noApiKeyState', 'successState'];
        states.forEach(stateId => {
            document.getElementById(stateId).style.display = 'none';
        });
    }
    
    // Utility methods
    formatContent(content) {
        if (typeof content === 'object') {
            let formatted = '';
            if (content.title) formatted += `<h3>Title:</h3><p>${this.escapeHtml(content.title)}</p>`;
            if (content.description) formatted += `<h3>Description:</h3><div>${content.description}</div>`;
            if (content.acceptanceCriteria) formatted += `<h3>Acceptance Criteria:</h3><div>${content.acceptanceCriteria}</div>`;
            return formatted;
        }
        return this.escapeHtml(content.toString());
    }
    
    formatFeedback(feedback) {
        // First, strip markdown code blocks if present
        feedback = this.stripMarkdownCodeBlocks(feedback);
        
        // Then, process copyable tags before other formatting
        feedback = this.processCopyableTags(feedback);
        
        // Check if feedback contains HTML tags
        if (this.isHtmlContent(feedback)) {
            // Sanitize HTML for security and clean excessive whitespace
            return this.cleanWhitespace(this.sanitizeHtml(feedback));
        } else {
            // Fallback to simple formatting for plain text
            return feedback
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^\* /gm, '• ')
                .replace(/^(\d+)\. /gm, '$1. ');
        }
    }
    
    stripMarkdownCodeBlocks(content) {
        // Strip markdown code blocks (```language or ``` with optional language)
        // This handles cases where LLMs wrap their HTML response in markdown code blocks
        const codeBlockRegex = /^```(?:html|xml|markup)?\s*\n?([\s\S]*?)\n?```$/gm;
        
        // If the entire content is wrapped in a single code block, unwrap it
        const singleBlockMatch = content.match(/^```(?:html|xml|markup)?\s*\n?([\s\S]*?)\n?```$/s);
        if (singleBlockMatch) {
            return singleBlockMatch[1].trim();
        }
        
        // Otherwise, replace individual code blocks
        return content.replace(codeBlockRegex, (_, codeContent) => {
            return codeContent.trim();
        });
    }
    
    processCopyableTags(content) {
        // Replace <copyable>...</copyable> tags with styled HTML elements
        const copyableRegex = /<copyable>([\s\S]*?)<\/copyable>/gi;
        let copyableIndex = 0;
        
        return content.replace(copyableRegex, (_, innerContent) => {
            const id = `copyable-${copyableIndex++}`;
            const cleanedHtmlContent = this.processNestedCopyableContent(innerContent.trim());
            const escapedHtmlContent = this.escapeHtml(cleanedHtmlContent).replace(/"/g, '&quot;');
            return `<span class="copyable-snippet" data-copyable-id="${id}" data-copy-html="${escapedHtmlContent}" title="Click to copy">${cleanedHtmlContent}</span>`;
        });
    }
    
    processNestedCopyableContent(htmlContent) {
        // Handle nested HTML content within copyable tags more robustly
        
        // If the content is just plain text, return it as is
        if (!this.isHtmlContent(htmlContent)) {
            return htmlContent;
        }
        
        // Create a temporary container to work with the HTML
        const tempDiv = document.createElement('div');
        
        try {
            tempDiv.innerHTML = htmlContent;
        } catch (error) {
            // If HTML parsing fails, treat as plain text
            return htmlContent;
        }
        
        // Fix common nested structure issues before processing
        this.fixNestedStructureIssues(tempDiv);
        
        // Apply the full cleanHtmlForAzureDevOps process which includes sanitization
        // We need to get the innerHTML, clean it through the full process, then put it back
        const innerHtml = tempDiv.innerHTML;
        const fullyCleanedHtml = this.cleanHtmlForAzureDevOps(innerHtml);
        tempDiv.innerHTML = fullyCleanedHtml;
        
        // Remove excessive whitespace while preserving structure
        this.removeExcessiveWhitespace(tempDiv);
        
        // Get the cleaned HTML
        const cleanedContent = tempDiv.innerHTML;
        
        // If the result is empty or just whitespace, return the original content
        if (!cleanedContent.trim()) {
            return htmlContent;
        }
        
        return cleanedContent;
    }
    
    fixNestedStructureIssues(element) {
        // Fix common nested structure issues that occur in LLM responses
        
        // Remove empty paragraphs that might wrap other block elements
        const emptyParagraphs = element.querySelectorAll('p');
        emptyParagraphs.forEach(p => {
            // If paragraph only contains block elements or is empty, unwrap it
            const hasOnlyBlockElements = Array.from(p.childNodes).every(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return !node.textContent.trim(); // Only whitespace text nodes
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const blockTags = ['div', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'];
                    return blockTags.includes(node.tagName.toLowerCase());
                }
                return false;
            });
            
            if (hasOnlyBlockElements) {
                // Unwrap the paragraph, keeping its content
                p.replaceWith(...p.childNodes);
            }
        });
        
        // Fix nested list issues - ensure li elements are properly structured
        const listItems = element.querySelectorAll('li');
        listItems.forEach(li => {
            // If li contains block elements at the root level, ensure proper structure
            const directBlockChildren = Array.from(li.childNodes).filter(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const blockTags = ['div', 'p', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
                    return blockTags.includes(node.tagName.toLowerCase());
                }
                return false;
            });
            
            // If we have mixed content (text + block elements), wrap text in spans
            if (directBlockChildren.length > 0) {
                Array.from(li.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        const span = document.createElement('span');
                        span.textContent = node.textContent;
                        node.replaceWith(span);
                    }
                });
            }
        });
        
        // Remove duplicate or unnecessary wrapper elements
        this.removeDuplicateWrappers(element);
    }
    
    removeDuplicateWrappers(element) {
        // Remove unnecessary nested elements of the same type
        const duplicatePatterns = [
            'div > div:only-child',
            'span > span:only-child',
            'p > p:only-child'
        ];
        
        duplicatePatterns.forEach(pattern => {
            const matches = element.querySelectorAll(pattern);
            matches.forEach(match => {
                // Move children to parent and remove the duplicate wrapper
                match.replaceWith(...match.childNodes);
            });
        });
        
        // Remove empty elements that serve no purpose
        const emptyElements = element.querySelectorAll('p:empty, div:empty, span:empty');
        emptyElements.forEach(el => el.remove());
    }
    
    cleanHtmlForAzureDevOps(htmlContent) {
        // Clean and optimize HTML content for Azure DevOps rich text fields
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Remove any unsupported tags and attributes
        this.sanitizeForAzureDevOps(tempDiv);
        
        // Return cleaned HTML
        return tempDiv.innerHTML;
    }
    
    sanitizeForAzureDevOps(element) {
        // Azure DevOps rich text fields support these HTML tags
        const azureDevOpsSupportedTags = [
            'p', 'br', 'div', 'span',
            'strong', 'b', 'em', 'i', 'u',
            'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote'
        ];
        
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();
            
            // Remove unsupported tags but keep content
            if (!azureDevOpsSupportedTags.includes(tagName)) {
                el.replaceWith(...el.childNodes);
                return;
            }
            
            // Remove all attributes except basic ones
            const allowedAttributes = ['class'];
            Array.from(el.attributes).forEach(attr => {
                if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                    el.removeAttribute(attr.name);
                }
            });
        });
    }
    
    isHtmlContent(text) {
        // Check if text contains HTML tags
        const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
        return htmlTagRegex.test(text);
    }
    
    cleanWhitespace(html) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove excessive whitespace between block elements, but preserve list structure
        this.removeExcessiveWhitespace(tempDiv);
        
        return tempDiv.innerHTML;
    }
    
    removeExcessiveWhitespace(element) {
        // Process all child nodes
        const childNodes = Array.from(element.childNodes);
        
        childNodes.forEach((node, index) => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Check if this is a whitespace-only text node
                if (/^\s*$/.test(node.textContent)) {
                    const prevSibling = childNodes[index - 1];
                    const nextSibling = childNodes[index + 1];
                    
                    // Block elements where we want to remove excess whitespace
                    const blockElements = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'BLOCKQUOTE'];
                    
                    // Only remove whitespace between block elements, but NOT around list elements
                    // This preserves the structure of lists while cleaning up spacing between major sections
                    if ((prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE && blockElements.includes(prevSibling.tagName)) &&
                        (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && blockElements.includes(nextSibling.tagName))) {
                        node.remove();
                    }
                } else {
                    // Normalize excessive whitespace within text nodes (multiple spaces/tabs to single space)
                    node.textContent = node.textContent.replace(/\s+/g, ' ');
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Recursively process child elements
                this.removeExcessiveWhitespace(node);
            }
        });
    }

    sanitizeHtml(html) {
        // First, fix any unclosed or malformed tags, but only if we don't already have processed copyable snippets
        // If we have copyable snippets, they're already well-formed and shouldn't be modified
        const hasCopyableSnippets = html.includes('class="copyable-snippet"');
        if (!hasCopyableSnippets) {
            html = this.fixMalformedTags(html);
        }
        
        // List of allowed HTML tags for security
        const allowedTags = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'br', 'div', 'span',
            'strong', 'b', 'em', 'i', 'u',
            'ul', 'ol', 'li',
            'blockquote', 'code', 'pre',
            'table', 'tr', 'td', 'th', 'thead', 'tbody'
        ];
        
        const allowedAttributes = [
            'class', 'data-copyable-id', 'data-copy-html', 'title'
        ];
        
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove script and style tags for security
        const scriptTags = tempDiv.querySelectorAll('script, style');
        scriptTags.forEach(tag => tag.remove());
        
        // Remove event handlers and javascript: links
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(element => {
            // Remove unsafe event attributes and non-allowed attributes
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || 
                    attr.value.includes('javascript:') ||
                    !allowedAttributes.includes(attr.name)) {
                    element.removeAttribute(attr.name);
                }
            });
            
            // Remove non-allowed tags but keep content
            if (!allowedTags.includes(element.tagName.toLowerCase())) {
                element.replaceWith(...element.childNodes);
            }
        });
        
        return tempDiv.innerHTML;
    }

    fixMalformedTags(html) {
        // Handle unclosed tags that are immediately followed by other opening tags
        // Example: <p><copyable> becomes just <copyable>
        
        // List of self-closing tags that don't need closing tags
        const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
        
        // List of tags that commonly appear unclosed in LLM responses
        const tagsToFix = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'];
        
        // Remove problematic unclosed opening tags that are immediately followed by other opening tags
        tagsToFix.forEach(tag => {
            // Pattern: <tag><another_tag> where the first tag is never closed
            // This removes the unclosed opening tag
            const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*(?=<(?:${tagsToFix.join('|')}|copyable)(?:\\s|>))`, 'gi');
            html = html.replace(regex, '');
        });
        
        // Handle specific case where unclosed tags appear at the end of content
        // Remove opening tags that don't have corresponding closing tags and appear at problematic positions
        tagsToFix.forEach(tag => {
            // Pattern: <tag> at the end of content or before closing tags of other elements
            const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*$`, 'gi');
            html = html.replace(regex, '');
        });
        
        // Remove any standalone opening tags that appear without content or closing tags
        const standaloneOpenTagRegex = /<([a-zA-Z]+)(?:\s[^>]*)?>\s*(?=<\/|\s*$|<(?:[a-zA-Z]+))/g;
        html = html.replace(standaloneOpenTagRegex, (match, tagName) => {
            // Only remove if it's not a self-closing tag and not followed by content
            if (selfClosingTags.includes(tagName.toLowerCase())) {
                return match; // Keep self-closing tags
            }
            
            // Check if there's a corresponding closing tag later
            const closingTagRegex = new RegExp(`</${tagName}>`, 'i');
            const remainingHtml = html.substring(html.indexOf(match) + match.length);
            
            if (!closingTagRegex.test(remainingHtml)) {
                // No closing tag found, remove the opening tag
                return '';
            }
            
            return match; // Keep if there's a closing tag
        });
        
        return html;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getProviderDisplayName(provider) {
        const names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic (Claude)',
            'custom': 'Custom API'
        };
        return names[provider] || provider;
    }
    
    showCopyNotification(message = 'Copied to clipboard!') {
        const notification = document.getElementById('copyNotification');
        notification.querySelector('span:last-child').textContent = message;
        notification.style.display = 'flex';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyNotification();
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }
    
    // Background script readiness check
    async waitForBackgroundScriptReady(maxAttempts = 5, initialDelay = 200) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Test if background script is ready by sending a lightweight message
                const isReady = await this.testBackgroundScriptReady();
                if (isReady) {
                    console.log(`Background script ready after ${attempt} attempt(s)`);
                    return true;
                }
            } catch (error) {
                console.warn(`Background script readiness check attempt ${attempt} failed:`, error.message);
            }
            
            // Wait before next attempt, but don't wait after the last attempt
            // Use exponential backoff: start with short delays, increase over time
            if (attempt < maxAttempts) {
                const delay = initialDelay * Math.pow(2, attempt - 1); // 200ms, 400ms, 800ms, 1600ms
                console.log(`Waiting ${delay}ms before next readiness check...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.warn(`Background script not ready after ${maxAttempts} attempts, proceeding anyway`);
        return false;
    }
    
    async testBackgroundScriptReady() {
        return new Promise((resolve, reject) => {
            // Test background script readiness by attempting a lightweight operation
            // that exercises the same code path as the actual LLM request
            chrome.runtime.sendMessage({
                action: 'testReadiness',
                settings: this.currentSettings || {}
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success && response.ready) {
                    resolve(true);
                } else {
                    reject(new Error('Background script not ready yet'));
                }
            });
        });
    }
    
    // API methods
    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get({
                apiProvider: 'openai',
                apiKey: '',
                model: '',
                customEndpoint: '',
                temperature: 0.7,
                maxTokens: 10000
            }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    }
    
    async getExtractedContent() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['extractedContent', 'extractionTimestamp'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    }
    
    async sendToLLM(content, settings) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'sendToLLM',
                content: content,
                settings: settings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const runtimeError = chrome.runtime.lastError.message;
                    resolve({
                        success: false,
                        error: runtimeError,
                        errorDetails: {
                            originalError: runtimeError,
                            isNetworkError: false,
                            timestamp: new Date().toISOString(),
                            requestData: {
                                provider: settings.apiProvider || 'Unknown',
                                model: settings.model || 'Unknown',
                                hasApiKey: !!settings.apiKey,
                                hasContent: !!content,
                                errorType: 'Chrome Runtime Error'
                            },
                            troubleshooting: [
                                'Extension context may have been invalidated',
                                'Try refreshing the feedback window',
                                'Close and reopen the feedback window',
                                'If persistent, reload the browser extension',
                                'Check if the extension is still enabled in browser settings'
                            ]
                        }
                    });
                } else if (!response) {
                    resolve({
                        success: false,
                        error: 'No response received from background script',
                        errorDetails: {
                            originalError: 'No response received from background script',
                            isNetworkError: false,
                            timestamp: new Date().toISOString(),
                            requestData: {
                                provider: settings.apiProvider || 'Unknown',
                                model: settings.model || 'Unknown',
                                hasApiKey: !!settings.apiKey,
                                hasContent: !!content,
                                errorType: 'Background Script Communication Error'
                            },
                            troubleshooting: [
                                'Background script may not be responding (possible race condition)',
                                'Try waiting a few seconds and clicking "Retry" again',
                                'This often happens when the extension is loading - try again',
                                'If persistent, close and reopen the feedback window',
                                'Check browser console for additional error messages'
                            ]
                        }
                    });
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    // Debug functionality methods
    toggleDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        const toggleBtn = document.getElementById('toggleDebugBtn');
        
        if (debugInfo.style.display === 'none' || !debugInfo.style.display) {
            debugInfo.style.display = 'block';
            toggleBtn.classList.add('active');
            this.updateDebugInfo();
        } else {
            debugInfo.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    }
    
    updateDebugInfo() {
        const promptInfo = this.currentPromptInfo;
        const tokenUsage = this.currentTokenUsage;
        
        if (!promptInfo) {
            document.getElementById('debugProvider').textContent = 'Unknown';
            document.getElementById('debugModel').textContent = 'Unknown';
            document.getElementById('debugTemperature').textContent = 'Unknown';
            document.getElementById('debugTimestamp').textContent = 'Unknown';
            document.getElementById('debugInputTokens').textContent = 'No data';
            document.getElementById('debugOutputTokens').textContent = 'No data';
            document.getElementById('debugTotalTokens').textContent = 'No data';
            return;
        }
        
        // Update provider
        const providerNames = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'mistral': 'Mistral AI',
            'custom': 'Custom API'
        };
        document.getElementById('debugProvider').textContent = 
            providerNames[promptInfo.provider] || promptInfo.provider;
        
        // Update model
        document.getElementById('debugModel').textContent = 
            promptInfo.model || 'Unknown model';
        
        // Update temperature
        document.getElementById('debugTemperature').textContent = 
            typeof promptInfo.temperature === 'number' ? promptInfo.temperature.toString() : 'Unknown';
        
        // Update timestamp
        const timestamp = new Date(promptInfo.timestamp);
        document.getElementById('debugTimestamp').textContent = 
            timestamp.toLocaleString();
        
        // Update token usage information
        this.updateTokenUsageInfo(tokenUsage);
    }
    
    updateTokenUsageInfo(tokenUsage) {
        const inputTokensElement = document.getElementById('debugInputTokens');
        const outputTokensElement = document.getElementById('debugOutputTokens');
        const totalTokensElement = document.getElementById('debugTotalTokens');
        
        if (!tokenUsage || !tokenUsage.hasUsage) {
            inputTokensElement.textContent = 'Not available';
            outputTokensElement.textContent = 'Not available';
            totalTokensElement.textContent = 'Not available';
            
            // Add a subtle indicator that token usage is not available
            inputTokensElement.classList.add('token-unavailable');
            outputTokensElement.classList.add('token-unavailable');
            totalTokensElement.classList.add('token-unavailable');
            return;
        }
        
        // Remove unavailable styling if previously applied
        inputTokensElement.classList.remove('token-unavailable');
        outputTokensElement.classList.remove('token-unavailable');
        totalTokensElement.classList.remove('token-unavailable');
        
        // Format token counts with thousands separators for better readability
        const formatTokenCount = (count) => {
            if (count === null || count === undefined) return 'N/A';
            return count.toLocaleString();
        };
        
        inputTokensElement.textContent = formatTokenCount(tokenUsage.inputTokens);
        outputTokensElement.textContent = formatTokenCount(tokenUsage.outputTokens);
        totalTokensElement.textContent = formatTokenCount(tokenUsage.totalTokens);
        
        // Show error message if there was an error extracting token usage
        if (tokenUsage.error) {
            console.warn('Token usage extraction error:', tokenUsage.error);
        }
    }
    
    // Debug section population
    populateDebugSections() {
        // Populate prompt section
        const promptContent = document.getElementById('actualPromptContent');
        if (this.currentPromptInfo && this.currentPromptInfo.actualPrompt) {
            promptContent.textContent = this.currentPromptInfo.actualPrompt;
        } else {
            promptContent.textContent = 'No actual prompt data available';
        }
        
        // Populate response section
        const responseContent = document.getElementById('rawResponseContent');
        if (this.currentRawResponse) {
            responseContent.textContent = this.currentRawResponse;
        } else {
            responseContent.textContent = 'No raw response data available';
        }
    }
    
    // Collapsible section methods
    togglePromptContent() {
        const content = document.getElementById('actualPromptContent');
        const button = document.getElementById('togglePromptBtn');
        const icon = button.querySelector('.material-icons');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        } else {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        }
    }
    
    // Copy functionality for snippets
    attachCopyListeners() {
        const copyableElements = document.querySelectorAll('.copyable-snippet');
        copyableElements.forEach(element => {
            // Add click listener to copy HTML
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const copyHtml = element.getAttribute('data-copy-html');
                this.copyHtmlToClipboard(copyHtml, element);
            });
            
            // Add hover effects
            element.addEventListener('mouseenter', () => {
                element.classList.add('hover');
            });
            
            element.addEventListener('mouseleave', () => {
                element.classList.remove('hover');
            });
        });
    }
    
    async copyHtmlToClipboard(htmlContent, element) {
        try {
            // Extract plain text version for plain text fields (like Azure DevOps title)
            const plainText = this.extractPlainTextFromHtml(htmlContent);
            
            // Try to copy both HTML and plain text using the Clipboard API
            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            });
            
            await navigator.clipboard.write([clipboardItem]);
            this.showCopySuccess(element);
            
        } catch (err) {
            console.warn('HTML clipboard write failed, trying fallback:', err);
            // Fallback: try to copy as plain text first, then HTML
            try {
                const plainText = this.extractPlainTextFromHtml(htmlContent);
                await navigator.clipboard.writeText(plainText);
                this.showCopySuccess(element);
            } catch (fallbackErr) {
                console.error('All clipboard methods failed:', fallbackErr);
                this.fallbackHtmlCopy(htmlContent, element);
            }
        }
    }
    
    extractPlainTextFromHtml(htmlContent) {
        // Create a temporary element to parse HTML and extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Get text content, which automatically strips HTML tags
        let plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        // Clean up extra whitespace and normalize line breaks
        plainText = plainText
            .replace(/\s+/g, ' ')  // Replace multiple spaces/tabs with single space
            .replace(/\n\s*\n/g, '\n')  // Remove empty lines
            .trim();
        
        return plainText;
    }
    
    fallbackHtmlCopy(htmlContent, element) {
        // Use plain text for fallback copy to ensure compatibility with all fields
        const plainText = this.extractPlainTextFromHtml(htmlContent);
        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopySuccess(element);
            } else {
                this.showCopyError();
            }
        } catch (err) {
            console.error('Fallback HTML copy failed:', err);
            this.showCopyError();
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    showCopySuccess(element) {
        // Add visual feedback to the element
        element.classList.add('copied');
        
        // Show toast notification
        this.showToast('Copied to clipboard!', 'success');
        
        // Remove visual feedback after animation
        setTimeout(() => {
            element.classList.remove('copied');
        }, 2000);
    }
    
    showCopyError() {
        // Show error toast notification
        this.showToast('Failed to copy', 'error');
    }
    
    showToast(message, type = 'success') {
        // Remove any existing toast
        const existingToast = document.querySelector('.copy-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `copy-toast copy-toast-${type}`;
        toast.textContent = message;
        
        // Position toast in top-right corner
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '10000';
        
        // Add to document
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }
    
    toggleResponseContent() {
        const content = document.getElementById('rawResponseContent');
        const button = document.getElementById('toggleResponseBtn');
        const icon = button.querySelector('.material-icons');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        } else {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        }
    }
    
    toggleOriginalStoryContent() {
        const content = document.getElementById('originalContent');
        const button = document.getElementById('toggleOriginalStoryBtn');
        const icon = button.querySelector('.material-icons');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        } else {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        }
    }
    
    // Error details functionality
    updateErrorDetails() {
        const showDetailsBtn = document.getElementById('showErrorDetailsBtn');
        const errorDetailsSection = document.getElementById('errorDetailsSection');
        
        if (this.currentErrorDetails) {
            showDetailsBtn.style.display = 'inline-flex';
            this.populateErrorDetails();
        } else {
            showDetailsBtn.style.display = 'none';
            if (errorDetailsSection) {
                errorDetailsSection.style.display = 'none';
            }
        }
    }
    
    populateErrorDetails() {
        if (!this.currentErrorDetails) return;
        
        const details = this.currentErrorDetails;
        
        // Update troubleshooting steps
        const troubleshootingList = document.getElementById('troubleshootingSteps');
        if (troubleshootingList && details.troubleshooting) {
            troubleshootingList.innerHTML = '';
            details.troubleshooting.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                troubleshootingList.appendChild(li);
            });
        }
        
        // Update technical details
        const technicalDetails = document.getElementById('technicalErrorDetails');
        if (technicalDetails && details.requestData) {
            const detailsHtml = `
                <div class="detail-row">
                    <span class="detail-label">Provider:</span>
                    <span class="detail-value">${details.requestData.provider || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Model:</span>
                    <span class="detail-value">${details.requestData.model || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">API Key Configured:</span>
                    <span class="detail-value">${details.requestData.hasApiKey ? 'Yes' : 'No'}</span>
                </div>
                ${details.requestData.endpoint ? `
                <div class="detail-row">
                    <span class="detail-label">Endpoint:</span>
                    <span class="detail-value">${details.requestData.endpoint}</span>
                </div>
                ` : ''}
                ${details.requestData.promptLength ? `
                <div class="detail-row">
                    <span class="detail-label">Prompt Length:</span>
                    <span class="detail-value">${details.requestData.promptLength} characters</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Error Time:</span>
                    <span class="detail-value">${new Date(details.timestamp).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Error Type:</span>
                    <span class="detail-value">${details.isNetworkError ? 'Network Error' : 'API Error'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Original Error:</span>
                    <span class="detail-value error-message">${this.escapeHtml(details.originalError)}</span>
                </div>
            `;
            technicalDetails.innerHTML = detailsHtml;
        }
    }
    
    getTroubleshootingStepsForGeneralError(error) {
        const steps = [];
        const errorMessage = error.message.toLowerCase();
        
        // Race condition errors (missing content or settings)
        if (errorMessage.includes('missing content') || errorMessage.includes('missing settings')) {
            steps.push('This may be a timing issue with extension initialization');
            steps.push('Try refreshing the feedback window or clicking "Get Feedback" again');
            steps.push('Ensure you extracted story content from an Azure DevOps work item first');
            steps.push('Check that your API settings are properly configured');
            return steps;
        }
        
        // Chrome extension errors
        if (errorMessage.includes('extension context') || errorMessage.includes('runtime.lastError')) {
            steps.push('Extension context was invalidated - try reloading the extension');
            steps.push('Close and reopen the feedback window');
            steps.push('If persistent, disable and re-enable the extension in Chrome settings');
            return steps;
        }
        
        // Storage errors
        if (errorMessage.includes('storage') || errorMessage.includes('local.get')) {
            steps.push('Browser storage access failed');
            steps.push('Check if you have sufficient storage quota available');
            steps.push('Try clearing extension storage and reconfigure settings');
            steps.push('Ensure extension has proper permissions');
            return steps;
        }
        
        // Settings-related errors
        if (errorMessage.includes('settings') || errorMessage.includes('configuration')) {
            steps.push('Check your API configuration in extension settings');
            steps.push('Verify your API key is valid and active');
            steps.push('Ensure you have selected the correct API provider');
            steps.push('Try testing your API connection in the settings page');
            return steps;
        }
        
        // Generic fallback steps
        steps.push('Try refreshing the feedback window');
        steps.push('Check extension settings and API configuration');
        steps.push('Ensure you have extracted story content from Azure DevOps first');
        steps.push('If the issue persists, try reloading the browser extension');
        
        return steps;
    }
    
    toggleErrorDetails() {
        const errorDetailsSection = document.getElementById('errorDetailsSection');
        const showDetailsBtn = document.getElementById('showErrorDetailsBtn');
        const btnText = showDetailsBtn.querySelector('.btn-text');
        const btnIcon = showDetailsBtn.querySelector('.material-icons');
        
        if (errorDetailsSection.style.display === 'none' || !errorDetailsSection.style.display) {
            errorDetailsSection.style.display = 'block';
            btnText.textContent = 'Hide Details';
            btnIcon.textContent = 'expand_less';
        } else {
            errorDetailsSection.style.display = 'none';
            btnText.textContent = 'Show Details';
            btnIcon.textContent = 'expand_more';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackManager();
});