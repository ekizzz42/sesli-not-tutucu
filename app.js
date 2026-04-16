// ========================
// VocalNotes - app.js
// ========================

const noteInput      = document.getElementById('noteInput');
const addNoteBtn     = document.getElementById('addNoteBtn');
const voiceBtn       = document.getElementById('voiceBtn');
const mobileFab      = document.getElementById('mobileFab');
const notesContainer = document.getElementById('notesContainer');
const emptyState     = document.getElementById('emptyState');
const statusMsg      = document.getElementById('statusMessage');
const searchInput    = document.getElementById('searchInput');
const noteCount      = document.getElementById('noteCount');
const installBtn     = document.getElementById('installBtn');
const charCounter    = document.getElementById('charCounter');
const sortSelect     = document.getElementById('sortSelect');
const exportBtn      = document.getElementById('exportBtn');

const editModal      = document.getElementById('editModal');
const editInput      = document.getElementById('editInput');
const saveEditBtn    = document.getElementById('saveEdit');
const cancelEditBtn  = document.getElementById('cancelEdit');
const closeModalBtn  = document.getElementById('closeModal');

// Settings Elements
const settingsBtn     = document.getElementById('settingsBtn');
const settingsModal   = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const closeSettingsFull = document.getElementById('closeSettingsBtn');
const langSelect      = document.getElementById('langSelect');
const themeButtons    = document.querySelectorAll('.theme-btn');
const visualizer      = document.getElementById('visualizer');
const updateAppBtn    = document.getElementById('updateAppBtn');

// Auth Elements
const authOverlay     = document.getElementById('authOverlay');
const loginForm       = document.getElementById('loginForm');
const registerForm    = document.getElementById('registerForm');
const toRegister      = document.getElementById('toRegister');
const toLogin         = document.getElementById('toLogin');
const currentUserName = document.getElementById('currentUserName');
const logoutBtn       = document.getElementById('logoutBtn');
const authStatus      = document.getElementById('authStatus');

let notes = [];
let reminders = [];
let currentUser = null;
let userSettings = {
    theme: 'dark',
    lang: 'tr'
};
let recognition = null;
let isRecording = false;
let currentView      = 'all'; // all, pinned, archived, trash
let preSpeechText    = ''; 
let pendingImages     = []; // Yeni eklenen resimler (base64)

const CATEGORIES = {
    genel: { label_tr: 'Genel', label_en: 'General', icon: '📁' },
    is: { label_tr: 'İş', label_en: 'Work', icon: '💼' },
    kisisel: { label_tr: 'Kişisel', label_en: 'Personal', icon: '👤' },
    fikir: { label_tr: 'Fikir', label_en: 'Idea', icon: '💡' },
    alisveris: { label_tr: 'Alışveriş', label_en: 'Shopping', icon: '🛒' }
};

const COLORS = [
    'rgba(124, 77,255, 0.25)', // Mor
    'rgba(0, 229, 255, 0.22)', // Turkuaz
    'rgba(255, 64, 129, 0.22)', // Pembe
    'rgba(0, 200, 83, 0.22)',  // Yeşil
    'rgba(255, 171, 64, 0.23)', // Turuncu
    'rgba(33, 150, 243, 0.22)', // Mavi
];

// ────────────────────────────────────────
// LocalStorage
// ────────────────────────────────────────
function saveNotes() {
    if (!currentUser) return;
    localStorage.setItem(`vocalnotes_data_${currentUser.id}`, JSON.stringify(notes));
    localStorage.setItem(`vocalnotes_reminders_${currentUser.id}`, JSON.stringify(reminders));
    localStorage.setItem(`vocalnotes_settings_${currentUser.id}`, JSON.stringify(userSettings));
}

function loadNotes() {
    if (!currentUser) return;
    try {
        const userId = currentUser.id;
        const raw = localStorage.getItem(`vocalnotes_data_${userId}`);
        notes = raw ? JSON.parse(raw) : [];
        
        const rawReminders = localStorage.getItem(`vocalnotes_reminders_${userId}`);
        reminders = rawReminders ? JSON.parse(rawReminders) : [];

        const rawSettings = localStorage.getItem(`vocalnotes_settings_${userId}`);
        if (rawSettings) userSettings = JSON.parse(rawSettings);

        // Settings'i uygula
        applyTheme(userSettings.theme);
        applyLanguage(userSettings.lang);
    } catch {
        notes = [];
        reminders = [];
    }
}

// ────────────────────────────────────────
// Render & Sort
// ────────────────────────────────────────
function renderNotes() {
    const filter = searchInput.value.toLowerCase();
    const sortVal = sortSelect.value;
    
    notesContainer.innerHTML = '';

    let displayNotes = [];
    if (currentView === 'trash') {
        displayNotes = notes.filter(n => n.trash);
    } else if (currentView === 'archived') {
        displayNotes = notes.filter(n => n.archived && !n.trash);
    } else if (currentView === 'pinned') {
        displayNotes = notes.filter(n => n.pinned && !n.archived && !n.trash);
    } else {
        displayNotes = notes.filter(n => !n.archived && !n.trash);
    }

    let filtered = displayNotes.filter(n => n.text.toLowerCase().includes(filter));

    // Sıralama Mantığı
    if (sortVal === 'newest') {
        filtered.sort((a, b) => b.id - a.id);
    } else if (sortVal === 'oldest') {
        filtered.sort((a, b) => a.id - b.id);
    } else if (sortVal === 'pinned' && currentView !== 'pinned') {
        filtered.sort((a, b) => {
            if (a.pinned === b.pinned) return b.id - a.id;
            return a.pinned ? -1 : 1;
        });
    }

    // Nav Badge & Empty State Toggle
    const activeNotes = notes.filter(n => !n.archived && !n.trash);
    if (activeNotes.length > 0) {
        noteCount.textContent = activeNotes.length;
        noteCount.classList.add('visible');
    } else {
        noteCount.classList.remove('visible');
    }

    // Empty State Check
    const emptyStateText = document.getElementById('emptyStateText');
    const clearTrashBtn = document.getElementById('clearTrashBtn');
    
    // Çöp Kutusu Görünümündeyken "Çöpü Boşalt" Butonunu Göster/Gizle
    if (currentView === 'trash' && filtered.length > 0) {
        clearTrashBtn.style.display = 'flex';
        clearTrashBtn.style.alignItems = 'center';
        clearTrashBtn.style.justifyContent = 'center';
        clearTrashBtn.style.gap = '8px';
    } else {
        clearTrashBtn.style.display = 'none';
    }

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        const t = TRANSLATIONS[userSettings.lang];
        if (currentView === 'trash') emptyStateText.innerHTML = t.emptyTrash;
        else if (currentView === 'archived') emptyStateText.innerHTML = t.emptyArchive;
        else emptyStateText.innerHTML = t.empty;
        return;
    }
    emptyState.classList.remove('visible');

    filtered.forEach((note, idx) => {
        const card = document.createElement('div');
        card.className = `note-card glass ${note.pinned ? 'is-pinned' : ''}`;
        card.setAttribute('data-category', note.category || 'genel');
        const isGeneral = (note.category || 'genel') === 'genel';
        const textColor = isGeneral ? '#000000' : '#ffffff';
        const cardBg = isGeneral ? '#f1f5f9' : COLORS[note.colorIdx % COLORS.length];

        const date = new Date(note.id);
        const dateStr = date.toLocaleDateString(userSettings.lang === 'tr' ? 'tr-TR' : 'en-US', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const cat = CATEGORIES[note.category || 'genel'];
        const catLabel = userSettings.lang === 'tr' ? cat.label_tr : cat.label_en;
        const reminder = reminders.find(r => r.noteId === note.id && !r.triggered);
        const reminderHtml = reminder ? `
            <div class="note-reminder-badge" title="${new Date(reminder.time).toLocaleString()}">
                <i class="fa-solid fa-bell"></i> ${new Date(reminder.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </div>` : '';

        let formattedText = note.text;
        // Eğer içerisinde HTML tag'leri yoksa ve markdown işareti varsa dönüştür
        if (!/<[a-z][\s\S]*>/i.test(formattedText)) {
            formattedText = escapeHtml(formattedText).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        }

        const imagesHtml = note.images ? note.images.map(img => `<img src="${img}" loading="lazy">`).join('') : '';

        card.style.background = cardBg;

        card.innerHTML = `
            <div class="note-category-badge" style="color: ${isGeneral ? '#000000' : '#ffffff'}">${cat.icon} ${catLabel}</div>
            ${note.pinned ? '<div class="note-pinned-badge"><i class="fa-solid fa-thumbtack"></i></div>' : ''}
            ${reminderHtml}
            <div class="note-content" style="color: ${textColor} !important;">
                ${formattedText}
                ${imagesHtml}
            </div>
            <div class="note-footer">
                <span class="note-date" style="color: ${isGeneral ? '#444444' : 'rgba(255,255,255,0.8)'}"><i class="fa-regular fa-clock"></i>${dateStr}</span>
                <div class="note-btn-group">
                    ${currentView === 'trash' ? `
                        <button class="btn-icon btn-copy" onclick="restoreNote(${note.id})" title="Geri Yükle">
                            <i class="fa-solid fa-trash-arrow-up"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="permanentDelete(${note.id})" title="Kalıcı Sil">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    ` : `
                        <button class="btn-icon btn-pin ${note.pinned ? 'pinned' : ''}" onclick="togglePin(${note.id})" title="Sabitle" style="color: ${isGeneral && !note.pinned ? '#444444' : ''}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                        <button class="btn-icon btn-edit" onclick="openEditModal(${note.id})" title="Düzenle" style="color: ${isGeneral ? '#444444' : ''}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-copy" onclick="archiveNote(${note.id})" title="${note.archived ? 'Arşivden Çıkar' : 'Arşivle'}" style="color: ${isGeneral ? '#444444' : ''}">
                            <i class="fa-solid fa-box-archive"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteNote(${note.id})" title="Sil" style="color: ${isGeneral ? '#444444' : ''}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
        notesContainer.appendChild(card);
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ────────────────────────────────────────
// Not İşlemleri
// ────────────────────────────────────────
function addNote(htmlText) {
    if (typeof htmlText !== 'string' || htmlText.type === 'click' || htmlText.type === 'keydown') {
        htmlText = noteInput.innerHTML;
    }
    // Eğer o an kayıt yapılıyorsa, kaydı durdur
    if (isRecording) {
        stopRecording();
        if (recognition) recognition.stop();
        htmlText = noteInput.innerHTML;
    }

    const plainText = noteInput.innerText.trim();
    if (!plainText) {
        showStatus('⚠️ Lütfen bir not yazın.', 'warn');
        return;
    }

    const noteId = Date.now();
    const note = {
        id: noteId,
        text: htmlText,
        pinned: false,
        archived: false,
        trash: false,
        category: document.getElementById('categoryInput').value,
        images: [...pendingImages],
        colorIdx: notes.length,
    };

    notes.push(note);
    
    // Temizlik
    noteInput.innerHTML = '';
    pendingImages = [];
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').style.display = 'none';
    
    // Hatırlatıcı komutu kontrolü
    const reminderTime = parseReminderCommand(text);
    if (reminderTime) {
        reminders.push({
            id: Date.now() + Math.random(),
            noteId: noteId,
            time: reminderTime,
            text: text,
            triggered: false
        });
        requestNotificationPermission();
        showStatus('⏰ Hatırlatıcı kuruldu!', 'ok');
    } else {
        showStatus('✅ Not başarıyla eklendi!', 'ok');
    }

    saveNotes();
    renderNotes();
    
    // Temizlik
    noteInput.value = '';
    speechFullTranscript = '';
    speechInterimTranscript = '';
    updateCharCounter();
    autoResize(noteInput);
}

function parseReminderCommand(text) {
    const lowerText = text.toLowerCase();
    
    // Pattern: "X gün/saat/dakika sonra hatırlat"
    const relativeMatch = lowerText.match(/(\d+)\s*(gün|saat|dakika|dk|sn|saniye)\s*sonra\s*hatırlat/);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];
        let ms = 0;
        
        if (unit.startsWith('gün')) ms = amount * 24 * 60 * 60 * 1000;
        else if (unit.startsWith('saat')) ms = amount * 60 * 60 * 1000;
        else if (unit.startsWith('dakika') || unit === 'dk') ms = amount * 60 * 1000;
        else if (unit.startsWith('saniye') || unit === 'sn') ms = amount * 1000;
        
        return Date.now() + ms;
    }

    // Pattern: "yarın hatırlat"
    if (lowerText.includes('yarın hatırlat')) {
        // Yarın bu saate kur
        return Date.now() + 24 * 60 * 60 * 1000;
    }

    return null;
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function checkReminders() {
    const now = Date.now();
    let changed = false;

    reminders.forEach(r => {
        if (!r.triggered && now >= r.time) {
            r.triggered = true;
            changed = true;
            sendNotification(r.text);
        }
    });

    if (changed) {
        // Tetiklenenleri temizleyebiliriz veya işaretli bırakabiliriz
        // Şimdilik silmeyelim ki tekrar tekrar tetiklenmesin ama saklayalım (triggered=true)
        saveNotes();
    }
}

function sendNotification(text) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        new Notification('VocalNotes Hatırlatıcı', {
            body: text,
            icon: 'favicon.ico' // Varsa ikon
        });
    } else {
        // Tarayıcı bildirimi yoksa status message olarak göster
        showStatus(`⏰ HATIRLATICI: ${text}`, 'warn');
    }
}

// Her 10 saniyede bir kontrol et
setInterval(checkReminders, 10000);

function deleteNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.trash = true;
        saveNotes();
        renderNotes();
        showStatus('🗑️ Not çöpe taşındı.');
    }
}

function archiveNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.archived = !note.archived;
        saveNotes();
        renderNotes();
        showStatus(note.archived ? '📦 Arşivlendi.' : '📥 Arşivden çıkarıldı.');
    }
}

function restoreNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.trash = false;
        saveNotes();
        renderNotes();
        showStatus('♻️ Not geri yüklendi.');
    }
}

function permanentDelete(id) {
    if (confirm('Bu notu kalıcı olarak silmek istediğinize emin misiniz?')) {
        // Sadece notları filtrele, kullanıcı verilerine dokunma
        notes = notes.filter(n => n.id !== id);
        reminders = reminders.filter(r => r.noteId !== id);
        saveNotes();
        renderNotes();
        showStatus('🗑️ Not tamamen silindi.');
    }
}

function emptyTrash() {
    if (notes.filter(n => n.trash).length === 0) return;
    
    if (confirm('Çöp kutusundaki tüm notlar kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?')) {
        // Çöpte olmayan (trash: false) notları tut, diğerlerini at
        notes = notes.filter(n => !n.trash);
        saveNotes();
        renderNotes();
        showStatus('🧹 Çöp kutusu tamamen boşaltıldı.');
    }
}

function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        saveNotes();
        renderNotes();
    }
}

function copyNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    navigator.clipboard.writeText(note.text).then(() => {
        showStatus('📋 Kopyalandı!', 'ok');
    });
}

// ────────────────────────────────────────
// Modal (Düzenleme)
// ────────────────────────────────────────
function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    currentEditId = id;
    editInput.value = note.text;
    editModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Scroll kilitle
    editInput.focus();
}

function closeEditModal() {
    editModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditId = null;
}

function saveEdit() {
    const newText = editInput.value.trim();
    if (!newText) return;
    
    const index = notes.findIndex(n => n.id === currentEditId);
    if (index !== -1) {
        notes[index].text = newText;
        saveNotes();
        renderNotes();
        closeEditModal();
        showStatus('✏️ Not güncellendi.');
    }
}

// ────────────────────────────────────────
// Dışa Aktar (Export)
// ────────────────────────────────────────
function exportNotes() {
    if (notes.length === 0) {
        showStatus('⚠️ Aktarılacak not bulunmuyor.', 'warn');
        return;
    }
    
    let content = "--- VOCALNOTES YEDEK ---\n\n";
    notes.forEach((n, i) => {
        const d = new Date(n.id).toLocaleString('tr-TR');
        content += `[${i+1}] Tarih: ${d}\n${n.text}\n\n------------------\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VocalNotes_Yedek_${new Date().toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('📤 Dosya indirildi!');
}

// ────────────────────────────────────────
// Yardımcı Fonksiyonlar
// ────────────────────────────────────────
function updateCharCounter() {
    const len = noteInput.innerText.length;
    charCounter.textContent = `${len} karakter`;
    charCounter.classList.remove('warn', 'danger');
    if (len > 200) charCounter.classList.add('warn');
    if (len > 400) charCounter.classList.add('danger');
}

function autoResize(el) {
    // Contenteditable div'ler kendi boyutunu ayarlar, sadece scroll kontrolü yaparız
    if (isRecording) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
}

function showStatus(msg, type = 'ok') {
    statusMsg.textContent = msg;
    statusMsg.style.color = type === 'warn' ? 'var(--warn)' : 'var(--accent)';
    clearTimeout(statusMsg._timeout);
    statusMsg._timeout = setTimeout(() => { statusMsg.textContent = ''; }, 3000);
}

// ────────────────────────────────────────
// Zengin İçerik (Formatting & Image)
// ────────────────────────────────────────
function formatText(type) {
    document.execCommand(type, false, null);
    noteInput.focus();
    updateCharCounter();
}

function handleVoiceCommand(transcript) {
    const cmd = transcript.toLowerCase().trim();
    if (cmd.includes('notu ekle') || cmd.includes('add note')) {
        addNote(noteInput.innerHTML);
        return true;
    }
    if (cmd.includes('gece moduna geç') || cmd.includes('midnight mode')) {
        applyTheme('midnight');
        showStatus('🌙 Gece modu aktif.');
        return true;
    }
    if (cmd.includes('ışıkları aç') || cmd.includes('light mode')) {
        applyTheme('light');
        showStatus('☀️ Aydınlık mod aktif.');
        return true;
    }
    if (cmd.includes('arşivi aç') || cmd.includes('open archive')) {
        document.querySelector('[data-view="archived"]').click();
        return true;
    }
    if (cmd.includes('notlarımı göster') || cmd.includes('show my notes')) {
        document.querySelector('[data-view="all"]').click();
        return true;
    }
    return false;
}

function aiSummarize() {
    const htmlText = noteInput.innerHTML;
    const plainText = noteInput.innerText.trim();
    
    if (plainText.length < 5) {
        showStatus(userSettings.lang === 'tr' ? '⚠️ Komut vermek için daha uzun bir metin yazın.' : '⚠️ Text is too short for a command.', 'warn');
        return;
    }

    showStatus(userSettings.lang === 'tr' ? '🪄 AI İşlem Yapıyor...' : '🪄 AI Processing...', 'ok');
    
    setTimeout(() => {
        const lower = plainText.toLowerCase();
        let result = "";
        let commandFound = false;

        if (lower.includes("özetle") || lower.includes("özet")) {
            const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
            result = `<strong>Özet:</strong> ${sentences[0].substring(0, 150)}...`;
            commandFound = true;
        } else if (lower.includes("çevir")) {
            result = `<strong>Çeviri (Simülasyon):</strong> Translating... [Lütfen bir API bağlayın]`;
            commandFound = true;
        } else if (lower.includes("madde") || lower.includes("listele")) {
            const words = plainText.replace("listele", "").replace("maddele", "").replace("madde", "").trim().split(" ");
            result = "<ul>" + words.slice(0, 5).map(w => `<li>${w}</li>`).join('') + "</ul>";
            commandFound = true;
        }

        if (!commandFound) {
            result = `<strong>Serbest AI Analizi (Simüle):</strong> <i>Lütfen komutunuzda 'özetle', 'listele' veya 'çevir' kullanın. Gerçek bir dil modeli (ChatGPT vb.) bağlamadan bu sistem öngörüyle çalışır.</i>`;
        }

        const separator = "<br>────────────────────<br>";
        
        noteInput.innerHTML = result + separator + htmlText;
        
        updateCharCounter();
        noteInput.scrollTo({ top: 0, behavior: 'smooth' });
        showStatus(userSettings.lang === 'tr' ? '✨ İşlem tamamlandı!' : '✨ Processing complete!', 'ok');
    }, 800);
}

function lockApp() {
    if (!currentUser) return; // Giriş yapmamışsa kilitleme
    document.getElementById('lockOverlay').style.display = 'flex';
    sessionStorage.setItem('vocalnotes_locked', 'true');
}

function unlockApp() {
    const pass = document.getElementById('unlockPass').value;
    if (pass === currentUser.pass) {
        document.getElementById('lockOverlay').style.display = 'none';
        sessionStorage.removeItem('vocalnotes_locked');
        document.getElementById('unlockPass').value = '';
    } else {
        document.getElementById('lockStatus').textContent = '❌ Yanlış Şifre!';
        setTimeout(() => document.getElementById('lockStatus').textContent = '', 2000);
    }
}
function handleImageSelect(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('imagePreview');
    
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            pendingImages.push(base64);
            
            const div = document.createElement('div');
            div.className = 'img-preview-item';
            div.innerHTML = `
                <img src="${base64}">
                <button class="btn-remove" onclick="removePendingImage('${base64}', this)">×</button>
            `;
            previewContainer.appendChild(div);
            previewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });
    e.target.value = ''; // Reset input
}

window.removePendingImage = (base64, btn) => {
    pendingImages = pendingImages.filter(img => img !== base64);
    btn.parentElement.remove();
    if (pendingImages.length === 0) document.getElementById('imagePreview').style.display = 'none';
};

function refreshApp() {
    showStatus('⏳ Güncelleniyor...', 'ok');
    if ('serviceWorker' in navigator) {
        caches.keys().then((names) => {
            for (let name of names) caches.delete(name);
        }).then(() => {
            location.reload(true);
        });
    } else {
        location.reload(true);
    }
}

// ────────────────────────────────────────
// Kimlik Doğrulama (Auth)
// ────────────────────────────────────────
function checkAuth() {
    try {
        const session = localStorage.getItem('vocalnotes_user');
        if (session) {
            const parsed = JSON.parse(session);
            if (parsed && parsed.id && parsed.name) {
                currentUser = parsed;
                authOverlay.style.display = 'none';
                currentUserName.textContent = currentUser.name;
                loadNotes();
                renderNotes();
                return;
            }
        }
    } catch (e) {
        console.error("Auth check error:", e);
    }
    
    // session yoksa veya geçersizse overlay'i göster
    authOverlay.style.display = 'flex';
    currentUser = null;
}

function showAuthStatus(msg, type = 'ok') {
    if (authStatus) {
        authStatus.textContent = msg;
        authStatus.style.color = type === 'warn' ? 'var(--warn)' : 'var(--accent)';
        clearTimeout(authStatus._timeout);
        authStatus._timeout = setTimeout(() => { authStatus.textContent = ''; }, 4000);
    }
}

function login(username, password) {
    if (!username || !password) return;
    username = username.trim();
    password = password.trim();

    let users = [];
    try {
        users = JSON.parse(localStorage.getItem('vocalnotes_users') || '[]');
    } catch(e) {
        console.error("Database error:", e);
    }
    
    const user = users.find(u => u.name.trim().toLowerCase() === username.toLowerCase());
    
    if (!user) {
        showAuthStatus('❌ Kullanıcı bulunamadı.', 'warn');
        // DETEKTİF MODU: Diğer anahtarlara da bak
        scanAllForUsernames(username);
        return;
    }

    if (user.pass.trim() !== password) {
        showAuthStatus('❌ Şifre hatalı.', 'warn');
        return;
    }
    
    localStorage.setItem('vocalnotes_user', JSON.stringify(user));
    checkAuth();
    showStatus('👋 Hoş geldin, ' + user.name);
}

function scanAllForUsernames() {
    const hintDiv = document.getElementById('registeredUsersHint');
    const userSpan = document.getElementById('userListHint');
    let allFoundNames = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
            const val = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(val)) {
                val.forEach(item => { if (item.name) allFoundNames.push(item.name); });
            } else if (val && val.name) {
                allFoundNames.push(val.name);
            }
        } catch(e) {}
    }

    if (allFoundNames.length > 0) {
        const uniqueNames = [...new Set(allFoundNames)];
        userSpan.textContent = uniqueNames.join(', ');
        hintDiv.style.display = 'block';
    } else {
        showAuthStatus('❌ Hiç kayıtlı kullanıcı yok. Lütfen kayıt olun.', 'warn');
    }
}

function togglePassVisibility(id, icon) {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function register(username, password) {
    if (!username || !password) return;
    username = username.trim();
    password = password.trim();

    if (username.length < 3) {
        showAuthStatus('⚠️ Kullanıcı adı en az 3 karakter olmalı.', 'warn');
        return;
    }
    if (password.length < 4) {
        showAuthStatus('⚠️ Şifre en az 4 karakter olmalı.', 'warn');
        return;
    }

    const users = JSON.parse(localStorage.getItem('vocalnotes_users') || '[]');
    if (users.find(u => u.name.toLowerCase() === username.toLowerCase())) {
        showAuthStatus('⚠️ Bu kullanıcı adı zaten alınmış.', 'warn');
        return;
    }
    
    const newUser = { id: Date.now(), name: username, pass: password };
    users.push(newUser);
    localStorage.setItem('vocalnotes_users', JSON.stringify(users));
    
    showAuthStatus('✅ Kayıt başarılı! Giriş yapılıyor...', 'ok');
    
    // Otomatik Giriş
    setTimeout(() => {
        login(username, password);
    }, 1200);
}

function logout() {
    localStorage.removeItem('vocalnotes_user');
    currentUser = null;
    location.reload(); 
}

// ────────────────────────────────────────
// Dil ve Tema Yönetimi
// ────────────────────────────────────────
const TRANSLATIONS = {
    tr: {
        subtitle: "Aklındakileri sese dök veya yaz, biz saklarız.",
        placeholder: "Notunuzu buraya yazın veya mikrofonu kullanın...",
        charCount: "karakter",
        add: "Ekle",
        search: "Notlarda ara...",
        myNotes: "Notlarım",
        empty: "Henüz hiç notun yok.<br>İlkini eklemeye ne dersin?",
        edit: "Notu Düzenle",
        save: "Kaydet",
        cancel: "İptal",
        settings: "Ayarlar",
        userAccount: "Hesap",
        themeName: "Görünüm",
        langName: "Dil Seçeneği",
        langDesc: "Ses tanıma dili seçilen dile göre ayarlanır.",
        done: "Tamam",
        statusListening: "🎙️ Dinleniyor...",
        statusCopied: "📋 Kopyalandı!",
        statusDeleted: "🗑️ Not silindi.",
        statusAdded: "✅ Not başarıyla eklendi!",
        statusWarn: "⚠️ Lütfen bir not yazın.",
        statusLangWarn: "⚠️ Ses tanıma desteklenmiyor.",
        statusMicWarn: "⚠️ Mikrofon izni reddedildi.",
        statusNetWarn: "⚠️ Ağ bağlantısı hatası.",
        sortNew: "En Yeni",
        sortOld: "En Eski",
        sortPinned: "Sabitlenmiş",
        updateBtn: "Uygulamayı Güncelle/Yenile",
        updateAvailable: "Yeni sürüm hazır! Yenilemek için tıklayın.",
        emptyArchive: "Arşivlenmiş notun yok.",
        emptyTrash: "Çöp kutusu boş.",
        navAll: "Tümü",
        navPinned: "Sabitler",
        navArchived: "Arşiv",
        navTrash: "Çöp Kutusu"
    },
    en: {
        subtitle: "Speak or type your thoughts, we keep them safe.",
        placeholder: "Type your note here or use the microphone...",
        charCount: "characters",
        add: "Add",
        search: "Search notes...",
        myNotes: "My Notes",
        empty: "No notes yet.<br>How about adding your first?",
        edit: "Edit Note",
        save: "Save",
        cancel: "Cancel",
        settings: "Settings",
        userAccount: "Account",
        themeName: "Appearance",
        langName: "Language",
        langDesc: "Speech recognition language is set based on this choice.",
        done: "Done",
        statusListening: "🎙️ Listening...",
        statusCopied: "📋 Copied!",
        statusDeleted: "🗑️ Note deleted.",
        statusAdded: "✅ Note added successfully!",
        statusWarn: "⚠️ Please write a note.",
        statusLangWarn: "⚠️ Speech recognition not supported.",
        statusMicWarn: "⚠️ Microphone permission denied.",
        statusNetWarn: "⚠️ Network connection error.",
        sortNew: "Newest",
        sortOld: "Oldest",
        sortPinned: "Pinned",
        updateBtn: "Update/Refresh App",
        updateAvailable: "New version ready! Click to refresh.",
        emptyArchive: "No archived notes.",
        emptyTrash: "Trash is empty.",
        navAll: "All",
        navPinned: "Pinned",
        navArchived: "Archive",
        navTrash: "Trash"
    }
};

function applyLanguage(lang) {
    userSettings.lang = lang;
    const t = TRANSLATIONS[lang];
    
    document.getElementById('appSubtitle').textContent = t.subtitle;
    noteInput.placeholder = t.placeholder;
    addNoteBtn.querySelector('span').textContent = t.add;
    searchInput.placeholder = t.search;
    document.querySelector('.section-header h2').firstChild.textContent = t.myNotes + ' ';
    emptyState.querySelector('p').innerHTML = t.empty;
    document.getElementById('lblEditNote').textContent = t.edit;
    document.getElementById('lblSave').textContent = t.save;
    document.getElementById('cancelEdit').textContent = t.cancel;
    document.getElementById('lblSettings').textContent = t.settings;
    document.getElementById('lblUserAccount').textContent = t.userAccount;
    document.getElementById('lblTheme').textContent = t.themeName;
    document.getElementById('lblLanguage').textContent = t.langName;
    document.getElementById('lblLangDesc').textContent = t.langDesc;
    document.getElementById('lblDone').textContent = t.done;

    // Sort options
    sortSelect.options[0].textContent = t.sortNew;
    sortSelect.options[2].textContent = t.sortPinned;
    document.getElementById('lblUpdateApp').textContent = t.updateBtn;
    
    // Nav Labels
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns[0].querySelector('span').textContent = t.navAll;
    navBtns[1].querySelector('span').textContent = t.navPinned;
    navBtns[2].querySelector('span').textContent = t.navArchived;
    navBtns[3].querySelector('span').textContent = t.navTrash;

    langSelect.value = lang;
    
    // Kategori Dropdown Çevirisi
    const catSelect = document.getElementById('categoryInput');
    if (catSelect) {
        catSelect.options[0].textContent = lang === 'tr' ? '📁 Genel' : '📁 General';
        catSelect.options[1].textContent = lang === 'tr' ? '💼 İş' : '💼 Work';
        catSelect.options[2].textContent = lang === 'tr' ? '👤 Kişisel' : '👤 Personal';
        catSelect.options[3].textContent = lang === 'tr' ? '💡 Fikir' : '💡 Idea';
        catSelect.options[4].textContent = lang === 'tr' ? '🛒 Alışveriş' : '🛒 Shopping';
    }

    // Update recognition if active
    if (recognition) {
        recognition.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
    }
}

function applyTheme(theme) {
    userSettings.theme = theme;
    document.body.classList.remove('light-theme', 'midnight-theme');
    if (theme !== 'dark') {
        document.body.classList.add(`${theme}-theme`);
    }

    themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ────────────────────────────────────────
// Ses Tanıma
// ────────────────────────────────────────
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = userSettings.lang === 'tr' ? 'tr-TR' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
        isRecording = true;
        [voiceBtn, mobileFab].forEach(b => b.classList.add('recording'));
        if (visualizer) visualizer.classList.add('active'); // Dalgaları göster
        showStatus(TRANSLATIONS[userSettings.lang].statusListening);
        
        preSpeechText = noteInput.innerHTML;
        if (preSpeechText && !preSpeechText.endsWith('&nbsp;')) {
            preSpeechText += '&nbsp;';
        }
    };

    recognition.onresult = (event) => {
        if (!isRecording) return;

        let currentSessionTranscript = '';
        // Mobil cihazlarda çift yazma hatasını önlemek için 
        // her zaman tüm sonuç listesini (0'dan itibaren) baştan sona birleştiriyoruz.
        for (let i = 0; i < event.results.length; i++) {
            currentSessionTranscript += event.results[i][0].transcript;
        }

        // Textarea içeriğini güncelle: Başlangıç Metni + Yeni Konuşulanlar
        noteInput.innerHTML = preSpeechText + currentSessionTranscript;

        // Sesli Komut Kontrolü (Sonuç kesinleştiğinde bakıyoruz)
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
            const lastTranscript = lastResult[0].transcript.toLowerCase();
            if (handleVoiceCommand(lastTranscript)) {
                // Eğer bir komutsa, bu kısmı temizle
                const cmdCleaned = noteInput.innerHTML.replace(lastResult[0].transcript, '').trim();
                noteInput.innerHTML = cmdCleaned;
            }
        }

        // Son parça ara sonuç mu? (Durum çubuğunda göstermek için)
        if (lastResult && !lastResult.isFinal) {
            showStatus(`🎙️ ${lastResult[0].transcript}`);
        }

        updateCharCounter();
        autoResize(noteInput);
    };

    recognition.onerror = (e) => { 
        console.error('Ses tanıma hatası:', e.error);
        const t = TRANSLATIONS[userSettings.lang];
        if (e.error === 'not-allowed') showStatus(t.statusMicWarn, 'warn');
        else if (e.error === 'network') showStatus(t.statusNetWarn, 'warn');
        stopRecording(); 
    };
    
    recognition.onend = () => { 
        // Eğer kullanıcı kaydı kapatmadıysa fakat tarayıcı (zaman aşımı vb.) durdurduysa,
        // tekrar başlatarak "Sonsuz Dinleme" sağlıyoruz.
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                // Zaten çalışıyorsa hata verebilir, yoksayıyoruz
            }
        } else {
            stopRecording(); 
        }
    };
}

function stopRecording() {
    isRecording = false;
    [voiceBtn, mobileFab].forEach(b => b.classList.remove('recording'));
    if (visualizer) visualizer.classList.remove('active'); // Dalgaları gizle
}

function toggleRecording() {
    if (!recognition) {
        showStatus('⚠️ Ses tanıma desteklenmiyor.', 'warn');
        return;
    }
    if (isRecording) {
        recognition.stop();
        stopRecording();
    } else {
        recognition.start();
    }
}

// ────────────────────────────────────────
// Olay Dinleyiciler
// ────────────────────────────────────────
addNoteBtn.addEventListener('click', () => addNote(noteInput.innerHTML));
voiceBtn.addEventListener('click', toggleRecording);
mobileFab.addEventListener('click', toggleRecording);
searchInput.addEventListener('input', renderNotes);
sortSelect.addEventListener('change', renderNotes);
exportBtn.addEventListener('click', exportNotes);
noteInput.addEventListener('input', () => { updateCharCounter(); });

noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addNote(noteInput.innerHTML);
    }
});

// Modal Events
saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);
closeModalBtn.addEventListener('click', closeEditModal);
window.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

// PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-flex';
});

installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((res) => {
        if (res.outcome === 'accepted') installBtn.style.display = 'none';
        deferredPrompt = null;
    });
});

// Settings Events
settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
closeSettingsFull.addEventListener('click', () => { settingsModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; });

langSelect.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
    saveNotes();
});

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
        saveNotes();
    });
});

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showStatus(TRANSLATIONS[userSettings.lang].updateAvailable, 'ok');
                        setTimeout(() => { if(confirm(TRANSLATIONS[userSettings.lang].updateAvailable)) refreshApp(); }, 1000);
                    }
                });
            });
        }).catch(() => {});
    });
}

// Auth Events
toRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

toLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const uInput = document.getElementById('loginUser');
    const pInput = document.getElementById('loginPass');
    
    if (uInput && pInput) {
        console.log("Login attempt for:", uInput.value);
        login(uInput.value, pInput.value);
    } else {
        console.error("Login inputs missing from DOM!");
    }
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('regUser').value;
    const p = document.getElementById('regPass').value;
    register(u, p);
});

logoutBtn.addEventListener('click', logout);
updateAppBtn.addEventListener('click', refreshApp);

// Navigation Events
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderNotes();
    });
});

document.getElementById('clearTrashBtn').addEventListener('click', emptyTrash);

// Phase 2 Events
document.querySelectorAll('.btn-format').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.format) formatText(btn.dataset.format);
    });
});

document.getElementById('imgUploadBtn').addEventListener('click', () => {
    document.getElementById('imageInput').click();
});

document.getElementById('imageInput').addEventListener('change', handleImageSelect);
document.getElementById('aiSummarizeBtn').addEventListener('click', aiSummarize);
document.getElementById('lockAppBtn').addEventListener('click', () => {
    settingsModal.style.display = 'none';
    lockApp();
});
document.getElementById('unlockBtn').addEventListener('click', unlockApp);
document.getElementById('unlockPass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') unlockApp();
});

checkAuth();
initSpeechRecognition();

// Otomatik Kilit Kontrolü
if (currentUser && sessionStorage.getItem('vocalnotes_locked')) lockApp();

// Global Fonksiyonlar (inline onclick için)
window.deleteNote = deleteNote;
window.copyNote = copyNote;
window.togglePin = togglePin;
window.openEditModal = openEditModal;
window.archiveNote = archiveNote;
window.restoreNote = restoreNote;
window.permanentDelete = permanentDelete;
window.emptyTrash = emptyTrash;

window.discoverAllUserData = function() {
    console.log("Discovery started...");
    const hintDiv = document.getElementById('registeredUsersHint');
    const userSpan = document.getElementById('userListHint');
    const statusDiv = document.getElementById('authStatus');
    let allFound = [];

    if (statusDiv) {
        statusDiv.textContent = '🔍 Hafıza taranıyor...';
        statusDiv.style.color = '#00e5ff';
    }

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const raw = localStorage.getItem(key);
            console.log("Checking key:", key);
            try {
                const val = JSON.parse(raw);
                if (Array.isArray(val)) {
                    val.forEach(item => { if (item.name) allFound.push({ name: item.name, source: key }); });
                } else if (val && val.name) {
                    allFound.push({ name: val.name, source: key });
                }
            } catch(e) {
                // Ham metin kontrolü
                if (raw && (key.toLowerCase().includes('user') || key.toLowerCase().includes('vocal'))) {
                    allFound.push({ name: "Gizli Kayıt (" + key + ")", source: key });
                }
            }
        }
    } catch (globalErr) {
        console.error("Discovery error:", globalErr);
        if (statusDiv) statusDiv.textContent = '❌ Tarama hatası oluştu.';
    }

    if (allFound.length > 0) {
        const uniqueNames = [...new Set(allFound.map(f => f.name))];
        userSpan.textContent = uniqueNames.join(', ');
        hintDiv.style.display = 'block';
        if (statusDiv) statusDiv.textContent = '✅ ' + uniqueNames.length + ' hesap bulundu!';
    } else {
        if (statusDiv) statusDiv.textContent = '❌ Hiçbir eski kayıt bulunamadı.';
    }
}
