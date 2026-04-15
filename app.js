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

let notes = [];
let recognition = null;
let isRecording = false;

// ── Renk paleti ──────────────────────────
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
    localStorage.setItem('vocalnotes_data', JSON.stringify(notes));
}

function loadNotes() {
    try {
        const raw = localStorage.getItem('vocalnotes_data');
        notes = raw ? JSON.parse(raw) : [];
    } catch {
        notes = [];
    }
}

// ────────────────────────────────────────
// Render
// ────────────────────────────────────────
function renderNotes(filter = '') {
    notesContainer.innerHTML = '';

    const filtered = notes.filter(n =>
        n.text.toLowerCase().includes(filter.toLowerCase())
    );

    // Not sayısı etiketi
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

    // En yeni en üste
    [...filtered].reverse().forEach((note, idx) => {
        const card = document.createElement('div');
        card.className = 'note-card glass';
        card.style.background = COLORS[note.colorIdx % COLORS.length];
        card.style.animationDelay = `${idx * 0.04}s`;
        card.setAttribute('data-id', note.id);

        const date   = new Date(note.createdAt);
        const dateStr = date.toLocaleDateString('tr-TR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
            <div class="note-content">${escapeHtml(note.text)}</div>
            <div class="note-footer">
                <span class="note-date">
                    <i class="fa-regular fa-clock"></i>${dateStr}
                </span>
                <div class="note-btn-group">
                    <button class="btn-icon btn-copy" title="Kopyala" aria-label="Kopyala" onclick="copyNote(${note.id})">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Sil" aria-label="Sil" onclick="deleteNote(${note.id})">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;

        notesContainer.appendChild(card);
    });
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ────────────────────────────────────────
// Not Ekle
// ────────────────────────────────────────
function addNote(text) {
    text = text.trim();
    if (!text) {
        showStatus('⚠️ Lütfen bir şeyler yazın veya söyleyin.', 'warn');
        return;
    }

    const note = {
        id: Date.now(),
        text,
        createdAt: new Date().toISOString(),
        colorIdx: notes.length,
    };

    notes.push(note);
    saveNotes();
    renderNotes(searchInput.value);

    noteInput.value = '';
    noteInput.style.height = 'auto';
    showStatus('✅ Not eklendi!', 'ok');

    // Sayfayı nota doğru kaydır (mobil için)
    notesContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ────────────────────────────────────────
// Not Sil
// ────────────────────────────────────────
function deleteNote(id) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.transform  = 'scale(0.85)';
        card.style.opacity    = '0';
        setTimeout(() => {
            notes = notes.filter(n => n.id !== id);
            saveNotes();
            renderNotes(searchInput.value);
        }, 280);
    }
}

// ────────────────────────────────────────
// Panoya Kopyala
// ────────────────────────────────────────
function copyNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    navigator.clipboard.writeText(note.text)
        .then(() => showStatus('📋 Panoya kopyalandı!', 'ok'))
        .catch(() => showStatus('⚠️ Kopyalanamadı.', 'warn'));
}

// ────────────────────────────────────────
// Durum Mesajı
// ────────────────────────────────────────
function showStatus(msg, type = 'ok') {
    statusMsg.textContent = msg;
    statusMsg.style.color = type === 'warn' ? '#ffc107' : 'var(--accent)';
    clearTimeout(statusMsg._timeout);
    statusMsg._timeout = setTimeout(() => {
        statusMsg.textContent = '';
    }, 2800);
}

// ────────────────────────────────────────
// Ses Tanıma (Web Speech API)
// ────────────────────────────────────────
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        [voiceBtn, mobileFab].forEach(btn => {
            btn.style.opacity = '0.4';
            btn.style.cursor  = 'not-allowed';
            btn.title = 'Tarayıcınız ses tanımayı desteklemiyor';
        });
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang            = 'tr-TR';
    recognition.interimResults  = true;
    recognition.continuous      = false;

    recognition.onstart = () => {
        isRecording = true;
        [voiceBtn, mobileFab].forEach(b => b.classList.add('recording'));
        showStatus('🎙️ Dinleniyor... Konuşun.');
    };

    recognition.onresult = (event) => {
        let interimText = '';
        let finalText   = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalText += t;
            } else {
                interimText += t;
            }
        }

        if (finalText) {
            const separator = noteInput.value ? ' ' : '';
            noteInput.value += separator + finalText.trim();
            autoResize();
            showStatus('✍️ Metin alındı. Ekle butonuna basın.', 'ok');
        } else if (interimText) {
            showStatus(`🎙️ ${interimText}`, 'ok');
        }
    };

    recognition.onerror = (e) => {
        const msgs = {
            'no-speech'     : '⚠️ Ses algılanamadı, tekrar deneyin.',
            'not-allowed'   : '🚫 Mikrofon izni reddedildi.',
            'audio-capture' : '🎤 Mikrofon bulunamadı.',
            'network'       : '🌐 Ağ hatası. İnternet bağlantınızı kontrol edin.',
        };
        showStatus(msgs[e.error] || `⚠️ Hata: ${e.error}`, 'warn');
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
}

function startRecording() {
    if (!recognition) return;
    try { recognition.start(); } catch { /* zaten başlamışsa sessizce geç */ }
}

function stopRecording() {
    isRecording = false;
    [voiceBtn, mobileFab].forEach(b => b.classList.remove('recording'));
}

function toggleRecording() {
    if (!recognition) {
        showStatus('⚠️ Ses tanıma kullanılamıyor. Chrome veya Edge kullanın.', 'warn');
        return;
    }
    if (isRecording) {
        recognition.stop();
    } else {
        startRecording();
    }
}

// ────────────────────────────────────────
// Textarea otomatik boyutlanma
// ────────────────────────────────────────
function autoResize() {
    noteInput.style.height = 'auto';
    noteInput.style.height = noteInput.scrollHeight + 'px';
}

// ────────────────────────────────────────
// Event Listeners
// ────────────────────────────────────────
addNoteBtn.addEventListener('click', () => addNote(noteInput.value));

voiceBtn.addEventListener('click', toggleRecording);

// Mobil FAB – yalnızca ses kaydı başlatır/durdurur
mobileFab.addEventListener('click', toggleRecording);

noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addNote(noteInput.value);
    }
});

noteInput.addEventListener('input', autoResize);

searchInput.addEventListener('input', () => {
    renderNotes(searchInput.value);
});

// ────────────────────────────────────────
// Global (onclick'ler için)
// ────────────────────────────────────────
window.deleteNote = deleteNote;
window.copyNote   = copyNote;

// ────────────────────────────────────────
// Başlat
// ────────────────────────────────────────
loadNotes();
renderNotes();
initSpeechRecognition();

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Error', err));
    });
}

