require("dotenv").config();
const mysql = require("mysql2/promise");

const config = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "complaint_system"
};

// A pool reconnects automatically (a single connection dies after MySQL's idle timeout)
const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10
});

// Creates the database and tables if they don't exist yet
async function initDb() {
    const { database, ...serverOnly } = config;
    const conn = await mysql.createConnection(serverOnly);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await conn.end();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS complaints (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            complaint_id VARCHAR(20)  NOT NULL UNIQUE,
            name         VARCHAR(100) NOT NULL,
            email        VARCHAR(150) NOT NULL,
            category     VARCHAR(50)  NOT NULL,
            description  TEXT         NOT NULL,
            status       VARCHAR(20)  NOT NULL DEFAULT 'Pending',
            created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id       INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50)  NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        )
    `);
}

module.exports = { pool, initDb };
