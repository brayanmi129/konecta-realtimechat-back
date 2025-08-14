const { createUserS, uploadFile } = require("../services/chatService");

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

async function uploadHandler(req, res) {
  console.log("Holaaaa");
  try {
    const fileUrl = await uploadFile(req.file);
    res.status(200).json({ url: fileUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al subir el archivo" });
  }
}

module.exports = { createUserC, uploadHandler };
