require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    JWT_SECRET = crypto.randomBytes(32).toString("hex");
    console.log("Warning: JWT_SECRET not set in .env - using a temporary one (admins must log in again after each restart).");
}

const CATEGORIES = ["Technical", "Academic", "Infrastructure", "Hostel", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

// ===============================
// AUTHENTICATION MIDDLEWARE
// (applied ONLY to admin routes, not globally)
// ===============================

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

// ===============================
// SERVE THE FRONTEND (optional: open https://smart-complaint-management-system-fmnj.onrender.com/)
// Only these files are exposed, so backend/.env is never reachable.
// ===============================

const FRONTEND_DIR = path.join(__dirname, "..");
const FRONTEND_FILES = ["index.html", "admin.html", "admin-login.html", "script.js", "style.css"];

app.get("/", function (req, res) {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

FRONTEND_FILES.forEach(function (file) {
    app.get("/" + file, function (req, res) {
        res.sendFile(path.join(FRONTEND_DIR, file));
    });
});

app.get("/api/health", function (req, res) {
    res.json({ message: "Smart Complaint Management API is running!" });
});

// ===============================
// CREATE COMPLAINT (public)
// ===============================

app.post("/complaints", async function (req, res) {
    const body = req.body || {};

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();

    if (!name || !email || !category || !description) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        });
    }

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: "Invalid category" });
    }

    if (name.length > 100 || email.length > 150 || description.length > 5000) {
        return res.status(400).json({ success: false, message: "One of the fields is too long" });
    }

    const sql = `
        INSERT INTO complaints
        (complaint_id, name, email, category, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    // The ID is random, so retry in the (rare) case of a duplicate
    for (let attempt = 0; attempt < 5; attempt++) {
        const complaintId = "CMP-" + crypto.randomInt(100000, 1000000);

        try {
            await pool.query(sql, [complaintId, name, email, category, description]);

            return res.json({
                success: true,
                message: "Complaint submitted successfully",
                complaintId: complaintId
            });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                continue;
            }

            console.log("Insert error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to save complaint"
            });
        }
    }

    res.status(500).json({ success: false, message: "Could not generate a unique complaint ID. Please try again." });
});

// ===============================
// GET ALL COMPLAINTS (admin)
// Must be declared as an exact path; "/complaints/:complaintId" below is separate.
// ===============================

app.get("/complaints", authenticateAdmin, async function (req, res) {
    try {
        const [results] = await pool.query(`
            SELECT *
            FROM complaints
            ORDER BY created_at DESC, id DESC
        `);

        res.json({ success: true, complaints: results });
    } catch (error) {
        console.log("Fetch error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch complaints"
        });
    }
});

// ===============================
// TRACK COMPLAINT (public)
// Personal details (name, email) are NOT returned to the public.
// ===============================

app.get("/complaints/:complaintId", async function (req, res) {
    const complaintId = String(req.params.complaintId || "").trim().toUpperCase();

    try {
        const [results] = await pool.query(
            `SELECT complaint_id, category, description, status, created_at
             FROM complaints
             WHERE complaint_id = ?`,
            [complaintId]
        );

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        res.json({ success: true, complaint: results[0] });
    } catch (error) {
        console.log("Search error:", error);

        res.status(500).json({
            success: false,
            message: "Database error"
        });
    }
});

// ===============================
// UPDATE COMPLAINT STATUS (admin)
// ===============================

app.put("/complaints/:complaintId/status", authenticateAdmin, async function (req, res) {
    const complaintId = req.params.complaintId;
    const status = (req.body || {}).status;

    if (!STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status"
        });
    }

    try {
        const [result] = await pool.query(
            `UPDATE complaints
             SET status = ?
             WHERE complaint_id = ?`,
            [status, complaintId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        res.json({
            success: true,
            message: "Complaint status updated successfully"
        });
    } catch (error) {
        console.log("Update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update status"
        });
    }
});

// ===============================
// ADMIN LOGIN (public)
// ===============================

app.post("/admin/login", async function (req, res) {
    const body = req.body || {};
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required"
        });
    }

    try {
        const [results] = await pool.query(
            "SELECT * FROM admins WHERE username = ?",
            [username]
        );

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const admin = results[0];
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            message: "Login successful",
            token: token
        });
    } catch (error) {
        console.log("Login database error:", error);

        res.status(500).json({
            success: false,
            message: "Database error"
        });
    }
});

app.get("/favicon.ico", function (req, res) { res.status(204).end(); });

// ===============================
// FALLBACKS
// ===============================

app.use(function (req, res) {
    res.status(404).json({ success: false, message: "Route not found" });
});

app.use(function (err, req, res, next) {
    // Malformed JSON body etc.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Invalid JSON" });
    }

    console.log("Unhandled error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
});

// ===============================
// START
// ===============================

initDb()
    .then(function () {
        console.log("Connected to MySQL database!");

        app.listen(PORT, function () {
            console.log("Server running at http://localhost:" + PORT);
        });
    })
    .catch(function (error) {
        console.log("Database connection failed:", error.message);
        console.log("Check DB_HOST / DB_USER / DB_PASSWORD in backend/.env and make sure MySQL is running.");
        process.exit(1);
    });
