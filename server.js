// Node.js сервер для TikTok-Live-Connector + локальная база
const express = require('express');
const fs = require('fs');
const path = require('path');
const { WebcastPushConnection } = require('tiktok-live-connector');

const PORT = 3030;
const DATA_FILE = path.join(__dirname, 'data.json');
const app = express();
app.use(express.static(__dirname));
// Проксируем data.json для dashboard
app.get('/dashboard/data.json', (req, res) => {
  res.sendFile(DATA_FILE);
});

// --- Локальная база ---
let db = { users: {} };
if (fs.existsSync(DATA_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

// --- TikTok-Live-Connector ---
const tiktokUsername = process.env.TIKTOK_USERNAME || 'digital.n0mad';
const connector = new WebcastPushConnection(tiktokUsername);

connector.connect().then(state => {
  console.log(`Connected to TikTok live as @${tiktokUsername}`);
}).catch(err => {
  console.error('Failed to connect:', err);
});

connector.on('like', data => {
  const userId = data.userId;
  const nickname = data.uniqueId || data.nickname || 'Anonymous';
  const avatar = data.profilePictureUrl || '';
  const count = data.likeCount || 1;
  if (!db.users[userId]) {
    db.users[userId] = { nickname, avatar, likes: 0 };
  } else {
    // Обновляем ник и аватар если вдруг поменялись
    db.users[userId].nickname = nickname;
    db.users[userId].avatar = avatar;
  }
  db.users[userId].likes += count;
  saveDB();
});

// --- API для фронта ---
app.get('/api/stats', (req, res) => {
  const users = Object.entries(db.users).map(([userId, u]) => ({ userId, ...u }));
  users.sort((a, b) => b.likes - a.likes);
  const leaderboard = users.slice(0, 5);
  const totalLikes = users.reduce((sum, u) => sum + u.likes, 0);
  const totalMiners = users.length;
  res.json({ totalLikes, totalMiners, leaderboard });
});

// --- Админ просмотр всей базы ---
app.get('/db', (req, res) => {
  res.json(db);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
