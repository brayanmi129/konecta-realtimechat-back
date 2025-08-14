const { getConnection } = require("../config/db");

const createUserS = async (nombre) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("nombre", nombre)
    .query("INSERT INTO KonectaUsuarios (nombre) OUTPUT inserted.* VALUES (@nombre)");

  return result.recordset[0];
};

const getConnectedUsersS = async () => {
  const pool = await getConnection();
  const result = await pool.request().query("SELECT * FROM Conexiones WHERE estado = 'conectado'");

  return result.recordset;
};

module.exports = { createUserS, getConnectedUsersS };
