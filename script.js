/* ============================================================
   Manis Bakery — Landing Page Interactions
   - Navbar scroll & mobile toggle
   - Scroll reveal animations
   - Quick-order toast
   - Langflow-powered AI chat assistant
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();
    initScrollReveal();
    initOrderButtons();
    initChat();
});

/* ---------- NAVBAR ---------- */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- MOBILE MENU ---------- */
function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        toggle.classList.remove('active');
        links.classList.remove('open');
    }));
}

/* ---------- SCROLL REVEAL ---------- */
function initScrollReveal() {
    const targets = document.querySelectorAll(
        '.menu-card, .feature-card, .about-visual, .about-copy, .section-head'
    );
    targets.forEach(el => el.classList.add('reveal'));

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    targets.forEach(el => io.observe(el));
}

/* ---------- ORDER BUTTONS ---------- */
function initOrderButtons() {
    document.querySelectorAll('[data-product]').forEach(btn => {
        btn.addEventListener('click', () => {
            const product = btn.dataset.product;
            showToast(`"${product}" ditambahkan! Buka chat untuk lanjut pesan 🧁`);
            // Buka chat & prefill pertanyaan ke asisten
            openChat();
            setTimeout(() => {
                const input = document.getElementById('chatInput');
                if (input) {
                    input.value = `Saya mau pesan ${product}, boleh info detail?`;
                    input.focus();
                }
            }, 400);
        });
    });
}

/* ---------- TOAST ---------- */
let toastTimer;
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ============================================================
   CHAT ASSISTANT — Langflow API
   ============================================================ */
let chatSessionId = null;

function initChat() {
    const fab = document.getElementById('chatFab');
    const panel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('chatClose');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const quick = document.getElementById('chatQuick');

    if (!fab || !panel) return;

    // Welcome message from config
    const messages = document.getElementById('chatMessages');
    const welcome = messages.querySelector('.msg-bot .msg-bubble');
    if (welcome && typeof LANGFLOW_CONFIG !== 'undefined' && LANGFLOW_CONFIG.welcomeMessage) {
        welcome.textContent = LANGFLOW_CONFIG.welcomeMessage;
    }

    fab.addEventListener('click', openChat);
    closeBtn.addEventListener('click', closeChat);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        sendUserMessage(text);
        input.value = '';
    });

    quick.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-chip')) {
            sendUserMessage(e.target.textContent);
        }
    });

    // Tutup panel dengan ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) closeChat();
    });
}

function openChat() {
    const panel = document.getElementById('chatPanel');
    const fab = document.getElementById('chatFab');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fab.classList.add('hidden');
    setTimeout(() => document.getElementById('chatInput')?.focus(), 320);
}

function closeChat() {
    const panel = document.getElementById('chatPanel');
    const fab = document.getElementById('chatFab');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fab.classList.remove('hidden');
}

function sendUserMessage(text) {
    appendMessage(text, 'user');
    callLangflow(text);
}

function appendMessage(text, role) {
    const messages = document.getElementById('chatMessages');
    const wrap = document.createElement('div');
    wrap.className = `msg msg-${role}`;
    wrap.innerHTML = `
        <div class="msg-avatar">${role === 'bot' ? '🧁' : ''}</div>
        <div class="msg-bubble">${escapeHtml(text)}</div>
    `;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
    const messages = document.getElementById('chatMessages');
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    wrap.id = 'typingIndicator';
    wrap.innerHTML = `
        <div class="msg-avatar">🧁</div>
        <div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>
    `;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
    document.getElementById('typingIndicator')?.remove();
}

/* ---------- Langflow API call ---------- */
async function callLangflow(userText) {
    showTyping();

    // Buat session_id sekali per percakapan (pertahankan konteks)
    if (!chatSessionId) chatSessionId = crypto.randomUUID();

    const payload = {
        output_type: 'chat',
        input_type: 'chat',
        input_value: userText,
        session_id: chatSessionId
    };

    try {
        const res = await fetch(LANGFLOW_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': LANGFLOW_CONFIG.apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        }

        const data = await res.json();
        const reply = extractReply(data);
        hideTyping();
        appendMessage(reply, 'bot');
    } catch (err) {
        hideTyping();
        console.error('Langflow error:', err);
        appendMessage(
            'Maaf, saya sedang tidak bisa terhubung ke server asisten 😔 Pastikan layanan Langflow aktif di localhost:7860, lalu coba lagi ya.',
            'bot'
        );
    }
}

/* ---------- Ekstrak balasan chat dari berbagai format respons Langflow ---------- */
function extractReply(data) {
    // Struktur umum Langflow: outputs[0].outputs[0].messages[0].message / .text
    try {
        const outputs = data?.outputs;
        if (Array.isArray(outputs)) {
            for (const out of outputs) {
                const inner = out?.outputs;
                if (Array.isArray(inner)) {
                    for (const item of inner) {
                        const msgs = item?.messages;
                        if (Array.isArray(msgs) && msgs.length) {
                            const last = msgs[msgs.length - 1];
                            const text = last?.message ?? last?.text ?? last?.content;
                            if (text) return String(text);
                        }
                        if (item?.results?.message) return String(item.results.message);
                        if (typeof item?.message === 'string') return item.message;
                    }
                }
            }
        }
        // Fallback langsung
        if (typeof data?.message === 'string') return data.message;
        if (typeof data?.result === 'string') return data.result;
    } catch (_) { /* ignore parse errors */ }
    return 'Maaf, saya tidak menangkap balasan tersebut. Bisa diulang? 🍰';
}

/* ---------- Util: escape HTML agar aman dari injection ---------- */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
