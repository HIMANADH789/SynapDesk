(() => {
  (function() {
    let s = document.currentScript;
    if (!s) return;

    let clientId = s.getAttribute("data-client-id") || "default",
        themeColor = s.getAttribute("data-theme-color") || "#1E40AF",
        apiUrl = s.getAttribute("data-api-url") || (s.src ? s.src.replace(/\/widget\/.*/, "") : ""),
        token = s.getAttribute("data-token") || "";

    let g = document.createElement("div");
    g.id = "ai-frontdesk-widget";
    document.body.appendChild(g);
    let p = g.attachShadow({ mode: "closed" });

    let v = document.createElement("style");
    v.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Launcher button ── */
    .launcher {
      position: fixed; bottom: 28px; right: 28px; z-index: 99999;
      display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
    }

    .nudge {
      background: #fff;
      color: #1e293b;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.13);
      white-space: nowrap;
      animation: nudge-in 0.4s cubic-bezier(.34,1.56,.64,1) both, nudge-out 0.3s ease 4s forwards;
      pointer-events: none;
      position: relative;
    }
    .nudge::after {
      content: '';
      position: absolute;
      bottom: -6px; right: 18px;
      border: 6px solid transparent;
      border-top-color: #fff;
      border-bottom: 0;
    }
    @keyframes nudge-in {
      from { opacity: 0; transform: translateY(10px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes nudge-out {
      to { opacity: 0; transform: translateY(6px); pointer-events: none; }
    }

    .widget-btn {
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, ${themeColor}, ${themeColor}cc);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 24px ${themeColor}55, 0 2px 8px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
      position: relative;
    }
    .widget-btn:hover {
      transform: scale(1.12);
      box-shadow: 0 8px 32px ${themeColor}77, 0 2px 8px rgba(0,0,0,0.18);
    }
    .widget-btn svg { transition: transform 0.3s, opacity 0.2s; }
    .widget-btn.open svg.icon-chat { opacity: 0; transform: rotate(90deg) scale(0.5); position: absolute; }
    .widget-btn.open svg.icon-close { opacity: 1; transform: rotate(0deg); }
    .widget-btn:not(.open) svg.icon-close { opacity: 0; transform: rotate(-90deg) scale(0.5); position: absolute; }
    .widget-btn:not(.open) svg.icon-chat { opacity: 1; transform: rotate(0deg); }

    .pulse-ring {
      position: absolute; inset: -4px;
      border-radius: 50%;
      border: 2px solid ${themeColor}88;
      animation: pulse 2.5s ease-out infinite;
    }
    @keyframes pulse {
      0%   { transform: scale(1); opacity: 0.7; }
      70%  { transform: scale(1.35); opacity: 0; }
      100% { transform: scale(1.35); opacity: 0; }
    }

    /* ── Chat panel ── */
    .chat-panel {
      position: fixed; bottom: 104px; right: 28px;
      width: 380px; height: 560px;
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 99998;
      opacity: 0; pointer-events: none;
      transform: translateY(16px) scale(0.97);
      transform-origin: bottom right;
      transition: opacity 0.25s ease, transform 0.3s cubic-bezier(.34,1.56,.64,1);
    }
    .chat-panel.open {
      opacity: 1; pointer-events: all;
      transform: translateY(0) scale(1);
    }

    /* ── Header ── */
    .chat-header {
      padding: 18px 20px;
      background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%);
      color: #fff;
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    .header-avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden; padding: 4px;
    }
    .header-avatar img { width: 100%; height: 100%; object-fit: contain; }
    .header-info { flex: 1; }
    .header-info h3 {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    }
    .header-status {
      display: flex; align-items: center; gap: 5px; margin-top: 2px;
    }
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2px rgba(74,222,128,0.3);
      animation: blink 2s ease-in-out infinite;
    }
    @keyframes blink {
      0%,100% { opacity: 1; } 50% { opacity: 0.5; }
    }
    .header-status span {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 11px; opacity: 0.85;
    }
    .close-btn {
      background: rgba(255,255,255,0.15); border: none; color: #fff;
      width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .close-btn:hover { background: rgba(255,255,255,0.28); }

    /* ── Messages ── */
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 18px 16px;
      display: flex; flex-direction: column; gap: 10px;
      background: #f8fafc;
      scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;
    }
    .chat-messages::-webkit-scrollbar { width: 4px; }
    .chat-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

    .msg-row { display: flex; align-items: flex-end; gap: 8px; width: 100%; }
    .msg-row.user { flex-direction: row-reverse; }
    
    .msg-wrap { max-width: 75%; display: flex; flex-direction: column; }
    .msg-row.user .msg-wrap { align-items: flex-end; }
    .msg-row.bot .msg-wrap { align-items: flex-start; }

    .bot-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: #fff;
      border: 1.5px solid #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden; padding: 3px;
    }
    .bot-avatar img { width: 100%; height: 100%; object-fit: contain; }

    .msg {
      padding: 10px 14px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13.5px; line-height: 1.55;
      word-break: break-word; white-space: pre-wrap;
      animation: msg-in 0.25s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes msg-in {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: none; }
    }
    .msg.bot {
      background: #fff;
      color: #1e293b;
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .msg.user {
      background: linear-gradient(135deg, ${themeColor}, ${themeColor}ee);
      color: #fff;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 2px 8px ${themeColor}44;
    }

    .cursor { display: inline-block; width: 2px; height: 14px; background: currentColor; margin-left: 2px; vertical-align: middle; animation: blink-cursor 0.8s step-end infinite; }
    @keyframes blink-cursor { 0%,100% { opacity:1; } 50% { opacity:0; } }

    /* ── Timestamp ── */
    .msg-time {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px; color: #94a3b8; margin-top: 2px;
      padding: 0 4px;
    }

    /* ── Typing indicator ── */
    .typing-row { display: flex; align-items: flex-end; gap: 8px; }
    .typing-bubble {
      background: #fff;
      border-radius: 18px 18px 18px 4px;
      padding: 12px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      display: flex; gap: 4px; align-items: center;
    }
    .typing-bubble span {
      width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;
      animation: bounce 1.4s infinite both;
    }
    .typing-bubble span:nth-child(2) { animation-delay: 0.18s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }

    /* ── Input area ── */
    .chat-footer {
      padding: 12px 14px;
      background: #fff;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .input-wrap {
      display: flex; align-items: center; gap: 8px;
      background: #f1f5f9; border-radius: 14px; padding: 6px 6px 6px 14px;
      border: 1.5px solid transparent;
      transition: border-color 0.2s, background 0.2s;
    }
    .input-wrap:focus-within {
      background: #fff;
      border-color: ${themeColor}55;
      box-shadow: 0 0 0 3px ${themeColor}18;
    }
    .chat-input {
      flex: 1; border: none; background: transparent; outline: none;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13.5px; color: #1e293b; padding: 4px 0;
    }
    .chat-input::placeholder { color: #94a3b8; }
    .send-btn {
      width: 34px; height: 34px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, ${themeColor}, ${themeColor}cc);
      color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
      flex-shrink: 0;
    }
    .send-btn:hover { transform: scale(1.08); }
    .send-btn:disabled { opacity: 0.4; transform: none; cursor: not-allowed; }

    .footer-note {
      text-align: center; margin-top: 8px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px; color: #cbd5e1;
    }
    
    /* ── Swinging Menu Options ── */
    .menu-bubbles {
      position: fixed; bottom: 104px; right: 28px;
      display: flex; flex-direction: column; gap: 10px; align-items: flex-end;
      z-index: 99999;
      transition: opacity 0.2s;
    }
    .menu-bubbles.hidden { display: none; }
    .menu-bubble {
      background: #fff; color: #1e293b; border: 1.5px solid #e2e8f0;
      padding: 10px 18px; border-radius: 20px; font-size: 13.5px; font-weight: 500;
      font-family: 'Inter', system-ui, sans-serif;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transform-origin: right center;
      animation: swing 3s infinite ease-in-out;
      transition: background 0.2s, border-color 0.2s;
    }
    .menu-bubble:hover { background: #f8fafc; border-color: ${themeColor}55; animation-play-state: paused; }
    @keyframes swing {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-3deg) translateY(-2px); }
    }
    
    /* ── Quick Replies ── */
    .quick-replies {
      display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;
    }
    .quick-reply-btn {
      background: #fff; color: ${themeColor}; border: 1px solid ${themeColor}44;
      padding: 8px 14px; border-radius: 16px; font-size: 12.5px; font-weight: 500;
      font-family: 'Inter', system-ui, sans-serif;
      cursor: pointer; transition: background 0.2s, border-color 0.2s;
    }
    .quick-reply-btn:hover { background: ${themeColor}11; border-color: ${themeColor}; }

    @media (max-width: 480px) {
      .chat-panel { width: calc(100vw - 24px); right: 12px; bottom: 96px; height: 72vh; border-radius: 16px; }
      .launcher { right: 16px; bottom: 16px; }
      .menu-bubbles { right: 16px; bottom: 96px; }
    }
    `;
    p.appendChild(v);

    let isOpen = false, sessionId, loading = false;

    // ── Launcher ──
    const launcher = document.createElement("div");
    launcher.className = "launcher";

    const nudge = document.createElement("div");
    nudge.className = "nudge";
    nudge.textContent = "👋 Need help? Ask me anything!";
    launcher.appendChild(nudge);

    const btn = document.createElement("button");
    btn.className = "widget-btn";
    btn.setAttribute("aria-label", "Open chat");
    btn.innerHTML = `
      <div class="pulse-ring"></div>
      <svg class="icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;

    let menuContainer = null;

    btn.onclick = () => {
      isOpen = !isOpen;
      panel.classList.toggle("open", isOpen);
      btn.classList.toggle("open", isOpen);
      nudge.style.display = "none";
      if (menuContainer) menuContainer.classList.toggle("hidden", isOpen);
      if (isOpen) inputEl.focus();
    };

    launcher.appendChild(btn);
    p.appendChild(launcher);

    // ── Chat panel ──
    const panel = document.createElement("div");
    panel.className = "chat-panel";
    panel.innerHTML = `
      <div class="chat-header">
        <div class="header-avatar">
          <img src="${apiUrl}/widget/logo.png" alt="logo" onerror="this.style.display='none'" />
        </div>
        <div class="header-info">
          <h3>AI Assistant</h3>
          <div class="header-status">
            <div class="status-dot"></div>
            <span>Online · Always here to help</span>
          </div>
        </div>
        <button class="close-btn" aria-label="Close chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-footer">
        <div class="input-wrap">
          <input class="chat-input" type="text" placeholder="Type your question..." autocomplete="off" />
          <button class="send-btn" type="button" aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div class="footer-note">Powered by AI Front Desk</div>
      </div>
    `;
    p.appendChild(panel);

    const messagesEl = panel.querySelector(".chat-messages");
    const inputEl = panel.querySelector(".chat-input");
    const sendBtn = panel.querySelector(".send-btn");
    const closeBtn = panel.querySelector(".close-btn");

    closeBtn.onclick = () => {
      isOpen = false;
      panel.classList.remove("open");
      btn.classList.remove("open");
      if (menuContainer) menuContainer.classList.remove("hidden");
    };

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(inputEl.value); }
    });
    sendBtn.onclick = () => sendMessage(inputEl.value);

    function getTime() {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function addMessage(role, text) {
      const row = document.createElement("div");
      row.className = \`msg-row \${role}\`;

      if (role === "bot") {
        const avatar = document.createElement("div");
        avatar.className = "bot-avatar";
        avatar.innerHTML = \`<img src="\${apiUrl}/widget/logo.png" alt="logo" onerror="this.style.display='none'" />\`;
        row.appendChild(avatar);
      }

      const wrap = document.createElement("div");
      wrap.className = "msg-wrap";

      const bubble = document.createElement("div");
      bubble.className = \`msg \${role}\`;
      bubble.textContent = text;
      wrap.appendChild(bubble);

      const time = document.createElement("div");
      time.className = "msg-time";
      time.textContent = getTime();
      wrap.appendChild(time);

      row.appendChild(wrap);
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      
      return wrap; 
    }

    function showTyping() {
      const row = document.createElement("div");
      row.className = "typing-row";
      row.id = "typing-indicator";

      const avatar = document.createElement("div");
      avatar.className = "bot-avatar";
      avatar.textContent = "🤖";
      row.appendChild(avatar);

      const bubble = document.createElement("div");
      bubble.className = "typing-bubble";
      bubble.innerHTML = "<span></span><span></span><span></span>";
      row.appendChild(bubble);

      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
      const el = p.getElementById("typing-indicator");
      if (el) el.remove();
    }

    async function streamMessage(text) {
      showTyping();
      let botWrap = null;
      let botBubble = null;
      let cursor = null;

      try {
        let c = await fetch(\`\${apiUrl}/api/chat/\${clientId}/stream\`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Widget-Token": token } : {}) },
          body: JSON.stringify({ message: text, session_id: sessionId })
        });

        if (!c.ok || !c.body) throw new Error(\`Stream failed: \${c.status}\`);

        let m = c.body.getReader(), B = new TextDecoder(), x = "";
        while (true) {
          let { done, value } = await m.read();
          if (done) break;
          x += B.decode(value, { stream: true });
          let H = x.split("\\n\\n");
          x = H.pop() ?? "";
          for (let A of H) {
            let L = A.trim();
            if (L.startsWith("data: ")) {
              try {
                let h = JSON.parse(L.slice(6));
                if (h.type === "token") {
                  if (!botWrap) {
                    hideTyping();
                    
                    const row = document.createElement("div");
                    row.className = "msg-row bot";

                    const avatar = document.createElement("div");
                    avatar.className = "bot-avatar";
                    avatar.innerHTML = \`<img src="\${apiUrl}/widget/logo.png" alt="logo" onerror="this.style.display='none'" />\`;
                    row.appendChild(avatar);

                    botWrap = document.createElement("div");
                    botWrap.className = "msg-wrap";

                    botBubble = document.createElement("div");
                    botBubble.className = "msg bot";
                    botWrap.appendChild(botBubble);

                    const time = document.createElement("div");
                    time.className = "msg-time";
                    time.textContent = getTime();
                    botWrap.appendChild(time);

                    row.appendChild(botWrap);
                    messagesEl.appendChild(row);
                    
                    cursor = document.createElement("span");
                    cursor.className = "cursor";
                    botBubble.appendChild(cursor);
                  }
                  if (h.text) {
                    botBubble.insertBefore(document.createTextNode(h.text), cursor);
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                  }
                } else if (h.type === "done") {
                  if (h.session_id) sessionId = h.session_id;
                  if (cursor) cursor.remove();
                } else if (h.type === "error") {
                  hideTyping(); if (cursor) cursor.remove();
                  addMessage("bot", h.content || "Error generating response.");
                }
              } catch (err) {}
            }
          }
        }
        if (cursor) cursor.remove();
      } catch (err) {
        hideTyping();
        addMessage("bot", "Sorry, something went wrong. Please try again.");
      }
    }

    async function sendMessage(text) {
      text = text.trim();
      if (!text || loading) return;
      inputEl.value = "";
      addMessage("user", text);
      loading = true;
      sendBtn.disabled = true;
      
      await streamMessage(text);
      
      loading = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }

    function renderMenuOptions(menuOptions) {
      if (!menuOptions || menuOptions.length === 0) return;
      menuContainer = document.createElement("div");
      menuContainer.className = "menu-bubbles";
      menuOptions.forEach((menu, idx) => {
        let menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "menu-bubble";
        menuBtn.textContent = menu.label;
        menuBtn.style.animationDelay = (idx * 0.2) + "s";
        menuBtn.onclick = () => {
          if (!isOpen) btn.click();
          if (menu.sub_questions && menu.sub_questions.length > 0) {
            let wrap = addMessage("bot", "Common questions about " + menu.label + ":");
            let qr = document.createElement("div");
            qr.className = "quick-replies";
            menu.sub_questions.forEach(q => {
              if (!q.trim()) return;
              let qb = document.createElement("button");
              qb.type = "button";
              qb.className = "quick-reply-btn";
              qb.textContent = q;
              qb.onclick = () => sendMessage(q);
              qr.appendChild(qb);
            });
            wrap.insertBefore(qr, wrap.lastChild); // Append right after message bubble, before time
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        menuContainer.appendChild(menuBtn);
      });
      p.appendChild(menuContainer);
    }

    // Load welcome message & settings
    fetch(\`\${apiUrl}/api/clients/\${clientId}\`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        const welcome = data?.settings?.welcome_message || "Hello! How can I help you today?";
        addMessage("bot", welcome);
        
        if (data?.settings?.chatbot_title) {
          let titleEl = panel.querySelector("h3");
          if (titleEl) titleEl.textContent = data.settings.chatbot_title;
        }
        if (data?.settings?.menu_options) {
          renderMenuOptions(data.settings.menu_options);
        }
      })
      .catch(() => {
        addMessage("bot", "Hello! How can I help you today?");
      });
  })();
})();
