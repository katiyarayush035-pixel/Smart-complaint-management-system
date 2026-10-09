require("dotenv").config();

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const config = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "complaint_system",
    port: Number(process.env.DB_PORT) || 3306
};

const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS complaints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            complaint_id VARCHAR(20) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL,
            category VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// Creates (or updates) the admin account from ADMIN_USERNAME / ADMIN_PASSWORD.
// Runs on every startup, so the admin exists on a fresh/deployed database and
// changing ADMIN_PASSWORD in the hosting dashboard resets the password.
async function ensureAdmin() {
    const username = String(process.env.ADMIN_USERNAME || "").trim();
    const password = String(process.env.ADMIN_PASSWORD || "");

    if (!username || !password) {
        const [rows] = await pool.query("SELECT COUNT(*) AS total FROM admins");
        if (rows[0].total === 0) {
            console.log("Warning: no admin exists. Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables and restart.");
        }
        return;
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
        `INSERT INTO admins (username, password) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [username, hash]
    );

    console.log("Admin account ready: " + username);
}

module.exports = { pool, initDb, ensureAdmin };