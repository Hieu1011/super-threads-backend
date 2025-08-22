# Super Threads WebSocket Server

WebSocket server đơn giản để test chat functionality cho Super Threads app.

## 🚀 Cài đặt và chạy

### 1. Cài đặt dependencies

```bash
cd websocket-server
npm install
```

### 2. Chạy server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

Server sẽ chạy trên `ws://localhost:8080`

## 📡 WebSocket API

### Message Types

#### 1. Join Room

```json
{
  "type": "join",
  "data": {
    "userId": "user123",
    "userName": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "roomId": "room_general"
  }
}
```

#### 2. Send Message

```json
{
  "type": "message",
  "data": {
    "text": "Hello everyone!"
  }
}
```

#### 3. Typing Indicator

```json
{
  "type": "typing",
  "data": {
    "isTyping": true
  }
}
```

#### 4. Ping (Heartbeat)

```json
{
  "type": "ping"
}
```

### Server Responses

#### 1. Welcome Message

```json
{
  "type": "welcome",
  "data": {
    "message": "Welcome to room room_general!",
    "roomId": "room_general"
  }
}
```

#### 2. New Message

```json
{
  "type": "message",
  "data": {
    "id": "msg_uuid",
    "text": "Hello everyone!",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "timestamp": "2024-01-01T12:00:00.000Z",
    "roomId": "room_general"
  }
}
```

#### 3. User Joined/Left

```json
{
  "type": "user_joined", // or "user_left"
  "data": {
    "user": {
      "id": "user123",
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 4. Room Users List

```json
{
  "type": "room_users",
  "data": {
    "users": [
      {
        "id": "user123",
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

#### 5. Typing Indicator

```json
{
  "type": "typing",
  "data": {
    "userId": "user123",
    "userName": "John Doe",
    "isTyping": true
  }
}
```

#### 6. Error

```json
{
  "type": "error",
  "message": "Error description"
}
```

## 🧪 Test với WebSocket Client

### Browser Console Test

```javascript
const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
  console.log("Connected!");

  // Join room
  ws.send(
    JSON.stringify({
      type: "join",
      data: {
        userId: "test_user_1",
        userName: "Test User",
        avatar: "https://via.placeholder.com/40",
        roomId: "test_room",
      },
    })
  );
};

ws.onmessage = (event) => {
  console.log("Received:", JSON.parse(event.data));
};

// Send message
ws.send(
  JSON.stringify({
    type: "message",
    data: { text: "Hello from browser!" },
  })
);
```

## 🔧 Cấu hình cho React Native

Trong React Native app, kết nối đến:

- **iOS Simulator**: `ws://localhost:8080`
- **Android Emulator**: `ws://10.0.2.2:8080`
- **Physical Device**: `ws://[YOUR_COMPUTER_IP]:8080`

## 📋 Features

- ✅ Real-time messaging
- ✅ Multiple rooms support
- ✅ User join/leave notifications
- ✅ Online users list
- ✅ Typing indicators
- ✅ Heartbeat/ping-pong
- ✅ Error handling
- ✅ Auto cleanup khi disconnect

## 🐛 Debug

Server sẽ log tất cả activities:

- Client connections/disconnections
- Messages sent/received
- Room joins/leaves
- Errors

Kiểm tra console để debug issues.

## 🌐 Network Configuration

Nếu test trên physical device, đảm bảo:

1. Device và computer cùng WiFi network
2. Firewall không block port 8080
3. Sử dụng IP address thay vì localhost
