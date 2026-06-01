# 🔄 Skill Swap Platform

A full-stack web application for peer-to-peer skill exchange — connect with others, teach what you know, and learn what you don't.

---

## 📌 About the Project

Skill Swap is a database-driven platform that enables users to exchange skills with each other. Users can list what they can teach and what they want to learn, discover matching peers, swap skills, track progress, and communicate via real-time messaging.

Built as part of my B.Tech Computer Science coursework at **Graphic Era Hill University, Dehradun**.

---

## ✨ Features

- 🔐 JWT-based user authentication (signup / login)
- 👤 User profiles with skills offered and skills wanted
- 🤝 Skill swap requests and matching
- 💬 Real-time messaging with Socket.IO
- 📊 Skill progress tracking
- 🔔 Notifications system
- 🎨 Clean, responsive frontend

---

## 🛠️ Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | HTML, CSS, JavaScript             |
| Backend  | Node.js, Express.js               |
| Database | MySQL                             |
| Auth     | JWT, bcryptjs                     |
| Realtime | Socket.IO                         |
| Config   | dotenv                            |

---

## 📁 Project Structure

```
skill-swap/
├── frontend/
│   ├── index.html        # Landing page
│   ├── login.html        # Login page
│   ├── signup.html       # Signup page
│   ├── dashboard.html    # Main dashboard
│   ├── profile.html      # User profile
│   ├── about.html        # About page
│   ├── style.css         # Global styles
│   ├── index.js
│   ├── login.js
│   ├── signup.js
│   ├── dashboard.js
│   ├── profile.js
│   └── utils.js
└── backend/
    ├── server.js         # Express server & API routes
    ├── db.js             # MySQL connection pool
    ├── database.sql      # Database schema
    ├── package.json
    ├── .env.example      # Environment variable template
    └── .gitignore
```

---

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://www.mysql.com/) v8+

---

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/skill-swap.git
cd skill-swap
```

---

### 2. Set Up the Database

Open MySQL and run:

```bash
mysql -u root -p < backend/database.sql
```

This will create the `skill_swap` database and all required tables.

---

### 3. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Now open `.env` and fill in your actual values:

```env
PORT=5001
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASS=your_mysql_password
DB_NAME=skill_swap
JWT_SECRET=choose_a_strong_random_string
```

---

### 4. Install Dependencies & Start the Server

```bash
cd backend
npm install
npm start
```

The server will start at `http://localhost:5001`

---

### 5. Open the Frontend

Open `frontend/index.html` in your browser — or use VS Code's **Live Server** extension for the best experience.

---

## 🗄️ Database Schema

| Table          | Description                              |
|----------------|------------------------------------------|
| `users`        | User accounts, skills offered/wanted     |
| `swaps`        | Skill swap listings                      |
| `messages`     | Real-time chat messages                  |
| `notifications`| User notifications                       |
| `progress`     | Skill learning progress per user         |

---

## 🔒 Security Notes

- The `.env` file is listed in `.gitignore` — **never commit it**
- Passwords are hashed with `bcryptjs` before storing
- API routes are protected with JWT middleware

---

## 👩‍💻 Author

**Harshita Kukreja**
B.Tech Computer Science — Graphic Era Hill University, Dehradun
- LinkedIn: [linkedin.com/in/harshita-kukreja-b89558351](https://www.linkedin.com/in/harshita-kukreja-b89558351)
- Email: harshitakukreja006@gmail.com

---

## 📄 License

This project is for academic and educational purposes.
