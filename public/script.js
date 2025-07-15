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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupUpload();
        this.loadStatus();
        this.updateStatus('Ready to connect', 'info');
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoVision = new PhotoVision();
});

// Expose for debugging
window.PhotoVision = PhotoVision;
