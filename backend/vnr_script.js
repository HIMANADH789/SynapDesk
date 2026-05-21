(() => {
  (function() {
    let s = document.currentScript;
    if (!s) return;

    let clientId = s.getAttribute("data-client-id") || "default",
        themeColor = s.getAttribute("data-theme-color") || "#1E40AF",
        apiUrl = s.getAttribute("data-api-url") || (s.src ? new URL(s.src).origin : ""),
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
      
      if (isOpen) inputEl.focus();
    };

    launcher.appendChild(btn);
    p.appendChild(launcher);

    // ── Chat panel ──
    const panel = document.createElement("div");
    panel.className = "chat-panel";
    panel.innerHTML = `
      <div class="chat-header">
        <div class="header-avatar" style="background: white; border-radius: 50%; padding: 2px;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAABICAYAAABCzyOOAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAABSmSURBVHhe7Zt5cBTXncc/r7tnRiOBEJJAAnFZBoS5bMeO47KdyoKdbOykNphUbMfJJmVXNsmu10U2bKVsSFIJdrzrI8HJZu1dE+LgYMfE6+Cwu1CEgE8BNiAOHUgYcQp0n6M5err7/faPHgbNICEhXLVVjj9VqlK/q19/+73f+73f61EiInwERnbCXyofCZHiIyFSjF4IEXR/M27rXtAO4sZxz+5Ex9oA0D1H8bqPIOIhdg9e237QLuLaeO0H0f1nAUH3HsdtP4h4SXBjeG37EacfRON11qIjp/32+s/gtlb593KiuM270fFOv43uBnRvIyI6q5MjZ9RCiHg4p3eQOPgf6L6T6N5G7Oo1uKffAIT4oTUkj/wXKvXg8YPPovvPoKNnseteIHn0D4jnYte/hF33W3SsFbernsSh/8DrPgo6iV37G+z3XwXt4Jz8E/ahZ9GxdryOGuzq53DP7kS0R/zAM9hH/gs8O7ubI0dGiBdtEx1pykzrPyPJY5tFtCfiJsRu+L3o/iYRrcXtbBC3tUpEe+LGOiR56nURrUU7cUmeel28vpMiosXpqJPkqe0i2hVxE5I88SfRiW6/Xst74vWdEhERt/uo2Ce2ptqISaLh96KjLSIi4rQeEKftoIjW6b5pJy5u36mMtIuhZETLp2DXv4xEm8m57p8AlZlrd+O2H0L3HgPRGDnjMcZfhTl+JhgBJN6B27oPFS7GmngtKAOJteG2H8TrbwKtMXKKMCcswBx3hZ8fb8dt248xdhpm4Rx/CkSacNsPIbFWQFC5kzAnXI05tiyjPwDu2V24rXsJzb8PFRiTnX0BIxJCPBuvowacKGbpx1FWOJ2nE93YB/4dr+8EaCeVqlChfAJTPkXwyr8hUfci7pk3wQyRe/0/o12bZN06dLwDxEu3pULjCZbfQWDarcR2P4ruO4ERGkf4k4/706HhZSTeAedsgTJQ4WJCs+/CKv14uh3RLl53AxLvxCr52IiEGNZGiJvAPvgsiQP/RqJmLYm9P0Xi7am8GIl9P8PreX+ACACC2L04J7bgdlSDOKCUb2Bj7STr16NjrRkikBpZycZNuJ31iBsDFCIaibaQbNiAxNrOiwAgGom1YR9ej9d7zE9yoti1z5PY8wR2zVriu1alDPPFGVYI5/hm3Lb9kBo4Xs9RnJN/AsBt2YeODn0T8RySDRsIXvE5QhX3EF74d4gTQUdbsoumkWQE98xbhK95kGDF3YQWfBO35T1fuCGQZC9e87sgHm5HDW7z7nSejrWSqPn1BaJnM6wQXld9VorgdtaDaHTkJGg3Kz8TibUibpzA9E9jllyP7j2R+VYHwe1qwBg7heCMz2AVz8M5U5ldJBMR3K56xLN9wbL6JPF2dKInIy2bYYWwiueDGlBMKcyiq/yH8ZIDiw6KiKBEnzewcnHhAJQ+167y/7xYVolBEA9EMPMmocxARpaRW4qRMz4jLZvhhZh+G4HJN4MRAGViFS8kMO02MExUeEKmSIOgrBBqzCTAn1oqXJxd5AKMvFL/n9TIMYsWZhYYBGPMZJQZxCq6CmvyJ8EIoAwTs2AmoblfHb6fI1k1AHSiC8TDyCn2DR+g+04S3/M44kSzi6exym4hNOfL2LUvoAK5WKXXkzjwrO89DoYyyJl3P4SLset/R+41f48XbSOx/+khp5Qyg4Tmfh2r7JZ0mjhRcGOonKJhRWAkIwLA6z1GsubX2Ad+6RvO1Ns18qcTmP0lVGhcdhVAYRZeRajibiTRje55H7flXYy8MgLTbvVHWDZKYZXegDlhAV7rHiR6Bq/3GFbRHALTbkUZZnYNlGFhTboRc8DyqSOnsKvXED/wDG7LnozyQzGiEWFXr8U5+7Y/BwvnkHP1P6QfXkSju+qxG//oO1TaQwXGYJXdTHDabahwIeI56L4TKMPEGFcOnoPbUY1z/H/RkdOI9jDCRVgzPotV8nGMUL4vXv8ZjHFXoAJ5iNOP27IX5/hmdKLTFzp3AoEZt2OVXg9Wrt9Z8UjUPI975m1ITcW8T/104OMMysiEqF2H0/Q6CFgTryG04O9QgTwQDx1rQ0dbMfNKUDlFiBcDZaIjZwDByJ+R4YBlIogTB+2ggmOHHsLawes7BU4EY+w0UKZfVjvo/iawxmCMnYIyg4h4JA+/iHNqBygw8iaRe8u/ZLd4ASMSQkeb/YZ1Emvix3yX1wzitu7Hrv01koygcsaTc9XfYoyfjV33W9yWd/2hPvE6Qgu/iTJD2c2OGOfYf5M89j+Im8DIn0HOwm+iAnnE9/0M3XcKZQYJlH+ewBV3oADd34RzZid4NtakT2AWzc1u8gKGeAWZGHmTCM25ByOvDLv2N8T3/Cs63onXthdJRgCQRDeJhg3oyCm8zlq/oghu6z68jurMBi8B8RySR/+IuAlIGWivpxG34xC676Q/qjwb52wlODHsuheI73saibcTnPNlf6kfASMSgpQVtutfRCe68HqO4RzdCGZOaq33MXIngBEEwzpfURmoYP7560tFKRhojJXhL8mBvPTqBaCsMLq3EafpzdQmcD9eW1VG/y7GiIXwH+j85kXlFBKY8leY42agzBBmwSxCFV/GyJ9GYOpiVCAXFRxLYOYSzIIrM5q6FJRhEbrqb33fwgxhlX4cs6ACs3AeVumNYOZg5E4geMUdqNB4336A/2gj2GydY0Q24hw62kLiwL9jjp9FaO5XANPf+HiO782ljZ0gnuu/MMMa8Vu5KNrzvUcjMGAkiO/dGpb/4Erhnnmb5PEtBK64nUDZLSO+9yUJQUoMr6sOs2g+INjvb0R3HMQsmk9o9pdQ4SKcs7txGv+IiEfwijsITFs84g4Nhu4+gn3kFXSkicD02whM/zTKCpM8+hrOmbdQwUJCc7+CkT8dr+VdjDFT/GX6EjB/9KMf/Sg7cWgE59Q2kg2/By+BjpzGbXoztYydQWLtqDFlJA+v82OXbgyvsw6reD4qpzC7sZEhmvjeJ33DqB283mOYBeVIoovk4RcRN44ke9CxVsxQAYlD/4mOtaZGw8gZuY0AQGEWzMYouBKz5AbE7kt7mQBe3wkk2Yc4AzZJ2rnotntYtJuOf6Svk/3oWAcyYJcpiU6MsVMwx83EmnTz+fIj5BKFALN4Prk3/gBrwnzMCQtRVg4AysohNPtLmGOnpYalAqUw8qdjFM3PbmbkmEEC0/86vRIZeaUY+VdgFs/DGDPZL2NYBEo/AaHxhG9cSWDKJzPbGAGXbCMyEBcdbcXrOYo5ZgrGuXhjsg+vpxElHkbBlb41vwzEs/G6GpBEF2bRPFS4CKUUEmvD6z6CChVgFMy8iAc7PJc8IjLQHmJ3o+OdaLsnNU0E7cSQRAc63um70JeLdpBkBG33IMk+lAgIaKcfHe9CEl1ZocJLZ/QjQgSn6XWSh19CtAOGSajiy1glHyNx8Fm87vchNZTDn1h5WU6Vfeg5nLM7AUHlFBG+9h/ByiG+50lfBGUSmPIpQlfdO/iudgSMekSITuJ11fsi4I8O5+hreJGm1IYrlRxt8U+5RouXTItAyijqvlN4HbW+CADi4XVUp93w0TBqIZRhoXKKM3aMxoSFqFABBFJbYgArB2Pc6D1LjIB/1nEOMwShAoyxU87fWylU7sQLQnSXwuinBvhr+clteGd3Yky4htCsO1HBfNz2apzGjYjnEJh5J4GS6zL2BZeKjjSRPPoqXu9xgtNu8wM7ZpDkiW24p7ahcksIVdyNkT9t1I7bZQnhxxMSoJNgBtNWW7QLrm8kVSB3gP8/SkT75xziocwwmEE/2UuCE0eZFlg5l3WfyxLC6z6CXbMWHW3BGDOJ0Lz7McZOxWncRPL4Zt+ITVtEaM69l9VJ9+xO7MMvIk4/VtFcgvPvR1m5vlHurEFZYYKz7iIw9VNDB3eGYXS1Um/DPfN2+uBF9zeTbNiA13scJxUmQzyck9vxOg9nVr4UtIt9eH062Ot11aO7juB1HPLjHCKIE8M5vR1JjcLRMGoh1CBzUbzkIKmkLf6oGRC9FhFQMkhE+/LuMWohMANYk29BBQsAP0iac9VXMPJnnD+QVQaBaYtGFCobEsMiOPsuPxADmIUVGOMrMCdcg1k4118xrBw/yn0ZnuVl2QjwI1fi2qhACGX5nUW7qbMOgcAY1MCI1WgQDU4UERfMXJTlxz/Fs8GJg2n69x6lfeCDEOLDwugl/JDxkRApPhIixZBCuC17UucTgttR46c170bH2hG7B7wkOtLkfyfR35w+Y/A6qv2IlGej+07hnvU/2tB9J8EbsCnSLjrW6n8+6CYQJ4LbdgDd04jYPbintqOjzf63WXYvyRNbES+Jjnf4h0eARJsRuxdx4+i+U/5ftNWPh3QfRZJ94MbQkdPoWNtFD6uHFMIYPwvMkB9gQafjAV5nDdi9iJdA953wd59uFPGSfuzBCCDRs4h28LrrkUR7ehVJnk45WvifJEm8ExUaj9OyG3Hi/kdh56LeeZMx8krxuhpQXsL/dspLIokeVE6x/0mRZ+O2H/Q/P2zZQ/L09tTu9AQSbwMzjHP2XYyxZUiiE7d5V8YzDuSiwVtlWKBdlJWLCuRiBPMxcidghIvBs1FGABUahzKDYJgYoXF+4CSnCBXMR5lB/6zSyvH3CcExGKkgriQjGMGx/mGyEcAIF/tfy1m5GDmFKKVQgTyUAiOvBBXIw8gr9XeYnoMRygdt++caOUUYoXysiVejzBwww2CGMHIKUGbA74sCrHD6/tkMv3yKnN85Dvw/g3NNqNT/fhkRQQ1aniHK+ZGnjHucu2fGvc/XHZYh+5zJ8EL8hTCkjfhL4yMhUgwrxK5du9i1a5e/6wNOnz7Nli1bAEgmk7z22ms0NTWlyycSCV5//XVeeOEF1q9fz969e9N5AHv37qW5uTl93dvby+bNm+nvz/ymqrGxkffeew/Py/w+8q233qKtzf8FAEBbWxubN29G68zdaFVVFfv27ctIuygyDOvWrZNFixZJW1ubeJ4njz/+uHz9618XEZHu7m6ZOnWqbNy4UUREtNayevVqWbhwoTz66KOybNkyqaiokC1btqTb+8Y3viF33HGHOI4jIiJ1dXUyb948aWxsTJcREbn11lvllltukebm5oz0RYsWyVe/+tX09RtvvCHz588X27bTabFYTMrLy+Vzn/ucdHR0pNMvxrBCOI4j1157rWzfvl0SiYQsXrxY3nzzTZGUECUlJfLKK6+IiEgkEpGZM2dKZWWlSEqYyspKiUQi6fa+9rWvyfjx42Xp0qUSiUSktrZWZs2aJUePHk2X2bt3r4TDYbn66qvl7bffTqeLiNx0000ybtw4+fa3vy3RaFR27Nghs2fPzhBi8+bNUlBQIDfddJPs3Lkzo/5QDDs1LMviC1/4Alu3bmX//v2ICBUVFdnFAKiurqa0tJTy8nJs2+bll1/mnXfe4ZVXXiEWO38e+uSTTyIirFix4oIpkUwmee6551i6dCn33Xcfq1evzsjPzc3lkUceob6+nscee4xoNNNbTCQSrFu3jmXLlvH5z3+e3/3udxn5QzGsEAC33347O3bs4KGHHmLRokVMmDAhuwgAhYWFRCIR4vE4SikKCgo4cuQIzz//PIHA+VB7WVkZzzzzDMePH+exxx7LaOPkyZNUVlYSCASorq5mx44dHD58PtRnGAYVFRW8+OKL7Nq1izVr1mTUP3LkCLt37yaRSFBTU8OGDRtwnOFPwUYkxJw5c5g0aRJVVVUsXboUwxi82syZMykuLmbNmjXU1NQwduxYDh06xJIlSzKEACgtLeWRRx7h+PHjGelvvPGG71UqhdaaKVOm8MQTT1xgDCdPnsyPf/xj6urqMtK3b9/OxIkTaWtrIxAIkJubyw9/+MOMMoOSPVeGYuPGjbJy5UrxPC+dFo1G5f7778+Yh1VVVfLAAw/I4sWL5c4775Snn35aotFoOv/nP/+5HDhwQCRlQ/bs2SPf+c530kZx9erVsm3btnT5yspKWbZsmXR3d4uIyKpVq2T//v0iIuJ5nmzbtk0efPBBSSaTIiKycuXKtI0SEfnDH/4g3/3udzNsyGCM2LM8VyzbZdZap9/gOUQkIz07j6x2tNbpUTZYewPzL7V+akEYchSfY8RCfNi5uEx/QXwgI8LzPJRSGIaB1hoRwTT9k61znuG5axEhmUziOA6hUCjDiLpu5m85TNNEKZXR/rlpN7A9z/PSZUfLBzIiNmzYQFVVFQC1tbU8+uij9Pf3E4/Heeqpp9i0aVN6bm/cuJEHHniAe+65hx/84AccOHAg3c7DDz/M8uXLWb58OQ8//HB6RfnlL3+Zdpe7uroyfIvOzk5WrVqV4XaPhg9EiD//+c80NDQAUFJSwpYtW/jJT37C1q1b+cUvfsGCBQtQSrFp0yZWrFjBDTfcwIoVK4jFYtx9992cPev/LmzJkiWMGzeOyspKlixZQnGx/yOXV199lfp6/ydVvb29vPTSS+l79/T0sHbtWjo7O9NpoyJ7GRkN9913n6xfvz59vXXrVikqKpJ58+bJr371KxERcV1XJk+eLN///vdFp36U2tvbKwsWLJCHHnooXfell16SxYsXp69FRG6++WZZtWqVVFVVyaZNm6SioiKd9/7778vkyZOltrY2o86l8oGMiGxuu+027rrrLkpKSvjiF78IgG3btLW1MX369PRczs/PZ8aMGekRMRSe5/HOO++wbt06Xn31Vbq7u7OLXDYfiBCSFZIzDIMbbriBsrIyQiH/eC43N5fy8nLq6urS9qKzs5PDhw9z5ZUX/6LGsizuvfdennrqKVauXElZ2YW//L1cRi2EiLBr1y6effZZqqurB91/ZFvxdevW8dZbb/G9732PtWvX8q1vfYvp06fz4IMPZpTL5tyKYVlWerX4oLloFHs4Ojs7effdd/nsZz/LZz7zmfTbBwiHw5SXl1NeXp726qZMmcL1119Pe3s7zc3N3HjjjSxfvpySkpKMerNmzWL27NnptMLCQq699lqKioowTZOysjLmzvVP2E3TZOrUqVx33XWEw/+Pp+EfFkY9NT5sfCREio+ESPF/fk5dwOotQ0QAAAAASUVORK5CYII=" alt="logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.style.display='none'" />
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
      row.className = `msg-row ${role}`;

      if (role === "bot") {
        const avatar = document.createElement("div");
        avatar.className = "bot-avatar";
        avatar.innerHTML = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAABICAYAAABCzyOOAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAABSmSURBVHhe7Zt5cBTXncc/r7tnRiOBEJJAAnFZBoS5bMeO47KdyoKdbOykNphUbMfJJmVXNsmu10U2bKVsSFIJdrzrI8HJZu1dE+LgYMfE6+Cwu1CEgE8BNiAOHUgYcQp0n6M5err7/faPHgbNICEhXLVVjj9VqlK/q19/+73f+73f61EiInwERnbCXyofCZHiIyFSjF4IEXR/M27rXtAO4sZxz+5Ex9oA0D1H8bqPIOIhdg9e237QLuLaeO0H0f1nAUH3HsdtP4h4SXBjeG37EacfRON11qIjp/32+s/gtlb593KiuM270fFOv43uBnRvIyI6q5MjZ9RCiHg4p3eQOPgf6L6T6N5G7Oo1uKffAIT4oTUkj/wXKvXg8YPPovvPoKNnseteIHn0D4jnYte/hF33W3SsFbernsSh/8DrPgo6iV37G+z3XwXt4Jz8E/ahZ9GxdryOGuzq53DP7kS0R/zAM9hH/gs8O7ubI0dGiBdtEx1pykzrPyPJY5tFtCfiJsRu+L3o/iYRrcXtbBC3tUpEe+LGOiR56nURrUU7cUmeel28vpMiosXpqJPkqe0i2hVxE5I88SfRiW6/Xst74vWdEhERt/uo2Ce2ptqISaLh96KjLSIi4rQeEKftoIjW6b5pJy5u36mMtIuhZETLp2DXv4xEm8m57p8AlZlrd+O2H0L3HgPRGDnjMcZfhTl+JhgBJN6B27oPFS7GmngtKAOJteG2H8TrbwKtMXKKMCcswBx3hZ8fb8dt248xdhpm4Rx/CkSacNsPIbFWQFC5kzAnXI05tiyjPwDu2V24rXsJzb8PFRiTnX0BIxJCPBuvowacKGbpx1FWOJ2nE93YB/4dr+8EaCeVqlChfAJTPkXwyr8hUfci7pk3wQyRe/0/o12bZN06dLwDxEu3pULjCZbfQWDarcR2P4ruO4ERGkf4k4/706HhZSTeAedsgTJQ4WJCs+/CKv14uh3RLl53AxLvxCr52IiEGNZGiJvAPvgsiQP/RqJmLYm9P0Xi7am8GIl9P8PreX+ACACC2L04J7bgdlSDOKCUb2Bj7STr16NjrRkikBpZycZNuJ31iBsDFCIaibaQbNiAxNrOiwAgGom1YR9ej9d7zE9yoti1z5PY8wR2zVriu1alDPPFGVYI5/hm3Lb9kBo4Xs9RnJN/AsBt2YeODn0T8RySDRsIXvE5QhX3EF74d4gTQUdbsoumkWQE98xbhK95kGDF3YQWfBO35T1fuCGQZC9e87sgHm5HDW7z7nSejrWSqPn1BaJnM6wQXld9VorgdtaDaHTkJGg3Kz8TibUibpzA9E9jllyP7j2R+VYHwe1qwBg7heCMz2AVz8M5U5ldJBMR3K56xLN9wbL6JPF2dKInIy2bYYWwiueDGlBMKcyiq/yH8ZIDiw6KiKBEnzewcnHhAJQ+167y/7xYVolBEA9EMPMmocxARpaRW4qRMz4jLZvhhZh+G4HJN4MRAGViFS8kMO02MExUeEKmSIOgrBBqzCTAn1oqXJxd5AKMvFL/n9TIMYsWZhYYBGPMZJQZxCq6CmvyJ8EIoAwTs2AmoblfHb6fI1k1AHSiC8TDyCn2DR+g+04S3/M44kSzi6exym4hNOfL2LUvoAK5WKXXkzjwrO89DoYyyJl3P4SLset/R+41f48XbSOx/+khp5Qyg4Tmfh2r7JZ0mjhRcGOonKJhRWAkIwLA6z1GsubX2Ad+6RvO1Ns18qcTmP0lVGhcdhVAYRZeRajibiTRje55H7flXYy8MgLTbvVHWDZKYZXegDlhAV7rHiR6Bq/3GFbRHALTbkUZZnYNlGFhTboRc8DyqSOnsKvXED/wDG7LnozyQzGiEWFXr8U5+7Y/BwvnkHP1P6QfXkSju+qxG//oO1TaQwXGYJXdTHDabahwIeI56L4TKMPEGFcOnoPbUY1z/H/RkdOI9jDCRVgzPotV8nGMUL4vXv8ZjHFXoAJ5iNOP27IX5/hmdKLTFzp3AoEZt2OVXg9Wrt9Z8UjUPI975m1ITcW8T/104OMMysiEqF2H0/Q6CFgTryG04O9QgTwQDx1rQ0dbMfNKUDlFiBcDZaIjZwDByJ+R4YBlIogTB+2ggmOHHsLawes7BU4EY+w0UKZfVjvo/iawxmCMnYIyg4h4JA+/iHNqBygw8iaRe8u/ZLd4ASMSQkeb/YZ1Emvix3yX1wzitu7Hrv01koygcsaTc9XfYoyfjV33W9yWd/2hPvE6Qgu/iTJD2c2OGOfYf5M89j+Im8DIn0HOwm+iAnnE9/0M3XcKZQYJlH+ewBV3oADd34RzZid4NtakT2AWzc1u8gKGeAWZGHmTCM25ByOvDLv2N8T3/Cs63onXthdJRgCQRDeJhg3oyCm8zlq/oghu6z68jurMBi8B8RySR/+IuAlIGWivpxG34xC676Q/qjwb52wlODHsuheI73saibcTnPNlf6kfASMSgpQVtutfRCe68HqO4RzdCGZOaq33MXIngBEEwzpfURmoYP7560tFKRhojJXhL8mBvPTqBaCsMLq3EafpzdQmcD9eW1VG/y7GiIXwH+j85kXlFBKY8leY42agzBBmwSxCFV/GyJ9GYOpiVCAXFRxLYOYSzIIrM5q6FJRhEbrqb33fwgxhlX4cs6ACs3AeVumNYOZg5E4geMUdqNB4336A/2gj2GydY0Q24hw62kLiwL9jjp9FaO5XANPf+HiO782ljZ0gnuu/MMMa8Vu5KNrzvUcjMGAkiO/dGpb/4Erhnnmb5PEtBK64nUDZLSO+9yUJQUoMr6sOs2g+INjvb0R3HMQsmk9o9pdQ4SKcs7txGv+IiEfwijsITFs84g4Nhu4+gn3kFXSkicD02whM/zTKCpM8+hrOmbdQwUJCc7+CkT8dr+VdjDFT/GX6EjB/9KMf/Sg7cWgE59Q2kg2/By+BjpzGbXoztYydQWLtqDFlJA+v82OXbgyvsw6reD4qpzC7sZEhmvjeJ33DqB283mOYBeVIoovk4RcRN44ke9CxVsxQAYlD/4mOtaZGw8gZuY0AQGEWzMYouBKz5AbE7kt7mQBe3wkk2Yc4AzZJ2rnotntYtJuOf6Svk/3oWAcyYJcpiU6MsVMwx83EmnTz+fIj5BKFALN4Prk3/gBrwnzMCQtRVg4AysohNPtLmGOnpYalAqUw8qdjFM3PbmbkmEEC0/86vRIZeaUY+VdgFs/DGDPZL2NYBEo/AaHxhG9cSWDKJzPbGAGXbCMyEBcdbcXrOYo5ZgrGuXhjsg+vpxElHkbBlb41vwzEs/G6GpBEF2bRPFS4CKUUEmvD6z6CChVgFMy8iAc7PJc8IjLQHmJ3o+OdaLsnNU0E7cSQRAc63um70JeLdpBkBG33IMk+lAgIaKcfHe9CEl1ZocJLZ/QjQgSn6XWSh19CtAOGSajiy1glHyNx8Fm87vchNZTDn1h5WU6Vfeg5nLM7AUHlFBG+9h/ByiG+50lfBGUSmPIpQlfdO/iudgSMekSITuJ11fsi4I8O5+hreJGm1IYrlRxt8U+5RouXTItAyijqvlN4HbW+CADi4XVUp93w0TBqIZRhoXKKM3aMxoSFqFABBFJbYgArB2Pc6D1LjIB/1nEOMwShAoyxU87fWylU7sQLQnSXwuinBvhr+clteGd3Yky4htCsO1HBfNz2apzGjYjnEJh5J4GS6zL2BZeKjjSRPPoqXu9xgtNu8wM7ZpDkiW24p7ahcksIVdyNkT9t1I7bZQnhxxMSoJNgBtNWW7QLrm8kVSB3gP8/SkT75xziocwwmEE/2UuCE0eZFlg5l3WfyxLC6z6CXbMWHW3BGDOJ0Lz7McZOxWncRPL4Zt+ITVtEaM69l9VJ9+xO7MMvIk4/VtFcgvPvR1m5vlHurEFZYYKz7iIw9VNDB3eGYXS1Um/DPfN2+uBF9zeTbNiA13scJxUmQzyck9vxOg9nVr4UtIt9eH062Ot11aO7juB1HPLjHCKIE8M5vR1JjcLRMGoh1CBzUbzkIKmkLf6oGRC9FhFQMkhE+/LuMWohMANYk29BBQsAP0iac9VXMPJnnD+QVQaBaYtGFCobEsMiOPsuPxADmIUVGOMrMCdcg1k4118xrBw/yn0ZnuVl2QjwI1fi2qhACGX5nUW7qbMOgcAY1MCI1WgQDU4UERfMXJTlxz/Fs8GJg2n69x6lfeCDEOLDwugl/JDxkRApPhIixZBCuC17UucTgttR46c170bH2hG7B7wkOtLkfyfR35w+Y/A6qv2IlGej+07hnvU/2tB9J8EbsCnSLjrW6n8+6CYQJ4LbdgDd04jYPbintqOjzf63WXYvyRNbES+Jjnf4h0eARJsRuxdx4+i+U/5ftNWPh3QfRZJ94MbQkdPoWNtFD6uHFMIYPwvMkB9gQafjAV5nDdi9iJdA953wd59uFPGSfuzBCCDRs4h28LrrkUR7ehVJnk45WvifJEm8ExUaj9OyG3Hi/kdh56LeeZMx8krxuhpQXsL/dspLIokeVE6x/0mRZ+O2H/Q/P2zZQ/L09tTu9AQSbwMzjHP2XYyxZUiiE7d5V8YzDuSiwVtlWKBdlJWLCuRiBPMxcidghIvBs1FGABUahzKDYJgYoXF+4CSnCBXMR5lB/6zSyvH3CcExGKkgriQjGMGx/mGyEcAIF/tfy1m5GDmFKKVQgTyUAiOvBBXIw8gr9XeYnoMRygdt++caOUUYoXysiVejzBwww2CGMHIKUGbA74sCrHD6/tkMv3yKnN85Dvw/g3NNqNT/fhkRQQ1aniHK+ZGnjHucu2fGvc/XHZYh+5zJ8EL8hTCkjfhL4yMhUgwrxK5du9i1a5e/6wNOnz7Nli1bAEgmk7z22ms0NTWlyycSCV5//XVeeOEF1q9fz969e9N5AHv37qW5uTl93dvby+bNm+nvz/ymqrGxkffeew/Py/w+8q233qKtzf8FAEBbWxubN29G68zdaFVVFfv27ctIuygyDOvWrZNFixZJW1ubeJ4njz/+uHz9618XEZHu7m6ZOnWqbNy4UUREtNayevVqWbhwoTz66KOybNkyqaiokC1btqTb+8Y3viF33HGHOI4jIiJ1dXUyb948aWxsTJcREbn11lvllltukebm5oz0RYsWyVe/+tX09RtvvCHz588X27bTabFYTMrLy+Vzn/ucdHR0pNMvxrBCOI4j1157rWzfvl0SiYQsXrxY3nzzTZGUECUlJfLKK6+IiEgkEpGZM2dKZWWlSEqYyspKiUQi6fa+9rWvyfjx42Xp0qUSiUSktrZWZs2aJUePHk2X2bt3r4TDYbn66qvl7bffTqeLiNx0000ybtw4+fa3vy3RaFR27Nghs2fPzhBi8+bNUlBQIDfddJPs3Lkzo/5QDDs1LMviC1/4Alu3bmX//v2ICBUVFdnFAKiurqa0tJTy8nJs2+bll1/mnXfe4ZVXXiEWO38e+uSTTyIirFix4oIpkUwmee6551i6dCn33Xcfq1evzsjPzc3lkUceob6+nscee4xoNNNbTCQSrFu3jmXLlvH5z3+e3/3udxn5QzGsEAC33347O3bs4KGHHmLRokVMmDAhuwgAhYWFRCIR4vE4SikKCgo4cuQIzz//PIHA+VB7WVkZzzzzDMePH+exxx7LaOPkyZNUVlYSCASorq5mx44dHD58PtRnGAYVFRW8+OKL7Nq1izVr1mTUP3LkCLt37yaRSFBTU8OGDRtwnOFPwUYkxJw5c5g0aRJVVVUsXboUwxi82syZMykuLmbNmjXU1NQwduxYDh06xJIlSzKEACgtLeWRRx7h+PHjGelvvPGG71UqhdaaKVOm8MQTT1xgDCdPnsyPf/xj6urqMtK3b9/OxIkTaWtrIxAIkJubyw9/+MOMMoOSPVeGYuPGjbJy5UrxPC+dFo1G5f7778+Yh1VVVfLAAw/I4sWL5c4775Snn35aotFoOv/nP/+5HDhwQCRlQ/bs2SPf+c530kZx9erVsm3btnT5yspKWbZsmXR3d4uIyKpVq2T//v0iIuJ5nmzbtk0efPBBSSaTIiKycuXKtI0SEfnDH/4g3/3udzNsyGCM2LM8VyzbZdZap9/gOUQkIz07j6x2tNbpUTZYewPzL7V+akEYchSfY8RCfNi5uEx/QXwgI8LzPJRSGIaB1hoRwTT9k61znuG5axEhmUziOA6hUCjDiLpu5m85TNNEKZXR/rlpN7A9z/PSZUfLBzIiNmzYQFVVFQC1tbU8+uij9Pf3E4/Heeqpp9i0aVN6bm/cuJEHHniAe+65hx/84AccOHAg3c7DDz/M8uXLWb58OQ8//HB6RfnlL3+Zdpe7uroyfIvOzk5WrVqV4XaPhg9EiD//+c80NDQAUFJSwpYtW/jJT37C1q1b+cUvfsGCBQtQSrFp0yZWrFjBDTfcwIoVK4jFYtx9992cPev/LmzJkiWMGzeOyspKlixZQnGx/yOXV199lfp6/ydVvb29vPTSS+l79/T0sHbtWjo7O9NpoyJ7GRkN9913n6xfvz59vXXrVikqKpJ58+bJr371KxERcV1XJk+eLN///vdFp36U2tvbKwsWLJCHHnooXfell16SxYsXp69FRG6++WZZtWqVVFVVyaZNm6SioiKd9/7778vkyZOltrY2o86l8oGMiGxuu+027rrrLkpKSvjiF78IgG3btLW1MX369PRczs/PZ8aMGekRMRSe5/HOO++wbt06Xn31Vbq7u7OLXDYfiBCSFZIzDIMbbriBsrIyQiH/eC43N5fy8nLq6urS9qKzs5PDhw9z5ZUX/6LGsizuvfdennrqKVauXElZ2YW//L1cRi2EiLBr1y6effZZqqurB91/ZFvxdevW8dZbb/G9732PtWvX8q1vfYvp06fz4IMPZpTL5tyKYVlWerX4oLloFHs4Ojs7effdd/nsZz/LZz7zmfTbBwiHw5SXl1NeXp726qZMmcL1119Pe3s7zc3N3HjjjSxfvpySkpKMerNmzWL27NnptMLCQq699lqKioowTZOysjLmzvVP2E3TZOrUqVx33XWEw/+Pp+EfFkY9NT5sfCREio+ESPF/fk5dwOotQ0QAAAAASUVORK5CYII=" alt="logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.style.display='none'" />`;
        row.appendChild(avatar);
      }

      const wrap = document.createElement("div");
      wrap.className = "msg-wrap";

      const bubble = document.createElement("div");
      bubble.className = `msg ${role}`;
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
      avatar.innerHTML = `<img src="data:image/png;base64,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" alt="logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.style.display='none'" />`;
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
        let c = await fetch(`${apiUrl}/api/chat/${clientId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Widget-Token": token } : {}) },
          body: JSON.stringify({ message: text, session_id: sessionId })
        });

        if (!c.ok || !c.body) throw new Error(`Stream failed: ${c.status}`);

        let m = c.body.getReader(), B = new TextDecoder(), x = "";
        while (true) {
          let { done, value } = await m.read();
          if (done) break;
          x += B.decode(value, { stream: true });
          let H = x.split("\n\n");
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
                    avatar.innerHTML = `<img src="data:image/png;base64,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" alt="logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.style.display='none'" />`;
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

    function renderSubQuestions(subQuestions) {
      let qr = document.createElement("div");
      qr.className = "quick-replies";
      subQuestions.forEach(q => {
        if (!q || !q.trim()) return;
        let qb = document.createElement("button");
        qb.type = "button";
        qb.className = "quick-reply-btn";
        qb.textContent = q;
        qb.onclick = () => sendMessage(q);
        qr.appendChild(qb);
      });
      return qr;
    }

    function renderSubmenuChips(submenus) {
      let wrap = addMessage("bot", "Choose a topic:");
      let chips = document.createElement("div");
      chips.className = "quick-replies";
      submenus.forEach(sm => {
        if (!sm.label) return;
        let chip = document.createElement("button");
        chip.type = "button";
        chip.className = "quick-reply-btn submenu-chip";
        chip.textContent = sm.label;
        chip.onclick = () => {
          chips.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
          chip.style.opacity = "1";
          chip.style.fontWeight = "700";
          if (sm.sub_questions && sm.sub_questions.length > 0) {
            let qWrap = addMessage("bot", "Questions about \"" + sm.label + "\":");
            qWrap.insertBefore(renderSubQuestions(sm.sub_questions), qWrap.lastChild);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        chips.appendChild(chip);
      });
      wrap.insertBefore(chips, wrap.lastChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderMenuOptions(menuOptions) {
      if (!menuOptions || menuOptions.length === 0) return;
      let wrap = addMessage("bot", "How can I help you? Choose a topic:");
      let chips = document.createElement("div");
      chips.className = "quick-replies";
      chips.style.marginTop = "10px";
      menuOptions.forEach(menu => {
        if (!menu.label) return;
        let btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-option-btn quick-reply-btn";
        btn.textContent = menu.label;
        btn.onclick = () => {
          chips.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
          btn.style.opacity = "1";
          let submenus = menu.submenus || [];
          if (submenus.length > 0) {
            renderSubmenuChips(submenus);
          } else if (menu.sub_questions && menu.sub_questions.length > 0) {
            let qWrap = addMessage("bot", "Questions about \"" + menu.label + "\":");
            qWrap.insertBefore(renderSubQuestions(menu.sub_questions), qWrap.lastChild);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        };
        chips.appendChild(btn);
      });
      wrap.insertBefore(chips, wrap.lastChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Load welcome message & settings
    fetch(`${apiUrl}/api/clients/${clientId}`, { method: "GET" })
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
