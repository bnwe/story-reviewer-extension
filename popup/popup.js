// Popup script for Azure DevOps Story Reviewer extension
// Handles UI interactions and displays extracted content

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const viewBtn = document.getElementById('viewBtn');
  const statusDiv = document.getElementById('status');
  const contentDiv = document.getElementById('extractedContent');

  // Initialize popup state
  initializePopup();

  // Event listeners
  extractBtn.addEventListener('click', extractContent);
  viewBtn.addEventListener('click', viewLastExtraction);

  function initializePopup() {
    // Check if we have stored extracted content
    browserAPI.storage.local.get(['extractedContent', 'extractionTimestamp'], (result) => {
      if (result.extractedContent && result.extractionTimestamp) {
        const timestamp = new Date(result.extractionTimestamp);
        const now = new Date();
        const minutesAgo = Math.floor((now - timestamp) / (1000 * 60));
        
        if (minutesAgo < 60) {
          viewBtn.disabled = false;
          updateStatus(`Last extraction: ${minutesAgo} minutes ago`);
        } else {
          updateStatus('No recent extractions found');
        }
      } else {
        updateStatus('Navigate to an Azure DevOps work item and click "Extract Story Content"');
      }
    });

    // Check current tab
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const isWorkItemPage = isAzureDevOpsWorkItem(tabs[0].url);
        extractBtn.disabled = !isWorkItemPage;
        
        if (!isWorkItemPage) {
          updateStatus('Please navigate to an Azure DevOps work item page');
        }
      }
    });
  }

  function extractContent() {
    updateStatus('Extracting content...');
    extractBtn.disabled = true;

    // Send message to content script to extract content
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browserAPI.tabs.sendMessage(tabs[0].id, { action: 'extractContent' }, (response) => {
        extractBtn.disabled = false;
        
        if (browserAPI.runtime.lastError) {
          updateStatus('Error: Could not communicate with the page. Please refresh and try again.');
          return;
        }

        if (response && response.success) {
          updateStatus('Content extracted successfully!');
          viewBtn.disabled = false;
          displayExtractedContent(response.content);
        } else {
          updateStatus('Failed to extract content. Please ensure you are on a work item page.');
        }
      });
    });
  }

  function viewLastExtraction() {
    browserAPI.storage.local.get(['extractedContent'], (result) => {
      if (result.extractedContent) {
        displayExtractedContent(result.extractedContent);
      } else {
        updateStatus('No extracted content found');
      }
    });
  }

  function displayExtractedContent(content) {
    const titleValue = document.getElementById('titleValue');
    const descriptionValue = document.getElementById('descriptionValue');
    const acValue = document.getElementById('acValue');

    // Use textContent for title (usually plain text)
    titleValue.textContent = content.title || '';
    
    // Use innerHTML for description and acceptance criteria to render HTML formatting
    descriptionValue.innerHTML = content.description || '';
    acValue.innerHTML = content.acceptanceCriteria || '';

    contentDiv.style.display = 'block';
    
    // Add validation feedback if available
    if (content.validation && content.validation.issues && content.validation.issues.length > 0) {
      updateStatus(`Content extracted with ${content.validation.issues.length} validation issues`);
    } else {
      updateStatus('Content extracted successfully');
    }
  }

  function updateStatus(message) {
    statusDiv.textContent = message;
  }

  function isAzureDevOpsWorkItem(url) {
    return (
      (url.includes('dev.azure.com') || url.includes('visualstudio.com')) &&
      (url.includes('_workitems') || url.includes('workitems'))
    );
  }
});