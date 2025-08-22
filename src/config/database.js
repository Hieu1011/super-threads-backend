const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
      
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection error:', err);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          this.initTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initTables() {
    return new Promise((resolve, reject) => {
      const queries = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          avatar TEXT,
          verified BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Conversations table
        `CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          is_group BOOLEAN DEFAULT 0,
          group_name TEXT,
          group_avatar TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Conversation participants table
        `CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id TEXT,
          user_id TEXT,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, user_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        
        // Messages table
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          media_url TEXT,
          reply_to TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_edited BOOLEAN DEFAULT 0,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id),
          FOREIGN KEY (sender_id) REFERENCES users(id),
          FOREIGN KEY (reply_to) REFERENCES messages(id)
        )`,
        
        // Message read status
        `CREATE TABLE IF NOT EXISTS message_reads (
          message_id TEXT,
          user_id TEXT,
          read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES messages(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`
      ];

      let completed = 0;
      queries.forEach((query, index) => {
        this.db.run(query, (err) => {
          if (err) {
            console.error(`❌ Error creating table ${index}:`, err);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === queries.length) {
            console.log('✅ Database tables initialized');
            resolve();
          }
        });
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err);
          } else {
            console.log('✅ Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getDb() {
    return this.db;
  }
}

module.exports = new Database();
