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

const closeModalBtn  = document.getElementById('closeModal');

// Settings Elements
const settingsBtn     = document.getElementById('settingsBtn');
const settingsModal   = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const closeSettingsFull = document.getElementById('closeSettingsBtn');
const langSelect      = document.getElementById('langSelect');
const themeButtons    = document.querySelectorAll('.theme-btn');
const visualizer      = document.getElementById('visualizer');

let notes = [];
let reminders = [];
let userSettings = {
    theme: 'dark',
    lang: 'tr'
};
let recognition = null;
let isRecording = false;
let currentEditId = null;
let preSpeechText = ''; // Kayıt başlamadan önceki mevcut metin

const COLORS = [
    'rgba(124,77,255,0.15)',
    'rgba(0,229,255,0.12)',
    'rgba(255,64,129,0.12)',
    'rgba(0,200,83,0.12)',
    'rgba(255,171,64,0.13)',
    'rgba(33,150,243,0.12)',
];

// ────────────────────────────────────────
// LocalStorage
// ────────────────────────────────────────
function saveNotes() {
    localStorage.setItem('vocalnotes_data_v2', JSON.stringify(notes));
    localStorage.setItem('vocalnotes_reminders', JSON.stringify(reminders));
    localStorage.setItem('vocalnotes_settings', JSON.stringify(userSettings));
}

function loadNotes() {
    try {
        const raw = localStorage.getItem('vocalnotes_data_v2');
        notes = raw ? JSON.parse(raw) : [];
        
        const rawReminders = localStorage.getItem('vocalnotes_reminders');
        reminders = rawReminders ? JSON.parse(rawReminders) : [];

        const rawSettings = localStorage.getItem('vocalnotes_settings');
        if (rawSettings) userSettings = JSON.parse(rawSettings);

        // Settings'i uygula
        applyTheme(userSettings.theme);
        applyLanguage(userSettings.lang);

        // Legacy support
        if (notes.length === 0) {
            const oldRaw = localStorage.getItem('vocalnotes_data');
            if (oldRaw) {
                notes = JSON.parse(oldRaw);
                saveNotes();
            }
        }
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

    let filtered = notes.filter(n => n.text.toLowerCase().includes(filter));

    // Sıralama Mantığı
    if (sortVal === 'newest') {
        filtered.sort((a, b) => b.id - a.id);
    } else if (sortVal === 'oldest') {
        filtered.sort((a, b) => a.id - b.id);
    } else if (sortVal === 'pinned') {
        filtered.sort((a, b) => {
            if (a.pinned === b.pinned) return b.id - a.id;
            return a.pinned ? -1 : 1;
        });
    }

    // Badge güncelleme
    if (notes.length > 0) {
        noteCount.textContent = notes.length;
        noteCount.classList.add('visible');
    } else {
        noteCount.classList.remove('visible');
    }

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        return;
    }
    emptyState.classList.remove('visible');

    filtered.forEach((note, idx) => {
        const card = document.createElement('div');
        card.className = `note-card glass ${note.pinned ? 'is-pinned' : ''}`;
        card.style.background = COLORS[note.colorIdx % COLORS.length];
        card.style.animationDelay = `${idx * 0.05}s`;
        card.setAttribute('data-id', note.id);

        const date = new Date(note.id);
        const dateStr = date.toLocaleDateString('tr-TR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        // Bu nota ait aktif hatırlatıcı var mı?
        const reminder = reminders.find(r => r.noteId === note.id && !r.triggered);
        const reminderHtml = reminder ? `
            <div class="note-reminder-badge" title="${new Date(reminder.time).toLocaleString('tr-TR')}">
                <i class="fa-solid fa-bell"></i> ${new Date(reminder.time).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
            </div>` : '';

        card.innerHTML = `
            ${note.pinned ? '<div class="note-pinned-badge"><i class="fa-solid fa-thumbtack"></i> Sabitlendi</div>' : ''}
            ${reminderHtml}
            <div class="note-content">${escapeHtml(note.text)}</div>
            <div class="note-footer">
                <span class="note-date">
                    <i class="fa-regular fa-clock"></i>${dateStr}
                </span>
                <div class="note-btn-group">
                    <button class="btn-icon btn-pin ${note.pinned ? 'pinned' : ''}" onclick="togglePin(${note.id})" title="Sabitle">
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                    <button class="btn-icon btn-edit" onclick="openEditModal(${note.id})" title="Düzenle">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon btn-copy" onclick="copyNote(${note.id})" title="Kopyala">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteNote(${note.id})" title="Sil">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
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
function addNote(text) {
    // Eğer o an kayıt yapılıyorsa, kaydı durdur
    if (isRecording) {
        stopRecording();
        if (recognition) recognition.stop();
        text = noteInput.value; // En güncel metni al (onresult zaten textarea'yı güncelledi)
    }

    text = text.trim();
    if (!text) {
        showStatus('⚠️ Lütfen bir not yazın.', 'warn');
        return;
    }

    const noteId = Date.now();
    const note = {
        id: noteId,
        text: text,
        pinned: false,
        colorIdx: notes.length,
    };

    notes.push(note);
    
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
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        card.style.transform = 'scale(0.8) opacity(0)';
        card.style.transition = '0.3s';
        setTimeout(() => {
            notes = notes.filter(n => n.id !== id);
            reminders = reminders.filter(r => r.noteId !== id);
            saveNotes();
            renderNotes();
        }, 300);
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
    const len = noteInput.value.length;
    charCounter.textContent = `${len} karakter`;
    charCounter.classList.remove('warn', 'danger');
    if (len > 200) charCounter.classList.add('warn');
    if (len > 400) charCounter.classList.add('danger');
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    
    // Konuşurken metin aşağı uzarsa otomatik olarak son kısma odaklan
    if (isRecording) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function showStatus(msg, type = 'ok') {
    statusMsg.textContent = msg;
    statusMsg.style.color = type === 'warn' ? 'var(--warn)' : 'var(--accent)';
    clearTimeout(statusMsg._timeout);
    statusMsg._timeout = setTimeout(() => { statusMsg.textContent = ''; }, 3000);
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
        sortPinned: "Sabitlenmiş"
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
        sortPinned: "Pinned"
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
    document.getElementById('lblTheme').textContent = t.themeName;
    document.getElementById('lblLanguage').textContent = t.langName;
    document.getElementById('lblLangDesc').textContent = t.langDesc;
    document.getElementById('lblDone').textContent = t.done;

    // Sort options
    sortSelect.options[0].textContent = t.sortNew;
    sortSelect.options[1].textContent = t.sortOld;
    sortSelect.options[2].textContent = t.sortPinned;

    langSelect.value = lang;
    
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
        
        preSpeechText = noteInput.value;
        if (preSpeechText && !preSpeechText.endsWith(' ')) {
            preSpeechText += ' ';
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
        noteInput.value = preSpeechText + currentSessionTranscript;

        // Son parça ara sonuç mu? (Durum çubuğunda göstermek için)
        const lastResult = event.results[event.results.length - 1];
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
addNoteBtn.addEventListener('click', () => addNote(noteInput.value));
voiceBtn.addEventListener('click', toggleRecording);
mobileFab.addEventListener('click', toggleRecording);
searchInput.addEventListener('input', renderNotes);
sortSelect.addEventListener('change', renderNotes);
exportBtn.addEventListener('click', exportNotes);
noteInput.addEventListener('input', () => { updateCharCounter(); autoResize(noteInput); });

noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addNote(noteInput.value);
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
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// ────────────────────────────────────────
// Başlat
// ────────────────────────────────────────
loadNotes();
renderNotes();
initSpeechRecognition();

// Global Fonksiyonlar (inline onclick için)
window.deleteNote = deleteNote;
window.copyNote = copyNote;
window.togglePin = togglePin;
window.openEditModal = openEditModal;
