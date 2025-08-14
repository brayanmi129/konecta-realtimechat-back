const controllers = require("../controllers/chatControler.js");
const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer();

router.post("/user", controllers.createUserC);
router.post("/uploadMedia", upload.single("file"), controllers.uploadHandler);

module.exports = router;
