const { getConnection } = require("../config/db");

const createUserS = async (nombre) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("nombre", nombre)
    .query("INSERT INTO KonectaUsuarios (nombre) OUTPUT inserted.* VALUES (@nombre)");

  usuario_id = result.recordset[0].id;

  await pool
    .request()
    .input("usuario_id", usuario_id)
    .query("INSERT INTO Conexiones (usuario_id, estado) VALUES (@usuario_id, 'conectado')");

  return result.recordset[0];
};

const getConnectedUsersS = async () => {
  const pool = await getConnection();
  const result = await pool.request().query(`
    SELECT 
      c.usuario_id AS id,
      k.nombre,
      c.estado
    FROM Conexiones c
    JOIN KonectaUsuarios k ON c.usuario_id = k.id
    WHERE c.estado = 'conectado'
  `);
  return result.recordset;
};

const putConectUserS = async (user) => {
  const pool = await getConnection();
  try {
    await pool
      .request()
      .input("id", user.id)
      .query("UPDATE Conexiones SET estado = 'conectado' WHERE usuario_id = @id");
    console.log(`Usuario ${user.nombre} registrado como conectado en la DB`);
  } catch (error) {
    console.error("Error al actualizar estado de conexión:", error);
  }
};

async function getOrCreatePrivateChatMessages(currentUserId, otherUserId) {
  console.log("Current IDDDDD", currentUserId);
  console.log("Other IDDDDD", otherUserId);
  try {
    const pool = await getConnection();

    // 1️⃣ Buscar chat privado existente entre los dos
    let result = await pool
      .request()
      .input("currentUserId", currentUserId)
      .input("otherUserId", otherUserId).query(`
        SELECT c.id
        FROM Chats c
        INNER JOIN ChatUsuarios cu1 ON c.id = cu1.chat_id AND cu1.usuario_id = @currentUserId
        INNER JOIN ChatUsuarios cu2 ON c.id = cu2.chat_id AND cu2.usuario_id = @otherUserId
        WHERE c.tipo = 'privado'
      `);

    let chatId;
    if (result.recordset.length > 0) {
      chatId = result.recordset[0].id;
      console.log("chat encontrado entre", currentUserId, "y", otherUserId, "con ID:", chatId);
    } else {
      // 2️⃣ Crear chat privado si no existe
      const insertChat = await pool
        .request()
        .input("tipo", "privado")
        .query(`INSERT INTO Chats (tipo) OUTPUT INSERTED.id VALUES (@tipo)`);

      chatId = insertChat.recordset[0].id;
      console.log(
        "El chat no existia entre",
        currentUserId,
        "y",
        otherUserId,
        "Nuevo chat creado con el ID:",
        chatId
      );

      // 3️⃣ Registrar ambos usuarios en ChatUsuarios
      await pool
        .request()
        .input("chatId", chatId)
        .input("user1", currentUserId)
        .input("user2", otherUserId).query(`
          INSERT INTO ChatUsuarios (chat_id, usuario_id) VALUES (@chatId, @user1);
          INSERT INTO ChatUsuarios (chat_id, usuario_id) VALUES (@chatId, @user2);
        `);
    }

    // 4️⃣ Traer mensajes de ese chat
    const messages = await pool.request().input("chatId", chatId).query(`
        SELECT 
          m.id,
          m.chat_id,
          m.usuario_id,
          m.contenido,
          m.archivo_url,
          m.archivo_tipo,
          m.archivo_nombre,
          m.creado,
          u.nombre AS usuario_nombre
        FROM Mensajes m
        INNER JOIN KonectaUsuarios u ON m.usuario_id = u.id
        WHERE m.chat_id = @chatId
        ORDER BY m.creado ASC
      `);

    console.log(messages.recordset);

    return { chatId, messages: messages.recordset };
  } catch (error) {
    console.error("Error getting or creating chat messages:", error);
    return { chatId: null, messages: [] };
  }
}

const sendMessageS = async (newMessage) => {
  try {
    const pool = await getConnection();

    // Insertar mensaje en la base de datos
    const result = await pool
      .request()
      .input("chat_id", newMessage.chat_id)
      .input("usuario_id", newMessage.usuario_id)
      .input("contenido", newMessage.contenido)
      .input("archivo_url", newMessage.archivo_url)
      .input("archivo_tipo", newMessage.archivo_tipo)
      .input("archivo_nombre", newMessage.archivo_nombre).query(`
          INSERT INTO Mensajes (chat_id, usuario_id, contenido, archivo_url, archivo_tipo, archivo_nombre)
          OUTPUT INSERTED.*
          VALUES (@chat_id, @usuario_id, @contenido, @archivo_url, @archivo_tipo, @archivo_nombre)
        `);

    const savedMessage = result.recordset[0];
    return savedMessage;
  } catch (error) {
    console.error("Error guardando mensaje:", error);
  }
};

const desconectUserS = async (user) => {
  const pool = await getConnection();
  await pool
    .request()
    .input("id", user.id)
    .query("UPDATE Conexiones SET estado = 'desconectado' WHERE usuario_id = @id");
  console.log(`Usuario ${user.nombre} registrado como desconectado en la DB`);
};

module.exports = {
  createUserS,
  getConnectedUsersS,
  desconectUserS,
  putConectUserS,
  getOrCreatePrivateChatMessages,
  sendMessageS,
};
