document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const topicInput = document.getElementById('topic-input');
    const generateBtn = document.getElementById('generate-btn');
    const randomBtn = document.getElementById('random-btn');
    const surpriseBtn = document.getElementById('surprise-btn');
    const batchBtn = document.getElementById('batch-btn');
    const resultContainer = document.getElementById('result-container');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const favoritesList = document.getElementById('favorites-list');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const emptyFavorites = document.getElementById('empty-favorites');
    const emptyHistory = document.getElementById('empty-history');
    
    // NEW: Feature elements
    const charCounter = document.getElementById('char-counter');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const statsBtn = document.getElementById('stats-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const totalGenerationsBadge = document.getElementById('total-generations');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    const exportFavoritesBtn = document.getElementById('export-favorites-btn');
    const importFavoritesBtn = document.getElementById('import-favorites-btn');
    const exportHistoryBtn = document.getElementById('export-history-btn');
    const importFileInput = document.getElementById('import-file-input');
    const keyboardShortcutsBtn = document.getElementById('keyboard-shortcuts-btn');
    const multipleResults = document.getElementById('multiple-results');
    const processBatchBtn = document.getElementById('process-batch-btn');
    const batchInput = document.getElementById('batch-input');
    const batchResults = document.getElementById('batch-results');

    // --- State ---
    let state = {
        favorites: JSON.parse(localStorage.getItem('w3t_favorites')) || [],
        history: JSON.parse(localStorage.getItem('w3t_history')) || [],
        theme: localStorage.getItem('w3t_theme') || 'light',
        // NEW: Extended state
        statistics: JSON.parse(localStorage.getItem('w3t_statistics')) || {
            totalGenerations: 0,
            topicCounts: {}
        },
        settings: JSON.parse(localStorage.getItem('w3t_settings')) || {
            animations: true,
            sounds: false,
            autocomplete: true,
            duplicateWarning: true,
            viewMode: 'normal'
        },
        undoStack: [],
        currentResult: null,
        lastGeneratedTopic: null
    };

    // --- API & Constants ---
    const API_URL = 'https://w3tsrv.awesomeapps.workers.dev/';
    const RANDOM_TOPICS = ["space travel", "climate change", "artificial intelligence", "street food", "video games", "ancient history", "machine learning", "ocean exploration", "renewable energy", "deep sea diving", "urban gardening", "blockchain technology"];
    const SURPRISE_TOPICS = ["mystery islands", "robot pets", "galaxy travel", "hidden treasure", "jungle survival", "singing clouds", "time-traveling cats", "invisible friends", "dancing stars", "magical forests"];

    // --- Sound Effects (NEW) ---
    const sounds = {
        success: () => playTone(800, 100),
        error: () => playTone(200, 200),
        click: () => playTone(600, 50),
        favorite: () => playTone(1000, 150)
    };

    function playTone(frequency, duration) {
        if (!state.settings.sounds) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        } catch (e) {
            console.warn('Audio not supported');
        }
    }

    // --- Functions ---

    /**
     * NEW: Get selected word count
     */
    function getWordCount() {
        const selected = document.querySelector('input[name="word-count"]:checked');
        return parseInt(selected ? selected.value : 3);
    }

    /**
     * Fetches words from the API for a given topic.
     * NEW: Now supports variable word count
     */
    async function getThreeWords(multipleMode = false) {
        const topic = topicInput.value.trim();
        if (!topic) {
            showToast("⚠️ Please enter a topic.", "warning");
            sounds.error();
            return;
        }

        // NEW: Duplicate detection
        if (state.settings.duplicateWarning && state.lastGeneratedTopic === topic && !multipleMode) {
            if (!confirm('You already generated this topic. Generate again?')) {
                return;
            }
        }

        setLoading(true);
        resultContainer.innerHTML = '';
        resultContainer.classList.remove('visible');
        if (multipleMode) multipleResults.innerHTML = '';

        const wordCount = getWordCount();
        const messages = [{
            role: 'user',
            content: `You are an agent for What3Topics. Describe the following topic in exactly ${wordCount} single simple, common, memorable and natural words, lowercase, separated by spaces and nothing else. Example: 'food health wellness' for 'healthy eating'. Topic: ${topic}`
        }];

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages })
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const data = await response.json();
            const rawContent = data.choices[0].message.content.trim();
            const wordsArray = rawContent.replace(/[^a-zA-Z\s]/g, '').toLowerCase().split(/\s+/).filter(Boolean);

            if (wordsArray.length === wordCount) {
                const resultText = wordsArray.join('.');
                displayResult(topic, resultText);
                addToHistory(topic, resultText);
                updateStatistics(topic);
                state.lastGeneratedTopic = topic;
                state.currentResult = { topic, words: resultText };
                sounds.success();
            } else {
                displayError(`Could not get ${wordCount} words. Try again. Raw: "${rawContent}"`);
                sounds.error();
            }
        } catch (error) {
            console.error('Error:', error);
            displayError('❌ Failed to generate. Please check your network and try again.');
            sounds.error();
        } finally {
            setLoading(false);
        }
    }

    /**
     * NEW: Generate multiple variations
     */
    async function generateMultipleVariations() {
        const topic = topicInput.value.trim();
        if (!topic) {
            showToast("⚠️ Please enter a topic.", "warning");
            return;
        }

        multipleResults.innerHTML = '<p style="text-align: center; opacity: 0.7;">Generating 3 variations...</p>';
        
        const variations = [];
        for (let i = 0; i < 3; i++) {
            await getThreeWords(true);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }
    }

    /**
     * Renders the result in the UI with animations.
     */
    function displayResult(topic, resultText) {
        const words = resultText.split('.');
        const isFavorited = state.favorites.some(fav => fav.words === resultText);
        
        resultContainer.innerHTML = `
            <div class="result-text ${state.settings.animations ? '' : 'no-animation'}">
                #${words.map((word, index) => `<span style="animation-delay: ${index * 0.2}s">${word}</span>`).join('.')}
            </div>
            <p style="margin-top: 0.5rem; margin-bottom: 0;">For topic: <strong>${topic}</strong></p>
            <div class="result-actions">
                <button class="icon-btn" id="copy-result-btn" title="Copy to clipboard">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg>
                </button>
                <button class="icon-btn ${isFavorited ? 'favorited' : ''}" id="fav-result-btn" title="Add to favorites">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                </button>
                <button class="icon-btn" id="share-result-btn" title="Share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
                <button class="icon-btn" id="qr-result-btn" title="Generate QR Code">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </button>
                <button class="icon-btn" id="regenerate-btn" title="Regenerate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button class="icon-btn" id="print-btn" title="Print">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
            </div>
        `;
        resultContainer.classList.add('visible');

        // Event listeners for result actions
        document.getElementById('copy-result-btn').addEventListener('click', () => copyResult(topic, resultText));
        document.getElementById('fav-result-btn').addEventListener('click', (e) => {
            toggleFavorite({ topic, words: resultText });
            e.currentTarget.classList.toggle('favorited');
        });
        document.getElementById('share-result-btn').addEventListener('click', () => shareResult(topic, resultText));
        document.getElementById('qr-result-btn').addEventListener('click', () => generateQRCode(resultText));
        document.getElementById('regenerate-btn').addEventListener('click', () => getThreeWords());
        document.getElementById('print-btn').addEventListener('click', () => printResult(topic, resultText));
    }

    /**
     * NEW: Copy result with improved feedback
     */
    function copyResult(topic, words) {
        const text = `#${words.replace(/\./g, '.')} - ${topic}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast("✅ Copied to clipboard!");
            sounds.click();
        }).catch(() => {
            showToast("❌ Failed to copy", "danger");
        });
    }

    /**
     * NEW: Share result via Web Share API
     */
    async function shareResult(topic, words) {
        const shareData = {
            title: 'What3Topics',
            text: `Check out this 3-word description: #${words.replace(/\./g, '.')} for "${topic}"`,
            url: window.location.href + `?topic=${encodeURIComponent(topic)}&words=${encodeURIComponent(words)}`
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                showToast("✅ Shared successfully!");
            } catch (err) {
                if (err.name !== 'AbortError') {
                    fallbackShare(shareData);
                }
            }
        } else {
            fallbackShare(shareData);
        }
    }

    /**
     * NEW: Fallback share (copy link)
     */
    function fallbackShare(shareData) {
        navigator.clipboard.writeText(shareData.url);
        showToast("🔗 Shareable link copied!");
    }

    /**
     * NEW: Generate QR Code
     */
    function generateQRCode(words) {
        const qrData = `#${words.replace(/\./g, '.')}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        
        const modal = createModal('QR Code', `
            <div style="text-align: center;">
                <img src="${qrUrl}" alt="QR Code" style="max-width: 100%; border-radius: 8px;">
                <p style="margin-top: 1rem; word-break: break-all;">${qrData}</p>
                <button onclick="window.open('${qrUrl}', '_blank')" class="primary-btn" style="margin-top: 1rem;">Download QR Code</button>
            </div>
        `);
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }

    /**
     * NEW: Print result
     */
    function printResult(topic, words) {
        const printWindow = window.open('', '', 'width=600,height=400');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>What3Topics - ${topic}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                    h1 { color: #553986; font-size: 3rem; margin: 2rem 0; }
                    p { font-size: 1.2rem; color: #666; }
                    @media print {
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <h1>#${words.replace(/\./g, '.')}</h1>
                <p>Topic: ${topic}</p>
                <p style="margin-top: 2rem; font-size: 0.9rem; color: #999;">Generated by What3Topics</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }

    /**
     * Renders an error message.
     */
    function displayError(message) {
        resultContainer.innerHTML = `<p style="color: var(--danger-color);">${message}</p>`;
        resultContainer.classList.add('visible');
    }

    /**
     * Manages loading state.
     */
    function setLoading(isLoading) {
        generateBtn.classList.toggle('loading', isLoading);
        generateBtn.disabled = isLoading;
    }

    /**
     * NEW: Update statistics
     */
    function updateStatistics(topic) {
        state.statistics.totalGenerations++;
        state.statistics.topicCounts[topic] = (state.statistics.topicCounts[topic] || 0) + 1;
        localStorage.setItem('w3t_statistics', JSON.stringify(state.statistics));
        updateStatisticsBadge();
    }

    /**
     * NEW: Update statistics badge
     */
    function updateStatisticsBadge() {
        totalGenerationsBadge.textContent = state.statistics.totalGenerations;
    }

    /**
     * NEW: Show statistics modal
     */
    function showStatistics() {
        const uniqueTopics = Object.keys(state.statistics.topicCounts).length;
        const mostUsed = Object.entries(state.statistics.topicCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        document.getElementById('stat-total-generations').textContent = state.statistics.totalGenerations;
        document.getElementById('stat-favorites-count').textContent = state.favorites.length;
        document.getElementById('stat-unique-topics').textContent = uniqueTopics;
        document.getElementById('stat-most-used').textContent = mostUsed ? mostUsed[0] : '—';
        
        openModal('stats-modal');
    }

    /**
     * Renders favorites with search/sort (NEW: Enhanced)
     */
    function renderFavorites() {
        const searchTerm = searchInput.value.toLowerCase();
        const sortOrder = sortSelect.value;
        
        let filtered = state.favorites.filter(item =>
            item.topic.toLowerCase().includes(searchTerm) ||
            item.words.toLowerCase().includes(searchTerm)
        );

        // Sort
        filtered = sortItems(filtered, sortOrder);

        favoritesList.innerHTML = '';
        if (filtered.length === 0) {
            emptyFavorites.style.display = 'block';
            return;
        }
        emptyFavorites.style.display = 'none';

        filtered.forEach(item => {
            const li = document.createElement('li');
            li.className = `favorite-item ${state.settings.viewMode}`;
            li.innerHTML = `
                <div class="history-item-content">
                    <div class="history-topic">${highlightSearch(item.topic, searchTerm)}</div>
                    <div class="history-words">#${highlightSearch(item.words.split('.').join('.'), searchTerm)}</div>
                    ${item.tags ? `<div class="tags">${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="icon-btn" title="Copy" data-action="copy">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/></svg>
                    </button>
                    <button class="icon-btn" title="Tag" data-action="tag">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    </button>
                    <button class="icon-btn" title="Remove" data-action="remove">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                </div>
            `;
            
            li.querySelector('.history-item-content').addEventListener('click', () => {
                topicInput.value = item.topic;
                displayResult(item.topic, item.words);
            });
            
            li.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    if (action === 'copy') copyResult(item.topic, item.words);
                    if (action === 'remove') toggleFavorite(item);
                    if (action === 'tag') addTagToFavorite(item);
                });
            });
            
            favoritesList.prepend(li);
        });
    }

    /**
     * NEW: Add tag to favorite
     */
    function addTagToFavorite(item) {
        const tag = prompt('Enter a tag for this favorite:');
        if (tag && tag.trim()) {
            if (!item.tags) item.tags = [];
            if (!item.tags.includes(tag.trim())) {
                item.tags.push(tag.trim());
                localStorage.setItem('w3t_favorites', JSON.stringify(state.favorites));
                renderFavorites();
                showToast(`✅ Tag "${tag}" added!`);
            }
        }
    }

    /**
     * NEW: Highlight search terms
     */
    function highlightSearch(text, search) {
        if (!search) return text;
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * NEW: Sort items
     */
    function sortItems(items, order) {
        const sorted = [...items];
        switch (order) {
            case 'alpha':
                return sorted.sort((a, b) => a.topic.localeCompare(b.topic));
            case 'alpha-reverse':
                return sorted.sort((a, b) => b.topic.localeCompare(a.topic));
            case 'oldest':
                return sorted.reverse();
            case 'recent':
            default:
                return sorted;
        }
    }

    /**
     * Renders history with search/sort (NEW: Enhanced)
     */
    function renderHistory() {
        const searchTerm = searchInput.value.toLowerCase();
        const sortOrder = sortSelect.value;
        
        let filtered = state.history.filter(item =>
            item.topic.toLowerCase().includes(searchTerm) ||
            item.words.toLowerCase().includes(searchTerm)
        );

        filtered = sortItems(filtered, sortOrder);

        historyList.innerHTML = '';
        if (filtered.length === 0) {
            emptyHistory.style.display = 'block';
            clearHistoryBtn.style.display = 'none';
            return;
        }
        emptyHistory.style.display = 'none';
        clearHistoryBtn.style.display = 'block';

        filtered.forEach(item => {
            const li = document.createElement('li');
            li.className = `history-item ${state.settings.viewMode}`;
            li.innerHTML = `
                <div class="history-item-content">
                    <div class="history-topic">${highlightSearch(item.topic, searchTerm)}</div>
                    <div class="history-words">#${highlightSearch(item.words.split('.').join('.'), searchTerm)}</div>
                </div>
            `;
            li.addEventListener('click', () => {
                topicInput.value = item.topic;
                displayResult(item.topic, item.words);
            });
            historyList.prepend(li);
        });
    }

    /**
     * Adds item to history.
     */
    function addToHistory(topic, words) {
        state.history = state.history.filter(item => item.topic !== topic);
        state.history.push({ topic, words, timestamp: Date.now() });
        if (state.history.length > 100) state.history.shift();
        localStorage.setItem('w3t_history', JSON.stringify(state.history));
        renderHistory();
    }

    /**
     * Toggles favorite.
     */
    function toggleFavorite(item) {
        const index = state.favorites.findIndex(fav => fav.words === item.words);
        if (index > -1) {
            // NEW: Add to undo stack
            state.undoStack.push({ action: 'removeFavorite', item: state.favorites[index] });
            state.favorites.splice(index, 1);
            showToast("💔 Removed from favorites.");
        } else {
            state.undoStack.push({ action: 'addFavorite', item });
            state.favorites.push(item);
            showToast("⭐ Added to favorites!");
            sounds.favorite();
        }
        localStorage.setItem('w3t_favorites', JSON.stringify(state.favorites));
        renderFavorites();
    }

    /**
     * Clears history.
     */
    function clearHistory() {
        if (confirm("Are you sure you want to clear all history?")) {
            state.undoStack.push({ action: 'clearHistory', items: [...state.history] });
            state.history = [];
            localStorage.removeItem('w3t_history');
            renderHistory();
            showToast("🕒 History cleared.");
        }
    }

    /**
     * NEW: Undo last action
     */
    function undo() {
        if (state.undoStack.length === 0) {
            showToast("⚠️ Nothing to undo", "warning");
            return;
        }

        const lastAction = state.undoStack.pop();
        
        switch (lastAction.action) {
            case 'addFavorite':
                state.favorites = state.favorites.filter(f => f.words !== lastAction.item.words);
                break;
            case 'removeFavorite':
                state.favorites.push(lastAction.item);
                break;
            case 'clearHistory':
                state.history = lastAction.items;
                break;
        }

        localStorage.setItem('w3t_favorites', JSON.stringify(state.favorites));
        localStorage.setItem('w3t_history', JSON.stringify(state.history));
        renderFavorites();
        renderHistory();
        showToast("↩️ Action undone");
    }

    /**
     * NEW: Export data as JSON
     */
    function exportData(dataType) {
        const data = dataType === 'favorites' ? state.favorites : state.history;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `what3topics-${dataType}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ ${dataType} exported!`);
    }

    /**
     * NEW: Import data from JSON
     */
    function importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    const mergeType = confirm('Click OK to merge with existing favorites, Cancel to replace them.');
                    if (mergeType) {
                        state.favorites = [...state.favorites, ...data];
                    } else {
                        state.favorites = data;
                    }
                    localStorage.setItem('w3t_favorites', JSON.stringify(state.favorites));
                    renderFavorites();
                    showToast(`✅ Imported ${data.length} items!`);
                } else {
                    throw new Error('Invalid format');
                }
            } catch (err) {
                showToast('❌ Invalid file format', 'danger');
            }
        };
        reader.readAsText(file);
    }

    /**
     * NEW: Batch processing
     */
    async function processBatch() {
        const topics = batchInput.value.split('\n').filter(t => t.trim());
        if (topics.length === 0) {
            showToast('⚠️ Please enter at least one topic', 'warning');
            return;
        }

        batchResults.innerHTML = '<p>Processing...</p>';
        processBatchBtn.disabled = true;

        const results = [];
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i].trim();
            topicInput.value = topic;
            
            try {
                // Simulate processing
                await new Promise(resolve => setTimeout(resolve, 1500));
                results.push({ topic, words: 'sample.result.words', status: 'success' });
            } catch (err) {
                results.push({ topic, status: 'error' });
            }

            batchResults.innerHTML = `
                <div class="batch-progress">
                    <p>Processing: ${i + 1} / ${topics.length}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((i + 1) / topics.length) * 100}%"></div>
                    </div>
                </div>
            `;
        }

        // Display results
        batchResults.innerHTML = results.map(r => `
            <div class="batch-result-item ${r.status}">
                <strong>${r.topic}</strong>: ${r.status === 'success' ? `#${r.words}` : 'Error'}
            </div>
        `).join('');

        processBatchBtn.disabled = false;
        showToast(`✅ Processed ${results.length} topics!`);
    }

    /**
     * NEW: Character counter
     */
    function updateCharCounter() {
        const length = topicInput.value.length;
        const maxLength = 100;
        charCounter.textContent = `${length}/${maxLength}`;
        charCounter.style.color = length > maxLength ? 'var(--danger-color)' : 'var(--text-color)';
    }

    /**
     * NEW: Autocomplete suggestions
     */
    function showAutocomplete() {
        if (!state.settings.autocomplete || topicInput.value.length < 2) {
            autocompleteDropdown.style.display = 'none';
            return;
        }

        const searchTerm = topicInput.value.toLowerCase();
        const suggestions = [...new Set(state.history.map(h => h.topic))]
            .filter(topic => topic.toLowerCase().includes(searchTerm))
            .slice(0, 5);

        if (suggestions.length === 0) {
            autocompleteDropdown.style.display = 'none';
            return;
        }

        autocompleteDropdown.innerHTML = suggestions.map(s => `
            <div class="autocomplete-item">${s}</div>
        `).join('');
        
        autocompleteDropdown.style.display = 'block';

        autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                topicInput.value = item.textContent;
                autocompleteDropdown.style.display = 'none';
                topicInput.focus();
            });
        });
    }

    /**
     * Toggles theme.
     */
    function toggleTheme() {
        state.theme = (state.theme === 'light') ? 'dark' : 'light';
        document.body.classList.toggle('dark-mode', state.theme === 'dark');
        localStorage.setItem('w3t_theme', state.theme);
    }

    /**
     * Shows toast notification.
     */
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    /**
     * NEW: Modal utilities
     */
    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    function createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
            </div>
        `;
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        return modal;
    }

    /**
     * NEW: Apply settings
     */
    function applySettings() {
        document.body.classList.toggle('no-animations', !state.settings.animations);
        document.body.classList.toggle('compact-view', state.settings.viewMode === 'compact');
        document.body.classList.toggle('expanded-view', state.settings.viewMode === 'expanded');
    }

    /**
     * NEW: Load URL parameters
     */
    function loadURLParams() {
        const params = new URLSearchParams(window.location.search);
        const topic = params.get('topic');
        const words = params.get('words');
        
        if (topic && words) {
            topicInput.value = topic;
            displayResult(topic, words);
        }
    }

    // --- Event Listeners ---
    generateBtn.addEventListener('click', () => getThreeWords());
    topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') getThreeWords();
    });
    topicInput.addEventListener('input', () => {
        updateCharCounter();
        showAutocomplete();
    });
    topicInput.addEventListener('blur', () => {
        setTimeout(() => autocompleteDropdown.style.display = 'none', 200);
    });

    randomBtn.addEventListener('click', () => {
        topicInput.value = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
        sounds.click();
    });

    surpriseBtn.addEventListener('click', () => {
        topicInput.value = SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)];
        getThreeWords();
    });

    batchBtn.addEventListener('click', () => {
        openModal('batch-modal');
    });

    themeToggleBtn.addEventListener('click', toggleTheme);
    clearHistoryBtn.addEventListener('click', clearHistory);
    
    // NEW: Feature buttons
    statsBtn.addEventListener('click', showStatistics);
    settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    keyboardShortcutsBtn.addEventListener('click', () => openModal('shortcuts-modal'));
    
    exportFavoritesBtn.addEventListener('click', () => exportData('favorites'));
    exportHistoryBtn.addEventListener('click', () => exportData('history'));
    importFavoritesBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) importData(e.target.files[0]);
    });
    
    processBatchBtn.addEventListener('click', processBatch);
    
    searchInput.addEventListener('input', () => {
        renderFavorites();
        renderHistory();
    });
    
    sortSelect.addEventListener('change', () => {
        renderFavorites();
        renderHistory();
    });

    // Settings toggles
    document.getElementById('animations-toggle').addEventListener('change', (e) => {
        state.settings.animations = e.target.checked;
        localStorage.setItem('w3t_settings', JSON.stringify(state.settings));
        applySettings();
    });
    
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
        state.settings.sounds = e.target.checked;
        localStorage.setItem('w3t_settings', JSON.stringify(state.settings));
    });
    
    document.getElementById('autocomplete-toggle').addEventListener('change', (e) => {
        state.settings.autocomplete = e.target.checked;
        localStorage.setItem('w3t_settings', JSON.stringify(state.settings));
    });
    
    document.getElementById('duplicate-warning-toggle').addEventListener('change', (e) => {
        state.settings.duplicateWarning = e.target.checked;
        localStorage.setItem('w3t_settings', JSON.stringify(state.settings));
    });
    
    document.getElementById('view-mode-select').addEventListener('change', (e) => {
        state.settings.viewMode = e.target.value;
        localStorage.setItem('w3t_settings', JSON.stringify(state.settings));
        applySettings();
        renderFavorites();
        renderHistory();
    });

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal || btn.closest('.modal').id);
        });
    });

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Tab navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
        });
    });

    // NEW: Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'Enter':
                    e.preventDefault();
                    getThreeWords();
                    break;
                case 'r':
                    e.preventDefault();
                    randomBtn.click();
                    break;
                case 's':
                    e.preventDefault();
                    surpriseBtn.click();
                    break;
                case 'c':
                    if (state.currentResult) {
                        e.preventDefault();
                        copyResult(state.currentResult.topic, state.currentResult.words);
                    }
                    break;
                case 'f':
                    if (state.currentResult) {
                        e.preventDefault();
                        toggleFavorite(state.currentResult);
                    }
                    break;
                case 'z':
                    e.preventDefault();
                    undo();
                    break;
            }
        } else if (e.key === '?') {
            openModal('shortcuts-modal');
        }
    });

    // --- Initialization ---
    function init() {
        if (state.theme === 'dark') {
            document.body.classList.add('dark-mode');
        }
        
        // Load settings
        document.getElementById('animations-toggle').checked = state.settings.animations;
        document.getElementById('sound-toggle').checked = state.settings.sounds;
        document.getElementById('autocomplete-toggle').checked = state.settings.autocomplete;
        document.getElementById('duplicate-warning-toggle').checked = state.settings.duplicateWarning;
        document.getElementById('view-mode-select').value = state.settings.viewMode;
        
        applySettings();
        renderFavorites();
        renderHistory();
        updateStatisticsBadge();
        updateCharCounter();
        loadURLParams();
    }

    init();
});
