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
        document.getElementById('exportBtn').addEventListener('click', this.exportFeedback.bind(this));
        document.getElementById('toggleDebugBtn').addEventListener('click', this.toggleDebugInfo.bind(this));
    }
    
    async checkApiConfiguration() {
        try {
            const settings = await this.getSettings();
            this.currentSettings = settings;
            
            const providerInfo = document.getElementById('providerInfo');
            if (settings.apiKey && settings.apiProvider) {
                providerInfo.textContent = `Provider: ${this.getProviderDisplayName(settings.apiProvider)}`;
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
                this.showFeedback(this.currentContent, response.feedback, response.promptInfo);
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
    
    async exportFeedback() {
        try {
            const feedbackContent = document.getElementById('feedbackContent');
            const originalContent = document.getElementById('originalContent');
            
            const exportText = `# User Story Feedback Report
Generated on: ${new Date().toLocaleString()}
Provider: ${this.getProviderDisplayName(this.currentSettings.apiProvider)}

## Original Story
${originalContent.textContent || originalContent.innerText}

## AI Feedback
${feedbackContent.textContent || feedbackContent.innerText}

---
Generated by Azure DevOps Story Reviewer Extension`;
            
            const blob = new Blob([exportText], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `story-feedback-${Date.now()}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showCopyNotification('Exported successfully!');
            
        } catch (error) {
            console.error('Failed to export feedback:', error);
            this.showError('Failed to export feedback');
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
    
    showFeedback(originalContent, feedback, promptInfo = null) {
        this.hideAllStates();
        
        // Store prompt info for debug display
        this.currentPromptInfo = promptInfo;
        
        // Display original content
        const originalDiv = document.getElementById('originalContent');
        originalDiv.innerHTML = this.formatContent(originalContent);
        
        // Display feedback
        const feedbackDiv = document.getElementById('feedbackContent');
        feedbackDiv.innerHTML = this.formatFeedback(feedback);
        
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
        // Simple formatting for feedback text
        return feedback
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\* /gm, '• ')
            .replace(/^(\d+)\. /gm, '$1. ');
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
                customEndpoint: ''
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
            document.getElementById('debugTimestamp').textContent = 'Unknown';
            document.getElementById('debugPromptPreview').textContent = 'No preview available';
            return;
        }
        
        // Update prompt type
        const promptType = promptInfo.isCustom ? 
            (promptInfo.error ? '❌ Custom (Error)' : '✅ Custom') : 
            (promptInfo.error ? '❌ Default (Error)' : '🔧 Default');
        document.getElementById('debugPromptType').textContent = promptType;
        
        // Update provider
        const providerNames = {
            'openai': 'OpenAI GPT',
            'anthropic': 'Anthropic Claude',
            'custom': 'Custom API'
        };
        document.getElementById('debugProvider').textContent = 
            providerNames[promptInfo.provider] || promptInfo.provider;
        
        // Update timestamp
        const timestamp = new Date(promptInfo.timestamp);
        document.getElementById('debugTimestamp').textContent = 
            timestamp.toLocaleString();
        
        // Update prompt preview
        document.getElementById('debugPromptPreview').textContent = 
            promptInfo.promptPreview || 'No preview available';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackManager();
});