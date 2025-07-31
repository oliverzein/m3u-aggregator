class M3UManager {
    constructor() {
        this.channels = [];
        this.filteredChannels = [];
        this.ruleSets = [];
        this.nextRuleSetId = 1;
        this.nextRuleId = 1;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.showUploadSection();
    }

    bindEvents() {
        // Upload events
        const uploadArea = document.getElementById('uploadArea');
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        // Rule sets events using event delegation
        const ruleSetsContainer = document.getElementById('ruleSetsContainer');
        if (ruleSetsContainer) {
            ruleSetsContainer.addEventListener('click', (e) => {
                const target = e.target;
                
                if (target.classList.contains('remove-rule-set')) {
                    const ruleSetId = parseInt(target.dataset.ruleSetId);
                    this.removeRuleSet(ruleSetId);
                } else if (target.classList.contains('add-rule')) {
                    const ruleSetId = parseInt(target.dataset.ruleSetId);
                    this.addRuleToSet(ruleSetId);
                } else if (target.classList.contains('remove-rule')) {
                    const ruleSetId = parseInt(target.closest('.rule-set').dataset.ruleSetId);
                    const ruleId = parseInt(target.dataset.ruleId);
                    this.removeRuleFromSet(ruleSetId, ruleId);
                }
            });

            ruleSetsContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('rule-set-name-input')) {
                    const ruleSetId = parseInt(e.target.closest('.rule-set').dataset.ruleSetId);
                    const newName = e.target.value;
                    this.updateRuleSetName(ruleSetId, newName);
                } else if (e.target.classList.contains('rule-field') || 
                           e.target.classList.contains('rule-pattern') ||
                           e.target.classList.contains('rule-match-type') ||
                           e.target.classList.contains('rule-case-sensitive')) {
                    const ruleSetId = parseInt(e.target.closest('.rule-set').dataset.ruleSetId);
                    const ruleId = parseInt(e.target.closest('.rule').dataset.ruleId);
                    this.updateRule(ruleSetId, ruleId);
                }
            });
        }

        // Action buttons
        const addRuleSetBtn = document.getElementById('addRuleSetBtn');
        const applyRuleSetsBtn = document.getElementById('applyRuleSetsBtn');
        const previewBtn = document.getElementById('previewBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const searchResults = document.getElementById('searchResults');
        const copyPreviewBtn = document.getElementById('copyPreviewBtn');
        const closePreviewBtn = document.getElementById('closePreviewBtn');

        if (addRuleSetBtn) addRuleSetBtn.addEventListener('click', () => this.addRuleSet());
        if (applyRuleSetsBtn) applyRuleSetsBtn.addEventListener('click', () => this.applyRuleSets());
        if (previewBtn) previewBtn.addEventListener('click', () => this.showPreview());
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadM3U());
        if (searchResults) searchResults.addEventListener('input', () => this.displayResults());
        if (copyPreviewBtn) copyPreviewBtn.addEventListener('click', () => this.copyPreview());
        if (closePreviewBtn) closePreviewBtn.addEventListener('click', () => this.hidePreview());
    }

    async handleFileUpload(file) {
        if (!file) return;

        this.showUploadProgress(true);
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.channels = result.channels;
                this.filteredChannels = [...this.channels];
                
                this.hideUploadSection();
                this.showStats();
                this.showFilters();
                this.showResults();
                this.updateStats();
                this.displayResults();
                
                this.showMessage(`Successfully loaded ${result.count} channels`, 'success');
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            this.showMessage(error.message, 'error');
        } finally {
            this.showUploadProgress(false);
        }
    }

    addRuleSet() {
        const ruleSet = {
            id: this.nextRuleSetId++,
            name: `Rule Set ${this.ruleSets.length + 1}`,
            rules: []
        };
        
        this.ruleSets.push(ruleSet);
        this.addRuleToSet(ruleSet.id);
        this.renderRuleSets();
    }

    async applyRuleSets() {
        if (this.channels.length === 0) {
            this.showMessage('No channels to filter', 'error');
            return;
        }

        const validRuleSets = this.ruleSets.filter(rs => rs.rules.length > 0);
        
        try {
            const response = await fetch('/api/filter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channels: this.channels,
                    ruleSets: validRuleSets
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.filteredChannels = result.filteredChannels;
                this.updateStats();
                this.displayResults();
                this.showMessage(`Filtered ${result.filteredCount} channels`, 'success');
            } else {
                throw new Error(result.error || 'Filtering failed');
            }
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    displayResults() {
        const channelsList = document.getElementById('channelsList');
        const searchResultsInput = document.getElementById('searchResults');
        
        if (!channelsList) return;
        
        let displayChannels = this.filteredChannels;
        
        if (searchResultsInput) {
            const searchTerm = searchResultsInput.value.toLowerCase();
            if (searchTerm) {
                displayChannels = displayChannels.filter(channel => 
                    channel.title.toLowerCase().includes(searchTerm) ||
                    (channel.group && channel.group.toLowerCase().includes(searchTerm)) ||
                    channel.url.toLowerCase().includes(searchTerm)
                );
            }
        }
        
        channelsList.innerHTML = '';
        
        if (displayChannels.length === 0) {
            channelsList.innerHTML = '<div class="no-results">No channels found</div>';
            return;
        }
        
        displayChannels.forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.className = 'channel-item';
            
            channelItem.innerHTML = `
                <div class="channel-title">${this.escapeHtml(channel.title)}</div>
                ${channel.group ? `<div class="channel-group">${this.escapeHtml(channel.group)}</div>` : ''}
                <div class="channel-url">${this.escapeHtml(channel.url)}</div>
                ${Object.keys(channel.attributes).length > 0 ? 
                    `<div class="channel-attributes">${this.escapeHtml(JSON.stringify(channel.attributes))}</div>` : ''}
            `;
            
            channelsList.appendChild(channelItem);
        });
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('messageContainer');
        if (!container) return;
        
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        container.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new M3UManager();
});