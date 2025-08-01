class OptionsManager {
    constructor() {
        this.defaultSettings = {
            apiProvider: 'openai',
            apiKey: '',
            customEndpoint: ''
        };
        
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
        
        apiProviderSelect.addEventListener('change', this.handleProviderChange.bind(this));
        toggleApiKeyBtn.addEventListener('click', this.toggleApiKeyVisibility.bind(this));
        testConnectionBtn.addEventListener('click', this.testConnection.bind(this));
        saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
        resetSettingsBtn.addEventListener('click', this.resetSettings.bind(this));
        
        // Auto-save on input changes
        apiKeyInput.addEventListener('input', this.autoSave.bind(this));
        customEndpointInput.addEventListener('input', this.autoSave.bind(this));
    }
    
    handleProviderChange() {
        const provider = document.getElementById('apiProvider').value;
        const customEndpointGroup = document.getElementById('customEndpointGroup');
        
        if (provider === 'custom') {
            customEndpointGroup.style.display = 'flex';
        } else {
            customEndpointGroup.style.display = 'none';
        }
        
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
            customEndpoint: document.getElementById('customEndpoint').value.trim()
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});