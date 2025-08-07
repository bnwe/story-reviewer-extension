// Popup script for Azure DevOps Story Reviewer extension
// Handles UI interactions and displays extracted content

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const feedbackBtn = document.getElementById('feedbackBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusDiv = document.getElementById('status');
  const helpSection = document.getElementById('helpSection');
  let moreInfoLink = null;

  // Initialize popup state
  initializePopup();

  // Event listeners
  feedbackBtn.addEventListener('click', getFeedback);
  settingsBtn.addEventListener('click', openSettings);

  function initializePopup() {
    // Check current tab
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const isWorkItemPage = isAzureDevOpsWorkItem(tabs[0].url);
        feedbackBtn.disabled = !isWorkItemPage;
        
        if (!isWorkItemPage) {
          updateStatusWithMoreInfo('Please navigate to a valid Azure DevOps work item URL. ');
        } else {
          updateStatus('Click "Get Feedback" to receive feedback on your Story (opens a new window).');
        }
      }
    });
  }

  function getFeedback() {
    updateStatus('Opening feedback window...');
    feedbackBtn.disabled = true;

    // Send message to content script to open feedback window
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browserAPI.tabs.sendMessage(tabs[0].id, { action: 'openFeedbackWindow' }, (response) => {
        feedbackBtn.disabled = false;
        
        if (browserAPI.runtime.lastError) {
          updateStatus('Error: Could not communicate with the page. Please refresh and try again.');
          return;
        }

        if (response && response.success) {
          updateStatus('Feedback window opened successfully!');
          // Close popup after successful operation
          window.close();
        } else {
          updateStatus('Failed to open feedback window. Please ensure you are on a work item page.');
        }
      });
    });
  }


  function updateStatus(message) {
    statusDiv.textContent = message;
  }

  function updateStatusWithMoreInfo(message) {
    statusDiv.innerHTML = '';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    
    moreInfoLink = document.createElement('a');
    moreInfoLink.textContent = 'More Info';
    moreInfoLink.href = '#';
    moreInfoLink.className = 'more-info-link';
    moreInfoLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleHelpSection();
    });
    
    statusDiv.appendChild(textSpan);
    statusDiv.appendChild(moreInfoLink);
  }

  function toggleHelpSection() {
    const isVisible = helpSection.style.display !== 'none';
    
    if (isVisible) {
      helpSection.style.display = 'none';
      if (moreInfoLink) moreInfoLink.textContent = 'More Info';
    } else {
      helpSection.style.display = 'block';
      if (moreInfoLink) moreInfoLink.textContent = 'Less Info';
    }
  }

  function isAzureDevOpsWorkItem(url) {
    return (
      (url.includes('dev.azure.com') || url.includes('visualstudio.com')) &&
      (url.includes('_workitems') || url.includes('workitems'))
    );
  }

  function openSettings() {
    // Open the extension's options page
    browserAPI.runtime.openOptionsPage();
  }
});