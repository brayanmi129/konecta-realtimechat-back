//services/chatservice.js
const { getConnection, sql } = require("../config/db");
const crypto = require("crypto");
const { containerClient } = require("../config/storage");
const SAS_TOKEN = process.env.SAS_TOKEN;

const createUserS = async (nombre) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar, nombre) // 👈 string explícito
    .query("INSERT INTO KonectaUsuarios (nombre) OUTPUT inserted.* VALUES (@nombre)");

  const usuario_id = result.recordset[0].id;

  await pool
    .request()
    .input("usuario_id", sql.Int, usuario_id) // 👈 int explícito
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

// 🔹 Obtener chats grupales de un usuario
const getGroupChatsForUserS = async (userId) => {
  const pool = await getConnection();
  const result = await pool.request().input("usuario_id", sql.Int, userId) // 👈
    .query(`
      SELECT c.id, c.nombre
      FROM Chats c
      INNER JOIN ChatUsuarios cu ON c.id = cu.chat_id
      WHERE cu.usuario_id = @usuario_id AND c.tipo = 'grupal'
    `);
  return result.recordset;
};

const getPrivateChatsForUserS = async (userId) => {
  const pool = await getConnection();
  const result = await pool.request().input("usuario_id", sql.Int, userId) // 👈
    .query(`
      SELECT 
        c.id AS chatId,
        cu2.usuario_id AS participantId,
        k.nombre AS participantNombre,
        co.estado AS participantEstado,
        COUNT(CASE WHEN ml.leido = 0 THEN 1 END) AS mensajesNoLeidos,
        MAX(m.creado) AS ultimoMensaje
      FROM Chats c
      INNER JOIN ChatUsuarios cu1 
        ON c.id = cu1.chat_id AND cu1.usuario_id = @usuario_id
      INNER JOIN ChatUsuarios cu2 
        ON c.id = cu2.chat_id AND cu2.usuario_id != @usuario_id
      INNER JOIN KonectaUsuarios k 
        ON k.id = cu2.usuario_id
      LEFT JOIN Conexiones co 
        ON co.usuario_id = cu2.usuario_id
      LEFT JOIN Mensajes m 
        ON c.id = m.chat_id
      LEFT JOIN MensajesLeidos ml 
        ON ml.mensaje_id = m.id AND ml.usuario_id = @usuario_id
      WHERE c.tipo = 'privado'
      GROUP BY c.id, cu2.usuario_id, k.nombre, co.estado
      ORDER BY MAX(m.creado) DESC
    `);

  const chatsMap = {};
  result.recordset.forEach((row) => {
    if (!chatsMap[row.chatId]) {
      chatsMap[row.chatId] = {
        chatId: row.chatId,
        participants: [
          {
            id: row.participantId,
            nombre: row.participantNombre,
            estado: row.participantEstado || "desconectado",
          },
        ],
        mensajesNoLeidos: row.mensajesNoLeidos,
        ultimoMensaje: row.ultimoMensaje,
      };
    }
  });

  return Object.values(chatsMap);
};

const usersInChatS = async (chat_id) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().input("chat_id", sql.Int, chat_id) // 👈
      .query(`
        SELECT usuario_id 
        FROM ChatUsuarios
        WHERE chat_id = @chat_id
      `);
    return result.recordset;
  } catch (error) {
    console.error("Error al obtener usuarios en el chat:", error);
    return [];
  }
};

const putConectUserS = async (user) => {
  const pool = await getConnection();
  try {
    await pool
      .request()
      .input("id", sql.Int, user.id) // 👈
      .query("UPDATE Conexiones SET estado = 'conectado' WHERE usuario_id = @id");
    console.log(`Usuario ${user.nombre} registrado como conectado en la DB`);
  } catch (error) {
    console.error("Error al actualizar estado de conexión:", error);
  }
};

async function getOrCreatePrivateChatMessages(currentUserId, otherUserId) {
  try {
    const pool = await getConnection();
    let result = await pool
      .request()
      .input("currentUserId", sql.Int, currentUserId) // 👈
      .input("otherUserId", sql.Int, otherUserId) // 👈
      .query(`
        SELECT c.id
        FROM Chats c
        INNER JOIN ChatUsuarios cu1 ON c.id = cu1.chat_id AND cu1.usuario_id = @currentUserId
        INNER JOIN ChatUsuarios cu2 ON c.id = cu2.chat_id AND cu2.usuario_id = @otherUserId
        WHERE c.tipo = 'privado'
      `);

    let chatId;
    if (result.recordset.length > 0) {
      chatId = result.recordset[0].id;
    } else {
      const insertChat = await pool
        .request()
        .input("tipo", sql.NVarChar, "privado") // 👈
        .query(`INSERT INTO Chats (tipo) OUTPUT INSERTED.id VALUES (@tipo)`);
      chatId = insertChat.recordset[0].id;
      await pool
        .request()
        .input("chatId", sql.Int, chatId)
        .input("user1", sql.Int, currentUserId)
        .input("user2", sql.Int, otherUserId).query(`
          INSERT INTO ChatUsuarios (chat_id, usuario_id) VALUES (@chatId, @user1);
          INSERT INTO ChatUsuarios (chat_id, usuario_id) VALUES (@chatId, @user2);
        `);
    }

    const messages = await pool.request().input("chatId", sql.Int, chatId) // 👈
      .query(`
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

    return { chatId, messages: messages.recordset };
  } catch (error) {
    console.error("Error getting or creating chat messages:", error);
    return { chatId: null, messages: [] };
  }
}

async function getOrCreateGroupChatMessages(chatId) {
  const pool = await getConnection();
  const chatResult = await pool.request().input("chatId", sql.Int, chatId) // 👈
    .query(`
      SELECT id, nombre, tipo, creado
      FROM Chats
      WHERE id = @chatId AND tipo = 'grupal'
    `);

  if (chatResult.recordset.length === 0) {
    throw new Error("El chat grupal no existe");
  }

  const chatInfo = chatResult.recordset[0];
  const messagesResult = await pool.request().input("chatId", sql.Int, chatId) // 👈
    .query(`
      SELECT 
        m.id,
        m.chat_id,
        m.usuario_id,
        u.nombre AS usuario_nombre,
        m.contenido,
        m.archivo_url,
        m.archivo_tipo,
        m.archivo_nombre,
        m.creado
      FROM Mensajes m
      INNER JOIN KonectaUsuarios u ON m.usuario_id = u.id
      WHERE m.chat_id = @chatId
      ORDER BY m.creado ASC
    `);

  return {
    chat: chatInfo,
    messages: messagesResult.recordset,
  };
}

const sendMessageS = async (newMessage) => {
  try {
    const pool = await getConnection();

    // 1️⃣ Insertar el mensaje
    const result = await pool
      .request()
      .input("chat_id", sql.Int, newMessage.chat_id) // 👈
      .input("usuario_id", sql.Int, newMessage.usuario_id) // 👈
      .input("contenido", sql.NVarChar, newMessage.contenido)
      .input("archivo_url", sql.NVarChar, newMessage.archivo_url)
      .input("archivo_tipo", sql.NVarChar, newMessage.archivo_tipo)
      .input("archivo_nombre", sql.NVarChar, newMessage.archivo_nombre).query(`
        INSERT INTO Mensajes (chat_id, usuario_id, contenido, archivo_url, archivo_tipo, archivo_nombre)
        OUTPUT INSERTED.*
        VALUES (@chat_id, @usuario_id, @contenido, @archivo_url, @archivo_tipo, @archivo_nombre)
      `);

    const savedMessage = result.recordset[0];

    // 2️⃣ Usuarios del chat (menos el remitente)
    const chatUsersResult = await pool
      .request()
      .input("chat_id", sql.Int, newMessage.chat_id)
      .input("usuario_id", sql.Int, newMessage.usuario_id).query(`
        SELECT usuario_id 
        FROM ChatUsuarios 
        WHERE chat_id = @chat_id AND usuario_id != @usuario_id
      `);

    // 3️⃣ Insertar en MensajesLeidos
    for (const user of chatUsersResult.recordset) {
      await pool
        .request()
        .input("mensaje_id", sql.Int, savedMessage.id) // 👈
        .input("usuario_id", sql.Int, user.usuario_id) // 👈
        .query(`
          INSERT INTO MensajesLeidos (mensaje_id, usuario_id, leido)
          VALUES (@mensaje_id, @usuario_id, 0);
        `);
    }

    return savedMessage;
  } catch (error) {
    console.error("Error guardando mensaje:", error);
    return null;
  }
};

const desconectUserS = async (id) => {
  const pool = await getConnection();
  await pool
    .request()
    .input("id", sql.Int, id) // 👈
    .query("UPDATE Conexiones SET estado = 'desconectado' WHERE usuario_id = @id");
  console.log(`Usuario ${id} registrado como desconectado en la DB`);
};

async function createGroupChat({ name, users }) {
  const pool = await getConnection();
  const chatResult = await pool
    .request()
    .input("nombre", sql.NVarChar, name)
    .input("tipo", sql.NVarChar, "grupal").query(`
      INSERT INTO Chats (nombre, tipo)
      OUTPUT INSERTED.id
      VALUES (@nombre, @tipo)
    `);

  const chatId = chatResult.recordset[0].id;
  for (const userId of users) {
    await pool.request().input("chat_id", sql.Int, chatId).input("usuario_id", sql.Int, userId) // 👈
      .query(`
        INSERT INTO ChatUsuarios (chat_id, usuario_id)
        VALUES (@chat_id, @usuario_id)
      `);
  }

  return chatId;
}

async function uploadFile(file) {
  try {
    if (!file) {
      throw new Error("No se recibió ningún archivo");
    }
    const randomName = crypto.randomUUID();
    const fileExtension = file.originalname.split(".").pop();
    const blobName = `${randomName}.${fileExtension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return `${blockBlobClient.url}${SAS_TOKEN || ""}`;
  } catch (error) {
    console.error("Error al subir el archivo a Azure Storage:", error);
    throw error;
  }
}

async function markMessagesAsRead(chatId, userId) {
  const pool = await getConnection();
  try {
    console.log("markMessagesAsRead params:", {
      chatId,
      userId,
      chatIdType: typeof chatId,
      userIdType: typeof userId,
    });
    await pool.request().input("chatId", sql.Int, chatId).input("userId", sql.Int, userId).query(`
 UPDATE ml
        SET ml.leido = 1
        FROM MensajesLeidos ml
        INNER JOIN Mensajes m ON ml.mensaje_id = m.id
        WHERE m.chat_id = @chatId AND ml.usuario_id = @userId
      `);

    return { success: true };
  } catch (error) {
    console.error("Error marcando mensajes como leídos:", error);
    return { success: false, error };
  }
}

module.exports = {
  createUserS,
  getConnectedUsersS,
  desconectUserS,
  putConectUserS,
  getOrCreatePrivateChatMessages,
  sendMessageS,
  createGroupChat,
  getGroupChatsForUserS,
  getOrCreateGroupChatMessages,
  uploadFile,
  getPrivateChatsForUserS,
  usersInChatS,
  markMessagesAsRead,
};
