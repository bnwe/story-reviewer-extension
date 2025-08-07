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
            
            // Show loading state and generate feedback
            this.showLoadingState();
            await this.generateFeedback();
            
        } catch (error) {
            console.error('Failed to load feedback:', error);
            this.showError('Failed to load story content');
        }
    }
    
    async generateFeedback() {
        try {
            if (!this.currentContent || !this.currentSettings) {
                throw new Error('Missing content or settings');
            }
            
            const response = await this.sendToLLM(this.currentContent, this.currentSettings);
            
            if (response.success) {
                this.showFeedback(this.currentContent, response.feedback, response.promptInfo, response.rawResponse);
            } else {
                this.showError(response.error || 'Failed to generate feedback', response.promptInfo);
            }
            
        } catch (error) {
            console.error('Failed to generate feedback:', error);
            this.showError(error.message);
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
    
    showError(message, promptInfo = null) {
        this.hideAllStates();
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').style.display = 'flex';
        
        // Store prompt info for potential debug display
        this.currentPromptInfo = promptInfo;
    }
    
    showNoApiKeyState() {
        this.hideAllStates();
        document.getElementById('noApiKeyState').style.display = 'flex';
    }
    
    showFeedback(originalContent, feedback, promptInfo = null, rawResponse = null) {
        this.hideAllStates();
        
        // Store prompt info and raw response for debug display
        this.currentPromptInfo = promptInfo;
        this.currentRawResponse = rawResponse;
        
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
            // Sanitize and clean whitespace, then return HTML content
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
        return content.replace(codeBlockRegex, (match, codeContent) => {
            return codeContent.trim();
        });
    }
    
    processCopyableTags(content) {
        // Replace <copyable>...</copyable> tags with styled HTML elements
        const copyableRegex = /<copyable>([\s\S]*?)<\/copyable>/gi;
        let copyableIndex = 0;
        
        return content.replace(copyableRegex, (match, innerContent) => {
            const id = `copyable-${copyableIndex++}`;
            const cleanedHtmlContent = this.cleanHtmlForAzureDevOps(innerContent.trim());
            const escapedHtmlContent = this.escapeHtml(cleanedHtmlContent).replace(/"/g, '&quot;');
            return `<span class="copyable-snippet" data-copyable-id="${id}" data-copy-html="${escapedHtmlContent}" title="Click to copy">${cleanedHtmlContent}</span>`;
        });
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
    
    sanitizeHtml(html) {
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
    
    cleanWhitespace(html) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove whitespace-only text nodes and normalize spacing
        this.removeWhitespaceNodes(tempDiv);
        
        return tempDiv.innerHTML;
    }
    
    removeWhitespaceNodes(element) {
        // Process all child nodes
        const childNodes = Array.from(element.childNodes);
        
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Check if this is a whitespace-only text node
                if (/^\s*$/.test(node.textContent)) {
                    // Remove whitespace-only text nodes between block elements
                    const prevSibling = node.previousSibling;
                    const nextSibling = node.nextSibling;
                    
                    // Check if surrounded by block elements
                    const blockElements = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE'];
                    
                    if ((prevSibling && blockElements.includes(prevSibling.tagName)) ||
                        (nextSibling && blockElements.includes(nextSibling.tagName))) {
                        node.remove();
                    }
                } else {
                    // Normalize whitespace in text nodes
                    node.textContent = node.textContent.replace(/\s+/g, ' ');
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Recursively process child elements
                this.removeWhitespaceNodes(node);
            }
        });
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
    
    // API methods
    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get({
                apiProvider: 'openai',
                apiKey: '',
                model: '',
                customEndpoint: '',
                temperature: 0.7
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
                    resolve({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    resolve(response || { success: false, error: 'No response received' });
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
        
        if (!promptInfo) {
            document.getElementById('debugPromptType').textContent = 'No prompt information available';
            document.getElementById('debugProvider').textContent = 'Unknown';
            document.getElementById('debugModel').textContent = 'Unknown';
            document.getElementById('debugTemperature').textContent = 'Unknown';
            document.getElementById('debugTimestamp').textContent = 'Unknown';
            return;
        }
        
        // Update prompt type
        const promptType = promptInfo.isCustom ? 
            (promptInfo.error ? '❌ Custom (Error)' : '✅ Custom') : 
            (promptInfo.error ? '❌ Default (Error)' : '🔧 Default');
        document.getElementById('debugPromptType').textContent = promptType;
        
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackManager();
});