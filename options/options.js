class OptionsManager {
    constructor() {
        this.defaultSettings = {
            apiProvider: 'openai',
            apiKey: '',
            customEndpoint: '',
            customPrompts: {},
            promptVersion: '1.0',
            promptBackups: []
        };
        
        this.defaultPrompt = `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in a structured format with clear sections for different aspects of the story.`;
        
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
        
        // Prompt management elements
        const promptTabs = document.querySelectorAll('.prompt-tab');
        const customPromptTextarea = document.getElementById('customPrompt');
        const previewPromptBtn = document.getElementById('previewPrompt');
        const resetPromptBtn = document.getElementById('resetPrompt');
        const previewModal = document.getElementById('previewModal');
        const modalClose = document.querySelector('.modal-close');
        const copyPreviewBtn = document.getElementById('copyPreview');
        const exportPromptsBtn = document.getElementById('exportPrompts');
        const importPromptsBtn = document.getElementById('importPrompts');
        const importFileInput = document.getElementById('importFile');
        
        apiProviderSelect.addEventListener('change', this.handleProviderChange.bind(this));
        toggleApiKeyBtn.addEventListener('click', this.toggleApiKeyVisibility.bind(this));
        testConnectionBtn.addEventListener('click', this.testConnection.bind(this));
        
        // Prompt management events
        promptTabs.forEach(tab => {
            tab.addEventListener('click', this.handlePromptTabChange.bind(this));
        });
        customPromptTextarea.addEventListener('input', this.handlePromptInput.bind(this));
        previewPromptBtn.addEventListener('click', this.showPromptPreview.bind(this));
        resetPromptBtn.addEventListener('click', this.resetCurrentPrompt.bind(this));
        modalClose.addEventListener('click', this.closePreviewModal.bind(this));
        copyPreviewBtn.addEventListener('click', this.copyPreviewToClipboard.bind(this));
        exportPromptsBtn.addEventListener('click', this.exportPrompts.bind(this));
        importPromptsBtn.addEventListener('click', this.triggerImport.bind(this));
        importFileInput.addEventListener('change', this.handleImportFile.bind(this));
        
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
        
        // Enhanced UI functionality
        this.bindEnhancedEvents();
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
                    // Migrate existing settings if needed
                    const migratedSettings = this.migrateSettingsSchema(result);
                    resolve(migratedSettings);
                }
            });
        });
    }
    
    migrateSettingsSchema(settings) {
        const migrated = { ...settings };
        let needsMigration = false;
        
        // Ensure customPrompts object exists
        if (!migrated.customPrompts) {
            migrated.customPrompts = {};
            needsMigration = true;
        }
        
        // Ensure promptVersion exists for future migrations
        if (!migrated.promptVersion) {
            migrated.promptVersion = '1.0';
            needsMigration = true;
        }
        
        // Initialize promptBackups array if not present
        if (!migrated.promptBackups) {
            migrated.promptBackups = [];
            needsMigration = true;
        }
        
        // Auto-save migrated settings if changes were made
        if (needsMigration) {
            this.storeSettings(migrated).catch(error => {
                console.warn('Failed to save migrated settings:', error);
            });
        }
        
        return migrated;
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
        const validationResult = this.comprehensivePromptValidation(prompt);
        
        if (!validationResult.isValid) {
            this.showValidation(validationResult.message, 'error');
            return false;
        }
        
        if (validationResult.warnings.length > 0) {
            this.showValidation(validationResult.warnings[0], 'warning');
            return true; // Still valid, just warnings
        }
        
        this.hideValidation();
        return true;
    }
    
    comprehensivePromptValidation(prompt) {
        const result = {
            isValid: true,
            warnings: [],
            errors: [],
            message: ''
        };
        
        // Basic validation
        if (!prompt || typeof prompt !== 'string') {
            result.isValid = false;
            result.message = 'Prompt must be a valid string';
            return result;
        }
        
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            result.isValid = false;
            result.message = 'Prompt cannot be empty';
            return result;
        }
        
        // Length validation
        if (trimmedPrompt.length < 10) {
            result.warnings.push('Prompt is very short - consider adding more detail');
        }
        
        if (trimmedPrompt.length > 8000) {
            result.warnings.push('Prompt is very long - may exceed API token limits');
        }
        
        // Template variable validation
        const openBraces = (prompt.match(/\{\{/g) || []).length;
        const closeBraces = (prompt.match(/\}\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            result.isValid = false;
            result.message = 'Template variables have mismatched braces';
            return result;
        }
        
        // Check for malformed variables (single braces)
        // First, temporarily replace valid double braces to avoid false positives
        const tempPrompt = prompt.replace(/\{\{[^}]*\}\}/g, 'VALID_VAR');
        const malformedVars = tempPrompt.match(/[{}]/g);
        if (malformedVars) {
            result.isValid = false;
            result.message = 'Found malformed template variables - use {{variable}} format';
            return result;
        }
        
        // Extract and validate template variables
        const variables = prompt.match(/\{\{([^}]+)\}\}/g) || [];
        const variableNames = variables.map(v => v.slice(2, -2).trim());
        
        // Check for invalid variable names
        const invalidVarNames = variableNames.filter(name => 
            !name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)
        );
        
        if (invalidVarNames.length > 0) {
            result.isValid = false;
            result.message = `Invalid variable names: ${invalidVarNames.join(', ')}`;
            return result;
        }
        
        // Check for required storyContent variable
        if (!prompt.includes('{{storyContent}}')) {
            result.warnings.push('Consider including {{storyContent}} variable for story content');
        }
        
        // Check for unknown variables
        const knownVariables = ['storyContent', 'timestamp', 'provider', 'feedbackType'];
        const unknownVars = variableNames.filter(name => !knownVariables.includes(name));
        
        if (unknownVars.length > 0) {
            result.warnings.push(`Unknown variables will be left as-is: ${unknownVars.join(', ')}`);
        }
        
        // Check for potentially problematic content
        const suspiciousPatterns = [
            { pattern: /javascript:/i, message: 'Contains potentially unsafe JavaScript content' },
            { pattern: /<script/i, message: 'Contains potentially unsafe script tags' },
            { pattern: /eval\s*\(/i, message: 'Contains potentially unsafe eval calls' }
        ];
        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pattern.test(prompt)) {
                result.isValid = false;
                result.message = message;
                return result;
            }
        }
        
        return result;
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
            document.getElementById('customPrompt').value = this.defaultPrompt;
            this.handlePromptInput({ target: { value: this.defaultPrompt } });
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
        const promptValue = savedPrompt || this.defaultPrompt;
        
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
    
    // Enhanced Prompt Storage Methods
    async saveCustomPrompt(provider, prompt) {
        try {
            if (!this.validatePrompt(prompt)) {
                throw new Error('Invalid prompt template');
            }
            
            const settings = await this.getStoredSettings();
            if (!settings.customPrompts) {
                settings.customPrompts = {};
            }
            
            // Create backup before changing
            this.createPromptBackup(provider, settings.customPrompts[provider]);
            
            settings.customPrompts[provider] = prompt;
            await this.storeSettings(settings);
            
            return { success: true, message: 'Prompt saved successfully' };
        } catch (error) {
            console.error('Failed to save custom prompt:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getCustomPrompt(provider) {
        try {
            const settings = await this.getStoredSettings();
            const customPrompt = settings.customPrompts?.[provider];
            
            if (customPrompt) {
                return {
                    success: true,
                    prompt: customPrompt,
                    isCustom: true
                };
            } else {
                // Return default prompt as fallback
                return {
                    success: true,
                    prompt: this.defaultPrompt,
                    isCustom: false
                };
            }
        } catch (error) {
            console.error('Failed to retrieve custom prompt:', error);
            return {
                success: false,
                error: error.message,
                prompt: this.defaultPrompt,
                isCustom: false
            };
        }
    }
    
    async bulkSavePrompts(promptsObject) {
        try {
            const results = {};
            
            for (const [provider, prompt] of Object.entries(promptsObject)) {
                if (!this.validatePrompt(prompt)) {
                    results[provider] = { success: false, error: 'Invalid prompt template' };
                    continue;
                }
                results[provider] = { success: true };
            }
            
            // Only save if all prompts are valid
            const allValid = Object.values(results).every(r => r.success);
            if (!allValid) {
                return { success: false, results, error: 'Some prompts failed validation' };
            }
            
            const settings = await this.getStoredSettings();
            if (!settings.customPrompts) {
                settings.customPrompts = {};
            }
            
            // Create backups for all existing prompts
            for (const provider of Object.keys(promptsObject)) {
                this.createPromptBackup(provider, settings.customPrompts[provider]);
            }
            
            // Save all prompts
            Object.assign(settings.customPrompts, promptsObject);
            await this.storeSettings(settings);
            
            return { success: true, results, message: 'All prompts saved successfully' };
        } catch (error) {
            console.error('Failed to bulk save prompts:', error);
            return { success: false, error: error.message };
        }
    }
    
    createPromptBackup(provider, currentPrompt) {
        if (!currentPrompt) return;
        
        const backup = {
            provider,
            prompt: currentPrompt,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        // Keep only last 5 backups per provider
        if (!this.promptBackups) {
            this.promptBackups = [];
        }
        
        // Remove old backups for this provider (keep only 4, so we can add 1 more)
        this.promptBackups = this.promptBackups
            .filter(b => b.provider !== provider)
            .concat(this.promptBackups.filter(b => b.provider === provider).slice(-4));
        
        this.promptBackups.push(backup);
    }
    
    async getPromptBackups(provider = null) {
        try {
            const settings = await this.getStoredSettings();
            const backups = settings.promptBackups || [];
            
            if (provider) {
                return backups.filter(b => b.provider === provider);
            }
            
            return backups;
        } catch (error) {
            console.error('Failed to retrieve prompt backups:', error);
            return [];
        }
    }
    
    async restorePromptFromBackup(provider, timestamp) {
        try {
            const backups = await this.getPromptBackups(provider);
            const backup = backups.find(b => b.timestamp === timestamp);
            
            if (!backup) {
                throw new Error('Backup not found');
            }
            
            const result = await this.saveCustomPrompt(provider, backup.prompt);
            if (result.success) {
                return { success: true, message: 'Prompt restored from backup' };
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to restore prompt from backup:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Import/Export Functionality
    async exportPrompts() {
        try {
            const settings = await this.getStoredSettings();
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                customPrompts: settings.customPrompts || {},
                metadata: {
                    totalPrompts: Object.keys(settings.customPrompts || {}).length,
                    exportedBy: 'Story Reviewer Extension'
                }
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `story-reviewer-prompts-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatusMessage('Prompts exported successfully!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showStatusMessage('Failed to export prompts: ' + error.message, 'error');
        }
    }
    
    triggerImport() {
        document.getElementById('importFile').click();
    }
    
    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await this.readFileAsText(file);
            const importData = JSON.parse(text);
            
            // Validate import data
            const validationResult = this.validateImportData(importData);
            if (!validationResult.isValid) {
                throw new Error(validationResult.message);
            }
            
            // Show confirmation dialog
            const promptCount = Object.keys(importData.customPrompts || {}).length;
            const confirmMessage = `Import ${promptCount} prompt(s)? This will overwrite existing prompts for the same providers.`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // Perform import
            await this.performImport(importData);
            
            this.showStatusMessage(`Successfully imported ${promptCount} prompt(s)!`, 'success');
            
            // Refresh UI to show imported prompts
            this.loadCurrentPrompt();
            
        } catch (error) {
            console.error('Import failed:', error);
            this.showStatusMessage('Import failed: ' + error.message, 'error');
        } finally {
            // Clear the file input
            event.target.value = '';
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    validateImportData(data) {
        const result = {
            isValid: true,
            message: ''
        };
        
        // Check basic structure
        if (!data || typeof data !== 'object') {
            result.isValid = false;
            result.message = 'Invalid file format';
            return result;
        }
        
        // Check for required fields
        if (!data.customPrompts || typeof data.customPrompts !== 'object') {
            result.isValid = false;
            result.message = 'No custom prompts found in file';
            return result;
        }
        
        // Check version compatibility
        if (data.version && !this.isVersionCompatible(data.version)) {
            result.isValid = false;
            result.message = `Incompatible file version: ${data.version}`;
            return result;
        }
        
        // Validate each prompt
        for (const [provider, prompt] of Object.entries(data.customPrompts)) {
            if (typeof prompt !== 'string' || !prompt.trim()) {
                result.isValid = false;
                result.message = `Invalid prompt for provider: ${provider}`;
                return result;
            }
            
            // Use comprehensive validation
            const promptValidation = this.comprehensivePromptValidation(prompt);
            if (!promptValidation.isValid) {
                result.isValid = false;
                result.message = `Invalid prompt for ${provider}: ${promptValidation.message}`;
                return result;
            }
        }
        
        return result;
    }
    
    isVersionCompatible(version) {
        // Simple version compatibility check
        const [major] = version.split('.');
        return major === '1';
    }
    
    async performImport(importData) {
        const settings = await this.getStoredSettings();
        
        // Create backups for existing prompts before overwriting
        for (const provider of Object.keys(importData.customPrompts)) {
            if (settings.customPrompts && settings.customPrompts[provider]) {
                this.createPromptBackup(provider, settings.customPrompts[provider]);
            }
        }
        
        // Merge imported prompts
        if (!settings.customPrompts) {
            settings.customPrompts = {};
        }
        
        Object.assign(settings.customPrompts, importData.customPrompts);
        
        // Save updated settings
        await this.storeSettings(settings);
        
        // Update local copy
        this.customPrompts = settings.customPrompts;
    }
    
    // Enhanced UI Methods
    bindEnhancedEvents() {
        // Help toggle functionality
        const helpToggle = document.getElementById('apiHelpToggle');
        const helpContent = document.getElementById('apiHelp');
        
        if (helpToggle && helpContent) {
            helpToggle.addEventListener('click', () => {
                helpContent.classList.toggle('show');
                
                // Update help text
                const helpText = helpToggle.querySelector('.help-text');
                if (helpContent.classList.contains('show')) {
                    helpText.textContent = 'Hide help';
                } else {
                    helpText.textContent = 'Show help';
                }
            });
        }
        
        // Variable tag click to copy functionality
        const variableTags = document.querySelectorAll('.variable-tag');
        variableTags.forEach(tag => {
            tag.addEventListener('click', async (e) => {
                e.preventDefault();
                const variable = tag.dataset.variable;
                
                try {
                    await navigator.clipboard.writeText(variable);
                    this.showVariableCopiedFeedback(tag);
                } catch (error) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = variable;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.showVariableCopiedFeedback(tag);
                }
            });
            
            // Add keyboard support
            tag.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    tag.click();
                }
            });
        });
    }
    
    showVariableCopiedFeedback(tagElement) {
        // Temporarily change the tag appearance to show it was copied
        const originalContent = tagElement.innerHTML;
        const variableName = tagElement.querySelector('.variable-name').textContent;
        
        tagElement.innerHTML = `
            <span class="variable-name">${variableName}</span>
            <span class="variable-desc">✓ Copied!</span>
        `;
        
        tagElement.style.background = 'rgba(16, 185, 129, 0.1)';
        tagElement.style.borderColor = 'var(--color-success)';
        
        setTimeout(() => {
            tagElement.innerHTML = originalContent;
            tagElement.style.background = '';
            tagElement.style.borderColor = '';
        }, 1500);
        
        // Also show a status message
        this.showStatusMessage(`Variable ${variableName} copied to clipboard!`, 'success');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});