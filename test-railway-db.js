// Test PostgreSQL connection với public URL
const { Pool } = require("pg");

const publicUrl =
  "postgresql://postgres:mgEPOEflqJHJpKeCsVDaRVbCsjZVVPbq@metro.proxy.rlwy.net:19503/railway";

console.log("🧪 Testing Railway PostgreSQL connection...");

async function testConnection() {
  try {
    const pool = new Pool({
      connectionString: publicUrl,
      ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    console.log("✅ Connected to Railway PostgreSQL");

    // Test query
    const result = await client.query("SELECT NOW() as current_time");
    console.log("⏰ Current time:", result.rows[0].current_time);

    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log(
      "📋 Tables:",
      tables.rows.map((r) => r.table_name)
    );

    client.release();
    await pool.end();

    console.log("✅ Test completed successfully");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  }
}

testConnection();
