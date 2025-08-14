const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");

const routes = require("./routers/routes.js");

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],

    credentials: true,
  })
);

app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("Api is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
