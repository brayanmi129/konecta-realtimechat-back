# Konecta ChatApp - Backend

Backend for a real-time chat application built with **Node.js**, **Express**, and **Socket.IO**.  
Handles real-time user connections, private and group chat messages, and file attachments.

---

## 📋 Client Requirement

The client requires a chat application that enables instant communication between employees,  
facilitating collaboration and problem-solving in real time. The application must be intuitive and easy to use.

---

## ✅ Implemented Features

### 1. User Management
- Login with a **nickname** (no password required).
- Tracks connected users in real time.
- Updates the online user list instantly for all clients.

### 2. Private Messaging
- Send and receive messages between two connected users.
- Messages include sender/receiver, date, and time.
- Retrieve chat history when opening a conversation.

### 3. Group Messaging
- Create chat groups with multiple members.
- Retrieve a user’s group list upon login.
- Send and receive group messages in real time.

### 4. File Support
- Send attachments (e.g., images, PDFs) in messages.

---

## 🛠️ Technologies Used

- **Node.js** + **Express** — Server framework.
- **Socket.IO** — Real-time communication.
- **CORS** — Cross-origin resource sharing.
- **dotenv** — Environment variable management.
- **Docker** — Containerization.

---

## 🚀 Installation and Run

### 1. Clone the repository
```bash
git clone https://github.com/your-username/konecta-realtimechat-back.git
cd konecta-realtimechat-back


konecta-realtimechat-back/
 ├── config/           # Configuration files
 ├── controllers/      # API controllers
 ├── routers/          # Express routes
 ├── services/         # Business logic
 ├── sockets/          # WebSocket logic
 ├── index.js          # Application entry point
 ├── dockerfile        # Docker build configuration
 ├── .dockerignore     # Docker ignore rules
 ├── .gitignore        # Git ignore rules
 ├── package.json      # Dependencies and scripts
 ├── web.config        # IIS/hosting configuration
 └── .env              # Environment variables

