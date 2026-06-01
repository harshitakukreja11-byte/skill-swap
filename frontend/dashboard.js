// frontend/dashboard.js — final stable version (Nov 2025)
(async function () {
  const socket = io("http://localhost:5001", {
    auth: { token: window.getToken() },
  });

  // DOM Elements
  const hello = document.getElementById("hello");
  const logoutBtn = document.getElementById("logoutBtn");
  const notifBtn = document.getElementById("notifBtn");
  const notifCount = document.getElementById("notifCount");
  const notificationsPanel = document.getElementById("notificationsPanel");
  const notificationsList = document.getElementById("notificationsList");
  const closeNotif = document.getElementById("closeNotif");
  const usersList = document.getElementById("usersList");
  const chatWindow = document.getElementById("chatWindow");
  const pmForm = document.getElementById("pmForm");
  const pmInput = document.getElementById("pmInput");
  const progressList = document.getElementById("progressList");
  const refreshBtn = document.getElementById("refreshBtn");
  const meetingForm = document.getElementById("meetingForm");
  const profileForm = document.getElementById("profileForm");

  let me = null;
  let currentChatUserId = null;
  let currentChatUserName = "";

  // --- small helper toast (for refresh / success messages)
  function showTempMessage(text, ms = 1600) {
    const toast = document.createElement("div");
    toast.textContent = text;
    Object.assign(toast.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      background: "rgba(0,0,0,0.75)",
      color: "white",
      padding: "10px 14px",
      borderRadius: "10px",
      fontFamily: "Poppins, sans-serif",
      zIndex: 9999,
      fontSize: "0.9rem",
      boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), ms);
  }

  // --- escape html helper
  function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/[&<>"']/g, (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[s])
    );
  }

  function safeJSON(str) {
    try {
      return typeof str === "string" ? JSON.parse(str) : str;
    } catch {
      return {};
    }
  }

  // --- load current user
  try {
    const meData = await window.authFetch("http://localhost:5001/api/me");
    me = meData.user;
    hello.textContent = `Hello, ${me.name}`;
    socket.emit("register", me.id);
  } catch (err) {
    alert("Session expired. Please login again.");
    window.location.href = "login.html";
    return;
  }

  // --- load matched partners
  async function loadUsers() {
    try {
      const res = await fetch("http://localhost:5001/api/matchspartners", {
        headers: { Authorization: "Bearer " + window.getToken() },
      });
      if (!res.ok) throw new Error("Users fetch failed");
      const data = await res.json();
      const partners = data.partners || [];
      if (!partners.length) {
        usersList.innerHTML = "<p class='small'>No matches yet</p>";
        return;
      }
      usersList.innerHTML = partners
        .map(
          (u) =>
            `<div class="user-item" data-id="${u.id}" data-name="${u.name}">💬 ${u.name}</div>`
        )
        .join("");
      document.querySelectorAll(".user-item").forEach((el) => {
        el.addEventListener("click", async () => {
          currentChatUserId = parseInt(el.dataset.id);
          currentChatUserName = el.dataset.name;
          await loadMessages(currentChatUserId);
        });
      });
    } catch (err) {
      console.error("loadUsers error:", err);
      usersList.innerHTML =
        "<p class='small' style='color:#b00;'>Failed to load users.</p>";
    }
  }

  // --- load chat messages
  async function loadMessages(otherId) {
    if (!otherId) return;
    chatWindow.innerHTML = `<p class='small'>Loading chat with ${currentChatUserName}...</p>`;
    try {
      const res = await fetch(
        `http://localhost:5001/api/messages/${otherId}`,
        { headers: { Authorization: "Bearer " + window.getToken() } }
      );
      if (!res.ok) throw new Error("Message fetch failed");
      const data = await res.json();
      const messages = data.messages || [];
      if (!messages.length) {
        chatWindow.innerHTML = `<p class='small'>No messages yet with ${currentChatUserName}. Say hi 👋</p>`;
        return;
      }
      chatWindow.innerHTML = messages
        .map((m) => {
          const mine = m.sender_id === me.id;
          return `<div class="message ${
            mine ? "from-me" : "from-other"
          }"><b>${m.sender_name}</b><br>${escapeHtml(
            m.message
          )}<br><small>${new Date(m.created_at).toLocaleTimeString()}</small></div>`;
        })
        .join("");
      chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (err) {
      console.error("loadMessages error:", err);
      chatWindow.innerHTML = "<p class='small'>Failed to load messages.</p>";
    }
  }

  // --- send chat message
  pmForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = pmInput.value.trim();
    if (!msg) return;
    if (!currentChatUserId)
      return alert("Select a matched user from the left to chat.");
    socket.emit("private message", { to: currentChatUserId, message: msg });
    const div = document.createElement("div");
    div.className = "message from-me";
    div.innerHTML = `<b>${me.name}</b><br>${escapeHtml(
      msg
    )}<br><small>${new Date().toLocaleTimeString()}</small>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    pmInput.value = "";
  });

  socket.on("private message", async (data) => {
    if (
      currentChatUserId &&
      (data.from === currentChatUserId || data.to === currentChatUserId)
    ) {
      await loadMessages(currentChatUserId);
    }
  });

  // --- notifications
  notifBtn.addEventListener("click", async () => {
    notificationsPanel.style.display = "block";
    await loadNotifications();
  });
  closeNotif.addEventListener(
    "click",
    () => (notificationsPanel.style.display = "none")
  );

  async function loadNotifications() {
    try {
      const res = await fetch("http://localhost:5001/api/notifications", {
        headers: { Authorization: "Bearer " + window.getToken() },
      });
      if (!res.ok)
        throw new Error("Notifications fetch failed: " + res.status);
      const data = await res.json();
      const rows = data.notifications || [];
      notifCount.textContent = rows.length;

      if (!rows.length) {
        notificationsList.innerHTML =
          "<p class='small'>No notifications yet.</p>";
        return;
      }

      notificationsList.innerHTML = rows
        .map((n) => {
          const p = safeJSON(n.payload || "{}");
          return `
            <div class="panel" style="margin-bottom:8px;">
              <div><b>${n.type}</b> ${
            p.partnerName ? "— " + p.partnerName : ""
          }</div>
              <div style="font-size:0.9rem;color:#444;">${
                p.skill ? "Skill: " + p.skill : ""
              }</div>
              <div style="font-size:0.8rem;color:#666;margin-top:4px;">
                ${new Date(n.created_at).toLocaleString()}
              </div>
            </div>`;
        })
        .join("");
    } catch (err) {
      console.error("loadNotifications error:", err);
      notificationsList.innerHTML =
        "<p class='small' style='color:#b00;'>Failed to load notifications.</p>";
    }
  }

  socket.on("notification", async (n) => {
    console.log("Realtime notification:", n);
    if (n && n.type === "match") {
      showTempMessage(
        `🎉 New match: ${n.payload.partnerName} — ${n.payload.skill}`,
        2000
      );
      await loadNotifications();
      await loadProgress();
    }
  });

  // --- load progress
  async function loadProgress() {
    try {
      const res = await fetch(
        `http://localhost:5001/api/progress/${me.id}`,
        { headers: { Authorization: "Bearer " + window.getToken() } }
      );
      if (!res.ok) throw new Error("Progress fetch failed");
      const data = await res.json();
      const rows = data.progress || [];
      if (!rows.length) {
        progressList.innerHTML =
          "<p class='small'>No tracked skills yet. Get matched to start tracking.</p>";
        return;
      }
      progressList.innerHTML = rows
        .map((p) => {
          const linkHtml = p.meeting_link
            ? `<div style="margin-top:6px;"><a href="${escapeHtml(
                p.meeting_link
              )}" target="_blank">Last meeting</a></div>`
            : "";
          return `<div class="progress-item">
            <b>${escapeHtml(p.skill)}</b>
            <div class="bar"><div class="bar-fill" style="width:${
              p.progress
            }%"></div></div>
            <small>${p.progress}%</small>${linkHtml}</div>`;
        })
        .join("");
    } catch (err) {
      console.error("loadProgress error:", err);
      progressList.innerHTML = "<p class='small'>Failed to load progress.</p>";
    }
  }

  // --- meeting form (adds +5% progress for both matched users)
  meetingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const skill = document.getElementById("meetingSkill").value.trim();
    const meeting_link = document.getElementById("meetingLink").value.trim();
    if (!skill || !meeting_link)
      return alert("Enter skill name and meeting link.");
    if (!currentChatUserId)
      return alert("Select a matched partner from the left before adding.");
    try {
      const res = await fetch("http://localhost:5001/api/meeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + window.getToken(),
        },
        body: JSON.stringify({
          skill,
          meeting_link,
          partnerId: currentChatUserId,
        }),
      });
      if (!res.ok) throw new Error("Meeting link add failed");
      showTempMessage("Meeting added — progress +5%", 2000);
      document.getElementById("meetingSkill").value = "";
      document.getElementById("meetingLink").value = "";
      await loadProgress();
    } catch (err) {
      console.error("meeting error:", err);
      alert("Failed to add meeting link");
    }
  });

  // --- profile update (teach/learn)
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const can_teach = document
      .getElementById("profileTeach")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const want_to_learn = document
      .getElementById("profileLearn")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!can_teach.length && !want_to_learn.length)
      return alert("Enter at least one skill.");
    try {
      const res = await fetch("http://localhost:5001/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + window.getToken(),
        },
        body: JSON.stringify({ can_teach, want_to_learn }),
      });
      if (!res.ok) throw new Error("Profile save failed");
      showTempMessage("Profile saved — matchmaking updated", 1800);
      await loadUsers();
      await loadNotifications();
    } catch (err) {
      console.error("profile error:", err);
      alert("Failed to save profile");
    }
  });

  // --- refresh button (stable & independent)
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      console.log("🔄 Refresh clicked");
      const loaders = [
        loadUsers().catch((err) => console.error("loadUsers failed:", err)),
        loadProgress().catch((err) =>
          console.error("loadProgress failed:", err)
        ),
        loadNotifications().catch((err) =>
          console.error("loadNotifications failed:", err)
        ),
      ];
      await Promise.all(loaders);
      showTempMessage("Dashboard refreshed");
    });
  }

  // --- logout
  logoutBtn.addEventListener("click", () => {
    window.setToken(null);
    window.location.href = "login.html";
  });

  // initial load
  await loadUsers();
  await loadProgress();
  await loadNotifications();
})();
