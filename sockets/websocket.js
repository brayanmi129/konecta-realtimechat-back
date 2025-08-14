// /sockets/index.js
const {
  getConnectedUsersS,
  desconectUserS,
  putConectUserS,
  getOrCreatePrivateChatMessages,
  sendMessageS,
} = require("../services/chatService");

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("Usuario conectado:", socket.id);

    // Login
    socket.on("login", async (userData) => {
      socket.user = userData;
      await putConectUserS(socket.user);

      const onlineUsers = await getConnectedUsersS();
      io.emit("onlineUsers", onlineUsers);
    });

    // Obtener mensajes
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
