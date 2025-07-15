// PhotoVision Frontend JavaScript
// Handles chat interface and image upload functionality

class PhotoVision {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.messagesContainer = document.getElementById('messages');
        this.statusElement = document.getElementById('status');
        
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.analysisResult = document.getElementById('analysisResult');
        this.resultContent = document.getElementById('resultContent');
        
        // Connection dashboard elements
        this.claudeStatusCard = document.getElementById('claudeStatusCard');
        this.smugmugStatusCard = document.getElementById('smugmugStatusCard');
        this.lastCheckedElement = document.getElementById('lastChecked');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupUpload();
        this.initializeStatusDashboard();
        console.log('PhotoVision initialized');
    }

    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => {
            this.handleSendMessage();
        });

        // Enter key in input
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Input change handler for UI updates
        this.messageInput.addEventListener('input', () => {
            this.updateSendButtonState();
        });
    }

    setupUpload() {
        // File input change handler
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag and drop handlers
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('drag-over');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('drag-over');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });
    }

    async handleFileUpload(file) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
            return;
        }

        // Validate file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('File size must be less than 10MB.');
            return;
        }

        // Show progress
        this.showUploadProgress();
        this.hideAnalysisResult();

        try {
            // Create form data
            const formData = new FormData();
            formData.append('image', file);

            // Send to analysis API
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showAnalysisResult(data.data.analysis.description);
                this.loadStatus(); // Refresh status
                this.addComprehensiveAnalysisMessage(data.data);
            } else {
                this.addMessage(`Analysis failed: ${data.error}`, 'assistant');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.addMessage('Upload failed. Please try again.', 'assistant');
        } finally {
            this.hideUploadProgress();
        }
    }

    showUploadProgress() {
        this.uploadProgress.style.display = 'block';
        this.progressFill.style.width = '100%';
        this.progressText.textContent = 'Analyzing...';
    }

    hideUploadProgress() {
        this.uploadProgress.style.display = 'none';
        this.progressFill.style.width = '0%';
    }

    showAnalysisResult(analysis) {
        this.resultContent.textContent = analysis;
        this.analysisResult.style.display = 'block';
    }

    hideAnalysisResult() {
        this.analysisResult.style.display = 'none';
    }

    async loadStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (data.success) {
                this.updateStatus(`Ready • ${data.data.totalImages} images processed`, 'success');
            } else {
                this.updateStatus('Error loading status', 'error');
            }
        } catch (error) {
            console.error('Status loading error:', error);
            this.updateStatus('Connection error', 'error');
        }
    }

    handleSendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        this.updateSendButtonState();

        // Show typing indicator
        this.showTypingIndicator();

        // Process message with API
        this.processMessage(message);
    }

    async processMessage(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            const data = await response.json();
            
            this.hideTypingIndicator();
            
            if (data.success) {
                this.addMessage(data.data.message, 'assistant');
            } else {
                this.addMessage('Sorry, I encountered an error processing your request.', 'assistant');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I\'m having trouble connecting right now.', 'assistant');
        }
    }

    addMessage(content, type = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    addComprehensiveAnalysisMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Format file size
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // Format timestamp
        const formatTimestamp = (timestamp) => {
            return new Date(timestamp).toLocaleString();
        };

        // Create comprehensive message
        let messageHTML = `
            <div style="margin-bottom: 10px;">
                <strong>✅ Image Analysis Complete</strong>
            </div>
            <div style="margin-bottom: 8px;">
                <strong>📄 Filename:</strong> ${data.filename}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>🖼️ Image Type:</strong> ${data.mimeType}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>📏 File Size:</strong> ${formatFileSize(data.size)}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>🤖 AI Model:</strong> ${data.metadata.model}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>⏰ Analyzed:</strong> ${formatTimestamp(data.metadata.timestamp)}
            </div>
        `;

        // Add keywords if available
        if (data.analysis.keywords && data.analysis.keywords.length > 0) {
            messageHTML += `
                <div style="margin-bottom: 8px;">
                    <strong>🏷️ Keywords:</strong> ${data.analysis.keywords.map(keyword => `<span style="background-color: #e3f2fd; padding: 2px 6px; border-radius: 3px; margin-right: 4px; font-size: 0.9em;">${keyword}</span>`).join('')}
                </div>
            `;
        }

        // Add description
        messageHTML += `
            <div style="margin-top: 12px;">
                <strong>📝 Description:</strong>
                <div style="margin-top: 4px; padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-style: italic;">
                    ${data.analysis.description}
                </div>
            </div>
        `;

        contentDiv.innerHTML = messageHTML;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = '<span class="loading"></span> Thinking...';
        
        typingDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(typingDiv);
        
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateSendButtonState() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText;
    }

    updateStatus(message, type = 'info') {
        const statusText = this.statusElement.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = message;
            
            // Remove existing status classes
            this.statusElement.classList.remove('status-success', 'status-error', 'status-warning', 'status-info');
            
            // Add new status class
            this.statusElement.classList.add(`status-${type}`);
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    // Future method for API communication
    async sendAPIRequest(endpoint, data) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Future method for enabling functionality
    enableChat() {
        this.messageInput.disabled = false;
        this.updateSendButtonState();
        this.updateStatus('Connected and ready', 'success');
    }

    // Future method for disabling functionality
    disableChat() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.updateStatus('Disconnected', 'error');
    }

    async initializeStatusDashboard() {
        this.setupStatusEventListeners();
        await this.checkAllConnections();
    }

    setupStatusEventListeners() {
        // Refresh status button
        const refreshBtn = document.getElementById('refreshStatus');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.checkAllConnections();
            });
        }
        
        // Claude AI test button
        const testClaudeBtn = document.getElementById('testClaude');
        if (testClaudeBtn) {
            testClaudeBtn.addEventListener('click', () => {
                this.testClaudeConnection();
            });
        }
        
        // SmugMug connect button
        const connectBtn = document.getElementById('connectSmugmug');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectSmugMug();
            });
        }
        
        // SmugMug test button
        const testSmugmugBtn = document.getElementById('testSmugmug');
        if (testSmugmugBtn) {
            testSmugmugBtn.addEventListener('click', () => {
                this.testSmugMugConnection();
            });
        }
        
        // SmugMug disconnect button
        const disconnectBtn = document.getElementById('disconnectSmugmug');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnectSmugMug();
            });
        }
    }

    async checkAllConnections() {
        this.updateLastChecked();
        await Promise.all([
            this.checkClaudeStatus(),
            this.checkSmugMugStatus()
        ]);
    }

    async checkClaudeStatus() {
        this.updateServiceStatus('claude', 'checking', 'Testing connection...');
        
        try {
            const response = await fetch('/api/health/claude');
            const data = await response.json();
            
            if (data.success) {
                this.updateServiceStatus('claude', 'connected', 'Connected');
            } else {
                this.updateServiceStatus('claude', 'disconnected', 'Connection failed');
            }
        } catch (error) {
            console.error('Claude status check error:', error);
            this.updateServiceStatus('claude', 'disconnected', 'Connection error');
        }
    }

    async checkSmugMugStatus() {
        this.updateServiceStatus('smugmug', 'checking', 'Checking connection...');
        
        try {
            const response = await fetch('/api/smugmug/status');
            const data = await response.json();
            
            if (data.success && data.data.connected) {
                this.updateServiceStatus('smugmug', 'connected', 'Connected');
                this.showSmugMugAccountInfo(data.data.user);
                this.enableSmugMugControls(true);
            } else {
                this.updateServiceStatus('smugmug', 'disconnected', 'Not connected');
                this.hideSmugMugAccountInfo();
                this.enableSmugMugControls(false);
            }
        } catch (error) {
            console.error('SmugMug status check error:', error);
            this.updateServiceStatus('smugmug', 'disconnected', 'Connection error');
            this.enableSmugMugControls(false);
        }
    }

    updateServiceStatus(service, status, message) {
        const statusElement = document.getElementById(`${service}Status`);
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');
        
        if (indicator && text) {
            // Remove all status classes
            indicator.classList.remove('connected', 'disconnected', 'checking');
            // Add current status class
            indicator.classList.add(status);
            
            text.textContent = message;
        }
    }

    async testClaudeConnection() {
        this.addMessage('Testing Claude AI connection...', 'assistant');
        await this.checkClaudeStatus();
        
        const statusElement = document.getElementById('claudeStatus');
        const status = statusElement ? statusElement.querySelector('.status-text').textContent : 'Unknown';
        this.addMessage(`Claude AI test result: ${status}`, 'assistant');
    }

    async testSmugMugConnection() {
        this.addMessage('Testing SmugMug connection...', 'assistant');
        await this.checkSmugMugStatus();
        
        const statusElement = document.getElementById('smugmugStatus');
        const status = statusElement ? statusElement.querySelector('.status-text').textContent : 'Unknown';
        this.addMessage(`SmugMug test result: ${status}`, 'assistant');
    }

    async connectSmugMug() {
        this.addMessage('Initiating SmugMug connection...', 'assistant');
        
        try {
            const response = await fetch('/api/smugmug/auth-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    callbackUrl: `${window.location.origin}/api/smugmug/callback` 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addMessage('Opening SmugMug authentication window...', 'assistant');
                
                // Open OAuth window
                const authWindow = window.open(
                    data.data.authUrl, 
                    'smugmug-auth', 
                    'width=600,height=600,scrollbars=yes,resizable=yes'
                );
                
                // Monitor for completion
                this.monitorOAuthWindow(authWindow);
            } else {
                this.addMessage(`Failed to start SmugMug authentication: ${data.error}`, 'assistant');
            }
        } catch (error) {
            console.error('SmugMug connection error:', error);
            this.addMessage('Failed to initiate SmugMug connection. Please try again.', 'assistant');
        }
    }

    monitorOAuthWindow(authWindow) {
        const pollTimer = setInterval(() => {
            try {
                if (authWindow.closed) {
                    clearInterval(pollTimer);
                    this.addMessage('Authentication window closed. Checking connection status...', 'assistant');
                    // Recheck SmugMug status after window closes
                    setTimeout(() => {
                        this.checkSmugMugStatus();
                    }, 2000);
                }
            } catch (error) {
                // Cross-origin error means window is still open and on different domain
            }
        }, 1000);
    }

    async disconnectSmugMug() {
        this.addMessage('Disconnecting from SmugMug...', 'assistant');
        
        try {
            const response = await fetch('/api/smugmug/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addMessage('Successfully disconnected from SmugMug.', 'assistant');
                this.updateServiceStatus('smugmug', 'disconnected', 'Not connected');
                this.hideSmugMugAccountInfo();
                this.enableSmugMugControls(false);
            } else {
                this.addMessage(`Failed to disconnect from SmugMug: ${data.error}`, 'assistant');
            }
        } catch (error) {
            console.error('SmugMug disconnect error:', error);
            this.addMessage('Failed to disconnect from SmugMug. Please try again.', 'assistant');
        }
    }

    enableSmugMugControls(connected) {
        const connectBtn = document.getElementById('connectSmugmug');
        const testBtn = document.getElementById('testSmugmug');
        const disconnectBtn = document.getElementById('disconnectSmugmug');
        
        if (connectBtn) connectBtn.disabled = connected;
        if (testBtn) testBtn.disabled = !connected;
        if (disconnectBtn) disconnectBtn.disabled = !connected;
    }

    showSmugMugAccountInfo(user) {
        const accountInfo = document.getElementById('smugmugAccountInfo');
        const accountDetails = document.getElementById('accountDetails');
        
        if (accountInfo && accountDetails && user) {
            accountDetails.innerHTML = `
                <strong>User:</strong> ${user.NickName || user.Name || 'Unknown'}<br>
                <strong>Account:</strong> ${user.AccountStatus || 'Active'}
            `;
            
            accountInfo.style.display = 'block';
        }
    }

    hideSmugMugAccountInfo() {
        const accountInfo = document.getElementById('smugmugAccountInfo');
        if (accountInfo) {
            accountInfo.style.display = 'none';
        }
    }

    updateLastChecked() {
        if (this.lastCheckedElement) {
            this.lastCheckedElement.textContent = new Date().toLocaleTimeString();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoVision = new PhotoVision();
});

// Expose for debugging
window.PhotoVision = PhotoVision;
