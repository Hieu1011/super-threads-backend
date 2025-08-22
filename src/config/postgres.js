const { Pool } = require("pg");

class PostgresDatabase {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      // Railway PostgreSQL connection
      const connectionString =
        process.env.DATABASE_URL || process.env.POSTGRES_URL;

      if (!connectionString) {
        throw new Error(
          "DATABASE_URL or POSTGRES_URL environment variable is required"
        );
      }

      this.pool = new Pool({
        connectionString,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
      });

      // Test connection
      const client = await this.pool.connect();
      console.log("✅ Connected to PostgreSQL database");
      client.release();

      await this.initTables();
    } catch (error) {
      console.error("❌ PostgreSQL connection error:", error);
      throw error;
    }
  }

  async initTables() {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          avatar TEXT,
          verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          is_group BOOLEAN DEFAULT FALSE,
          group_name TEXT,
          group_avatar TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Conversation participants table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id TEXT,
          user_id TEXT,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, user_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          media_url TEXT,
          reply_to TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_edited BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
        )
      `);

      // Message read status
      await client.query(`
        CREATE TABLE IF NOT EXISTS message_reads (
          message_id TEXT,
          user_id TEXT,
          read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, created_at DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email 
        ON users(email)
      `);

      await client.query("COMMIT");
      console.log("✅ PostgreSQL tables initialized");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Error initializing tables:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("✅ PostgreSQL connection closed");
    }
  }

  getPool() {
    return this.pool;
  }
}

module.exports = new PostgresDatabase();
