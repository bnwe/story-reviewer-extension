class OptionsManager {
    constructor() {
        this.defaultSettings = {
            apiProvider: 'openai',
            apiKey: '',
            customEndpoint: '',
            customPrompts: {}
        };
        
        this.defaultPrompts = {
            openai: `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in a structured format with clear sections for different aspects of the story.`,
            anthropic: `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in a structured format with clear sections for different aspects of the story.`,
            custom: `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in a structured format with clear sections for different aspects of the story.`
        };
        
        this.currentProvider = 'openai';
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.bindEvents();
    }
    
    bindEvents() {
        const apiProviderSelect = document.getElementById('apiProvider');
        const apiKeyInput = document.getElementById('apiKey');
        const customEndpointInput = document.getElementById('customEndpoint');
        const toggleApiKeyBtn = document.getElementById('toggleApiKey');
        const testConnectionBtn = document.getElementById('testConnection');
        const saveSettingsBtn = document.getElementById('saveSettings');
        const resetSettingsBtn = document.getElementById('resetSettings');
        
        // Prompt management elements
        const promptTabs = document.querySelectorAll('.prompt-tab');
        const customPromptTextarea = document.getElementById('customPrompt');
        const previewPromptBtn = document.getElementById('previewPrompt');
        const resetPromptBtn = document.getElementById('resetPrompt');
        const previewModal = document.getElementById('previewModal');
        const modalClose = document.querySelector('.modal-close');
        const copyPreviewBtn = document.getElementById('copyPreview');
        
        apiProviderSelect.addEventListener('change', this.handleProviderChange.bind(this));
        toggleApiKeyBtn.addEventListener('click', this.toggleApiKeyVisibility.bind(this));
        testConnectionBtn.addEventListener('click', this.testConnection.bind(this));
        saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
        resetSettingsBtn.addEventListener('click', this.resetSettings.bind(this));
        
        // Prompt management events
        promptTabs.forEach(tab => {
            tab.addEventListener('click', this.handlePromptTabChange.bind(this));
        });
        customPromptTextarea.addEventListener('input', this.handlePromptInput.bind(this));
        previewPromptBtn.addEventListener('click', this.showPromptPreview.bind(this));
        resetPromptBtn.addEventListener('click', this.resetCurrentPrompt.bind(this));
        modalClose.addEventListener('click', this.closePreviewModal.bind(this));
        copyPreviewBtn.addEventListener('click', this.copyPreviewToClipboard.bind(this));
        
        // Close modal when clicking outside
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                this.closePreviewModal();
            }
        });
        
        // Auto-save on input changes
        apiKeyInput.addEventListener('input', this.autoSave.bind(this));
        customEndpointInput.addEventListener('input', this.autoSave.bind(this));
        customPromptTextarea.addEventListener('input', this.autoSavePrompt.bind(this));
    }
    
    handleProviderChange() {
        const provider = document.getElementById('apiProvider').value;
        const customEndpointGroup = document.getElementById('customEndpointGroup');
        
        if (provider === 'custom') {
            customEndpointGroup.style.display = 'flex';
        } else {
            customEndpointGroup.style.display = 'none';
        }
        
        // Sync with prompt tabs
        this.switchToPromptTab(provider);
        
        this.autoSave();
    }
    
    toggleApiKeyVisibility() {
        const apiKeyInput = document.getElementById('apiKey');
        const toggleBtn = document.getElementById('toggleApiKey');
        
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleBtn.textContent = 'Hide';
        } else {
            apiKeyInput.type = 'password';
            toggleBtn.textContent = 'Show';
        }
    }
    
    async testConnection() {
        const testBtn = document.getElementById('testConnection');
        const statusElement = document.getElementById('connectionStatus');
        
        const settings = this.getCurrentSettings();
        
        if (!settings.apiKey) {
            this.showStatus(statusElement, 'Please enter an API key first', 'error');
            return;
        }
        
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        this.showStatus(statusElement, 'Testing connection...', 'testing');
        
        try {
            const result = await this.performConnectionTest(settings);
            
            if (result.success) {
                this.showStatus(statusElement, 'Connection successful!', 'success');
            } else {
                this.showStatus(statusElement, `Connection failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus(statusElement, `Test failed: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
        }
    }
    
    async performConnectionTest(settings) {
        return new Promise((resolve) => {
            // Send test message to background script
            chrome.runtime.sendMessage({
                action: 'testApiConnection',
                settings: settings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    async saveSettings() {
        const settings = this.getCurrentSettings();
        
        try {
            await this.storeSettings(settings);
            this.showStatusMessage('Settings saved successfully!', 'success');
        } catch (error) {
            this.showStatusMessage(`Failed to save settings: ${error.message}`, 'error');
        }
    }
    
    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            try {
                await this.storeSettings(this.defaultSettings);
                this.loadSettingsIntoUI(this.defaultSettings);
                this.showStatusMessage('Settings reset to defaults', 'success');
            } catch (error) {
                this.showStatusMessage(`Failed to reset settings: ${error.message}`, 'error');
            }
        }
    }
    
    async autoSave() {
        const settings = this.getCurrentSettings();
        try {
            await this.storeSettings(settings);
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
    
    getCurrentSettings() {
        return {
            apiProvider: document.getElementById('apiProvider').value,
            apiKey: document.getElementById('apiKey').value.trim(),
            customEndpoint: document.getElementById('customEndpoint').value.trim(),
            customPrompts: this.getAllCustomPrompts()
        };
    }
    
    async loadSettings() {
        try {
            const settings = await this.getStoredSettings();
            this.loadSettingsIntoUI(settings);
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.loadSettingsIntoUI(this.defaultSettings);
        }
    }
    
    loadSettingsIntoUI(settings) {
        document.getElementById('apiProvider').value = settings.apiProvider;
        document.getElementById('apiKey').value = settings.apiKey;
        document.getElementById('customEndpoint').value = settings.customEndpoint;
        
        // Load custom prompts
        this.currentProvider = settings.apiProvider;
        this.loadPromptsIntoUI(settings.customPrompts || {});
        
        // Trigger provider change to show/hide custom endpoint
        this.handleProviderChange();
    }
    
    async getStoredSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(this.defaultSettings, (result) => {
                if (chrome.runtime.lastError) {
                    resolve(this.defaultSettings);
                } else {
                    resolve(result);
                }
            });
        });
    }
    
    async storeSettings(settings) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set(settings, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }
    
    showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status ${type}`;
    }
    
    showStatusMessage(message, type) {
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
    
    getProviderDisplayName(provider) {
        const names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic (Claude)',
            'custom': 'Custom API'
        };
        return names[provider] || provider;
    }
    
    // Prompt Management Methods
    handlePromptTabChange(event) {
        const provider = event.target.dataset.provider;
        this.switchToPromptTab(provider);
    }
    
    switchToPromptTab(provider) {
        // Update active tab
        document.querySelectorAll('.prompt-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-provider="${provider}"]`).classList.add('active');
        
        // Save current prompt before switching
        if (this.currentProvider) {
            this.saveCurrentPrompt();
        }
        
        // Switch to new provider
        this.currentProvider = provider;
        this.loadCurrentPrompt();
    }
    
    handlePromptInput(event) {
        const charCount = event.target.value.length;
        document.getElementById('promptCharCount').textContent = charCount;
        
        // Basic validation
        this.validatePrompt(event.target.value);
    }
    
    validatePrompt(prompt) {
        
        if (!prompt.trim()) {
            this.showValidation('Prompt cannot be empty', 'error');
            return false;
        }
        
        // Check for required {{storyContent}} variable
        if (!prompt.includes('{{storyContent}}')) {
            this.showValidation('Warning: Prompt should include {{storyContent}} variable', 'warning');
            return true; // Still valid, just a warning
        }
        
        // Check for unclosed variables
        const unclosedVars = prompt.match(/\{\{[^}]*$/g);
        if (unclosedVars) {
            this.showValidation('Error: Unclosed template variables found', 'error');
            return false;
        }
        
        this.hideValidation();
        return true;
    }
    
    showValidation(message, type) {
        const validationElement = document.getElementById('promptValidation');
        validationElement.textContent = message;
        validationElement.className = `validation-message ${type}`;
        validationElement.style.display = 'block';
    }
    
    hideValidation() {
        const validationElement = document.getElementById('promptValidation');
        validationElement.style.display = 'none';
    }
    
    async showPromptPreview() {
        const promptTemplate = document.getElementById('customPrompt').value;
        
        if (!this.validatePrompt(promptTemplate)) {
            return;
        }
        
        // Sample data for preview
        const sampleData = {
            storyContent: `Title: Sample User Story
Description: As a user, I want to be able to save my work so that I don't lose my progress.
Acceptance Criteria:
- User can click save button
- Work is automatically saved every 5 minutes
- User receives confirmation when save is complete`,
            timestamp: new Date().toISOString(),
            provider: this.getProviderDisplayName(this.currentProvider),
            feedbackType: 'General Review'
        };
        
        const previewText = this.substituteVariables(promptTemplate, sampleData);
        
        document.getElementById('previewText').textContent = previewText;
        document.getElementById('previewModal').style.display = 'block';
    }
    
    substituteVariables(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }
    
    closePreviewModal() {
        document.getElementById('previewModal').style.display = 'none';
    }
    
    async copyPreviewToClipboard() {
        const previewText = document.getElementById('previewText').textContent;
        
        try {
            await navigator.clipboard.writeText(previewText);
            this.showStatusMessage('Prompt copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = previewText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showStatusMessage('Prompt copied to clipboard!', 'success');
        }
    }
    
    resetCurrentPrompt() {
        if (confirm(`Reset ${this.getProviderDisplayName(this.currentProvider)} prompt to default?`)) {
            const defaultPrompt = this.defaultPrompts[this.currentProvider];
            document.getElementById('customPrompt').value = defaultPrompt;
            this.handlePromptInput({ target: { value: defaultPrompt } });
            this.autoSavePrompt();
        }
    }
    
    saveCurrentPrompt() {
        const promptValue = document.getElementById('customPrompt').value;
        if (!this.customPrompts) {
            this.customPrompts = {};
        }
        this.customPrompts[this.currentProvider] = promptValue;
    }
    
    loadCurrentPrompt() {
        const savedPrompt = this.customPrompts?.[this.currentProvider];
        const promptValue = savedPrompt || this.defaultPrompts[this.currentProvider];
        
        document.getElementById('customPrompt').value = promptValue;
        this.handlePromptInput({ target: { value: promptValue } });
    }
    
    loadPromptsIntoUI(customPrompts) {
        this.customPrompts = customPrompts;
        this.loadCurrentPrompt();
    }
    
    getAllCustomPrompts() {
        // Save current prompt before getting all
        this.saveCurrentPrompt();
        return this.customPrompts || {};
    }
    
    async autoSavePrompt() {
        this.saveCurrentPrompt();
        await this.autoSave();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});