#!/usr/bin/env node

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "../database.sqlite");

console.log(`📊 Super Threads Database Viewer`);
console.log(`📍 Database: ${dbPath}`);
console.log(`⏰ ${new Date().toLocaleString()}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error opening database:", err.message);
    process.exit(1);
  }
});

async function queryTable(tableName, query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function showTables() {
  try {
    console.log("📋 TABLES:\n");

    // Users
    const users = await queryTable(
      "users",
      "SELECT * FROM users ORDER BY created_at DESC"
    );
    console.log("👥 USERS:");
    if (users.length === 0) {
      console.log("   (No users found)");
    } else {
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.display_name} (${user.email})`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Username: ${user.username}`);
        console.log(`      Verified: ${user.verified ? "✅" : "❌"}`);
        console.log(
          `      Created: ${new Date(user.created_at).toLocaleString()}`
        );
        console.log("");
      });
    }

    // Conversations
    const conversations = await queryTable(
      "conversations",
      "SELECT * FROM conversations ORDER BY updated_at DESC"
    );
    console.log("💬 CONVERSATIONS:");
    if (conversations.length === 0) {
      console.log("   (No conversations found)");
    } else {
      conversations.forEach((conv, index) => {
        console.log(
          `   ${index + 1}. ${conv.group_name || `Conversation ${conv.id.slice(0, 8)}`}`
        );
        console.log(`      ID: ${conv.id}`);
        console.log(`      Group: ${conv.is_group ? "✅" : "❌"}`);
        console.log(
          `      Updated: ${new Date(conv.updated_at).toLocaleString()}`
        );
        console.log("");
      });
    }

    // Messages (last 10)
    const messages = await queryTable(
      "messages",
      "SELECT m.*, u.display_name as sender_name FROM messages m LEFT JOIN users u ON m.sender_id = u.id ORDER BY m.created_at DESC LIMIT 10"
    );
    console.log("📨 RECENT MESSAGES (Last 10):");
    if (messages.length === 0) {
      console.log("   (No messages found)");
    } else {
      messages.forEach((msg, index) => {
        console.log(
          `   ${index + 1}. ${msg.sender_name || "Unknown"}: "${msg.content.slice(0, 50)}${msg.content.length > 50 ? "..." : ""}"`
        );
        console.log(`      ID: ${msg.id}`);
        console.log(`      Room: ${msg.conversation_id}`);
        console.log(`      Time: ${new Date(msg.created_at).toLocaleString()}`);
        console.log("");
      });
    }

    // Stats
    const userCount = await queryTable(
      "users",
      "SELECT COUNT(*) as count FROM users"
    );
    const messageCount = await queryTable(
      "messages",
      "SELECT COUNT(*) as count FROM messages"
    );
    const convCount = await queryTable(
      "conversations",
      "SELECT COUNT(*) as count FROM conversations"
    );

    console.log("📊 STATISTICS:");
    console.log(`   Users: ${userCount[0].count}`);
    console.log(`   Conversations: ${convCount[0].count}`);
    console.log(`   Messages: ${messageCount[0].count}`);
  } catch (error) {
    console.error("❌ Error querying database:", error);
  } finally {
    db.close();
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case "users":
    queryTable("users", "SELECT * FROM users ORDER BY created_at DESC").then(
      (users) => {
        console.table(users);
        db.close();
      }
    );
    break;

  case "messages":
    queryTable(
      "messages",
      "SELECT m.*, u.display_name as sender_name FROM messages m LEFT JOIN users u ON m.sender_id = u.id ORDER BY m.created_at DESC LIMIT 20"
    ).then((messages) => {
      console.table(messages);
      db.close();
    });
    break;

  case "conversations":
    queryTable(
      "conversations",
      "SELECT * FROM conversations ORDER BY updated_at DESC"
    ).then((conversations) => {
      console.table(conversations);
      db.close();
    });
    break;

  default:
    showTables();
}

process.on("SIGINT", () => {
  console.log("\n👋 Goodbye!");
  db.close();
  process.exit(0);
});
