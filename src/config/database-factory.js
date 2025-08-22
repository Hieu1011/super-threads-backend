// Database factory - tự động chọn SQLite (local) hoặc PostgreSQL (production)

const sqliteDb = require("./database");
const postgresDb = require("./postgres");

class DatabaseFactory {
  constructor() {
    this.currentDb = null;
  }

  async connect() {
    // Kiểm tra environment
    const isDevelopment = process.env.NODE_ENV !== "production";
    const hasPostgresUrl = !!(
      process.env.DATABASE_URL || process.env.POSTGRES_URL
    );

    if (hasPostgresUrl) {
      console.log("🐘 Using PostgreSQL (Cloud Database)");
      this.currentDb = postgresDb;
    } else if (isDevelopment) {
      console.log("📁 Using SQLite (Local Development)");
      this.currentDb = sqliteDb;
    } else {
      console.log("⚠️  No cloud database found, falling back to SQLite");
      this.currentDb = sqliteDb;
    }

    await this.currentDb.connect();
    return this.currentDb;
  }

  getDb() {
    if (!this.currentDb) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.currentDb;
  }

  async close() {
    if (this.currentDb) {
      await this.currentDb.close();
    }
  }

  // Unified query interface
  async query(text, params = []) {
    const db = this.getDb();

    if (db.query) {
      // PostgreSQL
      return await db.query(text, params);
    } else {
      // SQLite
      return new Promise((resolve, reject) => {
        db.getDb().all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
    }
  }

  async run(text, params = []) {
    const db = this.getDb();

    if (db.query) {
      // PostgreSQL
      return await db.query(text, params);
    } else {
      // SQLite
      return new Promise((resolve, reject) => {
        db.getDb().run(text, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  }
}

module.exports = new DatabaseFactory();
