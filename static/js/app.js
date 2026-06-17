/**
 * BigQuery Release Notes Explorer - Client Application
 */

// Application State
const state = {
    releaseNotes: [],
    activeFilter: 'all',
    searchQuery: '',
    sortOrder: 'newest',
    selectedNote: null,
    isFetching: false
};

// DOM Elements
const DOM = {
    // Top loading bar
    topLoadingBar: document.getElementById('top-loading-bar'),
    
    // Header & Actions
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    refreshedTime: document.getElementById('refreshed-time'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    
    // Stats cards
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countAnnouncement: document.getElementById('count-announcement'),
    countIssue: document.getElementById('count-issue'),
    statCards: document.querySelectorAll('.stat-card'),
    
    // Search & Filter
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    categoryTabs: document.getElementById('category-tabs'),
    tabPills: document.querySelectorAll('.tab-pill'),
    sortOrderSelect: document.getElementById('sort-order'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    retryBtn: document.getElementById('retry-btn'),
    
    // Main States
    notesGrid: document.getElementById('notes-grid'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    submitTweetBtn: document.getElementById('submit-tweet-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounterText: document.getElementById('char-counter-text'),
    charProgressBar: document.getElementById('char-progress-bar'),
    progressWarning: document.getElementById('progress-warning'),
    
    // Modal Note Preview
    previewCategory: document.getElementById('preview-category'),
    previewDate: document.getElementById('preview-date'),
    previewText: document.getElementById('preview-text'),
    
    // Modal Helpers
    btnAddHashtags: document.getElementById('btn-add-hashtags'),
    btnSummarize: document.getElementById('btn-summarize'),
    btnCopyDraft: document.getElementById('btn-copy-draft'),
    
    // Toasts
    toastContainer: document.getElementById('toast-container')
};

// Category accent colors mapping for the border colors of the cards
const CATEGORY_COLORS = {
    'Feature': '#38bdf8',       // Light blue
    'Announcement': '#c084fc',  // Purple
    'Issue': '#fb7185',         // Red
    'Change': '#34d399',        // Green
    'Deprecation': '#fbbf24',   // Orange/Amber
    'General': '#94a3b8'        // Slate
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleaseNotes();
});

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {
    // Refresh button
    DOM.refreshBtn.addEventListener('click', () => {
        if (!state.isFetching) {
            fetchReleaseNotes(true); // Force bypass backend cache
        }
    });

    // Theme toggle
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        toggleSearchClearBtn();
        renderNotes();
    });

    DOM.searchClearBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.searchQuery = '';
        toggleSearchClearBtn();
        DOM.searchInput.focus();
        renderNotes();
    });

    // Category tabs filtering
    DOM.categoryTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-pill');
        if (!tab) return;
        
        DOM.tabPills.forEach(pill => pill.classList.remove('active'));
        tab.classList.add('active');
        
        state.activeFilter = tab.getAttribute('data-filter');
        updateActiveStatHighlight();
        renderNotes();
    });

    // Dashboard cards click filtering
    DOM.statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.getAttribute('data-category');
            
            // Highlight the corresponding tab pill
            DOM.tabPills.forEach(pill => {
                if (pill.getAttribute('data-filter') === filter) {
                    pill.classList.add('active');
                } else {
                    pill.classList.remove('active');
                }
            });
            
            state.activeFilter = filter;
            updateActiveStatHighlight();
            renderNotes();
        });
    });

    // Sort Order
    DOM.sortOrderSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        renderNotes();
    });

    // Reset filters empty state button
    DOM.resetFiltersBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.searchQuery = '';
        toggleSearchClearBtn();
        
        DOM.tabPills.forEach(pill => {
            if (pill.getAttribute('data-filter') === 'all') {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
        state.activeFilter = 'all';
        updateActiveStatHighlight();
        renderNotes();
    });

    // Error retry button
    DOM.retryBtn.addEventListener('click', () => fetchReleaseNotes(true));

    // Modal close controls
    DOM.closeModalBtn.addEventListener('click', closeTweetModal);
    DOM.cancelTweetBtn.addEventListener('click', closeTweetModal);
    
    // Close modal on clicking outside container
    DOM.tweetModal.addEventListener('click', (e) => {
        if (e.target === DOM.tweetModal) {
            closeTweetModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOM.tweetModal.classList.contains('hidden')) {
            closeTweetModal();
        }
    });

    // Tweet form logic
    DOM.tweetTextarea.addEventListener('input', updateCharCount);
    DOM.submitTweetBtn.addEventListener('click', postTweet);
    DOM.btnAddHashtags.addEventListener('click', addTweetHashtags);
    DOM.btnSummarize.addEventListener('click', autoFitTweet);
    DOM.btnCopyDraft.addEventListener('click', copyTweetDraft);
}

/* ==========================================================================
   THEME STYLING & SWITCHING
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        DOM.themeIcon.className = 'fa-solid fa-moon';
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        DOM.themeIcon.className = 'fa-solid fa-sun';
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        DOM.themeIcon.className = 'fa-solid fa-moon';
        localStorage.setItem('theme', 'light');
        showToast('Switched to Light Mode', 'info');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        DOM.themeIcon.className = 'fa-solid fa-sun';
        localStorage.setItem('theme', 'dark');
        showToast('Switched to Dark Mode', 'info');
    }
}

/* ==========================================================================
   DATA FETCHING
   ========================================================================== */
async function fetchReleaseNotes(forceRefresh = false) {
    setLoadingState(true);
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?force=true' : ''}`;
        
        // Simulating progressive network loader bar
        DOM.topLoadingBar.style.width = '20%';
        
        const response = await fetch(url);
        DOM.topLoadingBar.style.width = '60%';
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        DOM.topLoadingBar.style.width = '90%';
        
        state.releaseNotes = data.updates || [];
        
        // Update Refreshed Time text
        updateRefreshedTimeText(data.refreshed_at);
        
        // Calculate Statistics
        calculateStatistics(state.releaseNotes);
        
        // Render release notes grid
        renderNotes();
        
        setLoadingState(false);
        DOM.topLoadingBar.style.width = '100%';
        setTimeout(() => DOM.topLoadingBar.style.width = '0%', 300);
        
        if (forceRefresh) {
            showToast('Release notes successfully refreshed!', 'success');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        setLoadingState(false, error.message);
        DOM.topLoadingBar.style.width = '0%';
        showToast('Failed to load release notes feed', 'error');
    }
}

function setLoadingState(isLoading, errorMessage = null) {
    state.isFetching = isLoading;
    
    if (isLoading) {
        DOM.refreshIcon.classList.add('spinning');
        DOM.refreshBtn.disabled = true;
        
        DOM.skeletonLoader.classList.remove('hidden');
        DOM.notesGrid.classList.add('hidden');
        DOM.emptyState.classList.add('hidden');
        DOM.errorState.classList.add('hidden');
    } else {
        DOM.refreshIcon.classList.remove('spinning');
        DOM.refreshBtn.disabled = false;
        DOM.skeletonLoader.classList.add('hidden');
        
        if (errorMessage) {
            DOM.errorMessage.textContent = errorMessage;
            DOM.errorState.classList.remove('hidden');
            DOM.notesGrid.classList.add('hidden');
        } else {
            DOM.errorState.classList.add('hidden');
            DOM.notesGrid.classList.remove('hidden');
        }
    }
}

function updateRefreshedTimeText(timestamp) {
    if (!timestamp) return;
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    DOM.refreshedTime.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Refreshed at ${timeStr}`;
}

function calculateStatistics(updates) {
    const stats = {
        all: updates.length,
        Feature: 0,
        Announcement: 0,
        Issue: 0
    };
    
    updates.forEach(update => {
        const cat = update.category;
        if (stats[cat] !== undefined) {
            stats[cat]++;
        }
    });
    
    // Update DOM counts
    DOM.countAll.textContent = stats.all;
    DOM.countFeature.textContent = stats.Feature;
    DOM.countAnnouncement.textContent = stats.Announcement;
    DOM.countIssue.textContent = stats.Issue;
}

function updateActiveStatHighlight() {
    DOM.statCards.forEach(card => {
        if (card.getAttribute('data-category') === state.activeFilter) {
            card.classList.add('active-stat');
        } else {
            card.classList.remove('active-stat');
        }
    });
}

function toggleSearchClearBtn() {
    if (DOM.searchInput.value.length > 0) {
        DOM.searchClearBtn.style.display = 'block';
    } else {
        DOM.searchClearBtn.style.display = 'none';
    }
}

/* ==========================================================================
   RENDERING RELEASE NOTES
   ========================================================================== */
function renderNotes() {
    // 1. Filter updates
    let filtered = state.releaseNotes.filter(note => {
        // Category Filter
        if (state.activeFilter !== 'all' && note.category !== state.activeFilter) {
            return false;
        }
        
        // Search query filter
        if (state.searchQuery) {
            const textMatch = note.text && note.text.toLowerCase().includes(state.searchQuery);
            const categoryMatch = note.category && note.category.toLowerCase().includes(state.searchQuery);
            const dateMatch = note.date && note.date.toLowerCase().includes(state.searchQuery);
            return textMatch || categoryMatch || dateMatch;
        }
        
        return true;
    });

    // 2. Sort updates
    filtered.sort((a, b) => {
        // Parse ISO timestamps
        const timeA = new Date(a.updated).getTime();
        const timeB = new Date(b.updated).getTime();
        
        if (state.sortOrder === 'newest') {
            return timeB - timeA;
        } else {
            return timeA - timeB;
        }
    });

    // 3. Display management
    DOM.notesGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        DOM.notesGrid.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    DOM.notesGrid.classList.remove('hidden');

    // 4. Render cards
    filtered.forEach(note => {
        const card = createNoteCard(note);
        DOM.notesGrid.appendChild(card);
    });
}

function createNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    
    // Set custom accent color variable based on category
    const accentColor = CATEGORY_COLORS[note.category] || CATEGORY_COLORS['General'];
    card.style.setProperty('--card-accent', accentColor);
    
    // Structure HTML
    card.innerHTML = `
        <div class="card-meta">
            <span class="category-badge" data-category="${note.category}">${note.category}</span>
            <div class="card-date">
                <i class="fa-regular fa-calendar-days"></i>
                <span>${note.date}</span>
            </div>
        </div>
        <div class="card-body">
            ${note.html}
        </div>
        <div class="card-actions">
            <a href="${note.link}" class="card-link-btn" target="_blank" rel="noopener">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Notes
            </a>
            <button class="tweet-trigger" title="Select and compose a Tweet for this release item">
                <i class="fa-brands fa-x-twitter"></i> Tweet Update
            </button>
        </div>
    `;
    
    // Event listener for tweet button
    const tweetBtn = card.querySelector('.tweet-trigger');
    tweetBtn.addEventListener('click', () => openTweetModal(note));
    
    return card;
}

/* ==========================================================================
   TWEET COMPOSER MODAL & UTILITIES
   ========================================================================== */
function openTweetModal(note) {
    state.selectedNote = note;
    
    // Preview original update
    DOM.previewCategory.textContent = note.category;
    DOM.previewCategory.setAttribute('data-category', note.category);
    DOM.previewDate.textContent = note.date;
    DOM.previewText.textContent = note.text;
    
    // Generate initial tweet draft template
    const templateText = generateInitialTweetText(note);
    DOM.tweetTextarea.value = templateText;
    
    // Update UI constraints
    updateCharCount();
    
    // Show Modal
    DOM.tweetModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
    
    // Focus textarea
    setTimeout(() => DOM.tweetTextarea.focus(), 150);
}

function closeTweetModal() {
    DOM.tweetModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scroll
    state.selectedNote = null;
}

function generateInitialTweetText(note) {
    const categoryEmoji = {
        'Feature': '🚀',
        'Announcement': '📢',
        'Issue': '⚠️',
        'Change': '🔄',
        'Deprecation': '🛑',
        'General': '💡'
    };
    
    const emoji = categoryEmoji[note.category] || '💡';
    
    // Clean text (take first sentence or up to 120 chars)
    let cleanText = note.text;
    if (cleanText.length > 130) {
        cleanText = cleanText.substring(0, 127) + '...';
    }
    
    return `${emoji} BigQuery ${note.category} (${note.date}):\n${cleanText}\n\nFull details:\n${note.link}\n\n#GoogleCloud #BigQuery`;
}

function updateCharCount() {
    const text = DOM.tweetTextarea.value;
    const count = getTwitterCharCount(text);
    
    DOM.charCounterText.textContent = `${count} / 280`;
    
    // Calculate percentage for progress meter
    const percent = Math.min((count / 280) * 100, 100);
    DOM.charProgressBar.style.width = `${percent}%`;
    
    // Style threshold classes
    DOM.charCounterText.classList.remove('warning', 'danger');
    DOM.charProgressBar.classList.remove('warning', 'danger');
    DOM.progressWarning.classList.add('hidden');
    
    if (count > 280) {
        DOM.charCounterText.classList.add('danger');
        DOM.charProgressBar.classList.add('danger');
        DOM.progressWarning.classList.remove('hidden');
    } else if (count > 250) {
        DOM.charCounterText.classList.add('warning');
        DOM.charProgressBar.classList.add('warning');
    }
}

/**
 * Custom char counting approximating Twitter/X logic where URL is shortened to 23 chars.
 */
function getTwitterCharCount(text) {
    if (!text) return 0;
    
    // Simple regex to extract HTTP/HTTPS URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    let length = text.length;
    
    // Twitter counts any URL as exactly 23 characters
    urls.forEach(url => {
        length = length - url.length + 23;
    });
    
    return length;
}

function addTweetHashtags() {
    const text = DOM.tweetTextarea.value;
    const tags = '#BigQuery #GoogleCloud #GCP';
    
    // If text already has the tags, don't append
    if (text.includes('#BigQuery')) {
        showToast('Hashtags already included', 'info');
        return;
    }
    
    DOM.tweetTextarea.value = text.trim() + '\n\n' + tags;
    updateCharCount();
    DOM.tweetTextarea.focus();
}

/**
 * Truncates and auto-fits text to guarantee compliance with the 280 limit.
 */
function autoFitTweet() {
    if (!state.selectedNote) return;
    
    const note = state.selectedNote;
    const count = getTwitterCharCount(DOM.tweetTextarea.value);
    
    // If it's already fitting, tell the user
    if (count <= 280) {
        showToast('Tweet draft already fits inside 280 limit!', 'info');
        return;
    }
    
    // Calculate maximum available characters for description:
    // 280 - (template headers + link (23) + hashtags)
    const categoryEmoji = {
        'Feature': '🚀', 'Announcement': '📢', 'Issue': '⚠️', 'Change': '🔄', 'Deprecation': '🛑', 'General': '💡'
    };
    const emoji = categoryEmoji[note.category] || '💡';
    
    const prefix = `${emoji} BigQuery ${note.category} (${note.date}):\n`;
    const suffix = `...\n\nFull details:\n${note.link}\n\n#GoogleCloud #BigQuery`;
    
    // Calculate lengths (treating link as 23 chars)
    const prefixLen = prefix.length;
    const suffixLen = suffix.length - note.link.length + 23; // replace actual URL length with 23
    
    const maxDescLen = 280 - prefixLen - suffixLen;
    
    if (maxDescLen <= 0) {
        // Extremely small limit, fallback to simple trim
        DOM.tweetTextarea.value = note.text.substring(0, 250) + `... ${note.link}`;
    } else {
        const trimmedDesc = note.text.substring(0, maxDescLen).trim();
        DOM.tweetTextarea.value = `${prefix}${trimmedDesc}${suffix}`;
    }
    
    updateCharCount();
    showToast('Draft optimized to fit Twitter limits', 'success');
}

function copyTweetDraft() {
    const text = DOM.tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Draft copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Copy failed:', err);
            showToast('Failed to copy to clipboard', 'error');
        });
}

function postTweet() {
    const text = DOM.tweetTextarea.value;
    const count = getTwitterCharCount(text);
    
    if (count > 280) {
        const confirmTweet = confirm("Your tweet is over 280 characters. Proceed anyway?");
        if (!confirmTweet) return;
    }
    
    // Open Twitter/X intent in new window
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    
    showToast('Redirected to Twitter/X composer', 'success');
    closeTweetModal();
}

/* ==========================================================================
   TOAST NOTIFICATION UTILITY
   ========================================================================== */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-circle-info';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-content">${message}</div>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // Trigger animation frame
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto-remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
