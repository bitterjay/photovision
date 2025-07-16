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
        this.initializeThemeSystem();
        this.initializeTabSystem();
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
                // Check if this is a conversational search response with results
                if (data.data.response && data.data.results !== undefined) {
                    this.addConversationalSearchMessage(data.data);
                } else {
                    // Fallback to simple message
                    this.addMessage(data.data.message || data.data.response, 'assistant');
                }
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

    addConversationalSearchMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Start with the conversational response
        let messageHTML = `
            <div class="conversational-response" style="padding: 8px; background-color: #f0f8ff; border-radius: 6px; border-left: 4px solid #2196f3;">
                ${data.response}
            </div>
        `;

        // Add search results if available
        if (data.results && data.results.length > 0) {
            messageHTML += `
                <div class="search-results-section">
                    <div class="results-header">
                        <strong>🔍 Search Results (${data.results.length} photos found):</strong>
                    </div>
                    <div class="minimal-results-grid">
            `;

            data.results.forEach((photo, index) => {
                const photoId = `photo-${Date.now()}-${index}`;
                
                messageHTML += `
                    <div class="minimal-result-card">
                        ${photo.smugmugUrl ? `
                            <img src="${photo.smugmugUrl}" 
                                 alt="${photo.description || photo.filename || 'Image'}" 
                                 class="card-image"
                                 loading="lazy"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display: none; height: 120px; background: #f8f9fa; align-items: center; justify-content: center; color: #666; font-size: 0.9em;">
                                <span>⚠️ Image unavailable</span>
                            </div>
                        ` : `
                            <div style="height: 120px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.9em;">
                                <span>📷 No image available</span>
                            </div>
                        `}
                        <div class="card-actions">
                            <button class="card-btn info-btn" onclick="window.photoVision.showMetadataModal('${photoId}')">
                                ℹ️ Details
                            </button>
                            ${photo.smugmugUrl ? `
                                <a href="${photo.smugmugUrl}" target="_blank" class="card-btn smugmug-btn">
                                    📸 View
                                </a>
                            ` : `
                                <span class="card-btn" style="background: #e9ecef; color: #6c757d; cursor: not-allowed;">
                                    📸 No Link
                                </span>
                            `}
                        </div>
                    </div>
                `;
                
                // Store photo data for modal
                this.storePhotoData(photoId, photo);
            });

            messageHTML += `
                    </div>
                </div>
            `;
        } else if (data.results && data.results.length === 0) {
            messageHTML += `
                <div class="no-results-section">
                    <div class="no-results-message">
                        <strong>🔍 No photos found</strong> matching your search criteria.
                    </div>
                </div>
            `;
        }

        contentDiv.innerHTML = messageHTML;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    storePhotoData(photoId, photo) {
        if (!this.photoDataStore) {
            this.photoDataStore = new Map();
        }
        this.photoDataStore.set(photoId, photo);
    }

    showMetadataModal(photoId) {
        const photo = this.photoDataStore?.get(photoId);
        if (!photo) {
            console.error('Photo data not found for ID:', photoId);
            return;
        }

        // Create modal HTML
        const modalHTML = `
            <div class="metadata-modal" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${photo.filename || 'Image Details'}</h3>
                        <button class="modal-close" onclick="this.closest('.metadata-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="metadata-section">
                            <h4>📄 File Information</h4>
                            <div class="metadata-content">
                                <div class="metadata-row">
                                    <span class="metadata-label">Filename:</span>
                                    <span class="metadata-value">${photo.filename || 'Unknown'}</span>
                                </div>
                                ${photo.size ? `
                                    <div class="metadata-row">
                                        <span class="metadata-label">File Size:</span>
                                        <span class="metadata-value">${this.formatFileSize(photo.size)}</span>
                                    </div>
                                ` : ''}
                                ${photo.mimeType ? `
                                    <div class="metadata-row">
                                        <span class="metadata-label">Type:</span>
                                        <span class="metadata-value">${photo.mimeType}</span>
                                    </div>
                                ` : ''}
                                ${photo.uploadedAt || photo.timestamp ? `
                                    <div class="metadata-row">
                                        <span class="metadata-label">Date:</span>
                                        <span class="metadata-value">${new Date(photo.uploadedAt || photo.timestamp).toLocaleString()}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        ${photo.description ? `
                            <div class="metadata-section">
                                <h4>🤖 AI Analysis</h4>
                                <div class="metadata-content">
                                    <div class="description-text">${photo.description}</div>
                                    ${photo.metadata?.model || photo.analysis?.model ? `
                                        <div class="metadata-row" style="margin-top: 8px;">
                                            <span class="metadata-label">Model:</span>
                                            <span class="metadata-value">${photo.metadata?.model || photo.analysis?.model}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}

                        ${photo.keywords && photo.keywords.length > 0 ? `
                            <div class="metadata-section">
                                <h4>🏷️ Keywords</h4>
                                <div class="metadata-content">
                                    <div class="keywords-list">
                                        ${photo.keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        ${photo.smugmugUrl || photo.albumKey ? `
                            <div class="metadata-section">
                                <h4>🔗 SmugMug Information</h4>
                                <div class="metadata-content">
                                    ${photo.smugmugUrl ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Image URL:</span>
                                            <span class="metadata-value">
                                                <a href="${photo.smugmugUrl}" target="_blank" style="color: #007bff; text-decoration: none;">
                                                    View Full Image →
                                                </a>
                                            </span>
                                        </div>
                                    ` : ''}
                                    ${photo.albumPath || photo.albumName || photo.albumKey ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Album Path:</span>
                                            <span class="metadata-value" style="font-weight: 500; color: #2c3e50;">
                                                ${photo.albumPath || photo.albumName || photo.albumKey}
                                            </span>
                                        </div>
                                    ` : ''}
                                    ${photo.albumName && photo.albumPath && photo.albumName !== photo.albumPath ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Album Name:</span>
                                            <span class="metadata-value">${photo.albumName}</span>
                                        </div>
                                    ` : ''}
                                    ${photo.smugmugImageKey ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Image Key:</span>
                                            <span class="metadata-value">${photo.smugmugImageKey}</span>
                                        </div>
                                    ` : ''}
                                    ${photo.albumKey ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Album ID:</span>
                                            <span class="metadata-value" style="font-family: monospace; font-size: 0.9em; color: #666;">${photo.albumKey}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}

                        ${photo.metadata || photo.analysis ? `
                            <div class="metadata-section">
                                <h4>📊 Technical Details</h4>
                                <div class="metadata-content">
                                    ${photo.metadata?.timestamp ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Analyzed:</span>
                                            <span class="metadata-value">${new Date(photo.metadata.timestamp).toLocaleString()}</span>
                                        </div>
                                    ` : ''}
                                    ${photo.metadata?.batchId ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Batch ID:</span>
                                            <span class="metadata-value">${photo.metadata.batchId}</span>
                                        </div>
                                    ` : ''}
                                    ${photo.id ? `
                                        <div class="metadata-row">
                                            <span class="metadata-label">Record ID:</span>
                                            <span class="metadata-value">${photo.id}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        this.setupBatchProcessingEventListeners();
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
                // Enable chat interface when Claude AI is connected
                this.enableChat();
            } else {
                this.updateServiceStatus('claude', 'disconnected', 'Connection failed');
                // Disable chat interface when Claude AI is not connected
                this.disableChat();
            }
        } catch (error) {
            console.error('Claude status check error:', error);
            this.updateServiceStatus('claude', 'disconnected', 'Connection error');
            // Disable chat interface on connection error
            this.disableChat();
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
                this.showBatchProcessingSection();
            } else {
                this.updateServiceStatus('smugmug', 'disconnected', 'Not connected');
                this.hideSmugMugAccountInfo();
                this.enableSmugMugControls(false);
                this.hideBatchProcessingSection();
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

    // Batch Processing Methods
    setupBatchProcessingEventListeners() {
        // Refresh albums button
        const refreshAlbumsBtn = document.getElementById('refreshAlbums');
        if (refreshAlbumsBtn) {
            refreshAlbumsBtn.addEventListener('click', () => {
                this.loadAlbums();
            });
        }

        // Refresh processing status button
        const refreshProcessingBtn = document.getElementById('refreshProcessingStatus');
        if (refreshProcessingBtn) {
            refreshProcessingBtn.addEventListener('click', () => {
                this.refreshAlbumProcessingStatuses();
            });
        }

        // Batch control buttons
        const startBatchBtn = document.getElementById('startBatch');
        if (startBatchBtn) {
            startBatchBtn.addEventListener('click', () => {
                this.startBatchProcessing();
            });
        }

        const pauseBatchBtn = document.getElementById('pauseBatch');
        if (pauseBatchBtn) {
            pauseBatchBtn.addEventListener('click', () => {
                this.pauseBatchProcessing();
            });
        }

        const resumeBatchBtn = document.getElementById('resumeBatch');
        if (resumeBatchBtn) {
            resumeBatchBtn.addEventListener('click', () => {
                this.resumeBatchProcessing();
            });
        }

        const cancelBatchBtn = document.getElementById('cancelBatch');
        if (cancelBatchBtn) {
            cancelBatchBtn.addEventListener('click', () => {
                this.cancelBatchProcessing();
            });
        }

        const retryFailedBtn = document.getElementById('retryFailed');
        if (retryFailedBtn) {
            retryFailedBtn.addEventListener('click', () => {
                this.retryFailedJobs();
            });
        }

        const clearResultsBtn = document.getElementById('clearResults');
        if (clearResultsBtn) {
            clearResultsBtn.addEventListener('click', () => {
                this.clearBatchResults();
            });
        }

        // Initialize batch processing state
        this.batchProgressInterval = null;
        this.selectedAlbumKey = null;
    }

    async loadAlbums() {
        const albumsList = document.getElementById('albumsList');
        const albumCount = document.getElementById('albumCount');
        
        if (!albumsList) return;

        albumsList.innerHTML = '<div class="loading-albums"><span class="loading"></span> Loading albums...</div>';
        albumCount.textContent = 'Loading...';

        try {
            const response = await fetch('/api/smugmug/albums');
            const data = await response.json();

            if (data.success && data.data.albums) {
                const albums = data.data.albums;
                albumCount.textContent = `${albums.length} albums`;

                if (albums.length === 0) {
                    albumsList.innerHTML = '<div class="no-albums">No albums found in your SmugMug account.</div>';
                    return;
                }

                // Load processing status for each album
                await this.loadAlbumsWithProcessingStatus(albums, albumsList);

            } else {
                albumsList.innerHTML = '<div class="error-message">Failed to load albums. Please check your SmugMug connection.</div>';
                albumCount.textContent = 'Error';
            }
        } catch (error) {
            console.error('Error loading albums:', error);
            albumsList.innerHTML = '<div class="error-message">Error loading albums. Please try again.</div>';
            albumCount.textContent = 'Error';
        }
    }

    async loadAlbumsWithProcessingStatus(albums, albumsList) {
        // Render albums list with hierarchy and placeholder for processing status
        albumsList.innerHTML = albums.map(album => {
            // Generate hierarchical display elements
            const indentLevel = album.IndentLevel || 0;
            const pathTags = album.PathTags || [];
            const displayPath = album.FullDisplayPath || album.Name || 'Untitled Album';
            
            // Create path tags HTML
            const pathTagsHtml = pathTags.length > 0 ? 
                pathTags.map(tag => `<span class="path-tag">${this.escapeHtml(tag)}</span>`).join('') : 
                '<span class="path-tag root-tag">Root</span>';

            // Create indentation indicator
            const indentIndicator = indentLevel > 0 ? 
                '├─ '.repeat(Math.min(indentLevel, 3)) : '';

            return `
                <div class="album-item indent-level-${indentLevel}" data-album-key="${album.AlbumKey}">
                    <div class="album-info">
                        <div class="album-header-section">
                            <div class="album-indent">${indentIndicator}</div>
                            <div class="album-name">${album.Name || 'Untitled Album'}</div>
                        </div>
                        <div class="album-path-info">
                            <div class="album-full-path">
                                <span class="path-label">📁</span>
                                <span class="path-text">${this.escapeHtml(displayPath)}</span>
                            </div>
                            <div class="album-path-tags">
                                <span class="tags-label">🏷️</span>
                                ${pathTagsHtml}
                            </div>
                        </div>
                        <div class="album-details">
                            <span class="image-count">${album.ImageCount || 0} images</span>
                            ${album.Description ? `<span class="album-description">${this.escapeHtml(album.Description)}</span>` : ''}
                        </div>
                        <div class="album-processing-status" id="processing-status-${album.AlbumKey}">
                            <span class="loading-status">Checking processing status...</span>
                        </div>
                    </div>
                    <button class="select-album-btn" data-album-key="${album.AlbumKey}">Select</button>
                </div>
            `;
        }).join('');

        // Add click handlers for album selection
        albumsList.querySelectorAll('.select-album-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const albumKey = e.target.dataset.albumKey;
                this.selectAlbum(albumKey);
            });
        });

        // Load processing status for each album (in batches to avoid overwhelming the server)
        const batchSize = 3;
        for (let i = 0; i < albums.length; i += batchSize) {
            const batch = albums.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(album => this.loadAlbumProcessingStatus(album.AlbumKey))
            );
            // Small delay between batches
            if (i + batchSize < albums.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadAlbumProcessingStatus(albumKey) {
        try {
            const response = await fetch(`/api/smugmug/album/${albumKey}/processing-status`);
            const data = await response.json();

            const statusElement = document.getElementById(`processing-status-${albumKey}`);
            if (!statusElement) return;

            if (data.success) {
                const status = data.data;
                this.displayAlbumProcessingStatus(statusElement, status);
            } else {
                statusElement.innerHTML = '<span class="status-error">Unable to check processing status</span>';
            }
        } catch (error) {
            console.error(`Error loading processing status for album ${albumKey}:`, error);
            const statusElement = document.getElementById(`processing-status-${albumKey}`);
            if (statusElement) {
                statusElement.innerHTML = '<span class="status-error">Error checking status</span>';
            }
        }
    }

    displayAlbumProcessingStatus(statusElement, status) {
        const { totalImages, processedImages, processingProgress, isCompletelyProcessed } = status;

        if (totalImages === 0) {
            statusElement.innerHTML = '<span class="status-empty">No images in album</span>';
            return;
        }

        const newImages = totalImages - processedImages;
        const duplicateInfo = status.duplicateStatistics || {};
        const duplicateDetectionEnabled = status.duplicateDetectionEnabled || false;

        let statusHTML = '';
        
        if (isCompletelyProcessed) {
            statusHTML = `
                <div class="processing-complete">
                    <span class="status-icon">✅</span>
                    <span class="status-text">All ${totalImages} images processed</span>
                    ${duplicateDetectionEnabled ? `
                        <div class="duplicate-info">
                            <small>Duplicate detection: Active</small>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (processedImages === 0) {
            statusHTML = `
                <div class="processing-none">
                    <span class="status-icon">⏳</span>
                    <span class="status-text">0 processed, ${totalImages} new images</span>
                    ${duplicateDetectionEnabled ? `
                        <div class="duplicate-info">
                            <small>Ready for duplicate-aware processing</small>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            statusHTML = `
                <div class="processing-partial">
                    <span class="status-icon">🔄</span>
                    <span class="status-text">${processedImages} processed, ${newImages} new images (${processingProgress}%)</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${processingProgress}%"></div>
                    </div>
                    ${duplicateDetectionEnabled ? `
                        <div class="duplicate-info">
                            <small>Duplicate detection: ${duplicateInfo.skippedDuplicates || 0} duplicates detected</small>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        statusElement.innerHTML = statusHTML;
    }

    selectAlbum(albumKey) {
        // Remove previous selection
        document.querySelectorAll('.album-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked album
        const albumItem = document.querySelector(`[data-album-key="${albumKey}"]`);
        if (albumItem) {
            albumItem.classList.add('selected');
        }

        this.selectedAlbumKey = albumKey;

        // Enable start button
        const startBtn = document.getElementById('startBatch');
        if (startBtn) {
            startBtn.disabled = false;
        }

        // Update batch name if empty
        const batchNameInput = document.getElementById('batchName');
        const albumName = albumItem?.querySelector('.album-name')?.textContent;
        if (batchNameInput && !batchNameInput.value && albumName) {
            batchNameInput.value = albumName;
        }

        // Load and display duplicate statistics for selected album
        this.loadDuplicateStatistics(albumKey);
    }

    async loadDuplicateStatistics(albumKey) {
        const statisticsSection = document.getElementById('duplicateStatistics');
        const refreshStatsBtn = document.getElementById('refreshStats');
        
        if (!statisticsSection) return;

        // Show loading state
        statisticsSection.style.display = 'block';
        this.updateDuplicateStatistics({
            totalImages: 0,
            processedImages: 0,
            newImages: 0,
            duplicates: 0
        }, 'Loading duplicate statistics...');

        try {
            const response = await fetch(`/api/smugmug/album/${albumKey}/processing-status`);
            const data = await response.json();

            if (data.success) {
                const status = data.data;
                const stats = status.imageBreakdown || {};
                
                // Display comprehensive duplicate statistics
                this.updateDuplicateStatistics(stats, null, status);
                
                // Update processing recommendation
                this.updateProcessingRecommendation(status.processingRecommendation);
                
            } else {
                this.updateDuplicateStatistics({
                    totalImages: 0,
                    processedImages: 0,
                    newImages: 0,
                    duplicates: 0
                }, 'Unable to load duplicate statistics');
            }
        } catch (error) {
            console.error('Error loading duplicate statistics:', error);
            this.updateDuplicateStatistics({
                totalImages: 0,
                processedImages: 0,
                newImages: 0,
                duplicates: 0
            }, 'Error loading duplicate statistics');
        }
    }

    updateDuplicateStatistics(stats, errorMessage = null, fullStatus = null) {
        const totalImagesCount = document.getElementById('totalImagesCount');
        const processedImagesCount = document.getElementById('processedImagesCount');
        const newImagesCount = document.getElementById('newImagesCount');
        const duplicatesCount = document.getElementById('duplicatesCount');

        if (errorMessage) {
            // Show error state
            [totalImagesCount, processedImagesCount, newImagesCount, duplicatesCount].forEach(el => {
                if (el) el.textContent = '—';
            });
            
            const recommendationText = document.getElementById('recommendationText');
            if (recommendationText) {
                recommendationText.textContent = errorMessage;
            }
            return;
        }

        // Update statistics display
        if (totalImagesCount) totalImagesCount.textContent = stats.totalImages || 0;
        if (processedImagesCount) processedImagesCount.textContent = stats.processedImages || 0;
        if (newImagesCount) newImagesCount.textContent = stats.newImages || 0;
        if (duplicatesCount) duplicatesCount.textContent = stats.duplicates || 0;

        // Update duplicate handling settings based on statistics
        if (fullStatus && fullStatus.duplicateStatistics) {
            const duplicateHandlingSelect = document.getElementById('duplicateHandling');
            const forceReprocessingCheckbox = document.getElementById('forceReprocessing');
            
            // Set recommended duplicate handling
            if (duplicateHandlingSelect && fullStatus.processingRecommendation) {
                const suggestion = fullStatus.processingRecommendation.duplicateHandlingSuggestion;
                if (suggestion && ['skip', 'update', 'replace'].includes(suggestion)) {
                    duplicateHandlingSelect.value = suggestion;
                }
            }
            
            // Set recommended processing mode
            if (forceReprocessingCheckbox && fullStatus.processingRecommendation) {
                const suggestedMode = fullStatus.processingRecommendation.suggestedMode;
                forceReprocessingCheckbox.checked = suggestedMode === 'force_reprocessing';
            }
        }
    }

    updateProcessingRecommendation(recommendation) {
        const recommendationText = document.getElementById('recommendationText');
        const recommendationMode = document.getElementById('recommendationMode');
        
        if (!recommendation) return;

        if (recommendationText) {
            let message = recommendation.reason || 'No specific recommendation available';
            
            // Add estimated time if available
            if (recommendation.estimatedTime && recommendation.estimatedTime > 0) {
                message += ` (Est. ${recommendation.estimatedTime} min)`;
            }
            
            recommendationText.textContent = message;
            
            // Style based on recommendation
            if (recommendation.shouldProcess) {
                recommendationText.className = 'recommendation-text should-process';
            } else {
                recommendationText.className = 'recommendation-text fully-processed';
            }
        }

        if (recommendationMode) {
            const mode = recommendation.suggestedMode || 'normal';
            const modeDescription = mode === 'force_reprocessing' ? 
                'Force reprocessing recommended' : 
                'Normal processing recommended';
            
            recommendationMode.textContent = modeDescription;
            recommendationMode.className = `recommendation-mode ${mode}`;
        }
    }

    async startBatchProcessing() {
        if (!this.selectedAlbumKey) {
            this.addMessage('Please select an album first.', 'assistant');
            return;
        }

        const maxImages = parseInt(document.getElementById('maxImages').value) || 50;
        const batchName = document.getElementById('batchName').value || `Album ${this.selectedAlbumKey}`;

        // Debug logging
        console.log('=== BATCH START DEBUG ===');
        console.log('Selected Album Key:', this.selectedAlbumKey);
        console.log('Max Images:', maxImages);
        console.log('Batch Name:', batchName);

        const requestData = {
            albumKey: this.selectedAlbumKey,
            maxImages: maxImages,
            batchName: batchName
        };
        
        console.log('Request Data:', JSON.stringify(requestData, null, 2));
        console.log('========================');

        this.addMessage(`Starting batch processing for ${batchName} (max ${maxImages} images)...`, 'assistant');

        try {
            const response = await fetch('/api/batch/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                this.addMessage(`Batch processing started! Processing ${data.data.jobCount} images.`, 'assistant');
                this.showBatchProgress();
                this.updateBatchControls('processing');
                this.startProgressMonitoring();
            } else {
                this.addMessage(`Failed to start batch processing: ${data.error}`, 'assistant');
                console.error('Batch start failed:', data);
            }
        } catch (error) {
            console.error('Error starting batch processing:', error);
            this.addMessage('Error starting batch processing. Please try again.', 'assistant');
        }
    }

    async pauseBatchProcessing() {
        try {
            const response = await fetch('/api/batch/pause', { method: 'POST' });
            const data = await response.json();

            if (data.success && data.data.paused) {
                this.addMessage('Batch processing paused.', 'assistant');
                this.updateBatchControls('paused');
            } else {
                this.addMessage('No active batch to pause.', 'assistant');
            }
        } catch (error) {
            console.error('Error pausing batch:', error);
            this.addMessage('Error pausing batch processing.', 'assistant');
        }
    }

    async resumeBatchProcessing() {
        try {
            const response = await fetch('/api/batch/resume', { method: 'POST' });
            const data = await response.json();

            if (data.success && data.data.resumed) {
                this.addMessage('Batch processing resumed.', 'assistant');
                this.updateBatchControls('processing');
            } else {
                this.addMessage('No batch to resume.', 'assistant');
            }
        } catch (error) {
            console.error('Error resuming batch:', error);
            this.addMessage('Error resuming batch processing.', 'assistant');
        }
    }

    async cancelBatchProcessing() {
        try {
            const response = await fetch('/api/batch/cancel', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                this.addMessage('Batch processing cancelled.', 'assistant');
                this.updateBatchControls('idle');
                this.stopProgressMonitoring();
                this.hideBatchProgress();
            } else {
                this.addMessage('Error cancelling batch processing.', 'assistant');
            }
        } catch (error) {
            console.error('Error cancelling batch:', error);
            this.addMessage('Error cancelling batch processing.', 'assistant');
        }
    }

    async retryFailedJobs() {
        try {
            const response = await fetch('/api/batch/retry', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                this.addMessage(`Retrying ${data.data.retriedJobs || 0} failed jobs.`, 'assistant');
                if (data.data.retriedJobs > 0) {
                    this.updateBatchControls('processing');
                }
            } else {
                this.addMessage('No failed jobs to retry.', 'assistant');
            }
        } catch (error) {
            console.error('Error retrying failed jobs:', error);
            this.addMessage('Error retrying failed jobs.', 'assistant');
        }
    }

    showBatchProgress() {
        const progressSection = document.getElementById('batchProgress');
        if (progressSection) {
            progressSection.style.display = 'block';
        }
    }

    hideBatchProgress() {
        const progressSection = document.getElementById('batchProgress');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
    }

    updateBatchControls(state) {
        const startBtn = document.getElementById('startBatch');
        const pauseBtn = document.getElementById('pauseBatch');
        const resumeBtn = document.getElementById('resumeBatch');
        const cancelBtn = document.getElementById('cancelBatch');
        const retryBtn = document.getElementById('retryFailed');

        // Reset all buttons
        [startBtn, pauseBtn, resumeBtn, cancelBtn, retryBtn].forEach(btn => {
            if (btn) btn.disabled = true;
        });

        switch (state) {
            case 'idle':
                if (startBtn && this.selectedAlbumKey) startBtn.disabled = false;
                break;
            case 'processing':
                if (pauseBtn) pauseBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                break;
            case 'paused':
                if (resumeBtn) resumeBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                break;
            case 'completed':
                if (startBtn && this.selectedAlbumKey) startBtn.disabled = false;
                if (retryBtn) retryBtn.disabled = false;
                break;
        }
    }

    startProgressMonitoring() {
        if (this.batchProgressInterval) {
            clearInterval(this.batchProgressInterval);
        }

        this.batchProgressInterval = setInterval(async () => {
            await this.updateBatchProgress();
        }, 2000); // Update every 2 seconds
    }

    stopProgressMonitoring() {
        if (this.batchProgressInterval) {
            clearInterval(this.batchProgressInterval);
            this.batchProgressInterval = null;
        }
    }

    async updateBatchProgress() {
        try {
            const response = await fetch('/api/batch/status');
            const data = await response.json();

            if (data.success) {
                const status = data.data;
                this.displayBatchStatus(status);

                // Check if batch is complete
                if (status.isComplete) {
                    this.stopProgressMonitoring();
                    this.updateBatchControls('completed');
                    this.showBatchResults(status);
                    this.addMessage(`Batch processing completed! Processed: ${status.processed}, Failed: ${status.failed}`, 'assistant');
                    
                    // Refresh album processing status for the processed album
                    if (this.selectedAlbumKey) {
                        await this.loadAlbumProcessingStatus(this.selectedAlbumKey);
                    }
                } else if (status.isPaused) {
                    this.updateBatchControls('paused');
                }
            }
        } catch (error) {
            console.error('Error updating batch progress:', error);
        }
    }

    displayBatchStatus(status) {
        // Update progress bar
        const progressFill = document.getElementById('batchProgressFill');
        const progressPercentage = document.getElementById('progressPercentage');
        if (progressFill && progressPercentage) {
            const percentage = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
            progressFill.style.width = `${percentage}%`;
            progressPercentage.textContent = `${percentage}%`;
        }

        // Update counters
        const processedCount = document.getElementById('processedCount');
        const totalCount = document.getElementById('totalCount');
        const failedCount = document.getElementById('failedCount');
        const remainingCount = document.getElementById('remainingCount');

        if (processedCount) processedCount.textContent = status.processed || 0;
        if (totalCount) totalCount.textContent = status.total || 0;
        if (failedCount) failedCount.textContent = status.failed || 0;
        if (remainingCount) remainingCount.textContent = (status.total - status.processed) || 0;

        // Update status
        const batchStatus = document.getElementById('batchStatus');
        if (batchStatus) {
            if (status.isComplete) {
                batchStatus.textContent = 'Completed';
                batchStatus.className = 'batch-status completed';
            } else if (status.isPaused) {
                batchStatus.textContent = 'Paused';
                batchStatus.className = 'batch-status paused';
            } else if (status.isProcessing) {
                batchStatus.textContent = 'Processing';
                batchStatus.className = 'batch-status processing';
            } else {
                batchStatus.textContent = 'Idle';
                batchStatus.className = 'batch-status idle';
            }
        }

        // Update current job
        const currentJobName = document.getElementById('currentJobName');
        if (currentJobName) {
            if (status.currentJob) {
                currentJobName.textContent = status.currentJob.imageName || 'Processing...';
            } else if (status.isComplete) {
                currentJobName.textContent = 'All jobs completed';
            } else {
                currentJobName.textContent = 'Waiting...';
            }
        }
    }

    showBatchResults(status) {
        const resultsSection = document.getElementById('batchResults');
        const resultsSummary = document.getElementById('resultsSummary');
        const failedJobs = document.getElementById('failedJobs');
        const failedList = document.getElementById('failedList');

        if (!resultsSection || !resultsSummary) return;

        // Show results section
        resultsSection.style.display = 'block';

        // Update summary
        resultsSummary.innerHTML = `
            <div class="summary-stats">
                <div class="summary-stat success">
                    <span class="stat-number">${status.processed - (status.failed || 0)}</span>
                    <span class="stat-label">Successful</span>
                </div>
                <div class="summary-stat failed">
                    <span class="stat-number">${status.failed || 0}</span>
                    <span class="stat-label">Failed</span>
                </div>
                <div class="summary-stat total">
                    <span class="stat-number">${status.total || 0}</span>
                    <span class="stat-label">Total</span>
                </div>
            </div>
        `;

        // Show failed jobs if any
        if (status.failed > 0 && status.failedJobs && failedJobs && failedList) {
            failedJobs.style.display = 'block';
            failedList.innerHTML = status.failedJobs.map(job => `
                <div class="failed-job">
                    <span class="job-name">${job.imageName || job.id}</span>
                    <span class="job-error">${job.error || 'Unknown error'}</span>
                </div>
            `).join('');
        } else if (failedJobs) {
            failedJobs.style.display = 'none';
        }
    }

    clearBatchResults() {
        const resultsSection = document.getElementById('batchResults');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    }

    async refreshAlbumProcessingStatuses() {
        // Refresh processing status for all visible albums
        const albumItems = document.querySelectorAll('.album-item[data-album-key]');
        
        for (const albumItem of albumItems) {
            const albumKey = albumItem.dataset.albumKey;
            if (albumKey) {
                await this.loadAlbumProcessingStatus(albumKey);
            }
        }
    }

    showBatchProcessingSection() {
        const section = document.getElementById('batchProcessingSection');
        if (section) {
            section.style.display = 'block';
            this.loadAlbums();
        }
    }

    hideBatchProcessingSection() {
        const section = document.getElementById('batchProcessingSection');
        if (section) {
            section.style.display = 'none';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoVision = new PhotoVision();
});

// Expose for debugging
window.PhotoVision = PhotoVision;

// Admin Tools functionality
document.addEventListener('DOMContentLoaded', function() {
    const toggleAdminTools = document.getElementById('toggleAdminTools');
    const adminControls = document.getElementById('adminControls');
    const destroyAllDataBtn = document.getElementById('destroyAllData');
    const recordCountElement = document.getElementById('recordCount');
    const destructionStatus = document.getElementById('destructionStatus');
    const destructionMessage = document.getElementById('destructionMessage');
    const backupInfo = document.getElementById('backupInfo');
    const backupFilename = document.getElementById('backupFilename');

    // Duplicate detection elements
    const analyzeDuplicatesBtn = document.getElementById('analyzeDuplicates');
    const refreshDuplicateInfoBtn = document.getElementById('refreshDuplicateInfo');
    const dryRunCleanupBtn = document.getElementById('dryRunCleanup');
    const executeCleanupBtn = document.getElementById('executeCleanup');
    const rollbackCleanupBtn = document.getElementById('rollbackCleanup');
    const refreshBackupsBtn = document.getElementById('refreshBackups');
    const confirmCleanupCheckbox = document.getElementById('confirmCleanup');
    const duplicateAnalysisSection = document.getElementById('duplicateAnalysis');
    const cleanupResultsSection = document.getElementById('cleanupResults');

    // Toggle admin controls visibility
    if (toggleAdminTools && adminControls) {
        toggleAdminTools.addEventListener('click', function() {
            const isHidden = adminControls.style.display === 'none';
            adminControls.style.display = isHidden ? 'block' : 'none';
            toggleAdminTools.textContent = isHidden ? 'Hide' : 'Show';
            
            // Load record count when showing
            if (isHidden) {
                loadRecordCount();
            }
        });
    }

    // Load record count
    async function loadRecordCount() {
        try {
            const response = await fetch('/api/data/count');
            const data = await response.json();
            recordCountElement.textContent = data.data?.count || 0;
        } catch (error) {
            console.error('Error loading record count:', error);
            recordCountElement.textContent = 'Error';
        }
    }

    // Destroy all data button
    if (destroyAllDataBtn) {
        destroyAllDataBtn.addEventListener('click', async function() {
            // Double confirmation for safety
            const firstConfirm = confirm('⚠️ WARNING: This will permanently delete ALL image data!\n\nThis action cannot be undone. Are you sure you want to continue?');
            
            if (!firstConfirm) return;
            
            const secondConfirm = confirm('🗑️ FINAL WARNING: This will destroy all processed image data and create a backup.\n\nType "DELETE" in the next prompt to confirm.');
            
            if (!secondConfirm) return;
            
            const finalConfirm = prompt('Type "DELETE" to confirm data destruction:');
            
            if (finalConfirm !== 'DELETE') {
                alert('Action cancelled. Data was not destroyed.');
                return;
            }

            // Disable button and show loading state
            destroyAllDataBtn.disabled = true;
            destroyAllDataBtn.textContent = 'Destroying Data...';
            
            try {
                const response = await fetch('/api/admin/destroy-all-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                if (response.ok) {
                    // Show success status
                    destructionStatus.style.display = 'block';
                    destructionStatus.className = 'destruction-status success';
                    destructionMessage.textContent = result.message || 'All image data has been successfully destroyed.';
                    
                    if (result.backupFile) {
                        backupInfo.style.display = 'block';
                        backupFilename.textContent = result.backupFile;
                    }
                    
                    // Update record count
                    recordCountElement.textContent = '0';
                    
                } else {
                    // Show error status
                    destructionStatus.style.display = 'block';
                    destructionStatus.className = 'destruction-status error';
                    destructionMessage.textContent = result.error || 'Failed to destroy data.';
                }

            } catch (error) {
                console.error('Error destroying data:', error);
                destructionStatus.style.display = 'block';
                destructionStatus.className = 'destruction-status error';
                destructionMessage.textContent = 'Network error occurred while destroying data.';
            } finally {
                // Re-enable button
                destroyAllDataBtn.disabled = false;
                destroyAllDataBtn.textContent = 'Destroy All Image Data';
            }
        });
    }

    // Auto-hide destruction status after 10 seconds
    if (destructionStatus) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (destructionStatus.style.display === 'block') {
                        setTimeout(() => {
                            destructionStatus.style.display = 'none';
                            backupInfo.style.display = 'none';
                        }, 10000); // Hide after 10 seconds
                    }
                }
            });
        });
        
        observer.observe(destructionStatus, { attributes: true });
    }

    // ===== DUPLICATE DETECTION EVENT LISTENERS =====
    
    // Analyze duplicates button
    if (analyzeDuplicatesBtn) {
        analyzeDuplicatesBtn.addEventListener('click', async function() {
            await analyzeDuplicates();
        });
    }

    // Refresh duplicate info button
    if (refreshDuplicateInfoBtn) {
        refreshDuplicateInfoBtn.addEventListener('click', async function() {
            await refreshDuplicateInfo();
        });
    }

    // Dry run cleanup button
    if (dryRunCleanupBtn) {
        dryRunCleanupBtn.addEventListener('click', async function() {
            await performDryRunCleanup();
        });
    }

    // Execute cleanup button
    if (executeCleanupBtn) {
        executeCleanupBtn.addEventListener('click', async function() {
            await executeCleanup();
        });
    }

    // Rollback cleanup button
    if (rollbackCleanupBtn) {
        rollbackCleanupBtn.addEventListener('click', async function() {
            await rollbackCleanup();
        });
    }

    // Refresh backups button
    if (refreshBackupsBtn) {
        refreshBackupsBtn.addEventListener('click', async function() {
            await refreshBackups();
        });
    }

    // Clear cleanup results button
    const clearCleanupResultsBtn = document.getElementById('clearCleanupResults');
    if (clearCleanupResultsBtn) {
        clearCleanupResultsBtn.addEventListener('click', function() {
            clearCleanupResults();
        });
    }

    // Confirm cleanup checkbox - enables/disables execute button
    if (confirmCleanupCheckbox) {
        confirmCleanupCheckbox.addEventListener('change', function() {
            if (executeCleanupBtn) {
                executeCleanupBtn.disabled = !this.checked;
            }
        });
    }

    // ===== DUPLICATE DETECTION FUNCTIONS =====

    async function analyzeDuplicates() {
        // Disable button and show loading
        analyzeDuplicatesBtn.disabled = true;
        analyzeDuplicatesBtn.textContent = '🔍 Analyzing...';
        
        // Hide previous results
        duplicateAnalysisSection.style.display = 'none';
        cleanupResultsSection.style.display = 'none';

        try {
            const response = await fetch('/api/admin/duplicates/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                displayAnalysisResults(result.data);
                duplicateAnalysisSection.style.display = 'block';
            } else {
                alert(`Analysis failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error analyzing duplicates:', error);
            alert('Network error occurred while analyzing duplicates.');
        } finally {
            // Re-enable button
            analyzeDuplicatesBtn.disabled = false;
            analyzeDuplicatesBtn.textContent = '🔍 Analyze Duplicates';
        }
    }

    async function refreshDuplicateInfo() {
        try {
            const response = await fetch('/api/admin/duplicates/utility');
            const result = await response.json();

            if (response.ok && result.success) {
                // Update any utility information displays
                console.log('Duplicate utility info refreshed:', result.data);
            } else {
                console.error('Failed to refresh duplicate info:', result.error);
            }
        } catch (error) {
            console.error('Error refreshing duplicate info:', error);
        }
    }

    async function performDryRunCleanup() {
        // Disable button and show loading
        dryRunCleanupBtn.disabled = true;
        dryRunCleanupBtn.textContent = '🧪 Running Dry Run...';

        try {
            const response = await fetch('/api/admin/duplicates/cleanup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    dryRun: true 
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                displayCleanupResults(result.data, true);
                cleanupResultsSection.style.display = 'block';
            } else {
                alert(`Dry run failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error performing dry run:', error);
            alert('Network error occurred during dry run.');
        } finally {
            // Re-enable button
            dryRunCleanupBtn.disabled = false;
            dryRunCleanupBtn.textContent = '🧪 Dry Run';
        }
    }

    async function executeCleanup() {
        // Double confirmation for safety
        const confirmExecution = confirm('⚠️ WARNING: This will permanently remove duplicate records!\\n\\nThis action cannot be undone without a rollback. Are you sure you want to continue?');
        
        if (!confirmExecution) return;

        // Disable button and show loading
        executeCleanupBtn.disabled = true;
        executeCleanupBtn.textContent = '🧹 Executing Cleanup...';

        try {
            const response = await fetch('/api/admin/duplicates/cleanup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    dryRun: false 
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                displayCleanupResults(result.data, false);
                cleanupResultsSection.style.display = 'block';
                
                // Show backup info if available
                if (result.data.backupFile) {
                    showBackupInfo(result.data.backupFile);
                }
                
                // Refresh backups list
                await refreshBackups();
                
                // Update record count
                loadRecordCount();
            } else {
                alert(`Cleanup execution failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error executing cleanup:', error);
            alert('Network error occurred during cleanup execution.');
        } finally {
            // Re-enable button
            executeCleanupBtn.disabled = false;
            executeCleanupBtn.textContent = '🧹 Execute Cleanup';
            
            // Reset confirmation checkbox
            if (confirmCleanupCheckbox) {
                confirmCleanupCheckbox.checked = false;
            }
        }
    }

    async function rollbackCleanup() {
        // Get the backup file path (you might want to implement a backup selection UI)
        const backupPath = prompt('Enter the backup file path to rollback to:');
        
        if (!backupPath) return;

        // Disable button and show loading
        rollbackCleanupBtn.disabled = true;
        rollbackCleanupBtn.textContent = '🔄 Rolling Back...';

        try {
            const response = await fetch('/api/admin/duplicates/rollback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    backupPath: backupPath 
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                displayRollbackResults(result.data);
                alert('Rollback completed successfully!');
                
                // Refresh displays
                await refreshDuplicateInfo();
                loadRecordCount();
            } else {
                alert(`Rollback failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error performing rollback:', error);
            alert('Network error occurred during rollback.');
        } finally {
            // Re-enable button
            rollbackCleanupBtn.disabled = false;
            rollbackCleanupBtn.textContent = '🔄 Rollback';
        }
    }

    async function refreshBackups() {
        const backupList = document.getElementById('backupList');
        if (!backupList) return;

        backupList.innerHTML = '<div class="loading-backups">Loading backups...</div>';

        try {
            const response = await fetch('/api/admin/duplicates/backups');
            const result = await response.json();

            if (response.ok && result.success) {
                displayBackupsList(result.data.backups);
            } else {
                backupList.innerHTML = '<div class="error-message">Failed to load backups</div>';
            }
        } catch (error) {
            console.error('Error refreshing backups:', error);
            backupList.innerHTML = '<div class="error-message">Error loading backups</div>';
        }
    }

    // ===== DISPLAY FUNCTIONS =====

    function displayAnalysisResults(data) {
        // Update analysis timestamp
        const analysisTimestamp = document.getElementById('analysisTimestamp');
        if (analysisTimestamp) {
            analysisTimestamp.textContent = new Date().toLocaleString();
        }

        // Update statistics
        const totalImagesAnalyzed = document.getElementById('totalImagesAnalyzed');
        const duplicateGroupsFound = document.getElementById('duplicateGroupsFound');
        const recordsToRemove = document.getElementById('recordsToRemove');
        const cleanDataSize = document.getElementById('cleanDataSize');

        if (totalImagesAnalyzed) totalImagesAnalyzed.textContent = data.totalImages || 0;
        if (duplicateGroupsFound) duplicateGroupsFound.textContent = data.duplicateGroups || 0;
        if (recordsToRemove) recordsToRemove.textContent = data.recordsToRemove || 0;
        if (cleanDataSize) cleanDataSize.textContent = data.finalCleanSize || 0;

        // Update recommendations
        const recommendationList = document.getElementById('recommendationList');
        if (recommendationList && data.recommendations) {
            recommendationList.innerHTML = data.recommendations.map(rec => `<li>${rec}</li>`).join('');
        }

        // Enable dry run button
        if (dryRunCleanupBtn) {
            dryRunCleanupBtn.disabled = false;
        }
    }

    function displayCleanupResults(data, isDryRun) {
        const cleanupResultsContent = document.getElementById('cleanupResultsContent');
        if (!cleanupResultsContent) return;

        const resultType = isDryRun ? 'Dry Run' : 'Cleanup Execution';
        
        cleanupResultsContent.innerHTML = `
            <div class="${isDryRun ? 'dry-run' : 'cleanup'}-summary">
                <h6>${resultType} Results</h6>
                <p><strong>Total Images Processed:</strong> ${data.totalProcessed || 0}</p>
                <p><strong>Records ${isDryRun ? 'Would Be' : ''} Removed:</strong> ${data.recordsRemoved || 0}</p>
                <p><strong>Final Clean Size:</strong> ${data.finalCleanSize || 0}</p>
                ${data.processingTime ? `<p><strong>Processing Time:</strong> ${data.processingTime}ms</p>` : ''}
                ${data.backupFile && !isDryRun ? `<p><strong>Backup Created:</strong> ${data.backupFile}</p>` : ''}
            </div>
        `;

        // Enable execute button after successful dry run
        if (isDryRun && executeCleanupBtn) {
            executeCleanupBtn.disabled = false;
        }
    }

    function displayRollbackResults(data) {
        const cleanupResultsContent = document.getElementById('cleanupResultsContent');
        if (!cleanupResultsContent) return;

        cleanupResultsContent.innerHTML = `
            <div class="rollback-summary">
                <h6>Rollback Results</h6>
                <p><strong>Records Restored:</strong> ${data.recordsRestored || 0}</p>
                <p><strong>Backup File Used:</strong> ${data.backupFile || 'Unknown'}</p>
                ${data.processingTime ? `<p><strong>Processing Time:</strong> ${data.processingTime}ms</p>` : ''}
            </div>
        `;
    }

    function displayBackupsList(backups) {
        const backupList = document.getElementById('backupList');
        if (!backupList) return;

        if (!backups || backups.length === 0) {
            backupList.innerHTML = '<div class="no-backups">No backups found</div>';
            return;
        }

        backupList.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <div class="backup-filename">${backup.filename}</div>
                    <div class="backup-timestamp">${new Date(backup.timestamp).toLocaleString()}</div>
                </div>
                <button class="backup-action-btn" onclick="selectBackupForRollback('${backup.path}')">
                    Select for Rollback
                </button>
            </div>
        `).join('');
    }

    function showBackupInfo(backupFile) {
        const cleanupBackupInfo = document.getElementById('cleanupBackupInfo');
        const cleanupBackupPath = document.getElementById('cleanupBackupPath');
        
        if (cleanupBackupInfo && cleanupBackupPath) {
            cleanupBackupPath.textContent = backupFile;
            cleanupBackupInfo.style.display = 'block';
        }
    }

    function clearCleanupResults() {
        if (cleanupResultsSection) {
            cleanupResultsSection.style.display = 'none';
        }
        
        const cleanupBackupInfo = document.getElementById('cleanupBackupInfo');
        if (cleanupBackupInfo) {
            cleanupBackupInfo.style.display = 'none';
        }
    }

    // Helper function for backup selection
    window.selectBackupForRollback = function(backupPath) {
        if (rollbackCleanupBtn) {
            rollbackCleanupBtn.dataset.backupPath = backupPath;
            rollbackCleanupBtn.disabled = false;
            rollbackCleanupBtn.textContent = '🔄 Rollback to Selected';
        }
    };

    // Initialize duplicate detection on page load
    refreshBackups();
});
