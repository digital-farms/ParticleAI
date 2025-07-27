// Миграция на TikTok-Live-Connector v2.x.x + ES-модули
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLiveConnection } from "tiktok-live-connector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3030;
const DATA_FILE = path.join(__dirname, "data.json");
const app = express();
app.use(express.static(__dirname));
app.get("/dashboard/data.json", (req, res) => {
  res.sendFile(DATA_FILE);
});

let db = { users: {} };
if (fs.existsSync(DATA_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

// --- TikTok-Live-Connector v2 ---
const tiktokUsername = process.env.TIKTOK_USERNAME || "pyon_game";
const connection = new TikTokLiveConnection(tiktokUsername);

connection.connect().then(() => {
  console.log(`Connected to TikTok live as @${tiktokUsername}`);
}).catch(err => {
  console.error("Failed to connect:", err);
});

// --- Периодическое логирование лайков ---
const likeLogState = {};
connection.on("like", event => {
  const userObj = event.user || event;
  const userId = userObj.userId || 'undefined';
  const nickname = userObj.uniqueId || userObj.nickname || "Anonymous";
  const avatar = userObj.profilePicture && Array.isArray(userObj.profilePicture.urls) ? userObj.profilePicture.urls[0] : "";

  const count = event.likeCount || 1;
  if (!db.users[userId]) {
    db.users[userId] = { nickname, avatar, likes: 0, points: 0 };
  } else {
    db.users[userId].nickname = nickname;
    db.users[userId].avatar = avatar;
  }
  db.users[userId].likes += count;
  db.users[userId].points = (db.users[userId].points || 0) + count;
  saveDB();

  let state = likeLogState[userId];
  const now = Date.now();
  if (!state) {
    state = likeLogState[userId] = { lastLikes: db.users[userId].likes, lastLog: now };
  }
  const likesSince = db.users[userId].likes - state.lastLikes;
  const timeSince = now - state.lastLog;
  if (likesSince >= 100 || timeSince > 30000) {
    console.log(`[LIKE] @${nickname}: ${db.users[userId].likes} лайков, + ${db.users[userId].points} поинтов.`);
    state.lastLikes = db.users[userId].likes;
    state.lastLog = now;
  }
});

// --- Подарки ---
connection.on("gift", event => {
  const userObj = event.user || event;
  const userId = userObj.userId || 'undefined';
  const nickname = userObj.uniqueId || userObj.nickname || "Anonymous";
  const avatar = userObj.profilePicture && Array.isArray(userObj.profilePicture.urls) ? userObj.profilePicture.urls[0] : "";
  const giftId = event.giftId;
  const repeatCount = event.repeatCount || 1;
  const giftName = event.giftName || `Gift#${giftId}`;
  if (!db.users[userId]) {
    db.users[userId] = { nickname, avatar, likes: 0, points: 0, giftsSent: 0 };
  } else {
    db.users[userId].nickname = nickname;
    db.users[userId].avatar = avatar;
  }
  db.users[userId].points = (db.users[userId].points || 0) + 1000 * repeatCount;
  db.users[userId].giftsSent = (db.users[userId].giftsSent || 0) + repeatCount;
  saveDB();
  console.log(`[GIFT] @${nickname} отправил подарок '${giftName}' (id:${giftId}) x${repeatCount}. Всего: ${db.users[userId].points} поинтов, ${db.users[userId].giftsSent} подарков.`);
});

// --- Комментарии ---
connection.on("chat", event => {
  const userObj = event.user || event;
  const userId = userObj.userId || 'undefined';
  const nickname = userObj.uniqueId || userObj.nickname || "Anonymous";
  if (!db.users[userId]) {
    db.users[userId] = { nickname, avatar: '', likes: 0, points: 0, comments: 0 };
  }
  db.users[userId].comments = (db.users[userId].comments || 0) + 1;
  db.users[userId].points = (db.users[userId].points || 0) + 100;
  saveDB();
  console.log(`[COMMENT] @${nickname}: ${db.users[userId].comments} комментов, + ${db.users[userId].points} поинтов.`);
});

// --- Репосты ---
connection.on("share", event => {
  const userObj = event.user || event;
  const userId = userObj.userId || 'undefined';
  const nickname = userObj.uniqueId || userObj.nickname || "Anonymous";
  if (!db.users[userId]) {
    db.users[userId] = { nickname, avatar: '', likes: 0, points: 0, shares: 0 };
  }
  db.users[userId].shares = (db.users[userId].shares || 0) + 1;
  db.users[userId].points = (db.users[userId].points || 0) + 300;
  saveDB();
  console.log(`[SHARE] @${nickname}: ${db.users[userId].shares} репостов, + ${db.users[userId].points} поинтов.`);
});

// --- API для фронта ---
app.get("/api/stats", (req, res) => {
  let users = Object.entries(db.users)
    .map(([userId, u]) => ({ userId, ...u }))
    .filter(u => (u.points || 0) > 0 && u.nickname && typeof u.nickname === 'string' && u.nickname.trim() !== '');
  users.sort((a, b) => b.points - a.points);
  const leaderboard = users.slice(0, 5);
  const pointsMined = users.reduce((sum, u) => sum + (u.points || 0), 0);
  const totalMiners = users.length;
  res.json({ pointsMined, totalMiners, leaderboard });
});

// --- Админ просмотр всей базы ---
app.get("/db", (req, res) => {
  res.json(db);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
