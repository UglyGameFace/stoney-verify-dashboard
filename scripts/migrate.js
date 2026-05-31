const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

function migrationFiles() {
  const dir = path.join(process.cwd(), "supabase")
  const primary = path.join(dir, "schema.sql")
  const extras = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && name !== "schema.sql")
    .sort()
    .map((name) => path.join(dir, name))

  return [primary, ...extras]
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL. Cannot run migrations.")
    process.exit(1)
  }

  const files = migrationFiles()
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    for (const file of files) {
      const sql = fs.readFileSync(file, "utf8")
      await client.query(sql)
      console.log(`Applied migration: ${path.relative(process.cwd(), file)}`)
    }
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
