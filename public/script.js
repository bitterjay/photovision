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
        
        // Image selection state management
        this.albumImageSelections = new Map(); // Map<albumKey, Set<excludedImageKeys>>
        this.analysisResult = document.getElementById('analysisResult');
        this.resultContent = document.getElementById('resultContent');
        
        // Starred images state
        this.starredImages = new Set();
        this.starredImagesLoaded = false;
        
        // Search mode state
        this.searchMode = 'smart'; // Default mode
        this.searchOptions = {
            mode: 'smart',
            semanticExpansion: true,
            partialMatches: false,
            requireAllTerms: false,
            searchFields: ['keywords', 'description', 'title', 'caption', 'album'],
            minScore: 0
        };
        
        // Connection dashboard elements
        this.claudeStatusCard = document.getElementById('claudeStatusCard');
        this.smugmugStatusCard = document.getElementById('smugmugStatusCard');
        this.lastCheckedElement = document.getElementById('lastChecked');
        
        // Album filter state
        this.albumsData = [];
        this.filteredAlbums = [];
        this.filterState = {
            search: '',
            status: 'all',
            level: 'all',
            sort: 'date-desc'
        };
        
        // Pagination state
        this.paginationState = {
            currentPage: 1,
            pageSize: 12,
            totalAlbums: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            isLoading: false
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupUpload();
        this.initializeStatusDashboard();
        this.initializeThemeSystem();
        this.initializeTabSystem();
        this.initializeSubTabSystem();
        this.initializeImageLoading();
        this.initializeSearchControls();
        this.loadStarredImages();
        console.log('PhotoVision initialized');
    }

    initializeThemeSystem() {
        // Initialize theme system
        const themeToggle = document.getElementById('themeToggle');
        const themeButtons = themeToggle?.querySelectorAll('.theme-btn');
        
        if (!themeButtons) return;

        // Load saved theme or default to auto
        const savedTheme = localStorage.getItem('photovision-theme') || 'auto';
        this.setTheme(savedTheme);

        // Add click handlers for theme buttons
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.setTheme(theme);
                localStorage.setItem('photovision-theme', theme);
            });
        });

        // Listen for system theme changes when in auto mode
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.applyTheme('auto');
                }
            });
        }
    }

    setTheme(theme) {
        this.currentTheme = theme;
        
        // Update button states
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        // Apply theme
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
    }

    initializeTabSystem() {
        // Initialize tab system
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        if (!tabButtons.length || !tabPanels.length) return;

        // Load saved active tab or default to chat
        const savedTab = localStorage.getItem('photovision-active-tab') || 'chat';
        this.setActiveTab(savedTab);

        // Add click handlers for tab buttons
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.setActiveTab(tabId);
                localStorage.setItem('photovision-active-tab', tabId);
            });
        });
    }

    initializeSubTabSystem() {
        // Initialize sub-tab system for dashboard
        const subTabButtons = document.querySelectorAll('.sub-tab-btn');
        const subTabPanels = document.querySelectorAll('.sub-tab-panel');
        
        if (!subTabButtons.length || !subTabPanels.length) return;

        // Load saved active sub-tab or default to system-status
        const savedSubTab = localStorage.getItem('photovision-dashboard-subtab') || 'system-status';
        this.setActiveSubTab(savedSubTab);

        // Add click handlers for sub-tab buttons
        subTabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const subTabId = btn.dataset.subtab;
                this.setActiveSubTab(subTabId);
                localStorage.setItem('photovision-dashboard-subtab', subTabId);
            });
        });
    }

    setActiveSubTab(subTabId) {
        // Update button states
        const subTabButtons = document.querySelectorAll('.sub-tab-btn');
        subTabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === subTabId);
        });

        // Update panel visibility
        const subTabPanels = document.querySelectorAll('.sub-tab-panel');
        subTabPanels.forEach(panel => {
            // Match panel IDs: systemStatusSubTab -> system-status, imageAnalysisSubTab -> image-analysis, dataSubTab -> data
            let shouldShow = false;
            if (subTabId === 'system-status' && panel.id === 'systemStatusSubTab') shouldShow = true;
            if (subTabId === 'image-analysis' && panel.id === 'imageAnalysisSubTab') shouldShow = true;
            if (subTabId === 'data' && panel.id === 'dataSubTab') shouldShow = true;
            
            panel.classList.toggle('active', shouldShow);
        });
    }

    initializeImageLoading() {
        // Initialize enhanced image loading
        console.log('Initializing enhanced image loading...');
        
        // Initialize intersection observer for lazy loading
        initEnhancedLazyLoading();
        
        // Re-initialize image loading after content updates
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if new images were added
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const newImages = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
                            if (newImages.length > 0 && window.initEnhancedLazyLoading) {
                                // Re-initialize lazy loading for new images
                                setTimeout(() => initEnhancedLazyLoading(), 100);
                            }
                        }
                    });
                }
            });
        });
        
        // Observe the results container for dynamic content
        const resultsContainer = document.querySelector('.minimal-results-grid');
        if (resultsContainer) {
            observer.observe(resultsContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    setActiveTab(tabId) {
        // Update button states
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update panel visibility
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => {
            const panelId = panel.id.replace('Tab', '');
            panel.classList.toggle('active', panelId === tabId);
        });

        // Load content for specific tabs when they become active
        if (tabId === 'batch') {
            this.loadAlbums();
        } else if (tabId === 'dashboard') {
            this.checkAllConnections();
        } else if (tabId === 'starred') {
            this.loadStarredTab();
        }
    }

    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => {
            this.handleSendMessage();
        });
        
        // Setup infinite scroll for albums
        this.setupInfiniteScroll();

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
        
        // Event delegation for load more buttons
        this.messagesContainer.addEventListener('click', (e) => {
            if (e.target.matches('.load-more-btn') || e.target.closest('.load-more-btn')) {
                const button = e.target.matches('.load-more-btn') ? e.target : e.target.closest('.load-more-btn');
                const query = button.dataset.query;
                const page = parseInt(button.dataset.page);
                
                if (query !== undefined && page) {
                    this.handleLoadMoreClick(button, query, page);
                }
            }
        });
        
        // Keyboard support for load more buttons
        this.messagesContainer.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && 
                (e.target.matches('.load-more-btn') || e.target.closest('.load-more-btn'))) {
                e.preventDefault();
                const button = e.target.matches('.load-more-btn') ? e.target : e.target.closest('.load-more-btn');
                const query = button.dataset.query;
                const page = parseInt(button.dataset.page);
                
                if (query !== undefined && page) {
                    this.handleLoadMoreClick(button, query, page);
                }
            }
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

    async handleSendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input and update button state
        this.messageInput.value = '';
        this.updateSendButtonState();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    message,
                    searchOptions: this.getSearchOptions()
                })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            if (data.success && data.data) {
                // Handle conversational search response
                this.addConversationalSearchMessage(data.data);
            } else {
                // Handle error message
                const errorMessage = data.error || 'Sorry, I encountered an error processing your request.';
                this.addMessage(errorMessage, 'assistant');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Show error message
            this.addMessage('Error: Unable to send message. Please check your connection and try again.', 'assistant');
        }
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

    addMessage(content, type = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        // Remove welcome message on first user message
        if (type === 'user') {
            this.removeWelcomeMessage();
        }
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    removeWelcomeMessage() {
        const welcomeMessage = document.querySelector('.message.system');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
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
            <div class="conversational-response" style="padding: 8px;">
                ${data.response}
            </div>
        `;

        // Add search results if available
        if (data.results && data.results.length > 0) {
            const pagination = data.pagination || {};
            const showingText = pagination.total ? 
                `Showing ${pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.total}` : 
                `${data.results.length} photos found`;
            
            messageHTML += `
                <div class="search-results-section" data-search-query="${data.originalQuery || ''}" data-current-page="${pagination.page || 0}">
                    <div class="results-header">
                        <strong>🔍 Search Results (${showingText}):</strong>
                    </div>
                    <div class="minimal-results-grid">
            `;

            data.results.forEach((photo, index) => {
                const photoId = `photo-${Date.now()}-${index}`;
                
                messageHTML += `
                    <div class="minimal-result-card">
                        ${createImageContainer(photo, photoId)}
                        <div class="card-actions">
                            <button class="card-btn info-btn" onclick="window.photoVision.showMetadataModal('${photoId}')">
                                Details
                            </button>
                            ${photo.smugmugUrl ? `
                                <a href="${photo.smugmugUrl}" target="_blank" class="card-btn download-btn" download>
                                    Download
                                </a>
                            ` : `
                                <span class="card-btn" style="background: #e9ecef; color: #6c757d; cursor: not-allowed;">
                                    No Link
                                </span>
                            `}
                        </div>
                    </div>
                `;
                
                // Store photo data for modal and lightbox
                this.storePhotoData(photoId, photo);
            });

            messageHTML += `
                    </div>
            `;
            
            // Add load more button if there are more results
            if (pagination.hasMore) {
                messageHTML += `
                    <div class="load-more-section" style="text-align: center; padding: 15px;">
                        <button class="load-more-btn" data-query="${data.originalQuery || ''}" data-page="${(pagination.page || 0) + 1}" aria-label="Load more results" tabindex="0">
                            <svg class="load-more-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 13l3 3 7-7"></path>
                                <path d="M12 3v12"></path>
                                <path d="M8 21h8"></path>
                            </svg>
                            Load More Results (${pagination.total - pagination.endIndex} remaining)
                        </button>
                    </div>
                `;
            }
            
            // Add search action buttons
            const searchContext = {
                query: data.originalQuery || '',
                options: data.searchOptions || this.getSearchOptions()
            };
            
            messageHTML += `
                <div class="search-actions-section">
                    <button class="search-action-btn repeat-btn" onclick="window.photoVision.refineSearch('${encodeURIComponent(JSON.stringify(searchContext))}', 'repeat')">
                        🔄 Search Again
                    </button>
                    <button class="search-action-btn broaden-btn" onclick="window.photoVision.refineSearch('${encodeURIComponent(JSON.stringify(searchContext))}', 'broaden')">
                        🔍+ Broaden Search
                    </button>
                    <button class="search-action-btn narrow-btn" onclick="window.photoVision.refineSearch('${encodeURIComponent(JSON.stringify(searchContext))}', 'narrow')">
                        🎯 Narrow Search
                    </button>
                </div>
            `;
            
            messageHTML += `
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
            
            // Add search action buttons for no results
            const searchContext = {
                query: data.originalQuery || '',
                options: data.searchOptions || this.getSearchOptions()
            };
            
            messageHTML += `
                <div class="search-actions-section">
                    <button class="search-action-btn broaden-btn" onclick="window.photoVision.refineSearch('${encodeURIComponent(JSON.stringify(searchContext))}', 'broaden')">
                        🔍+ Try Broader Search
                    </button>
                </div>
            `;
        }

        contentDiv.innerHTML = messageHTML;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        // Add click handlers for lightbox after content is added
        this.addLightboxHandlers(contentDiv, data.results);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    storePhotoData(photoId, photo) {
        if (!this.photoDataStore) {
            this.photoDataStore = new Map();
        }
        this.photoDataStore.set(photoId, photo);
    }

    handleLoadMoreClick(button, query, page) {
        // Set loading state
        this.setLoadMoreLoadingState(button, true);
        
        // Remove the button since we're creating a new chat window
        button.remove();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Call the actual load more function
        this.loadMoreResults(query, page);
    }
    
    setLoadMoreLoadingState(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
            
            // Replace icon with spinner
            const icon = button.querySelector('.load-more-btn-icon');
            if (icon) {
                icon.innerHTML = '<div class="load-more-spinner"></div>';
            }
            
            // Update text
            const textContent = button.childNodes;
            for (let node of textContent) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    node.textContent = 'Loading...';
                    break;
                }
            }
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            
            // Restore icon
            const icon = button.querySelector('.load-more-btn-icon');
            if (icon) {
                icon.innerHTML = `
                    <path d="M7 13l3 3 7-7"></path>
                    <path d="M12 3v12"></path>
                    <path d="M8 21h8"></path>
                `;
            }
        }
    }

    async loadMoreResults(query, page) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: query,
                    page: page
                }),
            });

            const data = await response.json();

            if (data.success && data.data.results && data.data.results.length > 0) {
                // Hide typing indicator
                this.hideTypingIndicator();
                
                // Create a new chat message with the additional results
                const moreResultsData = {
                    response: `Here are more results for "${query}":`,
                    results: data.data.results,
                    pagination: data.data.pagination,
                    originalQuery: query
                };
                
                this.addConversationalSearchMessage(moreResultsData);
            } else {
                // Hide typing indicator
                this.hideTypingIndicator();
                
                // No more results - add a simple message
                this.addMessage('No more results found.', 'assistant');
            }
        } catch (error) {
            console.error('Error loading more results:', error);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            this.addMessage('Error loading more results. Please try again.', 'assistant');
        }
    }

    /*
    appendSearchResults(searchSection, data) {
        const resultsGrid = searchSection.querySelector('.minimal-results-grid');
        const loadMoreSection = searchSection.querySelector('.load-more-section');
        
        if (!resultsGrid) return;

        // Generate HTML for new results
        let newResultsHTML = '';
        data.results.forEach((photo, index) => {
            const photoId = `photo-${Date.now()}-${index}`;
            
            newResultsHTML += `
                <div class="minimal-result-card">
                    ${createImageContainer(photo, photoId)}
                    <div class="card-actions">
                        <button class="card-btn info-btn" onclick="window.photoVision.showMetadataModal('${photoId}')">
                            Details
                        </button>
                        ${photo.smugmugUrl ? `
                            <a href="${photo.smugmugUrl}" target="_blank" class="card-btn download-btn" download>
                                Download
                            </a>
                        ` : `
                            <span class="card-btn" style="background: #e9ecef; color: #6c757d; cursor: not-allowed;">
                                No Link
                            </span>
                        `}
                    </div>
                </div>
            `;
            
            // Store photo data for modal and lightbox
            this.storePhotoData(photoId, photo);
        });

        // Insert new results before the load more section
        if (loadMoreSection) {
            loadMoreSection.insertAdjacentHTML('beforebegin', newResultsHTML);
        } else {
            resultsGrid.insertAdjacentHTML('beforeend', newResultsHTML);
        }

        // Update the lightbox handlers for new images
        const newImages = resultsGrid.querySelectorAll('.card-image[data-photo-id]');
        const allResults = [...(this.currentSearchResults || []), ...data.results];
        this.currentSearchResults = allResults; // Store for lightbox
        
        // Add lightbox handlers for new images
        const newImageElements = Array.from(newImages).slice(-data.results.length);
        newImageElements.forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                const photoId = img.dataset.photoId;
                const startIndex = Array.from(newImages).indexOf(img);
                this.openLightbox(allResults, startIndex);
            });
        });

        // Update or remove load more button
        if (loadMoreSection) {
            const pagination = data.pagination || {};
            if (pagination.hasMore) {
                const remainingCount = pagination.total - pagination.endIndex;
                loadMoreSection.innerHTML = `
                    <button class="load-more-btn" data-query="${data.originalQuery || ''}" data-page="${(pagination.page || 0) + 1}" aria-label="Load more results" tabindex="0">
                        <svg class="load-more-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M7 13l3 3 7-7"></path>
                            <path d="M12 3v12"></path>
                            <path d="M8 21h8"></path>
                        </svg>
                        Load More Results (${remainingCount} remaining)
                    </button>
                `;
            } else {
                loadMoreSection.remove();
            }
        }

        // Update search section attributes
        if (data.pagination) {
            searchSection.setAttribute('data-current-page', data.pagination.page || 0);
        }
    }
    */

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

    addLightboxHandlers(contentDiv, results) {
        if (!results || results.length === 0) return;
        
        const images = contentDiv.querySelectorAll('.card-image[data-photo-id]');
        images.forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                const photoId = img.dataset.photoId;
                const startIndex = Array.from(images).indexOf(img);
                this.openLightbox(results, startIndex);
            });
        });
    }

    openLightbox(results, startIndex = 0, albumPreviewContext = null) {
        // Filter results to only include those with images
        const validResults = results.filter(result => result.smugmugUrl);
        
        if (validResults.length === 0) {
            console.warn('No valid images to display in lightbox');
            return;
        }
        
        // Store album preview context for potential return
        this.albumPreviewContext = albumPreviewContext;
        
        // Adjust start index for filtered results
        const adjustedStartIndex = Math.min(startIndex, validResults.length - 1);
        
        // Create lightbox HTML
        const lightboxHTML = `
            <div id="imageLightbox" class="image-modal">
                <div class="modal-overlay"></div>
                <div class="modal-container">
                    ${albumPreviewContext ? `
                        <button class="back-to-grid-btn" id="backToGrid" title="Back to album grid">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            <span>Back to Grid</span>
                        </button>
                    ` : ''}
                    <button class="modal-close" id="closeLightbox">&times;</button>
                    <div class="swiper-container" id="lightboxSwiper">
                        <div class="swiper-wrapper">
                            ${validResults.map((result, index) => `
                                <div class="swiper-slide">
                                    <div class="slide-image">
                                        <img src="${result.smugmugUrl}" 
                                             alt="${result.description || result.filename || 'Image'}" 
                                             loading="lazy"
                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                        <div class="image-error" style="display: none;">
                                            <span>⚠️ Image failed to load</span>
                                        </div>
                                    </div>
                                    <div class="slide-metadata">
                                        <div class="slide-metadata-header">
                                            <div class="slide-metadata-title">${result.originalFilename || result.filename || 'Image'}</div>
                                            <div class="slide-metadata-counter">${index + 1} / ${validResults.length}</div>
                                        </div>
                                        <div class="slide-metadata-content">
                                            ${this.generateMetadataHTML(result)}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="swiper-pagination"></div>
                        <div class="swiper-button-next"></div>
                        <div class="swiper-button-prev"></div>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', lightboxHTML);
        
        // Initialize Swiper
        this.initializeLightboxSwiper(validResults, adjustedStartIndex);
        
        // Add event listeners
        this.addLightboxEventListeners();
    }

    initializeLightboxSwiper(results, startIndex) {
        // Initialize Swiper
        this.lightboxSwiper = new Swiper('#lightboxSwiper', {
            initialSlide: startIndex,
            loop: results.length > 1,
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
                dynamicBullets: true,
            },
            // Store custom data for keyword editing
            customData: results
        });
    }

    addLightboxEventListeners() {
        const lightbox = document.getElementById('imageLightbox');
        const closeBtn = document.getElementById('closeLightbox');
        const backToGridBtn = document.getElementById('backToGrid');
        const overlay = lightbox.querySelector('.modal-overlay');
        
        // Close button
        closeBtn.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        // Back to grid button
        if (backToGridBtn && this.albumPreviewContext) {
            backToGridBtn.addEventListener('click', () => {
                this.closeLightbox();
                // Reopen the album preview grid
                this.previewAlbumImages(
                    this.albumPreviewContext.albumKey,
                    this.albumPreviewContext.albumName
                );
            });
        }
        
        // Overlay click
        overlay.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Store escape handler for cleanup (as a property, not dataset)
        this.currentLightboxEscapeHandler = escapeHandler;
    }

    closeLightbox() {
        const lightbox = document.getElementById('imageLightbox');
        if (!lightbox) return;
        
        // Clean up Swiper
        if (this.lightboxSwiper) {
            this.lightboxSwiper.destroy(true, true);
            this.lightboxSwiper = null;
        }
        
        // Remove escape key handler
        if (this.currentLightboxEscapeHandler) {
            document.removeEventListener('keydown', this.currentLightboxEscapeHandler);
            this.currentLightboxEscapeHandler = null;
        }
        
        // Remove from DOM
        lightbox.remove();
    }
    
    // Album Preview Methods
    async previewAlbumImages(albumKey, albumName) {
        try {
            // Show loading state on the button (but not the delete button)
            const button = document.querySelector(`button[data-album-key="${albumKey}"]:not(.delete-processed-btn)`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Loading...';
            }
            
            // Fetch album preview data
            console.log(`Fetching preview for album: ${albumKey}`);
            const response = await fetch(`/api/smugmug/album/${albumKey}/preview`);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use status text
                    errorMessage = `${errorMessage} - ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            // Check if we have valid data
            if (!result.data || !result.data.images) {
                throw new Error('Invalid preview data received');
            }
            
            // Transform images for lightbox format
            const lightboxImages = result.data.images.map(img => {
                // Debug: Log the raw image data
                console.log('Raw image data:', img);
                
                return {
                    smugmugUrl: img.largeUrl || img.thumbnailUrl,
                    thumbnail: img.thumbnailUrl,
                    filename: img.filename,
                    caption: img.caption,
                    description: img.description || img.caption || img.filename,
                    keywords: img.keywords || [],
                    albumName: albumName,
                    imageKey: img.imageKey,
                    smugmugImageKey: img.imageKey,
                    isProcessed: img.isProcessed || false,
                    analysisTimestamp: img.analysisTimestamp
                };
            });
            
            // Open the lightbox with grid view
            this.openAlbumPreviewLightbox(lightboxImages, albumName, albumKey);
            
        } catch (error) {
            console.error('Error previewing album:', error);
            this.addMessage(`Error loading album preview: ${error.message}`, 'assistant');
        } finally {
            // Reset button state (but not the delete button)
            const button = document.querySelector(`button[data-album-key="${albumKey}"]:not(.delete-processed-btn)`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="preview-text">Preview</span>';
            }
        }
    }
    
    
    openAlbumPreviewLightbox(images, albumName, albumKey, selectionMode = false) {
        if (images.length === 0) {
            this.addMessage('No images found in this album', 'assistant');
            return;
        }
        
        // Debug: Log images to see what data we have
        console.log('Preview lightbox images:', images);
        console.log('First image details:', images[0]);
        
        // Count unprocessed images
        const unprocessedImages = images.filter(img => !img.isProcessed);
        const selectedCount = unprocessedImages.length;
        
        // Build unified header with batch controls
        const headerHTML = `
            <div class="preview-header">
                <h2 class="preview-title">${albumName}</h2>
                <div class="preview-info">
                    <div class="selection-controls">
                        <button class="select-all-btn" title="Select all images">
                            <span class="icon">☑</span> Select All
                        </button>
                        <button class="deselect-all-btn" title="Deselect all images">
                            <span class="icon">☐</span> Deselect All
                        </button>
                        <span class="selection-count">${selectedCount} of ${unprocessedImages.length} selected</span>
                    </div>
                    <span class="image-count">${images.length} total images (${unprocessedImages.length} unprocessed)</span>
                </div>
                <button class="modal-close" id="closeLightbox">&times;</button>
            </div>
        `;
        
        // Count processed images
        const processedImages = images.filter(img => img.isProcessed);
        const processedCount = processedImages.length;
        
        // Build footer with batch processing controls
        const footerHTML = `
            <div class="preview-footer">
                <div class="batch-controls">
                    <div class="batch-control-group">
                        <label>Batch Name:</label>
                        <input type="text" class="batch-name-input" placeholder="Enter batch name" value="${albumName}">
                    </div>
                    <div class="batch-control-group">
                        <label>Max Images: <span class="max-images-value">50</span></label>
                        <input type="range" class="max-images-slider" min="1" max="200" value="50">
                    </div>
                    <button class="start-batch-btn btn btn-primary" ${unprocessedImages.length === 0 ? 'disabled' : ''}>
                        <span class="btn-icon">▶</span> Start Batch Processing
                    </button>
                    ${processedCount > 0 ? `
                        <button class="delete-processed-btn btn btn-danger" data-album-key="${albumKey}" data-album-name="${albumName}" data-processed-count="${processedCount}">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                            </svg>
                            Delete ${processedCount} Processed Image${processedCount > 1 ? 's' : ''}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Create lightbox HTML with grid layout
        const lightboxHTML = `
            <div id="imageLightbox" class="image-modal album-preview-modal">
                <div class="modal-overlay"></div>
                <div class="modal-container preview-container">
                    ${headerHTML}
                    <div class="preview-grid-container">
                        <div class="preview-grid selection-mode">
                            ${images.map((img, index) => {
                                // Only show checkboxes for unprocessed images
                                const showCheckbox = !img.isProcessed;
                                const isSelected = showCheckbox; // All unprocessed images selected by default
                                return `
                                    <div class="preview-thumbnail${img.isProcessed ? ' processed' : ''}${isSelected ? ' selected' : ''}" data-index="${index}" data-image-key="${img.smugmugImageKey || img.imageKey || ''}">
                                        ${showCheckbox ? `
                                            <input type="checkbox" 
                                                   class="image-checkbox" 
                                                   checked
                                                   data-image-key="${img.smugmugImageKey || img.imageKey || ''}">
                                        ` : ''}
                                        ${img.isProcessed ? '<div class="processed-indicator" title="This image has been analyzed">✓</div>' : ''}
                                        <img src="${img.thumbnail}" 
                                             alt="${img.filename}" 
                                             loading="lazy"
                                             title="${img.isProcessed && img.description ? img.description : (img.caption || img.filename)}">
                                        <div class="thumbnail-info">
                                            <span class="thumbnail-name">${img.filename}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ${footerHTML}
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', lightboxHTML);
        
        // Add event listeners
        const lightbox = document.getElementById('imageLightbox');
        const closeBtn = lightbox.querySelector('#closeLightbox');
        const overlay = lightbox.querySelector('.modal-overlay');
        
        // Close button
        closeBtn.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        // Overlay click
        overlay.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        this.currentLightboxEscapeHandler = escapeHandler;
        
        // Add selection control handlers
        const selectAllBtn = lightbox.querySelector('.select-all-btn');
        const deselectAllBtn = lightbox.querySelector('.deselect-all-btn');
        const selectionCount = lightbox.querySelector('.selection-count');
        const maxImagesSlider = lightbox.querySelector('.max-images-slider');
        const maxImagesValue = lightbox.querySelector('.max-images-value');
        const startBatchBtn = lightbox.querySelector('.start-batch-btn');
        const batchNameInput = lightbox.querySelector('.batch-name-input');
        
        
        // Function to update selection count
        const updateSelectionCount = () => {
            const checkedCount = lightbox.querySelectorAll('.image-checkbox:checked').length;
            selectionCount.textContent = `${checkedCount} of ${unprocessedImages.length} selected`;
            
            // Enable/disable start button based on selection
            if (startBatchBtn) {
                startBatchBtn.disabled = checkedCount === 0;
            }
        };
        
        // Handle checkbox changes
        lightbox.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            checkbox.addEventListener('change', () => {
                const thumbnail = checkbox.closest('.preview-thumbnail');
                
                if (checkbox.checked) {
                    thumbnail.classList.add('selected');
                } else {
                    thumbnail.classList.remove('selected');
                }
                
                updateSelectionCount();
            });
        });
        
        // Select all button
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const checkboxes = lightbox.querySelectorAll('.image-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    checkbox.closest('.preview-thumbnail').classList.add('selected');
                });
                updateSelectionCount();
            });
        } else {
            console.warn('Select All button not found');
        }
        
        // Deselect all button
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const checkboxes = lightbox.querySelectorAll('.image-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                    checkbox.closest('.preview-thumbnail').classList.remove('selected');
                });
                updateSelectionCount();
            });
        } else {
            console.warn('Deselect All button not found');
        }
        
        // Max images slider
        if (maxImagesSlider) {
            maxImagesSlider.addEventListener('input', (e) => {
                maxImagesValue.textContent = e.target.value;
            });
        }
        
        // Start batch button
        if (startBatchBtn) {
            startBatchBtn.addEventListener('click', async () => {
                // Get selected images
                const selectedImages = [];
                lightbox.querySelectorAll('.image-checkbox:checked').forEach(checkbox => {
                    const imageKey = checkbox.getAttribute('data-image-key');
                    selectedImages.push(imageKey);
                });
                
                if (selectedImages.length === 0) {
                    alert('Please select at least one image to process.');
                    return;
                }
                
                const maxImages = parseInt(maxImagesSlider.value) || 50;
                const batchName = batchNameInput.value || albumName;
                
                // Close the lightbox
                this.closeLightbox();
                
                // Start batch processing with selected images
                await this.startBatchProcessingFromPreview(albumKey, albumName, selectedImages, maxImages, batchName);
            });
        }
        
        // Delete processed images button
        const deleteProcessedBtn = lightbox.querySelector('.delete-processed-btn');
        if (deleteProcessedBtn) {
            deleteProcessedBtn.addEventListener('click', async () => {
                const albumKeyToDelete = deleteProcessedBtn.getAttribute('data-album-key');
                const albumNameToDelete = deleteProcessedBtn.getAttribute('data-album-name');
                const processedCountToDelete = parseInt(deleteProcessedBtn.getAttribute('data-processed-count'));
                
                await this.handleDeleteAlbumProcessedImages(albumKeyToDelete, albumNameToDelete, processedCountToDelete);
            });
        }
        
        // Thumbnail clicks - open full image or toggle checkbox
        lightbox.querySelectorAll('.preview-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                // Don't do anything if clicking the checkbox itself
                if (e.target.tagName === 'INPUT') {
                    return;
                }
                
                // Check if clicking on the image
                if (e.target.tagName === 'IMG' || e.target.closest('img')) {
                    // Open full lightbox view
                    const index = parseInt(thumb.dataset.index);
                    this.closeLightbox();
                    // Pass album preview context
                    this.openLightbox(images, index, {
                        fromAlbumPreview: true,
                        albumKey: albumKey,
                        albumName: albumName,
                        selectionMode: false
                    });
                } else {
                    // Otherwise toggle checkbox if it exists
                    const checkbox = thumb.querySelector('.image-checkbox');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    }

    generateMetadataHTML(imageData) {
        if (!imageData) return '<div class="slide-metadata-empty">No metadata available</div>';

        let sections = [];

        // Description section
        if (imageData.claudeDescription || imageData.description) {
            sections.push(`
                <div class="metadata-section collapsed">
                    <div class="metadata-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="metadata-section-title">
                            📝 Description
                        </div>
                        <div class="metadata-section-toggle">▼</div>
                    </div>
                    <div class="metadata-section-body">
                        <div class="metadata-description">
                            ${imageData.claudeDescription || imageData.description || 'No description available'}
                        </div>
                    </div>
                </div>
            `);
        }

        // Keywords section
        sections.push(`
            <div class="metadata-section collapsed" data-image-key="${imageData.smugmugImageKey || imageData.imageKey || imageData.id}">
                <div class="metadata-section-header" onclick="if(!this.parentElement.classList.contains('editing')){this.parentElement.classList.toggle('collapsed')}">
                    <div class="metadata-section-title">
                        🏷️ Keywords
                    </div>
                    <div class="metadata-section-toggle">▼</div>
                </div>
                <div class="metadata-section-body">
                    <div class="keywords-view-mode">
                        <div class="metadata-keywords-header">
                            <div class="metadata-keywords">
                                ${imageData.keywords && imageData.keywords.length > 0 
                                    ? imageData.keywords.map(keyword => `<span class="metadata-keyword">${keyword}</span>`).join('')
                                    : '<span class="no-keywords">No keywords yet</span>'
                                }
                            </div>
                            <button class="keyword-edit-btn" onclick="window.photoVision.toggleKeywordEdit('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}')" title="Edit keywords">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="keywords-edit-mode" style="display: none;">
                        <div class="keywords-editor">
                            <div class="editable-keywords">
                                ${imageData.keywords && imageData.keywords.length > 0 
                                    ? imageData.keywords.map((keyword, index) => `
                                        <span class="editable-keyword">
                                            ${keyword}
                                            <button class="remove-keyword" onclick="window.photoVision.removeKeyword('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}', ${index})">×</button>
                                        </span>
                                    `).join('')
                                    : ''
                                }
                            </div>
                            <div class="keyword-input-group">
                                <input type="text" 
                                       class="keyword-input" 
                                       placeholder="Add keyword..." 
                                       onkeypress="if(event.key==='Enter'){window.photoVision.addKeyword('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}', this.value); this.value='';}">
                                <button class="add-keyword-btn" onclick="const input = this.previousElementSibling; window.photoVision.addKeyword('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}', input.value); input.value='';">Add</button>
                            </div>
                            <div class="keyword-edit-actions">
                                <button class="btn-save-keywords" onclick="window.photoVision.saveKeywords('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}')">Save</button>
                                <button class="btn-cancel-keywords" onclick="window.photoVision.cancelKeywordEdit('${imageData.smugmugImageKey || imageData.imageKey || imageData.id}')">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Album Information
        if (imageData.albumName || imageData.albumPath || imageData.albumHierarchy) {
            sections.push(`
                <div class="metadata-section collapsed">
                    <div class="metadata-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="metadata-section-title">
                            📁 Album Information
                        </div>
                        <div class="metadata-section-toggle">▼</div>
                    </div>
                    <div class="metadata-section-body">
                        ${imageData.albumName ? `
                            <div class="metadata-row">
                                <div class="metadata-label">Album</div>
                                <div class="metadata-value">${imageData.albumName}</div>
                            </div>
                        ` : ''}
                        ${imageData.albumPath ? `
                            <div class="metadata-row">
                                <div class="metadata-label">Path</div>
                                <div class="metadata-value">${imageData.albumPath}</div>
                            </div>
                        ` : ''}
                        ${imageData.albumHierarchy ? `
                            <div class="metadata-row">
                                <div class="metadata-label">Hierarchy</div>
                                <div class="metadata-value">${imageData.albumHierarchy}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `);
        }

        // Technical Details
        const technicalInfo = [];
        if (imageData.analysisTimestamp || imageData.metadata?.timestamp) {
            const timestamp = imageData.analysisTimestamp || imageData.metadata?.timestamp;
            technicalInfo.push(`
                <div class="metadata-row">
                    <div class="metadata-label">Analyzed</div>
                    <div class="metadata-value">${new Date(timestamp).toLocaleString()}</div>
                </div>
            `);
        }
        if (imageData.originalFilename || imageData.filename) {
            technicalInfo.push(`
                <div class="metadata-row">
                    <div class="metadata-label">Filename</div>
                    <div class="metadata-value"><code>${imageData.originalFilename || imageData.filename}</code></div>
                </div>
            `);
        }
        if (imageData.smugmugUrl) {
            technicalInfo.push(`
                <div class="metadata-row">
                    <div class="metadata-label">Source</div>
                    <div class="metadata-value">
                        <a href="${imageData.smugmugUrl}" target="_blank">View on SmugMug →</a>
                    </div>
                </div>
            `);
        }

        if (technicalInfo.length > 0) {
            sections.push(`
                <div class="metadata-section collapsed">
                    <div class="metadata-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="metadata-section-title">
                            ⚙️ Technical Details
                        </div>
                        <div class="metadata-section-toggle">▼</div>
                    </div>
                    <div class="metadata-section-body">
                        ${technicalInfo.join('')}
                    </div>
                </div>
            `);
        }

        // If no sections available, show a message
        if (sections.length === 0) {
            sections.push(`
                <div class="metadata-section">
                    <div class="metadata-section-body">
                        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                            No metadata available for this image
                        </div>
                    </div>
                </div>
            `);
        }

        return sections.join('');
    }

    updateLightboxMetadata(imageData) {
        const metadataContent = document.getElementById('metadataContent');
        if (!metadataContent || !imageData) return;
        metadataContent.innerHTML = this.generateMetadataHTML(imageData);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Image Selection Management Methods
    
    initializeAlbumSelection(albumKey, images) {
        if (!this.albumImageSelections.has(albumKey)) {
            this.albumImageSelections.set(albumKey, new Set());
        }
        // Return count of selected images
        const excluded = this.albumImageSelections.get(albumKey);
        return images.length - excluded.size;
    }
    
    toggleImageSelection(albumKey, imageKey) {
        const excluded = this.albumImageSelections.get(albumKey) || new Set();
        if (excluded.has(imageKey)) {
            excluded.delete(imageKey);
        } else {
            excluded.add(imageKey);
        }
        this.albumImageSelections.set(albumKey, excluded);
    }
    
    isImageSelected(albumKey, imageKey) {
        const excluded = this.albumImageSelections.get(albumKey);
        return !excluded || !excluded.has(imageKey);
    }
    
    getExcludedImages(albumKey) {
        return Array.from(this.albumImageSelections.get(albumKey) || []);
    }
    
    getSelectedImagesCount(albumKey, totalImages) {
        const excluded = this.albumImageSelections.get(albumKey) || new Set();
        return totalImages - excluded.size;
    }
    
    selectAllImages(albumKey) {
        this.albumImageSelections.set(albumKey, new Set());
    }
    
    deselectAllImages(albumKey, imageKeys) {
        this.albumImageSelections.set(albumKey, new Set(imageKeys));
    }
    
    clearAlbumSelection(albumKey) {
        this.albumImageSelections.delete(albumKey);
    }
    
    // Helper methods for selection management
    isImageExcluded(albumKey, imageKey) {
        const excluded = this.albumImageSelections.get(albumKey);
        return excluded && excluded.has(imageKey);
    }
    
    getAlbumExcludedCount(albumKey) {
        const excluded = this.albumImageSelections.get(albumKey);
        return excluded ? excluded.size : 0;
    }
    
    selectAllInAlbum(albumKey, imageKeys) {
        // Select all means exclude all images
        this.albumImageSelections.set(albumKey, new Set(imageKeys));
    }
    
    deselectAllInAlbum(albumKey) {
        // Deselect all means exclude no images
        this.albumImageSelections.set(albumKey, new Set());
    }
    
    updateAlbumExcludedDisplay(albumKey) {
        const excludedCount = this.getAlbumExcludedCount(albumKey);
        const excludedElement = document.getElementById(`excluded-count-${albumKey}`);
        
        if (excludedElement) {
            if (excludedCount > 0) {
                excludedElement.style.display = 'flex';
                const valueElement = excludedElement.querySelector('.excluded-value');
                if (valueElement) {
                    valueElement.textContent = excludedCount;
                }
            } else {
                excludedElement.style.display = 'none';
            }
        }
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
        if (this.messagesContainer) {
            // Use smooth scrolling if supported
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
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
        await this.checkActiveBatches();
        
        // Initialize analysis status indicator
        this.initializeAnalysisStatus();
    }
    
    async initializeAnalysisStatus() {
        try {
            const response = await fetch('/api/admin/image-analysis-config');
            const data = await response.json();
            
            if (data.success) {
                const analysisStatus = document.getElementById('analysisStatus');
                if (analysisStatus) {
                    if (data.data.enabled) {
                        analysisStatus.classList.add('status-success');
                    } else {
                        analysisStatus.classList.remove('status-success');
                    }
                }
            }
        } catch (error) {
            console.error('Error initializing analysis status:', error);
        }
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
        
        // Analysis status bar - click to toggle custom prompt
        const analysisStatusBar = document.getElementById('analysisStatus');
        if (analysisStatusBar) {
            analysisStatusBar.addEventListener('click', async () => {
                try {
                    // Call the toggle API endpoint
                    const response = await fetch('/api/admin/image-analysis-config/toggle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        const enableCustomAnalysis = document.getElementById('enableCustomAnalysis');
                        if (enableCustomAnalysis) {
                            // Update the checkbox to reflect the new state
                            // This will trigger its change event which updates UI
                            enableCustomAnalysis.checked = data.data.enabled;
                        }
                        
                        // Also update the header status indicator immediately
                        const analysisStatus = document.getElementById('analysisStatus');
                        if (analysisStatus) {
                            if (data.data.enabled) {
                                analysisStatus.classList.add('status-success');
                            } else {
                                analysisStatus.classList.remove('status-success');
                            }
                        }
                    } else {
                        console.error('Failed to toggle image analysis:', data.error);
                    }
                } catch (error) {
                    console.error('Error toggling image analysis:', error);
                }
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
            // First check API key status
            const keyStatusResponse = await fetch('/api/admin/api-keys/status');
            const keyStatusData = await keyStatusResponse.json();
            
            let apiKeyInfo = null;
            if (keyStatusData.success && keyStatusData.data.claude) {
                const keyStatus = keyStatusData.data.claude;
                apiKeyInfo = {
                    configured: keyStatus.configured,
                    source: keyStatus.source,
                    maskedKey: keyStatus.maskedKey
                };
            }
            
            // If no API key is configured, show appropriate status
            if (!apiKeyInfo || !apiKeyInfo.configured) {
                this.updateServiceStatus('claude', 'disconnected', 'Not Configured', {
                    apiKeyInfo: { configured: false }
                });
                this.disableChat();
                return;
            }
            
            // Check Claude health if API key exists
            const response = await fetch('/api/health/claude');
            const data = await response.json();
            
            if (data.success) {
                this.updateServiceStatus('claude', 'connected', 'Connected', { apiKeyInfo });
                // Enable chat interface when Claude AI is connected
                this.enableChat();
            } else {
                // Handle different error cases
                let statusMessage = 'Connection failed';
                if (response.status === 503) {
                    statusMessage = 'Initializing...';
                } else if (response.status === 400) {
                    statusMessage = 'No API key';
                } else if (data.error && data.error.includes('credit balance')) {
                    statusMessage = 'Insufficient credits';
                }
                
                this.updateServiceStatus('claude', 'disconnected', statusMessage, { apiKeyInfo });
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

    updateServiceStatus(service, status, message, additionalInfo = {}) {
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
        
        // Handle Claude-specific API key information
        // Removed API key info from Claude status card
    }
    
    // Removed updateClaudeApiKeyInfo function - API key info no longer displayed in status card

    async testClaudeConnection() {
        this.addMessage('Testing Claude AI connection...', 'assistant');
        await this.checkClaudeStatus();
        
        const statusElement = document.getElementById('claudeStatus');
        const status = statusElement ? statusElement.querySelector('.status-text').textContent : 'Unknown';
        this.addMessage(`Claude AI test result: ${status}`, 'assistant');
    }
    
    // Removed navigateToApiConfig function - Configure button removed from Claude status card

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
        
        if (connectBtn) {
            connectBtn.style.display = connected ? 'none' : 'inline-flex';
            connectBtn.disabled = connected;
        }
        if (testBtn) {
            testBtn.style.display = connected ? 'none' : 'inline-flex';
            testBtn.disabled = !connected;
        }
        if (disconnectBtn) {
            disconnectBtn.style.display = connected ? 'inline-flex' : 'none';
            disconnectBtn.disabled = !connected;
        }
    }

    showSmugMugAccountInfo(user) {
        const accountDetails = document.getElementById('accountDetails');
        
        if (accountDetails && user) {
            accountDetails.innerHTML = `
                <div class="account-user-info">
                    <svg class="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>${user.NickName || user.Name || 'Unknown'}</span>
                </div>
            `;
            
            accountDetails.style.display = 'block';
        }
    }

    hideSmugMugAccountInfo() {
        const accountDetails = document.getElementById('accountDetails');
        if (accountDetails) {
            accountDetails.style.display = 'none';
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

        // Removed max images slider sync - now handled in album preview

        // Initialize batch processing state
        this.batchProgressInterval = null;
        this.selectedAlbumKey = null;
    }

    async updateTotalScannedImages() {
        try {
            const response = await fetch('/api/data/count');
            const data = await response.json();
            
            if (data.success) {
                const totalScannedElement = document.getElementById('totalScannedImages');
                if (totalScannedElement) {
                    // Format number with commas for readability
                    const formattedCount = (data.data?.count || 0).toLocaleString();
                    totalScannedElement.textContent = formattedCount;
                }
            }
        } catch (error) {
            console.error('Error updating total scanned images:', error);
        }
    }

    async loadAlbums(page = 1, append = false) {
        const albumsList = document.getElementById('albumsList');
        
        if (!albumsList) return;

        // Update total scanned images when loading albums
        this.updateTotalScannedImages();

        // Prevent multiple simultaneous loads
        if (this.paginationState.isLoading) return;
        this.paginationState.isLoading = true;

        if (!append) {
            albumsList.innerHTML = '<div class="loading-albums"><div class="loading-spinner"></div> <span id="loadingText">Loading albums...</span></div>';
        } else {
            // Show infinite scroll loader when loading more
            this.showInfiniteScrollLoader();
        }

        try {
            const response = await fetch(`/api/smugmug/albums?page=${page}&pageSize=${this.paginationState.pageSize}`);
            const data = await response.json();

            if (data.success && data.data.albums) {
                const albums = data.data.albums;
                const pagination = data.data.pagination;
                
                // Update pagination state
                this.paginationState.currentPage = pagination.page;
                this.paginationState.totalAlbums = pagination.totalAlbums;
                this.paginationState.totalPages = pagination.totalPages;
                this.paginationState.hasNextPage = pagination.hasNextPage;
                this.paginationState.hasPrevPage = pagination.hasPrevPage;

                if (append) {
                    // Append to existing albums
                    this.albumsData = this.albumsData.concat(albums);
                } else {
                    // Replace albums data
                    this.albumsData = albums;
                }

                // Album count removed from UI

                if (albums.length === 0 && !append) {
                    albumsList.innerHTML = '<div class="no-albums">No albums found in your SmugMug account.</div>';
                    return;
                }

                // Load processing status for albums
                await this.loadAlbumsWithProcessingStatus(this.albumsData, albumsList);
                
                // Add infinite scroll loader if there are more pages
                this.addInfiniteScrollLoader(albumsList);
                
                // Hide loader if it was showing
                this.hideInfiniteScrollLoader();

            } else {
                if (!append) {
                    albumsList.innerHTML = '<div class="error-message">Failed to load albums. Please check your SmugMug connection.</div>';
                }
            }
        } catch (error) {
            console.error('Error loading albums:', error);
            if (!append) {
                albumsList.innerHTML = '<div class="error-message">Error loading albums. Please try again.</div>';
            }
        } finally {
            this.paginationState.isLoading = false;
        }
    }

    setupInfiniteScroll() {
        const albumsList = document.getElementById('albumsList');
        if (!albumsList) return;

        // Add scroll event listener for infinite scroll
        albumsList.addEventListener('scroll', this.handleScroll.bind(this));
    }

    handleScroll(event) {
        const albumsList = event.target;
        
        // Check if we're near the bottom (within 100px)
        const scrollThreshold = 100;
        const isNearBottom = albumsList.scrollTop + albumsList.clientHeight >= albumsList.scrollHeight - scrollThreshold;
        
        // Debug logging
        console.log('Scroll event:', {
            scrollTop: albumsList.scrollTop,
            clientHeight: albumsList.clientHeight,
            scrollHeight: albumsList.scrollHeight,
            isNearBottom: isNearBottom,
            hasNextPage: this.paginationState.hasNextPage,
            isLoading: this.paginationState.isLoading
        });
        
        // Load more if we're near bottom, have more pages, and not currently loading
        if (isNearBottom && this.paginationState.hasNextPage && !this.paginationState.isLoading) {
            console.log('Loading more albums...');
            this.loadMoreAlbums();
        }
    }

    async loadMoreAlbums() {
        if (this.paginationState.hasNextPage && !this.paginationState.isLoading) {
            await this.loadAlbums(this.paginationState.currentPage + 1, true);
        }
    }

    addInfiniteScrollLoader(albumsList) {
        // Remove existing loader
        const existingLoader = document.getElementById('infiniteScrollLoader');
        if (existingLoader) {
            existingLoader.remove();
        }

        // Add loading indicator at bottom if there are more pages
        if (this.paginationState.hasNextPage) {
            const loaderDiv = document.createElement('div');
            loaderDiv.id = 'infiniteScrollLoader';
            loaderDiv.className = 'infinite-scroll-loader';
            loaderDiv.innerHTML = `
                <div class="loading-spinner"></div>
                <span>Loading more albums...</span>
            `;
            loaderDiv.style.display = 'none'; // Initially hidden
            albumsList.appendChild(loaderDiv);
        }
    }

    showInfiniteScrollLoader() {
        const loader = document.getElementById('infiniteScrollLoader');
        if (loader) {
            loader.style.display = 'flex';
        }
    }

    hideInfiniteScrollLoader() {
        const loader = document.getElementById('infiniteScrollLoader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    async loadAlbumsWithProcessingStatus(albums, albumsList) {
        // Store albums data for filtering
        this.albumsData = albums;
        this.filteredAlbums = [...albums];
        
        // Setup filter event listeners
        this.setupAlbumFilters();
        
        // Apply initial filters and render
        this.applyFilters();
        
        // Initialize progressive loading for album statuses
        this.initializeAlbumStatusObserver();
    }
    
    initializeAlbumStatusObserver() {
        // Clean up existing observer if it exists
        if (this.albumStatusObserver) {
            this.albumStatusObserver.disconnect();
            this.albumStatusObserver = null;
        }
        
        // Create Intersection Observer for progressive loading
        this.albumStatusObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const albumItem = entry.target;
                    const albumKey = albumItem.dataset.albumKey;
                    
                    // Check if we haven't already loaded this album's status
                    const statusElement = albumItem.querySelector('.album-processing-status');
                    if (statusElement && !statusElement.dataset.loaded) {
                        statusElement.dataset.loaded = 'true';
                        this.loadAlbumProcessingStatus(albumKey);
                    }
                    
                    // Stop observing this album once loaded
                    this.albumStatusObserver.unobserve(albumItem);
                }
            });
        }, {
            // Start loading when album is 100px from viewport
            rootMargin: '100px 0px',
            threshold: 0
        });
        
        // Start observing all album items
        const albumItems = document.querySelectorAll('.album-item[data-album-key]');
        albumItems.forEach(item => {
            this.albumStatusObserver.observe(item);
        });
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
                // Find the album data from stored albums
                const album = this.albumsData.find(a => a.AlbumKey === albumKey) || {};
                this.displayAlbumProcessingStatus(statusElement, status, album);
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

    displayAlbumProcessingStatus(statusElement, status, album) {
        const { totalImages, processedImageKeys, processedImages, processingProgress, isCompletelyProcessed } = status;
        
        // Debug logging to track actual values
        console.log('Album processing status debug:', {
            totalImages,
            processedImageKeys,
            processedImages,
            processingProgress,
            isCompletelyProcessed,
            albumKey: statusElement.id.replace('processing-status-', '')
        });

        // Find the parent album card to add/remove the completely-processed class
        const albumCard = statusElement.closest('.album-item');
        const albumKey = albumCard ? albumCard.dataset.albumKey : null;
        
        // Check if batch processing is currently active
        const isBatchProcessingActive = this.batchProgressInterval !== null;
        
        // Only show active processing animation for the currently selected album during batch processing
        const isActivelyProcessing = isBatchProcessingActive && albumKey === this.selectedAlbumKey && !isCompletelyProcessed;
        
        if (totalImages === 0) {
            statusElement.innerHTML = '<span class="status-empty">No images in album</span>';
            if (albumCard) albumCard.classList.remove('completely-processed');
            return;
        }

        const duplicateInfo = status.duplicateStatistics || {};
        const duplicateDetectionEnabled = status.duplicateDetectionEnabled || false;

        let statusHTML = '';
        
        if (isCompletelyProcessed) {
            // Add completely-processed class to the album card
            if (albumCard) albumCard.classList.add('completely-processed');
            statusHTML = `
                <div class="processing-complete" style="background: linear-gradient(90deg, var(--success) 100%, var(--bg-secondary) 100%)">
                    <span class="status-icon">✅</span>
                    <span class="status-count">${album.ImageCount || 0} images</span>
                    ${duplicateDetectionEnabled ? `
                        <div class="duplicate-info">
                            <small>Duplicate detection: Active</small>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (processedImages === 0) {
            // Remove completely-processed class for unprocessed albums
            if (albumCard) albumCard.classList.remove('completely-processed');
            
            // Show different status for the selected album if batch processing is active
            const isSelectedAlbum = albumKey === this.selectedAlbumKey;
            const showWaitingStatus = isBatchProcessingActive && isSelectedAlbum;
            const statusIcon = '⏳';
            const statusText = 'Waiting for processing...';
            
            statusHTML = `
                <div class="processing-none" style="background: linear-gradient(90deg, var(--warning) 0%, var(--bg-secondary) 0%)">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-count">0/${album.ImageCount || 0}</span>
                    ${showWaitingStatus ? `<small class="processing-status-text">${statusText}</small>` : ''}
                    ${duplicateDetectionEnabled ? `
                        <div class="duplicate-info">
                            <small>Ready for duplicate-aware processing</small>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Remove completely-processed class for partially processed albums
            if (albumCard) albumCard.classList.remove('completely-processed');
            
            // Add processing-active class only if this is the actively processing album
            const activeClass = isActivelyProcessing ? ' processing-active' : '';
            
            statusHTML = `
                <div class="processing-partial${activeClass}" style="background: linear-gradient(90deg, var(--accent-primary) ${processingProgress}%, var(--bg-secondary) ${processingProgress}%)">
                    <span class="status-icon">${isActivelyProcessing ? '⚡' : '🔄'}</span>
                    <span class="status-count">${processedImages}/${album.ImageCount || 0}</span>
                    <span class="status-percentage">${processingProgress}%</span>
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

        // Batch name now handled in album preview

        // Update batch slider instantly from DOM
        this.updateBatchSliderFromDOM(albumKey);

        // Load and display duplicate statistics for selected album
        this.loadDuplicateStatistics(albumKey);
    }

    async updateBatchSliderForAlbum(albumKey) {
        try {
            const response = await fetch(`/api/smugmug/album/${albumKey}/processing-status`);
            const data = await response.json();

            if (data.success) {
                const status = data.data;
                
                // Max images slider removed - now handled in album preview
                const unprocessedCount = status.totalImages - status.processedImages;
                console.log('Unprocessed images:', unprocessedCount);
            }
        } catch (error) {
            console.error('Error updating batch slider:', error);
        }
    }

    updateBatchSliderFromDOM(albumKey) {
        // Extract album status directly from the DOM
        const statusElement = document.getElementById(`processing-status-${albumKey}`);
        if (!statusElement) return;

        // Find the status count element
        const statusCountElement = statusElement.querySelector('.status-count');
        if (!statusCountElement) return;

        // Parse the status count text (format: "25/100" or "100 images")
        const statusText = statusCountElement.textContent.trim();
        let processedImages = 0;
        let totalImages = 0;

        // Check if it's in "X/Y" format
        if (statusText.includes('/')) {
            const parts = statusText.split('/');
            processedImages = parseInt(parts[0]) || 0;
            totalImages = parseInt(parts[1]) || 0;
        } else {
            // It's probably in "X images" format (fully processed)
            const match = statusText.match(/(\d+)\s*images?/i);
            if (match) {
                totalImages = parseInt(match[1]) || 0;
                // If it shows just "X images", it's likely fully processed
                processedImages = totalImages;
            }
        }

        // Calculate unprocessed count
        const unprocessedCount = Math.max(0, totalImages - processedImages);

        // Update slider elements
        const maxImagesSlider = document.getElementById('maxImagesSlider');
        const maxImagesInput = document.getElementById('maxImages');
        const maxImagesLabel = document.querySelector('label[for="maxImages"]');
        
        console.log('Auto-updating slider from DOM:', {
            unprocessedCount,
            totalImages,
            processedImages,
            statusText,
            sliderElement: maxImagesSlider,
            inputElement: maxImagesInput
        });
        
        if (maxImagesSlider && maxImagesInput) {
            if (unprocessedCount > 0) {
                // Ensure the slider max is at least the unprocessed count
                if (parseInt(maxImagesSlider.max) < unprocessedCount) {
                    maxImagesSlider.max = unprocessedCount;
                    maxImagesInput.max = unprocessedCount; // Also update input max
                }
                
                // Update slider value
                maxImagesSlider.value = unprocessedCount;
                
                // Manually update the number input value (since it's readonly)
                maxImagesInput.value = unprocessedCount;
                
                // Update label text to show unprocessed count
                if (maxImagesLabel) {
                    maxImagesLabel.textContent = `Amount of Images to Batch Process (${unprocessedCount} unprocessed)`;
                }
            } else {
                // No unprocessed images - set to default
                const defaultMax = 100;
                maxImagesSlider.max = defaultMax;
                maxImagesInput.max = defaultMax;
                maxImagesSlider.value = 0;
                maxImagesInput.value = 0;
                
                if (maxImagesLabel) {
                    maxImagesLabel.textContent = 'Amount of Images to Batch Process (fully processed)';
                }
            }
            
            console.log('After update:', {
                sliderValue: maxImagesSlider.value,
                inputValue: maxImagesInput.value
            });
        }
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
                updateForceReprocessingToggle();
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

    async startBatchProcessingFromPreview(albumKey, albumName, selectedImages, maxImages, batchName) {
        // Get album details for display
        const selectedAlbum = this.albumsData.find(a => a.AlbumKey === albumKey);
        const albumHierarchy = selectedAlbum?.PathHierarchy || [];

        // Debug logging
        console.log('=== BATCH START FROM PREVIEW DEBUG ===');
        console.log('Album Key:', albumKey);
        console.log('Album Name:', albumName);
        console.log('Selected Images:', selectedImages.length, selectedImages);
        console.log('Max Images:', maxImages);
        console.log('Batch Name:', batchName);

        // Build the list of images to include (inverse of excluded)
        const includedImages = selectedImages.slice(0, maxImages);
        
        const requestData = {
            albumKey: albumKey,
            maxImages: maxImages,
            batchName: batchName,
            includedImages: includedImages  // Using includedImages instead of excludedImages
        };
        
        console.log('Request Data:', JSON.stringify(requestData, null, 2));
        console.log('========================');

        // Update message
        this.addMessage(`Starting batch processing for ${batchName} (${includedImages.length} images selected)...`, 'assistant');

        try {
            const response = await fetch('/api/batch/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);

            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                const actualCount = data.data.jobCount;
                const message = `Batch processing started! Processing ${actualCount} images.`;
                this.addMessage(message, 'assistant');
                
                this.showBatchProgress();
                // Create batch card for this batch
                this.createBatchCard(data.data.batchId, {
                    name: batchName,
                    albumKey: albumKey,
                    albumName: albumName,
                    albumHierarchy: albumHierarchy,
                    total: data.data.jobCount
                });
                this.updateBatchControls('processing');
                this.startProgressMonitoring();
                
                // Switch to chat tab to show the batch progress
                const chatTab = document.querySelector('.tab-btn');
                if (chatTab) {
                    chatTab.click();
                }
            } else {
                this.addMessage(`Failed to start batch processing: ${data.error}`, 'assistant');
                console.error('Batch start failed:', data);
            }
        } catch (error) {
            console.error('Error starting batch processing:', error);
            this.addMessage('Error starting batch processing. Please try again.', 'assistant');
        }
    }
    
    async handleDeleteAlbumProcessedImages(albumKey, albumName, processedCount) {
        // First confirmation
        const firstConfirm = confirm(
            `⚠️ WARNING: Delete Processed Images\n\n` +
            `This will permanently delete ${processedCount} processed image${processedCount > 1 ? 's' : ''} from the album "${albumName}".\n\n` +
            `This action cannot be undone. Are you sure you want to continue?`
        );
        
        if (!firstConfirm) return;
        
        // Second confirmation with typed input
        const secondConfirm = prompt(
            `⚠️ FINAL WARNING\n\n` +
            `You are about to delete ${processedCount} processed image${processedCount > 1 ? 's' : ''} from "${albumName}".\n\n` +
            `To confirm, please type: DELETE\n\n` +
            `This will permanently remove the analysis data for these images.`
        );
        
        if (secondConfirm !== 'DELETE') {
            alert('Action cancelled. No images were deleted.');
            return;
        }
        
        // Show loading state
        const deleteBtn = document.querySelector('.delete-processed-btn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';
        }
        
        try {
            const response = await fetch('/api/admin/delete-album-processed-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    albumKey: albumKey,
                    albumName: albumName
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Show success message
                alert(
                    `✅ Successfully deleted ${result.data.deletedCount} processed image${result.data.deletedCount > 1 ? 's' : ''} from "${albumName}".\n\n` +
                    `Backup saved as: ${result.data.backupFile}`
                );
                
                // Close the lightbox
                this.closeLightbox();
                
                // Refresh the album preview
                await this.previewAlbumImages(albumKey, albumName);
                
                // Update the album processing status in the background
                this.loadAlbumProcessingStatus(albumKey);
                
            } else {
                alert(`Failed to delete processed images: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error deleting processed images:', error);
            alert('Network error occurred while deleting processed images.');
        } finally {
            // Re-enable button if it still exists
            const deleteBtn = document.querySelector('.delete-processed-btn');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                    </svg>
                    Delete ${processedCount} Processed Image${processedCount > 1 ? 's' : ''}
                `;
            }
        }
    }

    async startBatchProcessing() {
        if (!this.selectedAlbumKey) {
            this.addMessage('Please select an album first.', 'assistant');
            return;
        }

        const maxImages = parseInt(document.getElementById('maxImages').value) || 50;
        const batchName = document.getElementById('batchName').value || `Album ${this.selectedAlbumKey}`;
        
        // Get album details for display
        const selectedAlbum = this.albumsData.find(a => a.AlbumKey === this.selectedAlbumKey);
        const albumHierarchy = selectedAlbum?.PathHierarchy || [];
        const albumName = selectedAlbum?.Name || this.selectedAlbumKey;

        // Debug logging
        console.log('=== BATCH START DEBUG ===');
        console.log('Selected Album Key:', this.selectedAlbumKey);
        console.log('Album Hierarchy:', albumHierarchy);
        console.log('Max Images:', maxImages);
        console.log('Batch Name:', batchName);

        // Get excluded images for the selected album
        const excludedImages = this.getExcludedImages(this.selectedAlbumKey);
        
        const requestData = {
            albumKey: this.selectedAlbumKey,
            maxImages: maxImages,
            batchName: batchName,
            excludedImages: excludedImages
        };
        
        console.log('Request Data:', JSON.stringify(requestData, null, 2));
        console.log('Excluded Images:', excludedImages.length, excludedImages);
        console.log('========================');

        // Update message to show excluded images count
        const excludedText = excludedImages.length > 0 ? ` (excluding ${excludedImages.length} images)` : '';
        this.addMessage(`Starting batch processing for ${batchName} (max ${maxImages} images${excludedText})...`, 'assistant');

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
                const actualCount = data.data.jobCount;
                const message = excludedImages.length > 0 
                    ? `Batch processing started! Processing ${actualCount} images (${excludedImages.length} excluded).`
                    : `Batch processing started! Processing ${actualCount} images.`;
                this.addMessage(message, 'assistant');
                
                this.showBatchProgress();
                // Create batch card for this batch
                this.createBatchCard(data.data.batchId, {
                    name: batchName,
                    albumKey: this.selectedAlbumKey,
                    albumName: albumName,
                    albumHierarchy: albumHierarchy,
                    total: data.data.jobCount
                });
                this.updateBatchControls('processing');
                this.startProgressMonitoring();
                
                // Clear the selection after starting batch
                this.clearAlbumSelection(this.selectedAlbumKey);
                this.updateAlbumExcludedDisplay(this.selectedAlbumKey);
            } else {
                this.addMessage(`Failed to start batch processing: ${data.error}`, 'assistant');
                console.error('Batch start failed:', data);
            }
        } catch (error) {
            console.error('Error starting batch processing:', error);
            this.addMessage('Error starting batch processing. Please try again.', 'assistant');
        }
    }

    async pauseBatchProcessing(batchId = null) {
        try {
            const response = await fetch('/api/batch/pause', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId })
            });
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

    async resumeBatchProcessing(batchId = null) {
        try {
            const response = await fetch('/api/batch/resume', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId })
            });
            const data = await response.json();

            if (data.success && data.data.resumed) {
                this.addMessage('Batch processing resumed.', 'assistant');
                this.updateBatchControls('processing');
                this.startProgressMonitoring();
            } else {
                this.addMessage('No batch to resume.', 'assistant');
            }
        } catch (error) {
            console.error('Error resuming batch:', error);
            this.addMessage('Error resuming batch processing.', 'assistant');
        }
    }

    async cancelBatchProcessing(batchId = null) {
        try {
            const response = await fetch('/api/batch/cancel', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId })
            });
            const data = await response.json();

            if (data.success) {
                const message = batchId ? 'Batch processing cancelled.' : 'All batch processing cancelled.';
                this.addMessage(message, 'assistant');
                
                // Check if there are still active batches
                const statusResponse = await fetch('/api/batch/status');
                const statusData = await statusResponse.json();
                
                if (statusData.success && statusData.data.batches && statusData.data.batches.length === 0) {
                    // No more active batches
                    this.updateBatchControls('idle');
                    this.stopProgressMonitoring();
                    this.hideBatchProgress();
                    // Cards are removed individually
                }
            } else {
                this.addMessage('Error cancelling batch processing.', 'assistant');
            }
        } catch (error) {
            console.error('Error cancelling batch:', error);
            this.addMessage('Error cancelling batch processing.', 'assistant');
        }
    }

    async retryFailedJobs(batchId = null) {
        try {
            if (!batchId) {
                this.addMessage('Please specify a batch ID to retry failed jobs.', 'assistant');
                return;
            }
            
            const response = await fetch('/api/batch/retry', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId })
            });
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

    // Batch card management
    createBatchCard(batchId, batchInfo) {
        const container = document.getElementById('batchCardsContainer');
        if (!container) return;
        
        // Check if card already exists
        if (document.querySelector(`[data-batch-id="${batchId}"]`)) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'batch-card';
        card.setAttribute('data-batch-id', batchId);
        
        // Store album info on the card element for later use
        if (batchInfo.albumHierarchy) {
            card.dataset.albumHierarchy = JSON.stringify(batchInfo.albumHierarchy);
        }
        if (batchInfo.albumName) {
            card.dataset.albumName = batchInfo.albumName;
        }
        
        // Display album hierarchy or fallback to album name
        const albumDisplay = batchInfo.albumHierarchy && batchInfo.albumHierarchy.length > 0
            ? batchInfo.albumHierarchy.join(' > ')
            : batchInfo.albumName || 'Unknown Album';
        
        card.innerHTML = `
            <div class="batch-card-header">
                <div class="batch-card-titles">
                    <div class="album-hierarchy">${albumDisplay}</div>
                    <div class="batch-name-secondary">${batchInfo.name || 'Batch Processing'}</div>
                </div>
                <div class="batch-card-controls">
                    <button class="minimize-btn" onclick="photoVision.toggleMinimizeBatchCard('${batchId}')">−</button>
                    <button class="close-btn" onclick="photoVision.closeBatchCard('${batchId}')">×</button>
                </div>
            </div>
            <div class="batch-card-body">
                <div class="progress-bar-compact">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="batch-stats">
                    <span class="progress-text">0/0 (0%)</span>
                    <span class="batch-status processing">PROCESSING</span>
                </div>
                <div class="current-file-info"></div>
                <div class="batch-actions">
                    <button class="pause-btn" onclick="photoVision.pauseBatchProcessing('${batchId}')">Pause</button>
                    <button class="resume-btn" onclick="photoVision.resumeBatchProcessing('${batchId}')" style="display: none;">Resume</button>
                    <button class="cancel-btn" onclick="photoVision.cancelBatchProcessing('${batchId}')">Cancel</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    }
    
    updateBatchCard(batchId, status) {
        const card = document.querySelector(`[data-batch-id="${batchId}"]`);
        if (!card) return;
        
        const percentage = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
        
        // Update album hierarchy if provided
        if (status.albumHierarchy) {
            const albumHierarchyElement = card.querySelector('.album-hierarchy');
            if (albumHierarchyElement) {
                albumHierarchyElement.textContent = status.albumHierarchy;
            }
        }
        
        // Update progress bar
        const progressFill = card.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        // Update stats
        const progressText = card.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${status.processed}/${status.total} (${percentage}%)`;
            if (status.failed > 0) {
                progressText.innerHTML += `<span class="failed-count">${status.failed} failed</span>`;
                card.classList.add('has-failures');
            }
        }
        
        // Update status
        const statusElement = card.querySelector('.batch-status');
        if (statusElement) {
            statusElement.className = 'batch-status';
            if (status.isComplete) {
                statusElement.textContent = 'COMPLETED';
                statusElement.classList.add('completed');
                this.scheduleBatchCardRemoval(batchId);
            } else if (status.isPaused) {
                statusElement.textContent = 'PAUSED';
                statusElement.classList.add('paused');
            } else if (status.isProcessing) {
                statusElement.textContent = 'PROCESSING';
                statusElement.classList.add('processing');
            } else if (status.failed === status.total && status.total > 0) {
                statusElement.textContent = 'FAILED';
                statusElement.classList.add('failed');
            }
        }
        
        // Update current file
        const currentFileInfo = card.querySelector('.current-file-info');
        if (currentFileInfo && status.currentJob) {
            let fileText = '';
            if (status.currentJob.imageName) {
                fileText = `Processing: ${status.currentJob.imageName}`;
            } else if (status.currentJob.albumHierarchy) {
                fileText = `Album: ${status.currentJob.albumHierarchy.join(' > ')}`;
            }
            currentFileInfo.textContent = fileText;
            currentFileInfo.title = fileText;
        }
        
        // Update action buttons
        this.updateBatchCardButtons(card, status);
    }
    
    updateBatchCardButtons(card, status) {
        const pauseBtn = card.querySelector('.pause-btn');
        const resumeBtn = card.querySelector('.resume-btn');
        const cancelBtn = card.querySelector('.cancel-btn');
        
        if (status.isProcessing) {
            if (pauseBtn) pauseBtn.style.display = 'block';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.disabled = false;
        } else if (status.isPaused) {
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'block';
            if (cancelBtn) cancelBtn.disabled = false;
        } else if (status.isComplete) {
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.disabled = true;
        }
    }
    
    removeBatchCard(batchId) {
        const card = document.querySelector(`[data-batch-id="${batchId}"]`);
        if (card) {
            card.classList.add('removing');
            setTimeout(() => {
                card.remove();
            }, 300);
        }
    }
    
    scheduleBatchCardRemoval(batchId) {
        // Remove card 5 seconds after completion
        setTimeout(() => {
            this.removeBatchCard(batchId);
        }, 5000);
    }
    
    toggleMinimizeBatchCard(batchId) {
        const card = document.querySelector(`[data-batch-id="${batchId}"]`);
        if (card) {
            card.classList.toggle('minimized');
            const btn = card.querySelector('.minimize-btn');
            if (btn) {
                btn.textContent = card.classList.contains('minimized') ? '+' : '−';
            }
        }
    }
    
    closeBatchCard(batchId) {
        this.removeBatchCard(batchId);
    }
    
    async checkActiveBatches() {
        try {
            const response = await fetch('/api/batch/status');
            const data = await response.json();
            
            if (data.success) {
                let hasActiveBatches = false;
                
                // Handle multiple batches format
                if (data.data.batches && data.data.batches.length > 0) {
                    data.data.batches.forEach(batch => {
                        if (!batch.isComplete) {
                            hasActiveBatches = true;
                            
                            // Check if card already exists
                            if (!document.querySelector(`[data-batch-id="${batch.batchId}"]`)) {
                                // Create batch info object with album hierarchy
                                const batchInfo = {
                                    name: batch.name || 'Batch Processing',
                                    albumKey: batch.albumKey,
                                    total: batch.total,
                                    albumHierarchy: batch.albumHierarchy
                                };
                                
                                // If albumHierarchy not present but albumKey is, fetch it
                                if (!batch.albumHierarchy && batch.albumKey) {
                                    // Find album in loaded albums
                                    const album = this.albums?.find(a => a.NodeID === batch.albumKey);
                                    if (album) {
                                        batchInfo.albumHierarchy = album.PathHierarchy;
                                    }
                                }
                                
                                this.createBatchCard(batch.batchId, batchInfo);
                            }
                            
                            // Update the card with current status
                            this.updateBatchCard(batch.batchId, batch);
                        }
                    });
                } 
                // Handle single batch format (backward compatibility)
                else if (data.data.batchId && !data.data.isComplete) {
                    hasActiveBatches = true;
                    const batch = data.data;
                    
                    if (!document.querySelector(`[data-batch-id="${batch.batchId}"]`)) {
                        // Create batch info object
                        const batchInfo = {
                            name: batch.name || 'Batch Processing',
                            albumKey: batch.albumKey,
                            total: batch.total,
                            albumHierarchy: batch.albumHierarchy
                        };
                        
                        // If albumHierarchy not present but albumKey is, fetch it
                        if (!batch.albumHierarchy && batch.albumKey) {
                            // Find album in loaded albums
                            const album = this.albums?.find(a => a.NodeID === batch.albumKey);
                            if (album) {
                                batchInfo.albumHierarchy = album.PathHierarchy;
                            }
                        }
                        
                        this.createBatchCard(batch.batchId, batchInfo);
                    }
                    
                    this.updateBatchCard(batch.batchId, batch);
                }
                
                // Start monitoring if there are active batches and not already monitoring
                if (hasActiveBatches && !this.batchProgressInterval) {
                    this.startProgressMonitoring();
                    console.log('Restored active batch monitoring after page refresh');
                    
                    // Also refresh album statuses to show animations
                    await this.refreshActiveProcessingAlbumStatuses();
                }
            }
        } catch (error) {
            console.error('Error checking active batches:', error);
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
                // Check if we have multiple batches format
                if (data.data.batches) {
                    // Multiple batches
                    this.displayMultipleBatchStatus(data.data.batches, data.data.statistics);
                    
                    // Check if any batch is complete
                    const completedBatches = data.data.batches.filter(b => b.isComplete);
                    const activeBatches = data.data.batches.filter(b => !b.isComplete);
                    
                    if (completedBatches.length > 0) {
                        completedBatches.forEach(batch => {
                            this.addMessage(`Batch "${batch.name}" completed! Processed: ${batch.processed}, Failed: ${batch.failed}`, 'assistant');
                        });
                        
                        // Refresh album statuses
                        await this.refreshVisibleAlbumStatuses();
                    }
                    
                    if (activeBatches.length === 0) {
                        // All batches complete
                        this.stopProgressMonitoring();
                        this.updateBatchControls('completed');
                        
                        // Update total scanned images after all batches complete
                        this.updateTotalScannedImages();
                        
                        // All batches complete - cards auto-remove after delay
                    }
                } else {
                    // Single batch (backward compatibility)
                    const status = data.data;
                    this.displayBatchStatus(status);

                    // Check if batch is complete
                    if (status.isComplete) {
                        this.stopProgressMonitoring();
                        this.updateBatchControls('completed');
                        this.showBatchResults(status);
                        this.addMessage(`Batch processing completed! Processed: ${status.processed}, Failed: ${status.failed}`, 'assistant');
                        
                        // Update total scanned images after batch completes
                        this.updateTotalScannedImages();
                        
                        // Single batch complete - card auto-removes after delay
                        
                        // Refresh album processing status for the processed album
                        if (this.selectedAlbumKey) {
                            await this.loadAlbumProcessingStatus(this.selectedAlbumKey);
                        }
                        
                        // Refresh all visible album statuses after completion
                        await this.refreshVisibleAlbumStatuses();
                    } else if (status.isPaused) {
                        this.updateBatchControls('paused');
                    } else {
                        // During active processing, refresh album statuses periodically
                        await this.refreshActiveProcessingAlbumStatuses();
                    }
                }
            }
        } catch (error) {
            console.error('Error updating batch progress:', error);
        }
    }

    displayMultipleBatchStatus(batches, statistics) {
        // Update individual batch cards
        batches.forEach(batch => {
            // Create card if it doesn't exist
            if (!document.querySelector(`[data-batch-id="${batch.batchId}"]`)) {
                this.createBatchCard(batch.batchId, {
                    name: batch.name || 'Batch Processing',
                    albumKey: batch.albumKey,
                    total: batch.total
                });
            }
            
            // Update the card
            this.updateBatchCard(batch.batchId, batch);
        });
        
        // If there's only one batch, also update the main progress display
        if (batches.length === 1) {
            this.displayBatchStatus(batches[0]);
        } else {
            // Multiple batches - update main progress with aggregate stats
            const activeBatches = batches.filter(b => !b.isComplete);
            const totalProcessed = batches.reduce((sum, b) => sum + b.processed, 0);
            const totalJobs = batches.reduce((sum, b) => sum + b.total, 0);
            const totalFailed = batches.reduce((sum, b) => sum + b.failed, 0);
            const percentage = totalJobs > 0 ? Math.round((totalProcessed / totalJobs) * 100) : 0;
            
            // Update main progress bar with aggregate stats
            const progressFill = document.getElementById('batchProgressFill');
            const progressPercentage = document.getElementById('progressPercentage');
            if (progressFill && progressPercentage) {
                progressFill.style.width = `${percentage}%`;
                progressPercentage.textContent = `${percentage}%`;
            }
            
            // Update counters with totals
            const processedCount = document.getElementById('processedCount');
            const totalCount = document.getElementById('totalCount');
            const failedCount = document.getElementById('failedCount');
            const remainingCount = document.getElementById('remainingCount');

            if (processedCount) processedCount.textContent = totalProcessed;
            if (totalCount) totalCount.textContent = totalJobs;
            if (failedCount) failedCount.textContent = totalFailed;
            if (remainingCount) remainingCount.textContent = totalJobs - totalProcessed;
            
            // Show active batches info
            const batchStatus = document.getElementById('batchStatus');
            if (batchStatus) {
                if (activeBatches.length === 0) {
                    batchStatus.textContent = 'All Completed';
                    batchStatus.className = 'batch-status completed';
                } else {
                    batchStatus.textContent = `${activeBatches.length} Active Batches`;
                    batchStatus.className = 'batch-status processing';
                }
            }
            
            // Show batch list in current job area
            const currentJobName = document.getElementById('currentJobName');
            if (currentJobName && activeBatches.length > 0) {
                const batchList = activeBatches.map(b => {
                    const batchPercent = b.total > 0 ? Math.round((b.processed / b.total) * 100) : 0;
                    return `${b.name} (${batchPercent}%)`;
                }).join(', ');
                currentJobName.textContent = batchList;
                currentJobName.title = batchList;
            }
        }
    }

    displayBatchStatus(status) {
        // Update batch card if it exists
        if (status.batchId) {
            this.updateBatchCard(status.batchId, status);
        }
        
        const percentage = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
        
        // Update main progress bar (existing functionality)
        const progressFill = document.getElementById('batchProgressFill');
        const progressPercentage = document.getElementById('progressPercentage');
        if (progressFill && progressPercentage) {
            progressFill.style.width = `${percentage}%`;
            progressPercentage.textContent = `${percentage}%`;
        }

        // Update counters (main progress)
        const processedCount = document.getElementById('processedCount');
        const totalCount = document.getElementById('totalCount');
        const failedCount = document.getElementById('failedCount');
        const remainingCount = document.getElementById('remainingCount');

        if (processedCount) processedCount.textContent = status.processed || 0;
        if (totalCount) totalCount.textContent = status.total || 0;
        if (failedCount) failedCount.textContent = status.failed || 0;
        if (remainingCount) remainingCount.textContent = (status.total - status.processed) || 0;

        // Update status (main progress)
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
        let currentJobText = 'Waiting...';
        
        if (status.currentJob) {
            if (status.currentJob.albumHierarchy && Array.isArray(status.currentJob.albumHierarchy)) {
                // Show just the album hierarchy
                currentJobText = status.currentJob.albumHierarchy.join(' > ');
            } else if (status.currentJob.albumName) {
                // Fallback to album name if hierarchy not available
                currentJobText = status.currentJob.albumName;
            } else {
                currentJobText = 'Processing...';
            }
        } else if (status.isComplete) {
            currentJobText = 'All jobs completed';
        } else if (status.isProcessing) {
            currentJobText = 'Processing...';
        }

        if (currentJobName) {
            currentJobName.textContent = currentJobText;
            currentJobName.title = currentJobText; // Full text in tooltip
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

    async refreshVisibleAlbumStatuses() {
        // Refresh all visible album statuses (used after batch completion)
        const albumItems = document.querySelectorAll('.album-item[data-album-key]');
        
        // Process in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < albumItems.length; i += batchSize) {
            const batch = Array.from(albumItems).slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(albumItem => {
                    const albumKey = albumItem.dataset.albumKey;
                    return albumKey ? this.loadAlbumProcessingStatus(albumKey) : Promise.resolve();
                })
            );
            
            // Small delay between batches
            if (i + batchSize < albumItems.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    async refreshActiveProcessingAlbumStatuses() {
        // Refresh album statuses during active processing (more conservative)
        // Only refresh selected album and a few visible albums to avoid server overload
        
        // Always refresh the selected album
        if (this.selectedAlbumKey) {
            await this.loadAlbumProcessingStatus(this.selectedAlbumKey);
        }
        
        // Refresh a limited number of visible albums on a rotating basis
        const albumItems = document.querySelectorAll('.album-item[data-album-key]');
        if (albumItems.length > 0) {
            // Initialize refresh counter if not exists
            if (!this.albumRefreshCounter) {
                this.albumRefreshCounter = 0;
            }
            
            // Refresh 2-3 albums per update cycle in rotation
            const refreshCount = Math.min(3, albumItems.length);
            for (let i = 0; i < refreshCount; i++) {
                const albumIndex = (this.albumRefreshCounter + i) % albumItems.length;
                const albumItem = albumItems[albumIndex];
                const albumKey = albumItem.dataset.albumKey;
                
                if (albumKey && albumKey !== this.selectedAlbumKey) {
                    await this.loadAlbumProcessingStatus(albumKey);
                }
            }
            
            // Update counter for next cycle
            this.albumRefreshCounter = (this.albumRefreshCounter + refreshCount) % albumItems.length;
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
    
    // Album Filter and Sort Methods
    setupAlbumFilters() {
        const searchInput = document.getElementById('albumSearch');
        const statusFilter = document.getElementById('statusFilter');
        const levelFilter = document.getElementById('levelFilter');
        const sortOrder = document.getElementById('sortOrder');
        const clearFilters = document.getElementById('clearFilters');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterState.search = e.target.value;
                this.applyFilters();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterState.status = e.target.value;
                this.applyFilters();
            });
        }
        
        if (levelFilter) {
            levelFilter.addEventListener('change', (e) => {
                this.filterState.level = e.target.value;
                this.applyFilters();
            });
        }
        
        if (sortOrder) {
            sortOrder.addEventListener('change', (e) => {
                this.filterState.sort = e.target.value;
                this.applyFilters();
            });
        }
        
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
    }
    
    applyFilters() {
        let filtered = [...this.albumsData];
        
        // Apply search filter
        if (this.filterState.search.trim()) {
            const searchTerm = this.filterState.search.toLowerCase().trim();
            filtered = filtered.filter(album => {
                const name = (album.Name || '').toLowerCase();
                const path = (album.FullDisplayPath || '').toLowerCase();
                return name.includes(searchTerm) || path.includes(searchTerm);
            });
        }
        
        // Apply status filter
        if (this.filterState.status !== 'all') {
            filtered = filtered.filter(album => {
                const status = this.getAlbumProcessingStatus(album);
                return status === this.filterState.status;
            });
        }
        
        // Apply level filter
        if (this.filterState.level !== 'all') {
            const level = this.filterState.level;
            filtered = filtered.filter(album => {
                const albumLevel = album.IndentLevel || 0;
                if (level === '0') return albumLevel === 0;
                if (level === '1') return albumLevel === 1;
                if (level === '2') return albumLevel >= 2;
                return true;
            });
        }
        
        // Apply sorting
        this.sortAlbums(filtered);
        
        this.filteredAlbums = filtered;
        this.renderFilteredAlbums();
        this.addInfiniteScrollLoader(albumsList);
        this.updateActiveFilters();
        this.updateAlbumCount();
    }
    
    sortAlbums(albums) {
        switch (this.filterState.sort) {
            case 'name-asc':
                albums.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                break;
            case 'name-desc':
                albums.sort((a, b) => (b.Name || '').localeCompare(a.Name || ''));
                break;
            case 'count-desc':
                albums.sort((a, b) => (b.ImageCount || 0) - (a.ImageCount || 0));
                break;
            case 'count-asc':
                albums.sort((a, b) => (a.ImageCount || 0) - (b.ImageCount || 0));
                break;
            case 'level-asc':
                albums.sort((a, b) => (a.IndentLevel || 0) - (b.IndentLevel || 0));
                break;
            case 'date-desc':
                albums.sort((a, b) => this.compareDates(b.Date, a.Date));
                break;
            case 'date-asc':
                albums.sort((a, b) => this.compareDates(a.Date, b.Date));
                break;
            case 'updated-desc':
                albums.sort((a, b) => this.compareDates(b.LastUpdated, a.LastUpdated));
                break;
            case 'updated-asc':
                albums.sort((a, b) => this.compareDates(a.LastUpdated, b.LastUpdated));
                break;
        }
    }
    
    compareDates(dateA, dateB) {
        // Handle missing dates (treat as very old)
        const defaultDate = new Date('1970-01-01');
        const parsedA = dateA ? new Date(dateA) : defaultDate;
        const parsedB = dateB ? new Date(dateB) : defaultDate;
        
        // Handle invalid dates
        const timeA = isNaN(parsedA.getTime()) ? defaultDate.getTime() : parsedA.getTime();
        const timeB = isNaN(parsedB.getTime()) ? defaultDate.getTime() : parsedB.getTime();
        
        return timeA - timeB;
    }
    
    getAlbumProcessingStatus(album) {
        // Get the processing status from the DOM element since it's loaded asynchronously
        const statusElement = document.getElementById(`processing-status-${album.AlbumKey}`);
        if (!statusElement) return 'unprocessed';
        
        // Check the content to determine status
        const statusHTML = statusElement.innerHTML;
        
        if (statusHTML.includes('processing-complete') || statusHTML.includes('All ') && statusHTML.includes('images processed')) {
            return 'processed';
        } else if (statusHTML.includes('processing-partial') || statusHTML.includes('remaining to process')) {
            return 'partial';
        } else {
            return 'unprocessed';
        }
    }
    
    renderFilteredAlbums() {
        const albumsList = document.getElementById('albumsList');
        if (!albumsList) return;
        
        if (this.filteredAlbums.length === 0) {
            albumsList.innerHTML = '<div class="no-albums">No albums match the current filters.</div>';
            return;
        }
        
        // Use the existing album rendering logic
        albumsList.innerHTML = this.filteredAlbums.map(album => {
            const indentLevel = album.IndentLevel || 0;
            const displayPath = album.FullDisplayPath || album.Name || 'Untitled Album';
            
            // Determine album name class based on hierarchy level
            let albumNameClass = 'album-name';
            if (indentLevel === 0 || indentLevel === 1) {
                albumNameClass = 'album-name-small'; // Year level
            } else if (indentLevel === 2) {
                albumNameClass = 'path-level-2'; // Event level
            } else {
                albumNameClass = 'album-name-small'; // Sub-album level
            }
            
            const hierarchyIndicator = indentLevel > 0 ? 
                `${'📁'.repeat(Math.min(indentLevel, 3))} ` : '📁 ';

            return `
                <div class="album-item" data-album-key="${album.AlbumKey}">
                   <!-- <div class="album-card-header">
                        <div class="album-hierarchy">
                            // <span class="album-hierarchy-icon">${hierarchyIndicator}</span>
                            // <span class="hierarchy-level">Level ${indentLevel}</span>
                        </div>
                        <h4 class="${albumNameClass}">${album.Name || 'Untitled Album'}</h4>
                    </div> -->
                    
                    <div class="album-card-content">
                        <div class="album-card-path">
                            ${this.formatPathWithLevels(displayPath)}
                        </div>
                        
                        <div class="album-metadata">
                            <div class="metadata-item">
                                <span class="metadata-label">📷</span>
                                <span class="metadata-value">${album.ImageCount || 0}</span>
                            </div>
                            <div class="metadata-item excluded-count" id="excluded-count-${album.AlbumKey}" style="display: none;">
                                <span class="metadata-label">❌</span>
                                <span class="metadata-value excluded-value">0</span>
                            </div>
                            ${album.Date ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">📅</span>
                                    <span class="metadata-value">${this.formatDate(album.Date)}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="album-processing-status" id="processing-status-${album.AlbumKey}">
                            <div class="processing-none">
                                <span class="loading-spinner"></span>
                                <span>Checking processing status...</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers for album preview (entire card is clickable)
        albumsList.querySelectorAll('.album-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const albumKey = e.currentTarget.dataset.albumKey;
                const album = this.filteredAlbums.find(a => a.AlbumKey === albumKey);
                const albumName = album?.Name || 'Untitled Album';
                await this.previewAlbumImages(albumKey, albumName);
            });
        });
        
        
        // Load processing status for filtered albums
        this.loadProcessingStatusForFilteredAlbums();
        
        // Initialize excluded counts display for all albums
        this.filteredAlbums.forEach(album => {
            this.updateAlbumExcludedDisplay(album.AlbumKey);
        });
    }
    
    async loadProcessingStatusForFilteredAlbums() {
        // Use the same progressive loading approach as the main album loading
        this.initializeAlbumStatusObserver();
    }
    
    updateActiveFilters() {
        const activeFiltersContainer = document.getElementById('activeFilters');
        const filterTags = document.getElementById('filterTags');
        
        if (!activeFiltersContainer || !filterTags) return;
        
        const activeTags = [];
        
        if (this.filterState.search.trim()) {
            activeTags.push({ type: 'search', label: `Search: "${this.filterState.search}"` });
        }
        
        if (this.filterState.status !== 'all') {
            const statusLabels = {
                'processed': 'Fully Processed',
                'partial': 'Partially Processed',
                'unprocessed': 'Unprocessed',
                'failed': 'Failed'
            };
            activeTags.push({ type: 'status', label: `Status: ${statusLabels[this.filterState.status]}` });
        }
        
        if (this.filterState.level !== 'all') {
            const levelLabels = {
                '0': 'Root Only',
                '1': 'Level 1',
                '2': 'Level 2+'
            };
            activeTags.push({ type: 'level', label: `Level: ${levelLabels[this.filterState.level]}` });
        }
        
        if (this.filterState.sort !== 'date-desc') {
            const sortLabels = {
                'name-asc': 'Name A-Z',
                'name-desc': 'Name Z-A',
                'count-desc': 'Image Count (High-Low)',
                'count-asc': 'Image Count (Low-High)',
                'level-asc': 'Hierarchy Level',
                'date-desc': 'Date Created (Newest First)',
                'date-asc': 'Date Created (Oldest First)',
                'updated-desc': 'Last Updated (Newest First)',
                'updated-asc': 'Last Updated (Oldest First)'
            };
            activeTags.push({ type: 'sort', label: `Sort: ${sortLabels[this.filterState.sort]}` });
        }
        
        if (activeTags.length > 0) {
            filterTags.innerHTML = activeTags.map(tag => `
                <span class="filter-tag">
                    ${tag.label}
                    <button class="filter-tag-remove" onclick="photoVision.removeFilter('${tag.type}')">×</button>
                </span>
            `).join('');
            activeFiltersContainer.style.display = 'flex';
        } else {
            activeFiltersContainer.style.display = 'none';
        }
    }
    
    removeFilter(filterType) {
        switch (filterType) {
            case 'search':
                this.filterState.search = '';
                document.getElementById('albumSearch').value = '';
                break;
            case 'status':
                this.filterState.status = 'all';
                document.getElementById('statusFilter').value = 'all';
                break;
            case 'level':
                this.filterState.level = 'all';
                document.getElementById('levelFilter').value = 'all';
                break;
            case 'sort':
                this.filterState.sort = 'date-desc';
                document.getElementById('sortOrder').value = 'date-desc';
                break;
        }
        this.applyFilters();
    }
    
    clearAllFilters() {
        this.filterState = {
            search: '',
            status: 'all',
            level: 'all',
            sort: 'date-desc'
        };
        
        // Reset form elements
        const searchInput = document.getElementById('albumSearch');
        const statusFilter = document.getElementById('statusFilter');
        const levelFilter = document.getElementById('levelFilter');
        const sortOrder = document.getElementById('sortOrder');
        
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (levelFilter) levelFilter.value = 'all';
        if (sortOrder) sortOrder.value = 'name-asc';
        
        this.applyFilters();
    }
    
    updateAlbumCount() {
        // Album count display removed from UI
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            
            // Format as MM/DD/YYYY or localized short date
            return date.toLocaleDateString();
        } catch (error) {
            return 'Invalid Date';
        }
    }
    
    formatPathWithLevels(displayPath) {
        if (!displayPath) return '';
        
        // Split the path by '>' separator and clean up whitespace
        const pathParts = displayPath.split('>').map(part => part.trim()).filter(part => part.length > 0);
        
        if (pathParts.length === 0) return displayPath;
        
        // Format each part with appropriate styling
        const formattedParts = pathParts.map((part, index) => {
            const level = index + 1;
            let className = 'path-level-3'; // default for level 3+
            
            if (level === 1) {
                className = 'path-level-1';
            } else if (level === 2) {
                className = 'path-level-2';
            }
            
            return `<span class="${className}">${part}</span>`;
        });
        
        // Join without separators
        return formattedParts.join('');
    }
    
    // Keyword Editor Methods
    
    toggleKeywordEdit(imageKey) {
        const section = document.querySelector(`.metadata-section[data-image-key="${imageKey}"]`);
        if (!section) return;
        
        const viewMode = section.querySelector('.keywords-view-mode');
        const editMode = section.querySelector('.keywords-edit-mode');
        const editBtn = section.querySelector('.keyword-edit-btn');
        
        if (editMode.style.display === 'none') {
            // Enter edit mode
            section.classList.add('editing');
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editBtn.style.display = 'none';
            
            // Store original keywords for cancel functionality
            const currentKeywords = this.getCurrentImageKeywords(imageKey);
            section.dataset.originalKeywords = JSON.stringify(currentKeywords);
            
            // Focus the input
            const input = editMode.querySelector('.keyword-input');
            if (input) input.focus();
        } else {
            // Exit edit mode
            section.classList.remove('editing');
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            editBtn.style.display = 'block';
        }
    }
    
    getCurrentImageKeywords(imageKey) {
        // Get keywords from the current swiper slide or search results
        if (this.lightboxSwiper && this.lightboxSwiper.slides) {
            const activeSlide = this.lightboxSwiper.slides[this.lightboxSwiper.activeIndex];
            if (activeSlide) {
                const currentData = this.lightboxSwiper.params.customData[this.lightboxSwiper.activeIndex];
                if (currentData && (currentData.smugmugImageKey === imageKey || currentData.imageKey === imageKey || currentData.id === imageKey)) {
                    return currentData.keywords || [];
                }
            }
        }
        return [];
    }
    
    addKeyword(imageKey, keyword) {
        keyword = keyword.trim();
        if (!keyword) return;
        
        const section = document.querySelector(`.metadata-section[data-image-key="${imageKey}"]`);
        if (!section) return;
        
        const keywordsContainer = section.querySelector('.editable-keywords');
        const currentKeywords = Array.from(keywordsContainer.querySelectorAll('.editable-keyword'))
            .map(el => el.textContent.trim().replace('×', '').trim());
        
        // Check for duplicates
        if (currentKeywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
            alert('This keyword already exists');
            return;
        }
        
        // Add the keyword to the UI
        const keywordHtml = `
            <span class="editable-keyword">
                ${keyword}
                <button class="remove-keyword" onclick="window.photoVision.removeKeyword('${imageKey}', ${currentKeywords.length})">×</button>
            </span>
        `;
        keywordsContainer.insertAdjacentHTML('beforeend', keywordHtml);
    }
    
    removeKeyword(imageKey, index) {
        const section = document.querySelector(`.metadata-section[data-image-key="${imageKey}"]`);
        if (!section) return;
        
        const keywordElements = section.querySelectorAll('.editable-keyword');
        if (keywordElements[index]) {
            keywordElements[index].remove();
        }
    }
    
    async saveKeywords(imageKey) {
        const section = document.querySelector(`.metadata-section[data-image-key="${imageKey}"]`);
        if (!section) return;
        
        // Get current keywords from UI
        const keywordsContainer = section.querySelector('.editable-keywords');
        const keywords = Array.from(keywordsContainer.querySelectorAll('.editable-keyword'))
            .map(el => el.textContent.trim().replace('×', '').trim())
            .filter(k => k.length > 0);
        
        // Show loading state
        const saveBtn = section.querySelector('.btn-save-keywords');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        try {
            // Send update to server
            const response = await fetch(`/api/images/${encodeURIComponent(imageKey)}/keywords`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save keywords');
            }
            
            const result = await response.json();
            
            // Update the view mode with new keywords
            const viewKeywords = section.querySelector('.metadata-keywords');
            viewKeywords.innerHTML = keywords.length > 0 
                ? keywords.map(k => `<span class="metadata-keyword">${k}</span>`).join('')
                : '<span class="no-keywords">No keywords yet</span>';
            
            // Update the data in swiper if in lightbox
            if (this.lightboxSwiper && this.lightboxSwiper.params.customData) {
                const currentData = this.lightboxSwiper.params.customData[this.lightboxSwiper.activeIndex];
                if (currentData && (currentData.smugmugImageKey === imageKey || currentData.imageKey === imageKey || currentData.id === imageKey)) {
                    currentData.keywords = keywords;
                }
            }
            
            // Exit edit mode
            this.toggleKeywordEdit(imageKey);
            
            // Show success message
            this.showToast('Keywords saved successfully', 'success');
            
        } catch (error) {
            console.error('Error saving keywords:', error);
            alert('Failed to save keywords. Please try again.');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }
    
    cancelKeywordEdit(imageKey) {
        const section = document.querySelector(`.metadata-section[data-image-key="${imageKey}"]`);
        if (!section) return;
        
        // Restore original keywords
        const originalKeywords = JSON.parse(section.dataset.originalKeywords || '[]');
        const keywordsContainer = section.querySelector('.editable-keywords');
        
        keywordsContainer.innerHTML = originalKeywords.length > 0 
            ? originalKeywords.map((keyword, index) => `
                <span class="editable-keyword">
                    ${keyword}
                    <button class="remove-keyword" onclick="window.photoVision.removeKeyword('${imageKey}', ${index})">×</button>
                </span>
            `).join('')
            : '';
        
        // Exit edit mode
        this.toggleKeywordEdit(imageKey);
    }
    
    showToast(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Star/Favorite Methods
    
    async loadStarredImages() {
        try {
            const response = await fetch('/api/images/starred/ids');
            const data = await response.json();
            
            if (data.success && data.data) {
                this.starredImages = new Set(data.data);
                this.starredImagesLoaded = true;
            }
        } catch (error) {
            console.error('Error loading starred images:', error);
            this.starredImages = new Set();
            this.starredImagesLoaded = true;
        }
    }
    
    isImageStarred(imageId) {
        return this.starredImages.has(imageId);
    }
    
    async toggleStar(imageId, buttonElement) {
        try {
            // Optimistic UI update
            const wasStarred = this.starredImages.has(imageId);
            
            if (wasStarred) {
                this.starredImages.delete(imageId);
                if (buttonElement) {
                    buttonElement.classList.remove('starred');
                    buttonElement.title = 'Add to favorites';
                }
            } else {
                this.starredImages.add(imageId);
                if (buttonElement) {
                    buttonElement.classList.add('starred');
                    buttonElement.title = 'Remove from favorites';
                }
            }
            
            // Make API call
            const response = await fetch('/api/images/toggle-star', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update all star buttons for this image
                this.updateAllStarButtons(imageId, data.data.isStarred);
                
                // If we're on the starred tab, refresh it
                if (this.getCurrentTab() === 'starred') {
                    this.loadStarredTab();
                }
                
                // Show toast notification
                this.showToast(data.data.isStarred ? 'Added to favorites' : 'Removed from favorites', 'success');
            } else {
                // Revert on error
                if (wasStarred) {
                    this.starredImages.add(imageId);
                    if (buttonElement) {
                        buttonElement.classList.add('starred');
                        buttonElement.title = 'Remove from favorites';
                    }
                } else {
                    this.starredImages.delete(imageId);
                    if (buttonElement) {
                        buttonElement.classList.remove('starred');
                        buttonElement.title = 'Add to favorites';
                    }
                }
                
                this.showToast('Failed to update favorite status', 'error');
            }
        } catch (error) {
            console.error('Error toggling star:', error);
            this.showToast('Failed to update favorite status', 'error');
        }
    }
    
    updateAllStarButtons(imageId, isStarred) {
        // Update all star buttons for this image
        const starButtons = document.querySelectorAll(`.star-btn[data-image-key="${imageId}"]`);
        starButtons.forEach(btn => {
            if (isStarred) {
                btn.classList.add('starred');
                btn.title = 'Remove from favorites';
            } else {
                btn.classList.remove('starred');
                btn.title = 'Add to favorites';
            }
        });
        
        // Update inline star buttons
        const inlineStarButtons = document.querySelectorAll(`.star-btn-inline[data-image-key="${imageId}"]`);
        inlineStarButtons.forEach(btn => {
            if (isStarred) {
                btn.classList.add('starred');
                btn.textContent = '★ Starred';
            } else {
                btn.classList.remove('starred');
                btn.textContent = '☆ Star';
            }
        });
    }
    
    async loadStarredTab() {
        const starredPanel = document.getElementById('starredTab');
        if (!starredPanel) return;
        
        try {
            // Show loading state
            starredPanel.innerHTML = `
                <div class="starred-tab-content">
                    <div class="starred-header">
                        <h2 class="starred-title">
                            <span>⭐</span> Starred Images
                        </h2>
                        <span class="starred-count">Loading...</span>
                    </div>
                    <div class="search-results-loading">Loading starred images...</div>
                </div>
            `;
            
            // Fetch starred images
            const response = await fetch('/api/images/starred');
            const data = await response.json();
            
            if (data.success && data.data) {
                const starredImages = data.data;
                
                if (starredImages.length === 0) {
                    starredPanel.innerHTML = `
                        <div class="starred-tab-content">
                            <div class="starred-header">
                                <h2 class="starred-title">
                                    <span>⭐</span> Starred Images
                                </h2>
                                <span class="starred-count">0 images</span>
                            </div>
                            <div class="starred-empty">
                                <div class="starred-empty-icon">⭐</div>
                                <div class="starred-empty-message">No starred images yet</div>
                                <div class="starred-empty-hint">Click the star icon on any image to save it to your favorites</div>
                            </div>
                        </div>
                    `;
                } else {
                    let html = `
                        <div class="starred-tab-content">
                            <div class="starred-header">
                                <h2 class="starred-title">
                                    <span>⭐</span> Starred Images
                                </h2>
                                <span class="starred-count">${starredImages.length} image${starredImages.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="starred-images-grid">
                    `;
                    
                    starredImages.forEach((photo, index) => {
                        const photoId = `starred-${Date.now()}-${index}`;
                        
                        html += `
                            <div class="minimal-result-card">
                                ${createImageContainer(photo, photoId)}
                                <div class="card-actions">
                                    <button class="card-btn info-btn" onclick="window.photoVision.showMetadataModal('${photoId}')">
                                        Details
                                    </button>
                                    ${photo.smugmugUrl ? `
                                        <a href="${photo.smugmugUrl}" target="_blank" class="card-btn download-btn" download>
                                            Download
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                        
                        // Store photo data for modal
                        this.storePhotoData(photoId, photo);
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                    
                    starredPanel.innerHTML = html;
                    
                    // Add lightbox handlers
                    this.addLightboxHandlers(starredPanel, starredImages);
                }
            } else {
                throw new Error(data.error || 'Failed to load starred images');
            }
        } catch (error) {
            console.error('Error loading starred tab:', error);
            starredPanel.innerHTML = `
                <div class="starred-tab-content">
                    <div class="starred-header">
                        <h2 class="starred-title">
                            <span>⭐</span> Starred Images
                        </h2>
                    </div>
                    <div class="error-message">
                        Failed to load starred images. Please try again.
                    </div>
                </div>
            `;
        }
    }
    
    getCurrentTab() {
        const activeTab = document.querySelector('.tab-btn.active');
        return activeTab ? activeTab.dataset.tab : null;
    }

    // Search Controls Methods
    
    initializeSearchControls() {
        // Load saved search mode
        const savedMode = localStorage.getItem('photovision-search-mode') || 'smart';
        const savedOptions = localStorage.getItem('photovision-search-options');
        
        if (savedOptions) {
            try {
                this.searchOptions = JSON.parse(savedOptions);
                this.searchMode = this.searchOptions.mode;
            } catch (e) {
                console.error('Error loading saved search options:', e);
            }
        }
        
        // Set initial UI state
        this.updateSearchModeUI(this.searchMode);
        this.updateSearchOptionsUI();
        
        // Mode selector buttons
        const modeButtons = document.querySelectorAll('.search-mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setSearchMode(mode);
            });
        });
        
        // Quick option checkboxes
        const includeSimilar = document.getElementById('includeSimilar');
        const requireAll = document.getElementById('requireAll');
        const descriptionsOnly = document.getElementById('descriptionsOnly');
        
        includeSimilar.addEventListener('change', () => {
            this.searchOptions.semanticExpansion = includeSimilar.checked;
            this.saveSearchOptions();
        });
        
        requireAll.addEventListener('change', () => {
            this.searchOptions.requireAllTerms = requireAll.checked;
            this.saveSearchOptions();
        });
        
        descriptionsOnly.addEventListener('change', () => {
            if (descriptionsOnly.checked) {
                this.searchOptions.searchFields = ['description'];
            } else {
                this.searchOptions.searchFields = ['keywords', 'description', 'title', 'caption', 'album'];
            }
            this.updateFieldCheckboxes();
            this.saveSearchOptions();
        });
        
        // Custom panel controls
        const minScoreSlider = document.getElementById('minScore');
        const minScoreValue = document.getElementById('minScoreValue');
        
        minScoreSlider.addEventListener('input', () => {
            minScoreValue.textContent = minScoreSlider.value;
            this.searchOptions.minScore = parseInt(minScoreSlider.value);
            this.saveSearchOptions();
        });
        
        // Field checkboxes
        const fieldCheckboxes = document.querySelectorAll('input[name="searchField"]');
        fieldCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSearchFieldsFromCheckboxes();
                this.saveSearchOptions();
            });
        });
    }
    
    setSearchMode(mode) {
        this.searchMode = mode;
        this.searchOptions.mode = mode;
        
        // Update options based on mode
        switch (mode) {
            case 'exact':
                this.searchOptions.semanticExpansion = false;
                this.searchOptions.partialMatches = false;
                break;
            case 'smart':
                this.searchOptions.semanticExpansion = true;
                this.searchOptions.partialMatches = false;
                break;
            case 'fuzzy':
                this.searchOptions.semanticExpansion = true;
                this.searchOptions.partialMatches = true;
                break;
            case 'custom':
                // Keep current settings
                break;
        }
        
        this.updateSearchModeUI(mode);
        this.updateSearchOptionsUI();
        this.saveSearchOptions();
        
        // Show/hide custom panel
        const customPanel = document.getElementById('customSearchPanel');
        customPanel.style.display = mode === 'custom' ? 'block' : 'none';
    }
    
    updateSearchModeUI(mode) {
        const modeButtons = document.querySelectorAll('.search-mode-btn');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }
    
    updateSearchOptionsUI() {
        document.getElementById('includeSimilar').checked = this.searchOptions.semanticExpansion;
        document.getElementById('requireAll').checked = this.searchOptions.requireAllTerms;
        document.getElementById('descriptionsOnly').checked = 
            this.searchOptions.searchFields.length === 1 && this.searchOptions.searchFields[0] === 'description';
        document.getElementById('minScore').value = this.searchOptions.minScore;
        document.getElementById('minScoreValue').textContent = this.searchOptions.minScore;
        
        this.updateFieldCheckboxes();
    }
    
    updateFieldCheckboxes() {
        const fieldCheckboxes = document.querySelectorAll('input[name="searchField"]');
        fieldCheckboxes.forEach(checkbox => {
            checkbox.checked = this.searchOptions.searchFields.includes(checkbox.value);
        });
    }
    
    updateSearchFieldsFromCheckboxes() {
        const fieldCheckboxes = document.querySelectorAll('input[name="searchField"]:checked');
        this.searchOptions.searchFields = Array.from(fieldCheckboxes).map(cb => cb.value);
        
        // Update descriptions only checkbox
        document.getElementById('descriptionsOnly').checked = 
            this.searchOptions.searchFields.length === 1 && this.searchOptions.searchFields[0] === 'description';
    }
    
    updateSearchControlsUI() {
        // Update search mode in UI
        this.searchMode = this.searchOptions.mode || 'smart';
        this.updateSearchModeUI(this.searchMode);
        
        // Update search options in UI
        this.updateSearchOptionsUI();
        
        // Show/hide custom panel based on mode
        const customPanel = document.getElementById('customSearchPanel');
        if (customPanel) {
            customPanel.style.display = this.searchMode === 'custom' ? 'block' : 'none';
        }
    }
    
    async performRefinedSearch(query) {
        // Add a message indicating the refined search
        const modeText = this.searchOptions.mode.charAt(0).toUpperCase() + this.searchOptions.mode.slice(1);
        this.addMessage(`Searching again with ${modeText} mode: "${query}"`, 'user');
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    message: query,
                    searchOptions: this.getSearchOptions()
                })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            if (data.success && data.data) {
                // Handle conversational search response
                this.addConversationalSearchMessage(data.data);
            } else {
                // Handle error message
                const errorMessage = data.error || 'Sorry, I encountered an error processing your request.';
                this.addMessage(errorMessage, 'assistant');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error while searching. Please try again.', 'assistant');
        }
    }
    
    saveSearchOptions() {
        localStorage.setItem('photovision-search-mode', this.searchMode);
        localStorage.setItem('photovision-search-options', JSON.stringify(this.searchOptions));
    }
    
    getSearchOptions() {
        return { ...this.searchOptions };
    }
    
    refineSearch(encodedContext, refinementType) {
        try {
            const searchContext = JSON.parse(decodeURIComponent(encodedContext));
            const { query, options } = searchContext;
            
            let newOptions;
            switch (refinementType) {
                case 'repeat':
                    // Use same options
                    newOptions = options;
                    break;
                case 'broaden':
                    newOptions = this.getLooserSearchOptions(options);
                    break;
                case 'narrow':
                    newOptions = this.getStricterSearchOptions(options);
                    break;
                default:
                    newOptions = options;
            }
            
            // Update search options in UI
            this.searchOptions = newOptions;
            this.updateSearchControlsUI();
            this.saveSearchOptions();
            
            // Perform the search directly without updating the input
            this.performRefinedSearch(query);
        } catch (error) {
            console.error('Error refining search:', error);
            this.addMessage('Sorry, I encountered an error refining the search.', 'assistant');
        }
    }
    
    getLooserSearchOptions(currentOptions) {
        const looserOptions = { ...currentOptions };
        
        // Progress mode: exact -> smart -> fuzzy
        if (currentOptions.mode === 'exact') {
            looserOptions.mode = 'smart';
            looserOptions.semanticExpansion = true;
        } else if (currentOptions.mode === 'smart') {
            looserOptions.mode = 'fuzzy';
            looserOptions.semanticExpansion = true;
            looserOptions.partialMatches = true;
        } else if (currentOptions.mode === 'custom' || currentOptions.mode === 'fuzzy') {
            // For custom/fuzzy mode, relax all settings
            looserOptions.semanticExpansion = true;
            looserOptions.partialMatches = true;
            looserOptions.requireAllTerms = false;
            looserOptions.minScore = Math.max(0, (currentOptions.minScore || 0) - 2);
            // Add more search fields if not all are selected
            if (!looserOptions.searchFields || looserOptions.searchFields.length < 5) {
                looserOptions.searchFields = ['keywords', 'description', 'title', 'caption', 'album'];
            }
        }
        
        return looserOptions;
    }
    
    getStricterSearchOptions(currentOptions) {
        const stricterOptions = { ...currentOptions };
        
        // Progress mode: fuzzy -> smart -> exact
        if (currentOptions.mode === 'fuzzy') {
            stricterOptions.mode = 'smart';
            stricterOptions.partialMatches = false;
        } else if (currentOptions.mode === 'smart') {
            stricterOptions.mode = 'exact';
            stricterOptions.semanticExpansion = false;
            stricterOptions.partialMatches = false;
        } else if (currentOptions.mode === 'custom' || currentOptions.mode === 'exact') {
            // For custom/exact mode, tighten all settings
            stricterOptions.semanticExpansion = false;
            stricterOptions.partialMatches = false;
            stricterOptions.requireAllTerms = true;
            stricterOptions.minScore = Math.min(10, (currentOptions.minScore || 0) + 2);
            // Reduce search fields to core ones
            if (stricterOptions.searchFields && stricterOptions.searchFields.length > 2) {
                stricterOptions.searchFields = ['keywords', 'description'];
            }
        }
        
        return stricterOptions;
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
            recordCountElement.textContent = data.data.count || 0;
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
    
    // Help block functionality
    const analysisHelpIcon = document.getElementById('analysisHelpIcon');
    const analysisHelpBlock = document.getElementById('analysisHelpBlock');
    
    if (analysisHelpIcon && analysisHelpBlock) {
        analysisHelpIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isVisible = analysisHelpBlock.style.display === 'block';
            analysisHelpBlock.style.display = isVisible ? 'none' : 'block';
        });
    }
    
    // Image Analysis Configuration functionality
    const enableCustomAnalysis = document.getElementById('enableCustomAnalysis');
    const analysisTemplate = document.getElementById('analysisTemplate');
    const preContextInput = document.getElementById('preContextInput');
    const contextCharCount = document.getElementById('contextCharCount');
    const previewAccordionBtn = document.getElementById('previewAccordionBtn');
    const previewAccordionContent = document.getElementById('previewAccordionContent');
    const previewContent = document.getElementById('previewAccordionContent');
    const generatePreviewBtn = document.getElementById('generatePreview');
    const saveAnalysisConfigBtn = document.getElementById('saveAnalysisConfig');
    const resetAnalysisConfigBtn = document.getElementById('resetAnalysisConfig');
    
    // Load current configuration
    async function loadAnalysisConfig() {
        try {
            const response = await fetch('/api/admin/image-analysis-config');
            const data = await response.json();
            
            if (data.success) {
                const config = data.data;
                
                // Update UI with current config
                enableCustomAnalysis.checked = config.enabled;
                preContextInput.value = config.preContext || '';
                updateCharCount();
                updateImageAnalysisToggle();
                updatePreviewContent();
                
                // Update template selection
                if (config.template) {
                    analysisTemplate.value = config.template;
                }
            }
        } catch (error) {
            console.error('Error loading analysis config:', error);
        }
    }
    
    // Load available templates
    async function loadTemplates() {
        try {
            const response = await fetch('/api/admin/image-analysis-templates');
            const data = await response.json();
            
            if (data.success) {
                const templates = data.data;
                // Start with custom user input option
                analysisTemplate.innerHTML = '<option value="">Custom user input (use text area below)</option>';
                
                Object.values(templates).forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.id;
                    option.textContent = `${template.name} - ${template.description}`;
                    analysisTemplate.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    
    // Update character count
    function updateCharCount() {
        const count = preContextInput.value.length;
        contextCharCount.textContent = count;
        
        const charCountElement = contextCharCount.parentElement;
        charCountElement.classList.remove('warning', 'error');
        
        if (count > 1800) {
            charCountElement.classList.add('error');
        } else if (count > 1500) {
            charCountElement.classList.add('warning');
        }
    }
    
    
    // Toggle switch functionality for image analysis
    function updateImageAnalysisToggle() {
        const enableCustomAnalysis = document.getElementById('enableCustomAnalysis');
        const imageAnalysisToggle = document.querySelector('[data-toggle="image-analysis"]');
        const analysisStatus = document.getElementById('analysisStatus');
        
        if (imageAnalysisToggle && enableCustomAnalysis) {
            if (enableCustomAnalysis.checked) {
                imageAnalysisToggle.classList.add('active');
            } else {
                imageAnalysisToggle.classList.remove('active');
            }
        }
        
        // Update header analysis status indicator
        if (analysisStatus && enableCustomAnalysis) {
            if (enableCustomAnalysis.checked) {
                analysisStatus.classList.add('status-success');
            } else {
                analysisStatus.classList.remove('status-success');
            }
        }
    }
    
    // Force reprocessing toggle functionality
    function updateForceReprocessingToggle() {
        const forceReprocessingCheckbox = document.getElementById('forceReprocessing');
        const forceReprocessingToggle = document.querySelector('[data-toggle="force-reprocessing"]');
        
        if (forceReprocessingToggle && forceReprocessingCheckbox) {
            if (forceReprocessingCheckbox.checked) {
                forceReprocessingToggle.classList.add('active');
            } else {
                forceReprocessingToggle.classList.remove('active');
            }
        }
    }
    
    // Event listeners
    if (enableCustomAnalysis) {
        enableCustomAnalysis.addEventListener('change', async (event) => {
            updateCharCount();
            updateImageAnalysisToggle();
            
            // Don't save if this is a programmatic change (not trusted)
            if (!event.isTrusted) {
                return;
            }
            
            // Save the toggle state when changed directly in the UI
            try {
                const response = await fetch('/api/admin/image-analysis-config/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: enableCustomAnalysis.checked })
                });
                
                const data = await response.json();
                if (!data.success) {
                    console.error('Failed to save toggle state:', data.error);
                }
            } catch (error) {
                console.error('Error saving toggle state:', error);
            }
        });
    }
    
    // Add click handler for the toggle switch itself
    const imageAnalysisToggle = document.querySelector('[data-toggle="image-analysis"]');
    if (imageAnalysisToggle) {
        imageAnalysisToggle.addEventListener('click', async (event) => {
            // Prevent double-firing if clicking the checkbox directly
            if (event.target.tagName === 'INPUT') {
                return;
            }
            
            // Click the checkbox which will trigger its change event
            if (enableCustomAnalysis) {
                enableCustomAnalysis.click();
            }
        });
    }
    
    if (preContextInput) {
        preContextInput.addEventListener('input', () => {
            updateCharCount();
            debouncedUpdatePreview();
        });
    }
    
    // Auto-apply template when dropdown selection changes
    if (analysisTemplate) {
        analysisTemplate.addEventListener('change', async () => {
            const templateId = analysisTemplate.value;
            if (!templateId) {
                // Custom user input - do nothing, user manages textarea directly
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/image-analysis-templates/${templateId}`);
                const data = await response.json();
                
                if (data.success) {
                    preContextInput.value = data.data.preContext || '';
                    updateCharCount();
                    updatePreviewContent();
                } else {
                    console.error('Error loading template:', data.error);
                }
            } catch (error) {
                console.error('Error applying template:', error);
            }
        });
    }
    
    // Accordion functionality
    if (previewAccordionBtn && previewAccordionContent) {
        previewAccordionBtn.addEventListener('click', () => {
            const isOpen = previewAccordionContent.classList.contains('open');
            
            if (isOpen) {
                previewAccordionContent.classList.remove('open');
                previewAccordionBtn.classList.remove('active');
                previewAccordionBtn.setAttribute('aria-expanded', 'false');
            } else {
                previewAccordionContent.classList.add('open');
                previewAccordionBtn.classList.add('active');
                previewAccordionBtn.setAttribute('aria-expanded', 'true');
            }
        });
    }
    
    // Configuration Testing Accordion functionality
    const testingAccordionBtn = document.getElementById('testingAccordionBtn');
    const testingAccordionContent = document.getElementById('testingAccordionContent');
    
    if (testingAccordionBtn && testingAccordionContent) {
        testingAccordionBtn.addEventListener('click', async () => {
            const isOpen = testingAccordionContent.classList.contains('open');
            
            if (isOpen) {
                testingAccordionContent.classList.remove('open');
                testingAccordionBtn.classList.remove('active');
                testingAccordionBtn.setAttribute('aria-expanded', 'false');
            } else {
                testingAccordionContent.classList.add('open');
                testingAccordionBtn.classList.add('active');
                testingAccordionBtn.setAttribute('aria-expanded', 'true');
                
                // Load and display model configuration
                await loadTestModelConfig();
            }
        });
    }
    
    // Load and display model configuration for testing
    async function loadTestModelConfig() {
        const testModelNameElement = document.getElementById('testModelName');
        if (!testModelNameElement) return;
        
        try {
            const response = await fetch('/api/config/models');
            const data = await response.json();
            
            if (data.success && data.data) {
                const modelConfig = data.data;
                const batchModel = modelConfig.batchProcessingModel;
                
                // Find the model details
                const modelInfo = modelConfig.availableModels.find(m => m.id === batchModel);
                
                if (modelInfo) {
                    testModelNameElement.textContent = `${modelInfo.name} (${modelInfo.id})`;
                } else {
                    testModelNameElement.textContent = batchModel;
                }
            } else {
                testModelNameElement.textContent = 'Default model';
            }
        } catch (error) {
            console.error('Error loading model config:', error);
            testModelNameElement.textContent = 'Error loading model';
        }
    }
    
    // Configuration testing functionality
    const testUploadArea = document.getElementById('testUploadArea');
    const testFileInput = document.getElementById('testFileInput');
    const testProgress = document.getElementById('testProgress');
    const testProgressFill = document.getElementById('testProgressFill');
    const testProgressPercentage = document.getElementById('testProgressPercentage');
    const testStatus = document.getElementById('testStatus');
    const testCurrentFile = document.getElementById('testCurrentFile');
    const testProcessedCount = document.getElementById('testProcessedCount');
    const testTotalCount = document.getElementById('testTotalCount');
    const testResultsSummary = document.getElementById('testResultsSummary');
    const resultsSummaryText = document.getElementById('resultsSummaryText');
    const viewTestResults = document.getElementById('viewTestResults');
    const clearTestResults = document.getElementById('clearTestResults');
    const testResultsModal = document.getElementById('testResultsModal');
    const testResultsModalBody = document.getElementById('testResultsModalBody');
    const modalResultsContainer = document.getElementById('modalResultsContainer');
    const modalResultsCount = document.getElementById('modalResultsCount');
    const closeTestResultsModal = document.getElementById('closeTestResultsModal');
    const closeTestResultsModalBtn = document.getElementById('closeTestResultsModalBtn');
    const clearTestResultsModal = document.getElementById('clearTestResultsModal');
    const enableComparison = document.getElementById('enableComparison');
    
    // Set up drag and drop for test upload area
    if (testUploadArea) {
        testUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            testUploadArea.classList.add('drag-over');
        });

        testUploadArea.addEventListener('dragleave', () => {
            testUploadArea.classList.remove('drag-over');
        });

        testUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            testUploadArea.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            if (files.length > 0) {
                handleConfigTestUpload(files);
            }
        });
    }
    
    // Set up file input for test upload
    if (testFileInput) {
        testFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                handleConfigTestUpload(files);
            }
        });
    }
    
    // Modal event listeners
    if (viewTestResults) {
        viewTestResults.addEventListener('click', () => {
            showTestResultsModal();
        });
    }
    
    if (closeTestResultsModal) {
        closeTestResultsModal.addEventListener('click', () => {
            hideTestResultsModal();
        });
    }
    
    if (closeTestResultsModalBtn) {
        closeTestResultsModalBtn.addEventListener('click', () => {
            hideTestResultsModal();
        });
    }
    
    // Clear test results
    if (clearTestResults) {
        clearTestResults.addEventListener('click', () => {
            clearAllTestResults();
        });
    }
    
    if (clearTestResultsModal) {
        clearTestResultsModal.addEventListener('click', () => {
            clearAllTestResults();
            hideTestResultsModal();
        });
    }
    
    // Modal overlay click to close
    if (testResultsModal) {
        testResultsModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-results-modal-overlay')) {
                hideTestResultsModal();
            }
        });
    }
    
    
    // Comparison toggle functionality
    if (enableComparison) {
        enableComparison.addEventListener('change', () => {
            // Re-display results if they exist
            if (testResultsContainer && testResultsContainer.children.length > 0) {
                // Get the current results data from the last analysis
                // For now, we'll need to re-run the analysis or store the results
                // Since we can't easily access the previous results, we'll add a note
                console.log('Comparison mode toggled. Upload new images to see the effect.');
            }
        });
    }
    
    // Keyboard accessibility for modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && testResultsModal && testResultsModal.style.display === 'flex') {
            hideTestResultsModal();
        }
    });
    
    // Handle configuration test upload
    async function handleConfigTestUpload(files) {
        if (!files || files.length === 0) return;
        
        // Validate files
        const validFiles = files.filter(file => {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (!validTypes.includes(file.type)) {
                alert(`Invalid file type: ${file.name}. Please select JPEG, PNG, GIF, or WebP images.`);
                return false;
            }
            
            if (file.size > maxSize) {
                alert(`File too large: ${file.name}. Maximum size is 10MB.`);
                return false;
            }
            
            return true;
        });
        
        if (validFiles.length === 0) return;
        
        // Show progress
        testProgress.style.display = 'block';
        testResultsSummary.style.display = 'none';
        testProgressFill.style.width = '0%';
        testProgressPercentage.textContent = '0%';
        testStatus.textContent = 'Preparing...';
        testTotalCount.textContent = validFiles.length;
        testProcessedCount.textContent = '0';
        
        try {
            // Create FormData with multiple files
            const formData = new FormData();
            validFiles.forEach((file, index) => {
                formData.append(`image${index}`, file);
            });
            
            // Process files one by one for progress tracking
            const results = [];
            
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                testCurrentFile.textContent = file.name;
                testStatus.textContent = `Processing ${file.name}...`;
                
                try {
                    // Create individual FormData for this file
                    const singleFormData = new FormData();
                    singleFormData.append('image0', file);
                    
                    // Create data URL for the image
                    const imageDataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    
                    const response = await fetch('/api/analyze/test', {
                        method: 'POST',
                        body: singleFormData
                    });
                    
                    const data = await response.json();
                    
                    if (data.success && data.data.results && data.data.results.length > 0) {
                        // Add the image data URL to the result
                        const result = data.data.results[0];
                        result.imageDataUrl = imageDataUrl;
                        results.push(result);
                    } else {
                        results.push({
                            filename: file.name,
                            success: false,
                            error: data.error || 'Unknown error',
                            imageDataUrl: imageDataUrl
                        });
                    }
                } catch (error) {
                    results.push({
                        filename: file.name,
                        success: false,
                        error: error.message
                    });
                }
                
                // Update progress
                const progress = Math.round(((i + 1) / validFiles.length) * 100);
                testProgressFill.style.width = `${progress}%`;
                testProgressPercentage.textContent = `${progress}%`;
                testProcessedCount.textContent = (i + 1).toString();
            }
            
            // Hide progress and show summary
            testProgress.style.display = 'none';
            
            // Store results for modal display
            window.lastTestResults = results;
            
            // Show summary
            showTestResultsSummary(results);
            
        } catch (error) {
            console.error('Test upload error:', error);
            testProgress.style.display = 'none';
            alert('Test upload failed. Please try again.');
        }
    }
    
    // Show test results summary
    function showTestResultsSummary(results) {
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        resultsSummaryText.textContent = `${successCount} of ${totalCount} images analyzed successfully`;
        testResultsSummary.style.display = 'block';
    }
    
    // Show test results modal
    function showTestResultsModal() {
        if (!window.lastTestResults) return;
        
        displayTestResults(window.lastTestResults);
        testResultsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Focus management
        closeTestResultsModal.focus();
    }
    
    // Hide test results modal
    function hideTestResultsModal() {
        testResultsModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    // Clear all test results
    function clearAllTestResults() {
        window.lastTestResults = null;
        testResultsSummary.style.display = 'none';
        modalResultsContainer.innerHTML = '';
    }
    
    // Display test results in modal
    function displayTestResults(results) {
        modalResultsContainer.innerHTML = '';
        
        // Update modal header count
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        modalResultsCount.textContent = `${successCount} of ${totalCount} images analyzed`;
        
        results.forEach((result, index) => {
            const resultCard = document.createElement('div');
            resultCard.className = `test-result-card ${result.success ? 'success' : 'error'}`;
            
            // Check if we have the new comparison format
            const hasComparison = result.customAnalysis && result.defaultAnalysis;
            const customSuccess = hasComparison ? result.customAnalysis.success : result.success;
            const defaultSuccess = hasComparison ? result.defaultAnalysis.success : null;
            
            let statusText = '';
            if (hasComparison) {
                const customStatus = customSuccess ? 'Custom: Success' : 'Custom: Failed';
                const defaultStatus = defaultSuccess ? 'Default: Success' : 'Default: Failed';
                statusText = `${customStatus} • ${defaultStatus}`;
            } else {
                statusText = result.success ? 'Analysis Successful' : 'Analysis Failed';
            }
            
            const statusIcon = result.success ? 
                '<svg class="result-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg>' :
                '<svg class="result-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            
            let contentHTML = `
                <div class="result-header-simple">
                    ${statusIcon}
                    <div class="result-info">
                        <h6>${result.filename}</h6>
                        <span class="result-status">${statusText}</span>
                    </div>
                </div>
                ${result.imageDataUrl ? `
                    <div class="test-image-preview" onclick="window.openImageModal('${result.imageDataUrl}', '${result.filename}')">
                        <img src="${result.imageDataUrl}" alt="${result.filename}" loading="lazy" />
                    </div>
                ` : ''}
                <div class="result-content">
            `;
            
            if (hasComparison) {
                // Show comparison view directly (no accordion)
                contentHTML += '<div class="comparison-container">';
                
                // Custom Analysis Column
                contentHTML += '<div class="analysis-column custom-analysis">';
                contentHTML += '<h6 class="analysis-header"><span class="analysis-badge custom">Custom Configuration</span></h6>';
                
                if (customSuccess) {
                    contentHTML += `
                        <div class="result-section">
                            <h6>Description:</h6>
                            <p class="analysis-description">${result.customAnalysis.description}</p>
                        </div>
                        <div class="result-section">
                            <h6>Keywords:</h6>
                            <div class="keywords-list">
                                ${result.customAnalysis.keywords.map(keyword => 
                                    `<span class="keyword-tag custom">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    contentHTML += `
                        <div class="result-section error">
                            <h6>Error:</h6>
                            <p class="error-message">${result.customAnalysis.error || 'Analysis failed'}</p>
                        </div>
                    `;
                }
                
                contentHTML += '</div>';
                
                // Default Analysis Column
                contentHTML += '<div class="analysis-column default-analysis">';
                contentHTML += '<h6 class="analysis-header"><span class="analysis-badge default">Default Analysis</span></h6>';
                
                if (defaultSuccess) {
                    contentHTML += `
                        <div class="result-section">
                            <h6>Description:</h6>
                            <p class="analysis-description">${result.defaultAnalysis.description}</p>
                        </div>
                        <div class="result-section">
                            <h6>Keywords:</h6>
                            <div class="keywords-list">
                                ${result.defaultAnalysis.keywords.map(keyword => 
                                    `<span class="keyword-tag default">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    contentHTML += `
                        <div class="result-section error">
                            <h6>Error:</h6>
                            <p class="error-message">${result.defaultAnalysis.error || 'Analysis failed'}</p>
                        </div>
                    `;
                }
                
                contentHTML += '</div>';
                contentHTML += '</div>'; // Close comparison-container
                
                // Add metadata section for comparison view
                if (customSuccess || defaultSuccess) {
                    const metadata = customSuccess ? result.customAnalysis.metadata : result.defaultAnalysis.metadata;
                    contentHTML += `
                        <div class="result-section metadata">
                            <h6>Metadata:</h6>
                            <div class="metadata-grid">
                                <div class="metadata-item">
                                    <span class="metadata-label">Model:</span>
                                    <span class="metadata-value">${metadata?.model || 'Unknown'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">File Size:</span>
                                    <span class="metadata-value">${formatFileSize(result.size)}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Type:</span>
                                    <span class="metadata-value">${result.mimeType}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                // Show single analysis view
                if (result.success && result.description) {
                    contentHTML += `
                        <div class="result-section">
                            <h6>Description:</h6>
                            <p class="analysis-description">${result.description}</p>
                        </div>
                        <div class="result-section">
                            <h6>Keywords:</h6>
                            <div class="keywords-list">
                                ${(result.keywords || []).map(keyword => 
                                    `<span class="keyword-tag">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                    
                    if (result.metadata) {
                        contentHTML += `
                            <div class="result-section metadata">
                                <h6>Metadata:</h6>
                                <div class="metadata-grid">
                                    <div class="metadata-item">
                                        <span class="metadata-label">Model:</span>
                                        <span class="metadata-value">${result.metadata.model || 'Unknown'}</span>
                                    </div>
                                    <div class="metadata-item">
                                        <span class="metadata-label">File Size:</span>
                                        <span class="metadata-value">${formatFileSize(result.size)}</span>
                                    </div>
                                    <div class="metadata-item">
                                        <span class="metadata-label">Type:</span>
                                        <span class="metadata-value">${result.mimeType}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    contentHTML += `
                        <div class="result-section error">
                            <h6>Error:</h6>
                            <p class="error-message">${result.error || 'Unknown error occurred'}</p>
                        </div>
                    `;
                }
            }
            
            contentHTML += '</div>'; // Close result-content
            resultCard.innerHTML = contentHTML;
            modalResultsContainer.appendChild(resultCard);
        });
    }
    
    // Helper function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Image modal functionality
    window.openImageModal = function(imageDataUrl, filename) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('imageEnlargeModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'imageEnlargeModal';
            modal.className = 'image-enlarge-modal';
            modal.innerHTML = `
                <div class="image-enlarge-content">
                    <button class="image-enlarge-close" onclick="window.closeImageModal()">&times;</button>
                    <img id="enlargedImage" src="" alt="" />
                    <div class="image-enlarge-caption"></div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    window.closeImageModal();
                }
            });
        }
        
        // Set image and show modal
        const img = modal.querySelector('#enlargedImage');
        const caption = modal.querySelector('.image-enlarge-caption');
        img.src = imageDataUrl;
        img.alt = filename;
        caption.textContent = filename;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };
    
    window.closeImageModal = function() {
        const modal = document.getElementById('imageEnlargeModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };
    
    // Close image modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const imageModal = document.getElementById('imageEnlargeModal');
            if (imageModal && imageModal.style.display === 'flex') {
                window.closeImageModal();
            }
        }
    });
    
    
    // Hot-load preview content function
    let previewUpdateTimeout;
    
    function updatePreviewContent() {
        const preContext = preContextInput.value.trim();
        
        // Default analysis instructions
        const defaultInstructions = `Please analyze this image in detail. Provide a comprehensive description and generate relevant keywords for indexing. Return your response as a JSON object with the following structure:

{
  "description": "A detailed description of the image...",
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

For the description, include:
1. Main subjects (people, objects, animals)
2. Setting and location type
3. Activities or actions taking place
4. Mood, lighting, and atmosphere
5. Colors, composition, and visual elements
6. Any text or signs visible
7. Time of day or season if apparent

For keywords, provide 5-10 relevant terms that would help with searching and indexing, such as:
- Main subjects (person, animal, object types)
- Activities (running, eating, playing)
- Settings (outdoor, indoor, beach, forest)
- Emotions/moods (happy, serious, peaceful)
- Visual elements (colorful, black and white, sunset)
- Equipment or objects visible

Be specific and descriptive to enable natural language searches like "photos of people laughing outdoors" or "sunset landscapes with mountains".`;
        
        // Combine pre-context with default instructions
        let completePrompt = defaultInstructions;
        if (preContext) {
            completePrompt = preContext + '\n\n' + defaultInstructions;
        }
        
        // Update preview content
        if (previewContent) {
            const placeholder = previewContent.querySelector('.preview-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // Create or update preview text
            let previewText = previewContent.querySelector('.preview-text');
            if (!previewText) {
                previewText = document.createElement('pre');
                previewText.className = 'preview-text';
                previewContent.appendChild(previewText);
            }
            
            previewText.textContent = completePrompt;
        }
    }
    
    // Debounced update function
    function debouncedUpdatePreview() {
        clearTimeout(previewUpdateTimeout);
        previewUpdateTimeout = setTimeout(updatePreviewContent, 300);
    }
    
    if (saveAnalysisConfigBtn) {
        saveAnalysisConfigBtn.addEventListener('click', async () => {
            const config = {
                // Don't include enabled field - it's managed separately now
                preContext: preContextInput.value,
                template: analysisTemplate.value,
                modifiedBy: 'admin'
            };
            
            try {
                const response = await fetch('/api/admin/image-analysis-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Configuration saved successfully!');
                } else {
                    alert('Error saving configuration: ' + data.error);
                }
            } catch (error) {
                console.error('Error saving config:', error);
                alert('Error saving configuration. Please try again.');
            }
        });
    }
    
    if (resetAnalysisConfigBtn) {
        resetAnalysisConfigBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to reset to default configuration? This will remove all custom settings.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/admin/image-analysis-config/reset', {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    enableCustomAnalysis.checked = false;
                    preContextInput.value = '';
                    analysisTemplate.value = '';
                    updateCharCount();
                    updateImageAnalysisToggle();
                    alert('Configuration reset to default!');
                } else {
                    alert('Error resetting configuration: ' + data.error);
                }
            } catch (error) {
                console.error('Error resetting config:', error);
                alert('Error resetting configuration. Please try again.');
            }
        });
    }
    
    // Add event listener for force reprocessing toggle
    const forceReprocessingCheckbox = document.getElementById('forceReprocessing');
    if (forceReprocessingCheckbox) {
        forceReprocessingCheckbox.addEventListener('change', updateForceReprocessingToggle);
    }
    
    // Initialize analysis configuration
    loadAnalysisConfig();
    loadTemplates();
    
    // Initialize toggle states and character count on page load
    setTimeout(() => {
        updateImageAnalysisToggle();
        updateForceReprocessingToggle();
        updateCharCount(); // Initialize character count for default text
    }, 100);
    
    // === MODEL CONFIGURATION FUNCTIONALITY ===
    
    // DOM elements for model configuration
    const chatModelSelect = document.getElementById('chatModelSelect');
    const batchModelSelect = document.getElementById('batchModelSelect');
    const saveModelConfigBtn = document.getElementById('saveModelConfig');
    const resetModelConfigBtn = document.getElementById('resetModelConfig');
    const modelInfo = document.getElementById('modelInfo');
    const chatModelInfo = document.getElementById('chatModelInfo');
    const batchModelInfo = document.getElementById('batchModelInfo');
    
    let currentModelConfig = null;
    
    // Load current model configuration
    async function loadModelConfig() {
        try {
            const response = await fetch('/api/config/models');
            const data = await response.json();
            
            if (data.success) {
                currentModelConfig = data.data;
                populateModelDropdowns();
                updateModelSelections();
                updateModelInfo();
            } else {
                console.error('Error loading model config:', data.error);
            }
        } catch (error) {
            console.error('Error loading model config:', error);
        }
    }
    
    // Populate model dropdown options
    function populateModelDropdowns() {
        if (!currentModelConfig || !currentModelConfig.availableModels) return;
        
        const createOption = (model) => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} (${model.speed} speed, ${model.cost} cost)`;
            option.setAttribute('data-description', model.description);
            option.setAttribute('data-speed', model.speed);
            option.setAttribute('data-cost', model.cost);
            return option;
        };
        
        // Clear existing options
        chatModelSelect.innerHTML = '';
        batchModelSelect.innerHTML = '';
        
        // Add options for each model
        currentModelConfig.availableModels.forEach(model => {
            chatModelSelect.appendChild(createOption(model));
            batchModelSelect.appendChild(createOption(model));
        });
    }
    
    // Update model selections based on current config
    function updateModelSelections() {
        if (!currentModelConfig) return;
        
        chatModelSelect.value = currentModelConfig.chatModel;
        batchModelSelect.value = currentModelConfig.batchProcessingModel;
    }
    
    // Update model info display
    function updateModelInfo() {
        if (!currentModelConfig) return;
        
        const chatModel = currentModelConfig.availableModels.find(m => m.id === currentModelConfig.chatModel);
        const batchModel = currentModelConfig.availableModels.find(m => m.id === currentModelConfig.batchProcessingModel);
        
        if (chatModel) {
            chatModelInfo.innerHTML = `
                <div class="model-detail">
                    <strong>${chatModel.name}</strong>
                    <p>${chatModel.description}</p>
                    <div class="model-stats">
                        <span class="model-stat speed-${chatModel.speed}">Speed: ${chatModel.speed}</span>
                        <span class="model-stat cost-${chatModel.cost}">Cost: ${chatModel.cost}</span>
                    </div>
                </div>
            `;
        }
        
        if (batchModel) {
            batchModelInfo.innerHTML = `
                <div class="model-detail">
                    <strong>${batchModel.name}</strong>
                    <p>${batchModel.description}</p>
                    <div class="model-stats">
                        <span class="model-stat speed-${batchModel.speed}">Speed: ${batchModel.speed}</span>
                        <span class="model-stat cost-${batchModel.cost}">Cost: ${batchModel.cost}</span>
                    </div>
                </div>
            `;
        }
        
        // Show model info section
        if (modelInfo) {
            modelInfo.style.display = 'block';
        }
    }
    
    // Save model configuration
    async function saveModelConfig() {
        const chatModel = chatModelSelect.value;
        const batchModel = batchModelSelect.value;
        
        if (!chatModel || !batchModel) {
            alert('Please select both chat and batch processing models.');
            return;
        }
        
        try {
            const response = await fetch('/api/config/models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatModel: chatModel,
                    batchProcessingModel: batchModel,
                    modifiedBy: 'admin'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentModelConfig = data.data;
                updateModelInfo();
                alert('Model configuration saved successfully!');
            } else {
                alert('Error saving model configuration: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving model config:', error);
            alert('Error saving model configuration. Please try again.');
        }
    }
    
    // Reset model configuration to defaults
    async function resetModelConfig() {
        if (!confirm('Are you sure you want to reset to default model configuration?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/config/models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatModel: 'claude-3-5-sonnet-20241022',
                    batchProcessingModel: 'claude-3-haiku-20240307',
                    modifiedBy: 'admin'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentModelConfig = data.data;
                updateModelSelections();
                updateModelInfo();
                alert('Model configuration reset to defaults!');
            } else {
                alert('Error resetting model configuration: ' + data.error);
            }
        } catch (error) {
            console.error('Error resetting model config:', error);
            alert('Error resetting model configuration. Please try again.');
        }
    }
    
    // Event listeners for model configuration
    if (saveModelConfigBtn) {
        saveModelConfigBtn.addEventListener('click', saveModelConfig);
    }
    
    if (resetModelConfigBtn) {
        resetModelConfigBtn.addEventListener('click', resetModelConfig);
    }
    
    // Update model info when selections change
    if (chatModelSelect) {
        chatModelSelect.addEventListener('change', updateModelInfo);
    }
    
    if (batchModelSelect) {
        batchModelSelect.addEventListener('change', updateModelInfo);
    }
    
    // Initialize model configuration
    loadModelConfig();
});

// === API KEY CONFIGURATION ===

// API Key Configuration functionality
document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('claudeApiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const testApiKeyBtn = document.getElementById('testApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const currentApiKeyInfo = document.getElementById('currentApiKeyInfo');
    const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
    const migrationNotice = document.getElementById('migrationNotice');
    
    // Load current API key status
    async function loadApiKeyStatus() {
        try {
            const response = await fetch('/api/admin/api-keys/status');
            const data = await response.json();
            
            if (data.success) {
                const status = data.data.claude; // The server wraps it in 'claude' property
                
                // Update current key info
                if (status.configured) {
                    currentApiKeyInfo.innerHTML = `
                        <div class="api-key-info">
                            <strong>Current API Key:</strong> ${status.maskedKey}
                            <span class="api-source">(${status.source === 'database' ? 'Encrypted Storage' : 'Environment Variable'})</span>
                        </div>
                    `;
                    
                    // Show migration notice if using environment variable
                    if (status.source === 'environment' && migrationNotice) {
                        migrationNotice.style.display = 'block';
                    }
                } else {
                    currentApiKeyInfo.innerHTML = '<div class="warning">No API key configured</div>';
                }
            }
        } catch (error) {
            console.error('Error loading API key status:', error);
            currentApiKeyInfo.innerHTML = '<div class="error">Failed to load API key status</div>';
        }
    }
    
    // Save API key
    async function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        const inputWrapper = apiKeyInput.closest('.api-key-input-wrapper');
        
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            inputWrapper.classList.add('error');
            setTimeout(() => inputWrapper.classList.remove('error'), 1000);
            return;
        }
        
        // Basic validation
        if (!apiKey.startsWith('sk-ant-')) {
            showStatus('Invalid API key format. Claude API keys should start with "sk-ant-"', 'error');
            inputWrapper.classList.add('error');
            setTimeout(() => inputWrapper.classList.remove('error'), 1000);
            return;
        }
        
        // Disable button and show loading
        saveApiKeyBtn.disabled = true;
        saveApiKeyBtn.textContent = 'Saving...';
        inputWrapper.classList.add('loading');
        
        try {
            const response = await fetch('/api/admin/api-keys/claude', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ apiKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showStatus('API key saved successfully', 'success');
                apiKeyInput.value = ''; // Clear the input
                inputWrapper.classList.remove('loading');
                inputWrapper.classList.add('success');
                setTimeout(() => inputWrapper.classList.remove('success'), 2000);
                await loadApiKeyStatus(); // Reload status
                
                // Hide migration notice if it was shown
                if (migrationNotice) {
                    migrationNotice.style.display = 'none';
                }
            } else {
                showStatus(data.error || 'Failed to save API key', 'error');
                inputWrapper.classList.remove('loading');
                inputWrapper.classList.add('error');
                setTimeout(() => inputWrapper.classList.remove('error'), 1000);
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            showStatus('Failed to save API key', 'error');
            inputWrapper.classList.remove('loading');
            inputWrapper.classList.add('error');
            setTimeout(() => inputWrapper.classList.remove('error'), 1000);
        } finally {
            // Re-enable button
            saveApiKeyBtn.disabled = false;
            saveApiKeyBtn.textContent = 'Save API Key';
            inputWrapper.classList.remove('loading');
        }
    }
    
    // Test API connection
    async function testApiConnection() {
        // Disable button and show loading
        testApiKeyBtn.disabled = true;
        testApiKeyBtn.textContent = 'Testing...';
        
        try {
            const response = await fetch('/api/admin/api-keys/test', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success && data.data.valid) {
                showStatus('API connection successful!', 'success');
            } else {
                const errorMessage = data.data?.message || data.error || 'API connection failed';
                showStatus(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error testing API connection:', error);
            showStatus('Failed to test API connection', 'error');
        } finally {
            // Re-enable button
            testApiKeyBtn.disabled = false;
            testApiKeyBtn.textContent = 'Test Connection';
        }
    }
    
    // Show status message
    function showStatus(message, type) {
        if (!apiKeyStatus) return;
        
        apiKeyStatus.textContent = message;
        apiKeyStatus.className = `status-message ${type}`;
        apiKeyStatus.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                apiKeyStatus.style.display = 'none';
            }, 5000);
        }
    }
    
    // Toggle password visibility with enhanced icons
    if (toggleKeyVisibility && apiKeyInput) {
        toggleKeyVisibility.addEventListener('click', () => {
            const currentType = apiKeyInput.type;
            const eyeIcon = toggleKeyVisibility.querySelector('.eye-icon');
            const eyeOffIcon = toggleKeyVisibility.querySelector('.eye-off-icon');
            
            if (currentType === 'password') {
                apiKeyInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
                toggleKeyVisibility.title = 'Hide API key';
            } else {
                apiKeyInput.type = 'password';
                eyeIcon.style.display = 'block';
                eyeOffIcon.style.display = 'none';
                toggleKeyVisibility.title = 'Show API key';
            }
        });
    }
    
    // Event listeners
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', saveApiKey);
    }
    
    if (testApiKeyBtn) {
        testApiKeyBtn.addEventListener('click', testApiConnection);
    }
    
    // Enter key in API key input
    if (apiKeyInput) {
        apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveApiKey();
            }
        });
    }
    
    // Initialize API key status
    loadApiKeyStatus();
});

// === IMAGE LOADING ENHANCEMENT FUNCTIONS ===

/**
 * Determine aspect ratio class based on image dimensions or filename
 * @param {string} filename - Image filename
 * @param {string} description - Image description
 * @returns {string} Aspect ratio class
 */
function getImageAspectRatio(filename, description) {
    // Default to unknown aspect ratio
    let aspectClass = 'aspect-unknown';
    
    // Try to infer from description or filename
    if (description) {
        const desc = description.toLowerCase();
        if (desc.includes('portrait') || desc.includes('vertical')) {
            aspectClass = 'aspect-portrait';
        } else if (desc.includes('landscape') || desc.includes('horizontal') || desc.includes('wide')) {
            aspectClass = 'aspect-landscape';
        } else if (desc.includes('square')) {
            aspectClass = 'aspect-square';
        }
    }
    
    // Fallback to filename patterns
    if (aspectClass === 'aspect-unknown' && filename) {
        // Most photos are landscape by default
        aspectClass = 'aspect-landscape';
    }
    
    return aspectClass;
}

/**
 * Create enhanced image container with skeleton loading
 * @param {Object} photo - Photo object
 * @param {string} photoId - Unique photo ID
 * @returns {string} HTML string for image container
 */
function createImageContainer(photo, photoId) {
    if (!photo.smugmugUrl) {
        return `
            <div class="image-container aspect-unknown">
                <div style="height: 100%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.875rem;">
                    <span>📷 No image available</span>
                </div>
            </div>
        `;
    }
    
    const aspectClass = getImageAspectRatio(photo.filename, photo.description);
    const imageKey = photo.smugmugImageKey || photo.imageKey || photo.id || photoId;
    // If this image has a starredId, use that to check starred status
    const checkKey = photo.starredId || imageKey;
    const isStarred = window.photoVision?.isImageStarred(checkKey) || photo.isStarred || false;
    
    return `
        <div class="image-container ${aspectClass}">
            <button class="star-btn ${isStarred ? 'starred' : ''}" 
                    onclick="window.photoVision.toggleStar('${photo.starredId || imageKey}', this)" 
                    title="${isStarred ? 'Remove from favorites' : 'Add to favorites'}"
                    data-image-key="${photo.starredId || imageKey}">
                <svg class="star-icon" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
            </button>
            <div class="image-skeleton">
                <div class="loading-indicator"></div>
            </div>
            <img src="${photo.smugmugUrl}" 
                 alt="${photo.description || photo.filename || 'Image'}" 
                 class="card-image"
                 data-photo-id="${photoId}"
                 onload="handleImageLoad(this)"
                 onerror="handleImageError(this)">
        </div>
    `;
}

/**
 * Handle successful image loading
 * @param {HTMLImageElement} img - Image element that loaded
 */
function handleImageLoad(img) {
    // Prevent multiple load events
    if (img.classList.contains('loaded')) return;
    
    try {
        // Add loaded class for smooth transition
        img.classList.add('loaded');
        
        // Hide skeleton loading
        const skeleton = img.parentElement?.querySelector('.image-skeleton');
        if (skeleton) {
            skeleton.classList.add('hidden');
            // Remove skeleton after transition with cleanup
            setTimeout(() => {
                if (skeleton.parentElement && skeleton.classList.contains('hidden')) {
                    skeleton.remove();
                }
            }, 300);
        }
        
        // Adjust aspect ratio based on actual image dimensions
        const container = img.parentElement;
        if (container && img.naturalWidth && img.naturalHeight) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            
            // Update container class based on actual aspect ratio
            let newAspectClass = 'aspect-unknown';
            if (aspectRatio > 1.5) {
                newAspectClass = 'aspect-landscape';
            } else if (aspectRatio < 0.8) {
                newAspectClass = 'aspect-portrait';
            } else if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
                newAspectClass = 'aspect-square';
            }
            
            // Only update if different to prevent layout thrashing
            if (!container.classList.contains(newAspectClass)) {
                container.className = container.className.replace(/aspect-\w+/, newAspectClass);
            }
        }
        
        // Emit custom event for analytics/tracking
        img.dispatchEvent(new CustomEvent('photoLoaded', {
            detail: { 
                photoId: img.dataset.photoId,
                loadTime: performance.now(),
                dimensions: { 
                    width: img.naturalWidth, 
                    height: img.naturalHeight 
                }
            }
        }));
        
    } catch (error) {
        console.warn('Error in handleImageLoad:', error);
        // Fallback to error handler
        handleImageError(img);
    }
}

/**
 * Handle image loading errors
 * @param {HTMLImageElement} img - Image element that failed to load
 */
function handleImageError(img) {
    try {
        const container = img.parentElement;
        if (!container) return;
        
        const photoId = img.dataset.photoId;
        const originalSrc = img.src;
        
        // Log error for debugging
        console.warn('Image load failed:', { photoId, src: originalSrc });
        
        // Try to reload image once with cache busting
        if (!img.dataset.retried && originalSrc) {
            img.dataset.retried = 'true';
            const retryUrl = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'retry=' + Date.now();
            
            setTimeout(() => {
                img.src = retryUrl;
            }, 1000);
            return;
        }
        
        // Replace with error message after retry failed
        container.innerHTML = `
            <div style="height: 100%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.875rem; flex-direction: column; gap: 0.5rem; cursor: pointer;" onclick="retryImageLoad('${photoId}', '${originalSrc}')">
                <span style="font-size: 1.5rem;">⚠️</span>
                <span>Image unavailable</span>
                <span style="font-size: 0.75rem; opacity: 0.7;">Click to retry</span>
            </div>
        `;
        
        // Emit custom event for error tracking
        img.dispatchEvent(new CustomEvent('photoError', {
            detail: { 
                photoId: photoId,
                src: originalSrc,
                error: 'Load failed after retry'
            }
        }));
        
    } catch (error) {
        console.error('Error in handleImageError:', error);
    }
}

/**
 * Retry loading a failed image
 * @param {string} photoId - Photo ID
 * @param {string} originalSrc - Original image URL
 */
function retryImageLoad(photoId, originalSrc) {
    const errorDiv = event.target.closest('[style*="bg-tertiary"]');
    if (!errorDiv || !originalSrc) return;
    
    // Replace error div with loading skeleton
    errorDiv.outerHTML = `
        <div class="image-skeleton">
            <div class="loading-indicator"></div>
        </div>
        <img src="${originalSrc}" 
             alt="Retry loading image" 
             class="card-image"
             data-photo-id="${photoId}"
             onload="handleImageLoad(this)"
             onerror="handleImageError(this)">
    `;
}

/**
 * Enhanced lazy loading with Intersection Observer
 */
function initEnhancedLazyLoading() {
    if (!('IntersectionObserver' in window)) {
        // Fallback for browsers without IntersectionObserver
        console.warn('IntersectionObserver not supported, using immediate loading');
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
        return;
    }
    
    // Reuse existing observer if available
    if (window.photoVisionImageObserver) {
        // Re-observe new images
        document.querySelectorAll('img[data-src]').forEach(img => {
            window.photoVisionImageObserver.observe(img);
        });
        return;
    }
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                
                // Start loading the image
                if (img.dataset.src) {
                    const startTime = performance.now();
                    
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    
                    // Track loading performance
                    img.addEventListener('load', () => {
                        const loadTime = performance.now() - startTime;
                        console.debug(`Image loaded in ${loadTime.toFixed(2)}ms:`, img.src.substring(0, 50) + '...');
                    }, { once: true });
                }
                
                // Stop observing this image
                observer.unobserve(img);
            }
        });
    }, {
        // Start loading when image is 50px from viewport
        rootMargin: '50px 0px',
        threshold: 0
    });
    
    // Store observer globally for reuse
    window.photoVisionImageObserver = imageObserver;
    
    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
    
    console.log('Enhanced lazy loading initialized');
}
