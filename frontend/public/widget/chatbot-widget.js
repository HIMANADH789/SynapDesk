(()=>{(function(){let s=document.currentScript;if(!s)return;let f=s.getAttribute("data-client-id")||"default",r=s.getAttribute("data-theme-color")||"#1E40AF",g=s.getAttribute("data-api-url")||s.src.replace(/\/widget\/.*/,""),l=document.createElement("div");l.id="ai-frontdesk-widget",document.body.appendChild(l);let c=l.attachShadow({mode:"closed"}),m=document.createElement("style");m.textContent=`
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    .widget-btn {
      position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
      border-radius: 50%; background: ${r}; color: #fff; border: none;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
      transition: transform 0.2s;
    }
    .widget-btn:hover { transform: scale(1.1); }

    .chat-panel {
      position: fixed; bottom: 92px; right: 24px; width: 380px; height: 520px;
      border-radius: 16px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: none; flex-direction: column; overflow: hidden; z-index: 99998;
    }
    .chat-panel.open { display: flex; }

    .chat-header {
      padding: 16px 20px; background: ${r}; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
    }
    .chat-header h3 { font-size: 16px; font-weight: 600; }
    .chat-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }

    .msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .msg.user { align-self: flex-end; background: ${r}; color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }

    .chat-input {
      padding: 12px 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;
    }
    .chat-input input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
      font-size: 14px; outline: none;
    }
    .chat-input input:focus { border-color: ${r}; }
    .chat-input button {
      background: ${r}; color: #fff; border: none; border-radius: 10px;
      padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500;
    }
    .chat-input button:disabled { opacity: 0.5; }

    .typing { display: flex; gap: 4px; padding: 10px 14px; }
    .typing span {
      width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;
      animation: bounce 1.4s infinite both;
    }
    .typing span:nth-child(2) { animation-delay: 0.16s; }
    .typing span:nth-child(3) { animation-delay: 0.32s; }
    @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }

    @media (max-width: 480px) {
      .chat-panel { width: calc(100vw - 32px); right: 16px; bottom: 88px; height: 70vh; }
    }
  `,c.appendChild(m);let o=!1,b,u=!1,a=document.createElement("button");a.className="widget-btn",a.innerHTML="\u{1F4AC}",a.onclick=()=>{o=!o,t.classList.toggle("open",o),a.innerHTML=o?"\u2715":"\u{1F4AC}",o&&h.focus()},c.appendChild(a);let t=document.createElement("div");t.className="chat-panel",t.innerHTML=`
    <div class="chat-header">
      <h3>Chat with us</h3>
      <button class="close-btn">\u2715</button>
    </div>
    <div class="chat-messages"></div>
    <form class="chat-input">
      <input type="text" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  `,c.appendChild(t);let i=t.querySelector(".chat-messages"),h=t.querySelector(".chat-input input"),v=t.querySelector(".chat-input"),x=t.querySelector(".chat-input button"),T=t.querySelector(".close-btn");T.onclick=()=>{o=!1,t.classList.remove("open"),a.innerHTML="\u{1F4AC}"};function d(e,n){let p=document.createElement("div");p.className=`msg ${e}`,p.textContent=n,i.appendChild(p),i.scrollTop=i.scrollHeight}function E(){let e=document.createElement("div");e.className="msg bot typing",e.innerHTML="<span></span><span></span><span></span>",e.id="typing-indicator",i.appendChild(e),i.scrollTop=i.scrollHeight}function y(){let e=c.getElementById("typing-indicator");e&&e.remove()}v.onsubmit=async e=>{e.preventDefault();let n=h.value.trim();if(!(!n||u)){h.value="",d("user",n),u=!0,x.disabled=!0,E();try{let w=await(await fetch(`${g}/api/chat/${f}/query`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:n,session_id:b})})).json();b=w.session_id,y(),d("bot",w.response)}catch{y(),d("bot","Sorry, something went wrong. Please try again.")}finally{u=!1,x.disabled=!1}}},fetch(`${g}/api/clients/${f}`,{method:"GET"}).then(e=>e.json()).then(e=>{let n=e?.settings?.welcome_message||"Hello! How can I help you today?";d("bot",n)}).catch(()=>{d("bot","Hello! How can I help you today?")})})();})();
