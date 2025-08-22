const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const database = require('./src/config/database');
const authRoutes = require('./src/routes/auth');
const { authenticateWebSocket } = require('./src/middleware/auth');

// Load environment variables
require('dotenv').config();

const PORT = process.env.PORT || 8080;

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for WebSocket
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:19006'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get(['/health', '/'], (req, res) => {
  res.json({
    status: "healthy",
    clients: clients.size,
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// Create HTTP server
const server = require('http').createServer(app);

// Tạo WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// Lưu trữ các kết nối và thông tin user
const clients = new Map();
const rooms = new Map();

// Initialize database and start server
async function startServer() {
  try {
    await database.connect();
    
    server.listen(PORT, () => {
      console.log(`🌐 HTTP server listening on port ${PORT}`);
      console.log(`🚀 WebSocket server started on port ${PORT}`);
      console.log(`📊 API endpoints available at /api/*`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

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

wss.on("connection", (ws, req) => {
  const clientId = uuidv4();

  console.log(`➕ Client connected: ${clientId}`);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const client = clients.get(clientId);

      switch (message.type) {
        case "auth":
          // Authenticate với JWT token
          try {
            const { token } = message.data;
            const user = await authenticateWebSocket(token);
            
            // Lưu authenticated user info
            clients.set(clientId, {
              ws,
              userId: user.userId,
              userName: user.displayName,
              avatar: user.avatar,
              email: user.email,
              verified: user.verified,
              isAuthenticated: true
            });

            ws.send(JSON.stringify({
              type: "auth_success",
              data: {
                user: {
                  id: user.userId,
                  name: user.displayName,
                  avatar: user.avatar,
                  email: user.email,
                  verified: user.verified
                }
              }
            }));

            console.log(`🔐 User authenticated: ${user.displayName} (${user.email})`);
          } catch (error) {
            ws.send(JSON.stringify({
              type: "auth_error",
              data: { message: error.message }
            }));
            console.log(`❌ Authentication failed: ${error.message}`);
          }
          break;

        case "join":
          // User join room (cần authenticate trước)
          if (!client || !client.isAuthenticated) {
            ws.send(JSON.stringify({
              type: "error",
              data: { message: "Please authenticate first" }
            }));
            return;
          }

          const { roomId } = message.data;

          // Update client với room info
          clients.set(clientId, {
            ...client,
            roomId
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
                user: { 
                  id: client.userId, 
                  name: client.userName, 
                  avatar: client.avatar,
                  verified: client.verified
                },
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

          console.log(`👤 User ${client.userName} joined room ${roomId}`);
          break;

        case "message":
          // Gửi tin nhắn (cần authenticate và join room)
          if (!client || !client.isAuthenticated) {
            ws.send(
              JSON.stringify({
                type: "error",
                data: { message: "Please authenticate first" },
              })
            );
            return;
          }

          if (!client.roomId) {
            ws.send(
              JSON.stringify({
                type: "error",
                data: { message: "Please join a room first" },
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
                verified: client.verified,
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
