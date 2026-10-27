
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction
            ? { rejectUnauthorized: false }
            : undefined,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
    }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT || 5432),
        ssl: process.env.DB_SSL === "true"
            ? { rejectUnauthorized: false }
            : undefined,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
    };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
    console.log("PostgreSQL connection established");
});

pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error.message);
});

// Verify the active database without printing credentials.
pool.query(`
    SELECT
        current_database() AS database_name,
        current_user AS database_user,
        inet_server_addr()::text AS server_address
`)
    .then((result) => {
        console.log("PostgreSQL database verification:", result.rows[0]);
    })
    .catch((error) => {
        console.error("PostgreSQL connection verification failed:", error.message);
    });

module.exports = pool;
