const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 8080;

// Health check endpoint cho deployment platforms
const http = require("http");
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        clients: clients.size,
        rooms: rooms.size,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Tạo WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// Start HTTP server
server.listen(PORT, () => {
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});

// Lưu trữ các kết nối và thông tin user
const clients = new Map();
const rooms = new Map();

console.log(`🚀 WebSocket server started on port ${PORT}`);

// Hàm broadcast message đến tất cả client trong room
function broadcastToRoom(roomId, message, excludeClient = null) {
  if (!rooms.has(roomId)) return;

  const roomClients = rooms.get(roomId);
  roomClients.forEach((clientId) => {
    const client = clients.get(clientId);
    if (
      client &&
      client.ws.readyState === WebSocket.OPEN &&
      client !== excludeClient
    ) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// Hàm gửi danh sách users trong room
function sendRoomUsers(roomId) {
  if (!rooms.has(roomId)) return;

  const roomClients = rooms.get(roomId);
  const users = Array.from(roomClients).map((clientId) => {
    const client = clients.get(clientId);
    return {
      id: client.userId,
      name: client.userName,
      avatar: client.avatar,
    };
  });

  const message = {
    type: "room_users",
    data: { users },
  };

  broadcastToRoom(roomId, message);
}

wss.on("connection", (ws) => {
  const clientId = uuidv4();

  console.log(`➕ Client connected: ${clientId}`);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      const client = clients.get(clientId);

      switch (message.type) {
        case "join":
          // User join với thông tin
          const { userId, userName, avatar, roomId } = message.data;

          clients.set(clientId, {
            ws,
            userId,
            userName,
            avatar,
            roomId,
          });

          // Thêm vào room
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId).add(clientId);

          // Thông báo user joined
          broadcastToRoom(
            roomId,
            {
              type: "user_joined",
              data: {
                user: { id: userId, name: userName, avatar },
                timestamp: new Date().toISOString(),
              },
            },
            client
          );

          // Gửi danh sách users
          sendRoomUsers(roomId);

          // Gửi welcome message
          ws.send(
            JSON.stringify({
              type: "welcome",
              data: {
                message: `Welcome to room ${roomId}!`,
                roomId,
              },
            })
          );

          console.log(`👤 User ${userName} joined room ${roomId}`);
          break;

        case "message":
          // Gửi tin nhắn
          if (!client) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Please join a room first",
              })
            );
            return;
          }

          const chatMessage = {
            type: "message",
            data: {
              id: uuidv4(),
              text: message.data.text,
              user: {
                id: client.userId,
                name: client.userName,
                avatar: client.avatar,
              },
              timestamp: new Date().toISOString(),
              roomId: client.roomId,
            },
          };

          // Broadcast đến tất cả trong room
          broadcastToRoom(client.roomId, chatMessage);

          console.log(
            `💬 Message from ${client.userName}: ${message.data.text}`
          );
          break;

        case "typing":
          // Xử lý typing indicator
          if (!client) return;

          broadcastToRoom(
            client.roomId,
            {
              type: "typing",
              data: {
                userId: client.userId,
                userName: client.userName,
                isTyping: message.data.isTyping,
              },
            },
            client
          );
          break;

        case "ping":
          // Heartbeat
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    const client = clients.get(clientId);

    if (client) {
      // Remove từ room
      if (rooms.has(client.roomId)) {
        rooms.get(client.roomId).delete(clientId);

        // Thông báo user left
        broadcastToRoom(client.roomId, {
          type: "user_left",
          data: {
            user: {
              id: client.userId,
              name: client.userName,
              avatar: client.avatar,
            },
            timestamp: new Date().toISOString(),
          },
        });

        // Cập nhật danh sách users
        sendRoomUsers(client.roomId);

        // Xóa room nếu không còn ai
        if (rooms.get(client.roomId).size === 0) {
          rooms.delete(client.roomId);
          console.log(`🗑️  Room ${client.roomId} deleted`);
        }
      }

      console.log(`➖ User ${client.userName} disconnected`);
    }

    clients.delete(clientId);
    console.log(`🔌 Client disconnected: ${clientId}`);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

// Cleanup khi server tắt
process.on("SIGINT", () => {
  console.log("\n🛑 Server shutting down...");
  wss.close(() => {
    console.log("✅ WebSocket server closed");
    process.exit(0);
  });
});

// Log thống kê mỗi 30 giây
setInterval(() => {
  console.log(`📊 Stats - Clients: ${clients.size}, Rooms: ${rooms.size}`);
}, 30000);
