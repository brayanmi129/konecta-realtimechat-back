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
      await putConectUserS(socket.user);

      const onlineUsers = await getConnectedUsersS();
      const groupChats = await getGroupChatsForUser(socket.user.id);
      console.log(`Chats grupales encontrados para ${socket.user.id}:`, groupChats);
      socket.join(`user_${socket.user.id}`);
      io.emit("onlineUsers", onlineUsers);
      io.emit("groups", groupChats);
    });

    // Obtener mensajes privados
    socket.on("getMessages", async (ids, callback) => {
      const { chatId, messages } = await getOrCreatePrivateChatMessages(
        ids.currentUserId,
        ids.otherUserId
      );
      const chatInfo = {
        messages: messages,
        chatId: chatId,
      };
      callback(chatInfo);
    });

    socket.on("getMessagesGroup", async (chat, callback) => {
      const { messages } = await getOrCreateGroupChatMessages(chat.id);
      const chatInfo = {
        messages: messages,
        chatId: chat.id,
      };
      callback(chatInfo);
    });

    // Unirse a sala
    socket.on("joinChat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`Socket ${socket.id} se unió a chat_${chatId}`);
    });

    // Salir de sala (💥 lo que te faltaba)
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

    socket.on("createGroup", async (data) => {
      console.log("Creandoooo");
      try {
        // 1. Insertar en tabla Chats
        // Añadir el creador al array de usuarios si no está ya incluido
        const users = Array.isArray(data.users) ? [...data.users] : [];
        if (!users.includes(data.creator)) {
          users.push(data.creator);
        }
        const chatId = await createGroupChat({
          name: data.name,
          users: users,
        });

        const groupChats = await getGroupChatsForUser(data.creator);
        io.emit("groups", groupChats);
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
