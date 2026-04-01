(()=>{(function(){let c=document.currentScript;if(!c)return;let y=c.getAttribute("data-client-id")||"default",d=c.getAttribute("data-theme-color")||"#1E40AF",w=c.getAttribute("data-api-url")||c.src.replace(/\/widget\/.*/,""),g=document.createElement("div");g.id="ai-frontdesk-widget",document.body.appendChild(g);let p=g.attachShadow({mode:"closed"}),v=document.createElement("style");v.textContent=`
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    .widget-btn {
      position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
      border-radius: 50%; background: ${d}; color: #fff; border: none;
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
      padding: 16px 20px; background: ${d}; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
    }
    .chat-header h3 { font-size: 16px; font-weight: 600; }
    .chat-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }

    .msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
    .msg.user { align-self: flex-end; background: ${d}; color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }

    .cursor {
      display: inline-block; width: 2px; height: 14px;
      background: #64748b; margin-left: 2px; vertical-align: middle;
      animation: blink 0.8s step-end infinite;
    }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }

    .chat-input {
      padding: 12px 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;
    }
    .chat-input input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
      font-size: 14px; outline: none;
    }
    .chat-input input:focus { border-color: ${d}; }
    .chat-input button {
      background: ${d}; color: #fff; border: none; border-radius: 10px;
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
  `,p.appendChild(v);let s=!1,E,b=!1,r=document.createElement("button");r.className="widget-btn",r.innerHTML="\u{1F4AC}",r.onclick=()=>{s=!s,o.classList.toggle("open",s),r.innerHTML=s?"\u2715":"\u{1F4AC}",s&&u.focus()},p.appendChild(r);let o=document.createElement("div");o.className="chat-panel",o.innerHTML=`
    <div class="chat-header">
      <h3>Chat with us</h3>
      <button class="close-btn">\u2715</button>
    </div>
    <div class="chat-messages"></div>
    <form class="chat-input">
      <input type="text" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  `,p.appendChild(o);let a=o.querySelector(".chat-messages"),u=o.querySelector(".chat-input input"),L=o.querySelector(".chat-input"),T=o.querySelector(".chat-input button"),M=o.querySelector(".close-btn");M.onclick=()=>{s=!1,o.classList.remove("open"),r.innerHTML="\u{1F4AC}"};function f(e,n){let t=document.createElement("div");return t.className=`msg ${e}`,t.textContent=n,a.appendChild(t),a.scrollTop=a.scrollHeight,t}function S(){let e=document.createElement("div");return e.className="msg bot typing",e.innerHTML="<span></span><span></span><span></span>",e.id="typing-indicator",a.appendChild(e),a.scrollTop=a.scrollHeight,e}function C(){let e=p.getElementById("typing-indicator");e&&e.remove()}function $(e,n,t){return new Promise(i=>{let l=0;function m(){if(l>=e.length){i();return}n.insertBefore(document.createTextNode(e[l++]),t),a.scrollTop=a.scrollHeight,setTimeout(m,15)}m()})}async function z(e){let n=S(),t=null,i=null;try{let l=await fetch(`${w}/api/chat/${y}/stream`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:e,session_id:E})});if(!l.ok||!l.body)throw new Error("Stream failed");let m=l.body.getReader(),N=new TextDecoder,x="";for(;;){let{done:B,value:I}=await m.read();if(B)break;x+=N.decode(I,{stream:!0});let H=x.split(`

`);x=H.pop()??"";for(let q of H){let k=q.trim();if(k.startsWith("data: "))try{let h=JSON.parse(k.slice(6));h.type==="token"?(t||(n.remove(),t=document.createElement("div"),t.className="msg bot",i=document.createElement("span"),i.className="cursor",a.appendChild(t),t.appendChild(i)),await $(h.text,t,i)):h.type==="done"&&(E=h.session_id,i&&i.remove())}catch{}}}}catch{C(),t?i&&i.remove():f("bot","Sorry, something went wrong. Please try again.")}}L.onsubmit=async e=>{e.preventDefault();let n=u.value.trim();!n||b||(u.value="",f("user",n),b=!0,T.disabled=!0,await z(n),b=!1,T.disabled=!1,u.focus())},fetch(`${w}/api/clients/${y}`).then(e=>e.json()).then(e=>{let n=e?.settings?.welcome_message||"Hello! How can I help you today?";f("bot",n)}).catch(()=>f("bot","Hello! How can I help you today?"))})();})();
