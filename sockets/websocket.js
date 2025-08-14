// /sockets/index.js
const {
  getConnectedUsersS,
  desconectUserS,
  putConectUserS,
  getOrCreatePrivateChatMessages,
  sendMessageS,
  createGroupChat,
  getGroupChatsForUser,
  getOrCreateGroupChatMessages,
} = require("../services/chatService");

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("Usuario conectado:", socket.id);

    // Login
    socket.on("login", async (userData) => {
      socket.user = userData;

      // Guardar como conectado
      await putConectUserS(socket.user);

      // Unirse a la sala privada del usuario
      socket.join(`user_${socket.user.id}`);

      // Enviar lista de usuarios online
      const onlineUsers = await getConnectedUsersS();
      io.emit("onlineUsers", onlineUsers);

      // Enviar SOLO al usuario logueado sus grupos
      const groupChats = await getGroupChatsForUser(socket.user.id);
      console.log(`Chats grupales para ${socket.user.id}:`, groupChats);
      io.to(`user_${socket.user.id}`).emit("groups", groupChats);
    });

    socket.on("pingServer", () => {
      console.log("pong");
      socket.emit("pongServer");
    });

    // Obtener mensajes privados
    socket.on("getMessages", async (ids, callback) => {
      const { chatId, messages } = await getOrCreatePrivateChatMessages(
        ids.currentUserId,
        ids.otherUserId
      );
      callback({ messages, chatId });
    });

    // Obtener mensajes de grupo
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
      io.to(`chat_${newMessage.chat_id}`).emit("messageToChat", savedMessage);
    });

    // Crear grupo
    socket.on("createGroup", async (data) => {
      console.log("Creando grupo...");
      try {
        // Validar lista de usuarios
        const users = Array.isArray(data.users) ? [...data.users] : [];
        if (!users.includes(data.creator)) {
          users.push(data.creator);
        }

        // Crear grupo
        const chatId = await createGroupChat({
          name: data.name,
          users,
        });

        // Enviar grupos actualizados SOLO a los miembros
        for (const userId of users) {
          const userGroupChats = await getGroupChatsForUser(userId);
          io.to(`user_${userId}`).emit("groups", userGroupChats);
        }
      } catch (err) {
        console.error("Error creando grupo:", err);
      }
    });

    // Desconexión
    socket.on("disconnect", async () => {
      console.log("Usuario desconectado:", socket.user);
      if (socket.user) {
        await desconectUserS(socket.user);
        const onlineUsers = await getConnectedUsersS();
        io.emit("onlineUsers", onlineUsers);
      }
    });
  });
};
