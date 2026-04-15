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

// Modal Elements
const editModal      = document.getElementById('editModal');
const editInput      = document.getElementById('editInput');
const saveEditBtn    = document.getElementById('saveEdit');
const cancelEditBtn  = document.getElementById('cancelEdit');
const closeModalBtn  = document.getElementById('closeModal');

let notes = [];
let recognition = null;
let isRecording = false;
let currentEditId = null;

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
}

function loadNotes() {
    try {
        const raw = localStorage.getItem('vocalnotes_data_v2');
        notes = raw ? JSON.parse(raw) : [];
        // Legacy support (v1 to v2 transition)
        if (notes.length === 0) {
            const oldRaw = localStorage.getItem('vocalnotes_data');
            if (oldRaw) {
                notes = JSON.parse(oldRaw);
                saveNotes();
            }
        }
    } catch {
        notes = [];
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

        card.innerHTML = `
            ${note.pinned ? '<div class="note-pinned-badge"><i class="fa-solid fa-thumbtack"></i> Sabitlendi</div>' : ''}
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
    text = text.trim();
    if (!text) {
        showStatus('⚠️ Lütfen bir not yazın.', 'warn');
        return;
    }

    const note = {
        id: Date.now(),
        text: text,
        pinned: false,
        colorIdx: notes.length,
    };

    notes.push(note);
    saveNotes();
    renderNotes();
    
    noteInput.value = '';
    updateCharCounter();
    autoResize(noteInput);
    showStatus('✅ Not başarıyla eklendi!', 'ok');
}

function deleteNote(id) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        card.style.transform = 'scale(0.8) opacity(0)';
        card.style.transition = '0.3s';
        setTimeout(() => {
            notes = notes.filter(n => n.id !== id);
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
}

function showStatus(msg, type = 'ok') {
    statusMsg.textContent = msg;
    statusMsg.style.color = type === 'warn' ? '#ffc107' : 'var(--accent)';
    clearTimeout(statusMsg._timeout);
    statusMsg._timeout = setTimeout(() => { statusMsg.textContent = ''; }, 3000);
}

// ────────────────────────────────────────
// Ses Tanıma
// ────────────────────────────────────────
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
        isRecording = true;
        [voiceBtn, mobileFab].forEach(b => b.classList.add('recording'));
        showStatus('🎙️ Dinleniyor...');
    };

    recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
            else interimText += event.results[i][0].transcript;
        }

        if (finalText) {
            noteInput.value += (noteInput.value ? ' ' : '') + finalText.trim();
            updateCharCounter();
            autoResize(noteInput);
        } else if (interimText) {
            showStatus(`🎙️ ${interimText}`);
        }
    };

    recognition.onerror = () => { stopRecording(); };
    recognition.onend = () => { stopRecording(); };
}

function stopRecording() {
    isRecording = false;
    [voiceBtn, mobileFab].forEach(b => b.classList.remove('recording'));
}

function toggleRecording() {
    if (!recognition) {
        showStatus('⚠️ Ses tanıma desteklenmiyor.', 'warn');
        return;
    }
    if (isRecording) recognition.stop();
    else recognition.start();
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
