const express = require("express");
const app = express();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const routes = require("./routers/routes.js");
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

require("./sockets/websocket.js")(io);

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

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
