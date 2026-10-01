// Usage: node createAdmin.js [username] [password]
// Creates the admin, or resets the password if the username already exists.
const bcrypt = require("bcryptjs");
const { pool, initDb } = require("./db");

const username = process.argv[2] || "admin";
const plainPassword = process.argv[3] || "Admin@123";

async function main() {
    await initDb();

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await pool.query(
        `INSERT INTO admins (username, password) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [username, hashedPassword]
    );

    console.log("Admin account is ready!");
    console.log("Username:", username);
    console.log("Password:", plainPassword);
}

main()
    .catch(function (error) {
        console.log("Error creating admin:", error.message);
        process.exitCode = 1;
    })
    .finally(function () {
        pool.end();
    });
