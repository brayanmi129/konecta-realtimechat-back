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
} = require("../services/chatService");

const userLastPing = {};

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

      // Obtener chats privados y grupales del usuario
      const privateChats = await getPrivateChatsForUserS(socket.user.id);
      const groupChats = await getGroupChatsForUserS(socket.user.id);

      console.log(`Chats privados para ${socket.user.id}:`, privateChats[0]);
      console.log(`Chats grupales para ${socket.user.id}:`, groupChats);

      // Enviar al usuario logueado
      io.to(`user_${socket.user.id}`).emit("privateChats", privateChats);
      io.to(`user_${socket.user.id}`).emit("groupChats", groupChats);
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
      // 🔔 Notificación para todos menos el remitente
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
          const userGroupChats = await getGroupChatsForUserS(userId);
          io.to(`user_${userId}`).emit("groups", userGroupChats);
        }
      } catch (err) {
        console.error("Error creando grupo:", err);
      }
    });

    socket.on("pingServer", () => {
      if (socket.user) {
        userLastPing[socket.user.id] = Date.now();
      }
      // Respuesta al cliente
      socket.emit("pongServer");
    });

    // Revisión periódica de inactividad
    setInterval(async () => {
      const now = Date.now();
      for (const userId in userLastPing) {
        if (now - userLastPing[userId] > 20000) {
          // 20 segundos sin ping
          console.log(`Usuario ${userId} inactivo, marcando como desconectado`);
          await desconectUserS({ id: userId });
          delete userLastPing[userId];
          const onlineUsers = await getConnectedUsersS();
          io.emit("onlineUsers", onlineUsers);
        }
      }
    }, 5000);

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
