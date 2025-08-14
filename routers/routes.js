const controllers = require("../controllers/chatControler.js");
const express = require("express");
const router = express.Router();

router.post("/user", controllers.createUserC);

module.exports = router;
