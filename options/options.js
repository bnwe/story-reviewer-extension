class OptionsManager {
    constructor() {
        this.defaultSettings = {
            apiProvider: 'openai',
            apiKey: '',
            model: '',
            customPrompt: '',
            promptVersion: '1.0',
            promptBackups: [],
            temperature: 0.7
        };
        
        this.modelOptions = {
            openai: [
                { value: 'gpt-4.1', label: 'GPT‑4.1 (Recommended)', description: 'Flagship multimodal powerhouse with huge context' },
                { value: 'gpt-4.1-mini', label: 'GPT‑4.1 mini', description: 'Balanced, lower-cost general-purpose option' },
                { value: 'gpt-4.1-nano', label: 'GPT‑4.1 nano', description: 'Ultra-fast, inexpensive small variant' },
                { value: 'gpt-4o', label: 'GPT‑4o (Omni)', description: 'Multimodal (text, image, audio) flagship' }
            ],
            anthropic: [
                { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1', description: 'Top-tier performer: advanced coding, reasoning, extended thinking' },
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)', description: 'Balanced high-performance model with strong instruction following' },
                { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', description: 'Super‑fast, cost-efficient option for rapid responses' }
            ],
            mistral: [
                { value: 'mistral-small-latest', label: 'Mistral Small', description: 'Powerful, efficient open-source small model' },
                { value: 'mistral-medium-latest', label: 'Mistral Medium (Recommended)', description: 'State-of-the-art performance. Cost-efficient' },
                { value: 'mistral-large-latest', label: 'Mistral Large', description: 'For complex tasks and sophisticated problems' }
            ]
        };
        
        this.defaultPrompt = `Please provide feedback on this user story. Analyze it for clarity, completeness, testability, and adherence to best practices. Provide specific, actionable suggestions for improvement.

User Story Content:
{{storyContent}}

Please provide your feedback in HTML format with clear sections for different aspects of the story. Use proper HTML tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> to structure your response. This will improve readability and allow for better formatting.

When providing specific text suggestions that can be copied and pasted directly into the user story (such as additional acceptance criteria, improved descriptions, or refined user story text), wrap these copyable snippets in <copyable></copyable> tags. For example:
- If suggesting a new acceptance criterion: <copyable>Given X when Y then Z</copyable>
- If suggesting improved wording: <copyable>As a user, I want to...</copyable>
- If suggesting additional details: <copyable>The system should validate...</copyable>

Only use copyable tags for literal text that can be directly copied into Azure DevOps work items, not for explanatory text or analysis.

Inside the copyable tags please use regular HTML formatting, so that formatting is transfered to Azure Devops as well. E.g. for lists use <ul> or <ol> tags etc.

Example: <p>Here are some improved acceptance criteria:</p><ol><li>User is presented option to cancel or continue</li><li>After canceling, the draft is discarded.</li></ol>`;
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.bindEvents();
    }
    
    bindEvents() {
        const apiProviderSelect = document.getElementById('apiProvider');
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('modelSelect');
        const toggleApiKeyBtn = document.getElementById('toggleApiKey');
        const testConnectionBtn = document.getElementById('testConnection');
        
        // Prompt management elements
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
        if (modelSelect) {
            modelSelect.addEventListener('change', this.autoSave.bind(this));
        }
        toggleApiKeyBtn.addEventListener('click', this.toggleApiKeyVisibility.bind(this));
        testConnectionBtn.addEventListener('click', this.testConnection.bind(this));
        
        // Prompt management events
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
        customPromptTextarea.addEventListener('input', this.autoSave.bind(this));
        
        // Temperature input auto-save
        const temperatureInput = document.getElementById('temperature');
        if (temperatureInput) {
            temperatureInput.addEventListener('input', this.autoSave.bind(this));
        }
        
        // Enhanced UI functionality
        this.bindEnhancedEvents();
    }
    
    handleProviderChange() {
        this.populateModelOptions();
        this.autoSave();
    }
    
    populateModelOptions(selectedModel = null) {
        const provider = document.getElementById('apiProvider').value;
        const modelSelect = document.getElementById('modelSelect');
        
        // Exit early if element doesn't exist (e.g., in tests)
        if (!modelSelect) return;
        
        // Clear existing options
        modelSelect.innerHTML = '<option value="">Select a model...</option>';
        
        // Get models for current provider
        const models = this.modelOptions[provider] || [];
        
        // Add model options
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            option.dataset.description = model.description;
            modelSelect.appendChild(option);
        });
        
        // Set the specified model, or default if none provided and none currently selected
        if (selectedModel) {
            modelSelect.value = selectedModel;
        } else {
            const currentModel = modelSelect.value;
            if (!currentModel && models.length > 0) {
                // Find recommended model or use first one
                const recommended = models.find(m => m.label.includes('Recommended'));
                modelSelect.value = recommended ? recommended.value : models[0].value;
            }
        }
        
        // Update help text
        this.updateModelHelp();
        
        // Add change listener to update help text
        modelSelect.addEventListener('change', this.updateModelHelp.bind(this));
    }
    
    updateModelHelp() {
        const modelSelect = document.getElementById('modelSelect');
        const modelHelp = document.getElementById('modelHelp');
        
        // Exit early if elements don't exist (e.g., in tests)
        if (!modelSelect || !modelHelp) return;
        
        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        
        if (selectedOption && selectedOption.dataset.description) {
            modelHelp.textContent = selectedOption.dataset.description;
            modelHelp.style.display = 'block';
        } else {
            modelHelp.style.display = 'none';
        }
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
        const modelSelect = document.getElementById('modelSelect');
        const temperatureInput = document.getElementById('temperature');
        return {
            apiProvider: document.getElementById('apiProvider').value,
            apiKey: document.getElementById('apiKey').value.trim(),
            model: modelSelect ? modelSelect.value : '',
            customPrompt: document.getElementById('customPrompt').value.trim(),
            temperature: temperatureInput ? parseFloat(temperatureInput.value) || 0.7 : 0.7
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
        
        // Load temperature setting
        const temperatureInput = document.getElementById('temperature');
        if (temperatureInput) {
            temperatureInput.value = settings.temperature || 0.7;
        }
        
        // Load custom prompt
        this.loadPromptIntoUI(settings.customPrompt || '');
        
        // Populate models with the saved model selection
        this.populateModelOptions(settings.model);
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
        
        // Migrate from old customPrompts to new customPrompt
        if (migrated.customPrompts && !migrated.customPrompt) {
            // Take the first available custom prompt or use default
            const providers = ['openai', 'anthropic', 'custom'];
            for (const provider of providers) {
                if (migrated.customPrompts[provider]) {
                    migrated.customPrompt = migrated.customPrompts[provider];
                    break;
                }
            }
            // Clean up old structure
            delete migrated.customPrompts;
            needsMigration = true;
        }
        
        // Ensure customPrompt exists
        if (!migrated.customPrompt) {
            migrated.customPrompt = '';
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
        
        // Ensure model field exists
        if (!migrated.model) {
            migrated.model = '';
            needsMigration = true;
        }
        
        // Ensure temperature field exists
        if (migrated.temperature === undefined) {
            migrated.temperature = 0.7;
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
            'mistral': 'Mistral AI'
        };
        return names[provider] || provider;
    }
    
    // Prompt Management Methods
    
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
            provider: this.getProviderDisplayName(document.getElementById('apiProvider').value),
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
        if (confirm('Reset prompt template to default?')) {
            document.getElementById('customPrompt').value = this.defaultPrompt;
            this.handlePromptInput({ target: { value: this.defaultPrompt } });
            this.autoSave();
        }
    }
    
    loadPromptIntoUI(customPrompt) {
        const promptValue = customPrompt || this.defaultPrompt;
        document.getElementById('customPrompt').value = promptValue;
        this.handlePromptInput({ target: { value: promptValue } });
    }
    
    // Enhanced Prompt Storage Methods
    async saveCustomPrompt(prompt) {
        try {
            if (!this.validatePrompt(prompt)) {
                throw new Error('Invalid prompt template');
            }
            
            const settings = await this.getStoredSettings();
            
            // Create backup before changing
            this.createPromptBackup('unified', settings.customPrompt);
            
            settings.customPrompt = prompt;
            await this.storeSettings(settings);
            
            return { success: true, message: 'Prompt saved successfully' };
        } catch (error) {
            console.error('Failed to save custom prompt:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getCustomPrompt() {
        try {
            const settings = await this.getStoredSettings();
            const customPrompt = settings.customPrompt;
            
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
    
    async savePrompt(prompt) {
        try {
            if (!this.validatePrompt(prompt)) {
                return { success: false, error: 'Invalid prompt template' };
            }
            
            const settings = await this.getStoredSettings();
            
            // Create backup for existing prompt
            this.createPromptBackup('unified', settings.customPrompt);
            
            // Save the prompt
            settings.customPrompt = prompt;
            await this.storeSettings(settings);
            
            return { success: true, message: 'Prompt saved successfully' };
        } catch (error) {
            console.error('Failed to save prompt:', error);
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
    
    async restorePromptFromBackup(timestamp) {
        try {
            const backups = await this.getPromptBackups();
            const backup = backups.find(b => b.timestamp === timestamp);
            
            if (!backup) {
                throw new Error('Backup not found');
            }
            
            const result = await this.saveCustomPrompt(backup.prompt);
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
                customPrompt: settings.customPrompt || '',
                metadata: {
                    hasCustomPrompt: !!(settings.customPrompt),
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
            const hasPrompt = !!(importData.customPrompt);
            const confirmMessage = hasPrompt ? 'Import custom prompt? This will overwrite your existing prompt template.' : 'No valid prompt found to import.';
            
            if (!hasPrompt || !confirm(confirmMessage)) {
                return;
            }
            
            // Perform import
            await this.performImport(importData);
            
            this.showStatusMessage('Successfully imported prompt template!', 'success');
            
            // Refresh UI to show imported prompt
            this.loadPromptIntoUI(importData.customPrompt);
            
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
        if (!data.customPrompt && !data.customPrompts) {
            result.isValid = false;
            result.message = 'No custom prompt found in file';
            return result;
        }
        
        // Check version compatibility
        if (data.version && !this.isVersionCompatible(data.version)) {
            result.isValid = false;
            result.message = `Incompatible file version: ${data.version}`;
            return result;
        }
        
        // Handle migration from old format
        if (data.customPrompts && !data.customPrompt) {
            // Use the first available prompt from old format
            const providers = ['openai', 'anthropic', 'custom'];
            for (const provider of providers) {
                if (data.customPrompts[provider]) {
                    data.customPrompt = data.customPrompts[provider];
                    break;
                }
            }
        }
        
        // Validate the prompt
        if (data.customPrompt) {
            if (typeof data.customPrompt !== 'string' || !data.customPrompt.trim()) {
                result.isValid = false;
                result.message = 'Invalid prompt template';
                return result;
            }
            
            // Use comprehensive validation
            const promptValidation = this.comprehensivePromptValidation(data.customPrompt);
            if (!promptValidation.isValid) {
                result.isValid = false;
                result.message = `Invalid prompt template: ${promptValidation.message}`;
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
        
        // Create backup for existing prompt before overwriting
        if (settings.customPrompt) {
            this.createPromptBackup('unified', settings.customPrompt);
        }
        
        // Import the prompt
        settings.customPrompt = importData.customPrompt || '';
        
        // Save updated settings
        await this.storeSettings(settings);
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