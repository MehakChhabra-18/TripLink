const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const app    = require("./app");
const http   = require("http");
const { Server } = require("socket.io");
const { initSocket } = require("./services/socketService");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:      "*",
    methods:     ["GET", "POST"],
    credentials: true,
  },
});

global.io = io;
initSocket(io);

server.listen(PORT, () => {
  console.log(`🚗 TripLink server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌐 EJS frontend: http://localhost:${PORT}`);
});