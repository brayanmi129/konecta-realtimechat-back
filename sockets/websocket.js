// /sockets/index.js
const {
  getConnectedUsersS,
  desconectUserS,
  putConectUserS,
  getOrCreatePrivateChatMessages,
  sendMessageS,
  createGroupChat,
  getGroupChatsForUserS,
  getPrivateChatsForUserS,
  getOrCreateGroupChatMessages,
  usersInChatS,
} = require("../services/chatService");

const userLastPing = {};
const connectedUsers = new Map(); // userId => socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("Usuario conectado:", socket.id);

    // Login
    socket.on("login", async (userData) => {
      socket.user = userData;

      // Guardar en mapa de conectados
      connectedUsers.set(userData.id, socket.id);

      // Guardar como conectado en BD
      await putConectUserS(socket.user);

      // Unirse a sala privada del usuario
      socket.join(`user_${socket.user.id}`);

      // Enviar lista de usuarios online
      const onlineUsers = await getConnectedUsersS();
      io.emit("onlineUsers", onlineUsers);

      // Obtener y enviar chats
      const privateChats = await getPrivateChatsForUserS(socket.user.id);
      const groupChats = await getGroupChatsForUserS(socket.user.id);

      io.to(`user_${socket.user.id}`).emit("privateChats", privateChats);
      io.to(`user_${socket.user.id}`).emit("groupChats", groupChats);
    });

    // Obtener mensajes privados
    socket.on("getMessages", async (ids, callback) => {
      const { chatId, messages, isNewChat } = await getOrCreatePrivateChatMessages(
        ids.currentUserId,
        ids.otherUserId
      );
      callback({ messages, chatId, isNewChat });
    });

    // Obtener mensajes grupales
    socket.on("getMessagesGroup", async (chat, callback) => {
      const { messages } = await getOrCreateGroupChatMessages(chat.id);
      callback({ messages, chatId: chat.id });
    });

    // Unirse a sala
    socket.on("joinChat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`Socket ${socket.id} se unió a chat_${chatId}`);
    });

    // Salir de sala
    socket.on("leaveChat", (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`Socket ${socket.id} salió de chat_${chatId}`);
    });

    // Enviar mensaje
    socket.on("sendMessage", async (newMessage) => {
      console.log("Nuevo mensaje recibido:", newMessage);
      const savedMessage = await sendMessageS(newMessage);
      io.to(`chat_${newMessage.chat_id}`).emit("messageReceived", savedMessage);

      const usersInChat = await usersInChatS(newMessage.chat_id);

      if (!usersInChat) {
        console.error("No se encontraron usuarios para el chat", newMessage.chat_id);
        return;
      }

      for (const { usuario_id } of usersInChat) {
        const socketId = connectedUsers.get(usuario_id);
        if (socketId) {
          const privateChats = await getPrivateChatsForUserS(usuario_id);
          io.to(socketId).emit("privateChats", privateChats);
        }
      }
    });

    // Crear grupo
    socket.on("createGroup", async (data) => {
      console.log("Creando grupo:", data);
      try {
        const users = Array.isArray(data.users) ? [...data.users] : [];
        if (!users.includes(data.creator)) {
          users.push(data.creator);
        }

        const chatId = await createGroupChat({
          name: data.name,
          users,
        });

        for (const userId of users) {
          const userGroupChats = await getGroupChatsForUserS(userId);
          io.to(`user_${userId}`).emit("groupChats", userGroupChats);
        }
      } catch (err) {
        console.error("Error creando grupo:", err);
      }
    });

    // Ping
    socket.on("pingServer", () => {
      if (socket.user) {
        userLastPing[socket.user.id] = Date.now();
      }
      socket.emit("pongServer");
    });

    // Revisar inactividad
    setInterval(async () => {
      const now = Date.now();
      for (const userId in userLastPing) {
        if (now - userLastPing[userId] > 20000) {
          console.log(`Usuario ${userId} inactivo`);
          await desconectUserS({ id: userId });
          delete userLastPing[userId];
          connectedUsers.delete(Number(userId));
          const onlineUsers = await getConnectedUsersS();
          io.emit("onlineUsers", onlineUsers);
        }
      }
    }, 5000);

    // Desconexión
    socket.on("disconnect", async () => {
      if (socket.user) {
        await desconectUserS(socket.user.id);
        connectedUsers.delete(socket.user.id);
        const onlineUsers = await getConnectedUsersS();
        io.emit("onlineUsers", onlineUsers);
      }
    });
  });
};
