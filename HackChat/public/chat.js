// public/chat.js
(() => {
  const overlay = document.getElementById('join-overlay');
  const joinBtn = document.getElementById('join-btn');
  const roomInput = document.getElementById('room-input');
  const nickInput = document.getElementById('nick-input');
  const roomTitle = document.getElementById('room-title');
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('msg-form');
  const input = document.getElementById('msg-input');

  let ws = null;
  let room = 'lobby';
  let nick = 'anon';

  function addLine(obj) {
    const el = document.createElement('div');
    el.className = 'line';
    if (obj.type === 'msg') {
      const nickSpan = document.createElement('span');
      nickSpan.className = 'nick';
      nickSpan.textContent = obj.nick;
      nickSpan.style.color = obj.color || 'black';
      const txt = document.createElement('span');
      txt.className = 'text';
      txt.textContent = `: ${obj.text}`;
      el.appendChild(nickSpan);
      el.appendChild(txt);
    } else if (obj.type === 'system') {
      el.className += ' system';
      if (obj.subtype === 'join') el.textContent = `${obj.nick} joined the room.`;
      else if (obj.subtype === 'part') el.textContent = `${obj.nick} left.`;
      else if (obj.subtype === 'nick') el.textContent = `${obj.old} is now ${obj.nick}.`;
      else el.textContent = JSON.stringify(obj);
    }
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function connect() {
    const proto = (location.protocol === 'https:') ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/?room=${encodeURIComponent(room)}&nick=${encodeURIComponent(nick)}`;
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      overlay.style.display = 'none';
      roomTitle.textContent = `#${room}`;
      addLine({ type: 'system', subtype: 'info', text: `Connected as ${nick}` });
    });

    ws.addEventListener('message', (ev) => {
      let obj;
      try { obj = JSON.parse(ev.data); } catch (e) { return; }
      addLine(obj);
    });

    ws.addEventListener('close', () => {
      addLine({ type: 'system', subtype: 'info', text: 'Disconnected. Reopen page to reconnect.' });
    });

    ws.addEventListener('error', () => {
      addLine({ type: 'system', subtype: 'info', text: 'Connection error.' });
    });
  }

  joinBtn.addEventListener('click', (e) => {
    e.preventDefault();
    room = (roomInput.value || 'lobby').trim().replace(/[^a-zA-Z0-9\-_]/g,'') || 'lobby';
    nick = (nickInput.value || 'anon').trim().slice(0,32) || 'anon';
    connect();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addLine({ type: 'system', subtype: 'info', text: 'Not connected.'});
      return;
    }
    // client-side /nick command
    if (txt.startsWith('/nick ')) {
      const newNick = txt.slice(6).trim().slice(0,32);
      if (newNick) {
        ws.send(JSON.stringify({ type: 'nick', nick: newNick }));
        nick = newNick;
        input.value = '';
        return;
      }
    }
    ws.send(JSON.stringify({ type: 'msg', text: txt }));
    input.value = '';
  });

  // If URL contains ?room= or ?nick= prefill
  (function prefillFromUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get('room')) roomInput.value = q.get('room');
    if (q.get('nick')) nickInput.value = q.get('nick');
    if (location.hash) {
      const h = location.hash.slice(1);
      if (h) roomInput.value = h;
    }
  })();

})();