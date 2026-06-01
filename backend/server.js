// backend/server.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import pool from "./db.js";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "change_this";

app.use(express.json());
app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST"],
  },
});
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("register", (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log("Registered socket for user:", userId);
  });

  socket.on("private message", async ({ to, message }) => {
    try {
      const fromUserId = [...connectedUsers.entries()].find(([, sid]) => sid === socket.id)?.[0];
      if (!fromUserId) return;

      await pool.query(
        "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?,?,?)",
        [fromUserId, to, message]
      );

      const toSocket = connectedUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("private message", { from: fromUserId, to, message });
      }
    } catch (err) {
      console.error("private message error", err);
    }
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of connectedUsers.entries()) {
      if (sid === socket.id) connectedUsers.delete(uid);
    }
    console.log("Socket disconnected:", socket.id);
  });
});

// helpers
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "Missing token" });
  try {
    const token = h.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// --- Routes

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password, can_teach, want_to_learn } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

    const [existing] = await pool.query("SELECT id FROM users WHERE email=?", [email]);
    if (existing.length) return res.status(400).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      "INSERT INTO users (name,email,password_hash,can_teach,want_to_learn) VALUES (?,?,?,?,?)",
      [name, email, hash, JSON.stringify(can_teach || []), JSON.stringify(want_to_learn || [])]
    );
    const token = createToken({ id: r.insertId, email });
    res.json({ token });
  } catch (err) {
    console.error("signup error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
    if (!rows.length) return res.status(400).json({ error: "Invalid credentials" });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });
    const token = createToken({ id: user.id, email });
    res.json({ token });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Me
app.get("/api/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id,name,email,can_teach,want_to_learn FROM users WHERE id=?", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const u = rows[0];
    u.can_teach = JSON.parse(u.can_teach || "[]");
    u.want_to_learn = JSON.parse(u.want_to_learn || "[]");
    res.json({ user: u });
  } catch (err) {
    console.error("me error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update profile -> triggers matchmaking
app.post("/api/profile", auth, async (req, res) => {
  try {
    const { can_teach, want_to_learn } = req.body;
    await pool.query("UPDATE users SET can_teach=?, want_to_learn=? WHERE id=?", [
      JSON.stringify(can_teach || []),
      JSON.stringify(want_to_learn || []),
      req.user.id,
    ]);
    await findAndNotifyMatches(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("profile update error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Return matched partners ONLY (so users list shows matches, not every user)
app.get("/api/matchspartners", auth, async (req, res) => {
  try {
    const [[me]] = await pool.query("SELECT id, can_teach, want_to_learn, name FROM users WHERE id=?", [req.user.id]);
    const myTeach = JSON.parse(me.can_teach || "[]");
    const myLearn = JSON.parse(me.want_to_learn || "[]");

    const [others] = await pool.query("SELECT id,name,can_teach,want_to_learn FROM users WHERE id!=?", [req.user.id]);

    const partners = [];
    for (const o of others) {
      const otherTeach = JSON.parse(o.can_teach || "[]");
      const otherLearn = JSON.parse(o.want_to_learn || "[]");
      const teachMatch = myLearn.some(s => otherTeach.includes(s));
      const learnMatch = myTeach.some(s => otherLearn.includes(s));
      if (teachMatch && learnMatch) partners.push({ id: o.id, name: o.name });
    }
    res.json({ partners });
  } catch (err) {
    console.error("matchspartners error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Messages (chat history)
app.get("/api/messages/:otherId", auth, async (req, res) => {
  try {
    const otherId = req.params.otherId;
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM messages m JOIN users u ON m.sender_id=u.id
       WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
       ORDER BY m.created_at ASC`,
      [req.user.id, otherId, otherId, req.user.id]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error("messages error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Notifications list (history)
app.get("/api/notifications", auth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC", [req.user.id]);
    res.json({ notifications: rows });
  } catch (err) {
    console.error("notifications error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Progress for user
app.get("/api/progress/:userId", auth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT skill,progress,meeting_link FROM progress WHERE user_id=?", [req.params.userId]);
    res.json({ progress: rows });
  } catch (err) {
    console.error("progress get error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Meeting endpoint (requires a partner) --> increments progress for BOTH participants by 5%
// Request body: { skill, meeting_link, partnerId }
app.post("/api/meeting", auth, async (req, res) => {
  try {
    const { skill, meeting_link, partnerId } = req.body;
    const organizer = req.user.id;
    if (!skill || !meeting_link || !partnerId) return res.status(400).json({ error: "Missing fields" });

    // record meeting event
    await pool.query("INSERT INTO meetings (skill, organizer_id, partner_id, meeting_link) VALUES (?,?,?,?)", [skill, organizer, partnerId, meeting_link]);

    // ensure progress rows exist for both users (create if not exists)
    await pool.query("INSERT INTO progress (user_id,skill,progress,meeting_link) VALUES (?,?,0,?) ON DUPLICATE KEY UPDATE meeting_link=VALUES(meeting_link)", [organizer, skill, meeting_link]);
    await pool.query("INSERT INTO progress (user_id,skill,progress,meeting_link) VALUES (?,?,0,?) ON DUPLICATE KEY UPDATE meeting_link=VALUES(meeting_link)", [partnerId, skill, meeting_link]);

    // increase progress by 5 for both (cap 100)
    await pool.query("UPDATE progress SET progress = LEAST(progress + 5, 100), meeting_link=? WHERE user_id=? AND skill=?", [meeting_link, organizer, skill]);
    await pool.query("UPDATE progress SET progress = LEAST(progress + 5, 100), meeting_link=? WHERE user_id=? AND skill=?", [meeting_link, partnerId, skill]);

    res.json({ success: true });
  } catch (err) {
    console.error("meeting error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Matchmaking logic: creates notifications + progress rows + emits socket events
// --- Matchmaking logic: creates notifications + progress rows + emits socket events
async function findAndNotifyMatches(userId) {
  try {
    console.log("🔍 Running matchmaking for user:", userId);

    // Fetch the current user
    const [[me]] = await pool.query(
      "SELECT id, name, can_teach, want_to_learn FROM users WHERE id = ?",
      [userId]
    );
    if (!me) return;

    const myTeach = JSON.parse(me.can_teach || "[]");
    const myLearn = JSON.parse(me.want_to_learn || "[]");

    // Fetch all other users
    const [others] = await pool.query(
      "SELECT id, name, can_teach, want_to_learn FROM users WHERE id != ?",
      [userId]
    );

    for (const other of others) {
      const otherTeach = JSON.parse(other.can_teach || "[]");
      const otherLearn = JSON.parse(other.want_to_learn || "[]");

      // Determine mutual skill matches
      const teachMatch = myLearn.some((skill) => otherTeach.includes(skill));
      const learnMatch = myTeach.some((skill) => otherLearn.includes(skill));

      if (teachMatch && learnMatch) {
        const skillA = myLearn.find((s) => otherTeach.includes(s)); // what current user learns
        const skillB = otherLearn.find((s) => myTeach.includes(s)); // what other user learns

        console.log(
          `✅ Match found between ${me.name} and ${other.name} (skills: ${skillA} / ${skillB})`
        );

        // 🔔 Add notifications for both users
        await pool.query(
          "INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)",
          [
            userId,
            "match",
            JSON.stringify({ partnerName: other.name, skill: skillA }),
          ]
        );

        await pool.query(
          "INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)",
          [
            other.id,
            "match",
            JSON.stringify({ partnerName: me.name, skill: skillB }),
          ]
        );

        // 🧠 Ensure progress row exists for both users (start from 0)
        if (skillA) {
          await pool.query(
            "INSERT INTO progress (user_id, skill, progress) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE progress = progress",
            [userId, skillA]
          );
        }

        if (skillB) {
          await pool.query(
            "INSERT INTO progress (user_id, skill, progress) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE progress = progress",
            [other.id, skillB]
          );
        }

        // ⚡ Realtime Socket notifications
        const socket1 = connectedUsers.get(userId);
        const socket2 = connectedUsers.get(other.id);

        if (socket1) {
          io.to(socket1).emit("notification", {
            type: "match",
            payload: { partnerName: other.name, skill: skillA },
          });
        }

        if (socket2) {
          io.to(socket2).emit("notification", {
            type: "match",
            payload: { partnerName: me.name, skill: skillB },
          });
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in findAndNotifyMatches:", err);
  }
}


// Serve static frontend
app.use(express.static(path.join(__dirname, "../frontend")));
server.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
