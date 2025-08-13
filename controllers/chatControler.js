const { createUserS, getConnectedUsersS } = require("../services/chatService");

const createUserC = async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await createUserS(nombre);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: "error al crear el usuario" });
    console.log(e);
  }
};

module.exports = { createUserC };
