const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL. Cannot run migrations.")
    process.exit(1)
  }

  const sqlPath = path.join(process.cwd(), "supabase", "schema.sql")
  const sql = fs.readFileSync(sqlPath, "utf8")
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    await client.query(sql)
    console.log("Migration completed successfully.")
  } catch (error) {
    console.error("Migration failed:")
    console.error(error.message || error)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

main()
