// server.js
// Minimal WebSocket relay: rooms are in-memory, no persistent logs.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const app = express();
app.use(helmet());
app.use(morgan('tiny'));
app.use(compression());
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms: Map<roomName, Set<ws>>
const rooms = new Map();

function broadcastToRoom(room, payload) {
  const set = rooms.get(room);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

function genColor(name) {
  // simple hash -> HSL
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  h = Math.abs(h) % 360;
  return `hsl(${h} 70% 45%)`;
}

wss.on('connection', (ws, req) => {
  const q = url.parse(req.url, true).query;
  const room = (q.room ? String(q.room) : 'lobby').replace(/[^a-zA-Z0-9\-_]/g,'') || 'lobby';
  ws.room = room;
  ws.id = Math.random().toString(36).slice(2,9);
  ws.nick = q.nick ? String(q.nick).slice(0,32) : `anon${Math.floor(Math.random()*1000)}`;
  ws.color = genColor(ws.nick);

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);

  // notify room
  broadcastToRoom(room, { type: 'system', subtype: 'join', id: ws.id, nick: ws.nick, color: ws.color, time: Date.now() });

  ws.on('message', (msgRaw) => {
    let msg;
    try { msg = JSON.parse(msgRaw); } catch (e) { return; }
    if (msg && msg.type === 'msg' && typeof msg.text === 'string') {
      // basic anti-spam/size guard
      const text = msg.text.slice(0, 2000);
      broadcastToRoom(ws.room, {
        type: 'msg',
        id: ws.id,
        nick: ws.nick,
        color: ws.color,
        text,
        time: Date.now()
      });
    } else if (msg && msg.type === 'nick' && typeof msg.nick === 'string') {
      const old = ws.nick;
      ws.nick = msg.nick.slice(0,32);
      ws.color = genColor(ws.nick);
      broadcastToRoom(ws.room, { type: 'system', subtype: 'nick', id: ws.id, old, nick: ws.nick, color: ws.color, time: Date.now() });
    }
  });

  ws.on('close', () => {
    const set = rooms.get(ws.room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(ws.room);
    }
    broadcastToRoom(ws.room, { type: 'system', subtype: 'part', id: ws.id, nick: ws.nick, time: Date.now() });
  });
});

// start
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HackChat-clone listening on ${PORT}`);
});
