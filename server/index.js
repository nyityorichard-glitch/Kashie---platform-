 // =========================================================
// KASHIE BACKEND SERVER
// File: Server/index.js
// =========================================================

require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL;

const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is missing from the environment."
    );
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
        "JWT_SECRET must be configured with a strong secret."
    );
}


// =========================================================
// DATABASE CONNECTION
// =========================================================

const pool = new Pool({
    connectionString: DATABASE_URL,

    ssl:
        process.env.PGSSL === "true"
            ? { rejectUnauthorized: true }
            : undefined,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL connection error:",
        error.message
    );
});


// =========================================================
// MIDDLEWARE
// =========================================================

app.disable("x-powered-by");

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_ORIGIN
        ? process.env.FRONTEND_ORIGIN.split(",")
        : false,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
}));

app.use(express.json({
    limit: "1mb"
}));

app.use(express.urlencoded({
    extended: false,
    limit: "1mb"
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many authentication attempts. Please try again later."
    }
});


// =========================================================
// GENERAL HEALTH CHECK
// GET /api/health
// =========================================================

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        return res.status(200).json({
            success: true,
            service: "KASHIE API",
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(
            "Health check database error:",
            error.message
        );

        return res.status(503).json({
            success: false,
            service: "KASHIE API",
            database: "unavailable"
        });
    }
});


// =========================================================
// CREATE ARTIST ACCOUNT
// POST /api/auth/register
// =========================================================

app.post(
    "/api/auth/register",
    authLimiter,
    async (req, res) => {
        try {
            const {
                fullName,
                email,
                password,
                institution,
                specialization,
                location
            } = req.body || {};

            if (
                typeof fullName !== "string" ||
                typeof email !== "string" ||
                typeof password !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Name, email and password are required."
                });
            }

            const cleanName = fullName.trim();

            const cleanEmail = email.trim().toLowerCase();

            if (
                cleanName.length < 2 ||
                cleanName.length > 150
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid full name."
                });
            }

            if (
                cleanEmail.length > 255 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address."
                });
            }

            if (
                password.length < 12 ||
                Buffer.byteLength(password, "utf8") > 72
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Use a password of at least 12 characters and no more than 72 bytes."
                });
            }

            const passwordHash = await bcrypt.hash(
                password,
                12
            );

            const client = await pool.connect();

            let newUser;

            try {
                await client.query("BEGIN");

                const userResult = await client.query(
                    `
                    INSERT INTO users (
                        full_name,
                        email,
                        password_hash,
                        role,
                        account_status,
                        email_verified
                    )
                    VALUES ($1, $2, $3, 'artist', 'active', FALSE)
                    RETURNING id, full_name, email, role, created_at
                    `,
                    [
                        cleanName,
                        cleanEmail,
                        passwordHash
                    ]
                );

                newUser = userResult.rows[0];

                await client.query(
                    `
                    INSERT INTO artists (
                        user_id,
                        institution,
                        specialization,
                        location
                    )
                    VALUES ($1, $2, $3, $4)
                    `,
                    [
                        newUser.id,
                        institution || null,
                        specialization || null,
                        location || null
                    ]
                );

                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");

                if (error.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "An account with this email already exists."
                    });
                }

                throw error;
            } finally {
                client.release();
            }

            return res.status(201).json({
                success: true,
                message:
                    "Artist account created. Email verification must be implemented before the account is considered verified.",
                user: newUser
            });
        } catch (error) {
            console.error(
                "Artist registration error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not create the account."
            });
        }
    }
);


// =========================================================
// USER LOGIN
// POST /api/auth/login
// =========================================================

app.post(
    "/api/auth/login",
    authLimiter,
    async (req, res) => {
        try {
            const { email, password } = req.body || {};

            if (
                typeof email !== "string" ||
                typeof password !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required."
                });
            }

            const cleanEmail = email.trim().toLowerCase();

            const result = await pool.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    password_hash,
                    role,
                    account_status,
                    email_verified
                FROM users
                WHERE email = $1
                LIMIT 1
                `,
                [cleanEmail]
            );

            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }

            const passwordMatches = await bcrypt.compare(
                password,
                user.password_hash
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }

            if (user.account_status !== "active") {
                return res.status(403).json({
                    success: false,
                    message:
                        "This account is not currently active."
                });
            }

            const token = jwt.sign(
                {
                    sub: user.id,
                    role: user.role
                },
                JWT_SECRET,
                {
                    expiresIn: "1h",
                    issuer: "kashie-api",
                    audience: "kashie-app"
                }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful.",

                token,

                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    role: user.role,
                    emailVerified: user.email_verified
                }
            });
        } catch (error) {
            console.error(
                "Login error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Could not complete login."
            });
        }
    }
);


// =========================================================
// AUTHENTICATION MIDDLEWARE
// =========================================================

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (
        typeof authorization !== "string" ||
        !authorization.startsWith("Bearer ")
    ) {
        return res.status(401).json({
            success: false,
            message: "Authentication is required."
        });
    }

    const token = authorization.slice(7);

    try {
        req.auth = jwt.verify(token, JWT_SECRET, {
            issuer: "kashie-api",
            audience: "kashie-app"
        });

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "The login token is invalid or expired."
        });
    }
}


// =========================================================
// ADMIN-ONLY MIDDLEWARE
// =========================================================

async function requireAdmin(req, res, next) {
    try {
        const result = await pool.query(
            `
            SELECT id, role, account_status
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [req.auth.sub]
        );

        const user = result.rows[0];

        if (
            !user ||
            user.role !== "admin" ||
            user.account_status !== "active"
        ) {
            return res.status(403).json({
                success: false,
                message: "Administrator access is required."
            });
        }

        req.admin = user;

        next();
    } catch (error) {
        console.error(
            "Admin authorization error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Could not verify administrator access."
        });
    }
}


// =========================================================
// ADMIN DASHBOARD SUMMARY
// GET /api/admin/stats
// =========================================================

app.get(
    "/api/admin/stats",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM users)
                        AS total_users,

                    (SELECT COUNT(*) FROM artists)
                        AS total_artists,

                    (
                        SELECT COUNT(*)
                        FROM artists
                        WHERE verification_status = 'pending'
                    ) AS pending_artists,

                    (SELECT COUNT(*) FROM artworks)
                        AS total_artworks,

                    (
                        SELECT COUNT(*)
                        FROM artworks
                        WHERE artwork_status = 'pending'
                    ) AS pending_artworks,

                    (SELECT COUNT(*) FROM orders)
                        AS total_orders,

                    (
                        SELECT COUNT(*)
                        FROM commissions
                    ) AS total_commissions
            `);

            return res.status(200).json({
                success: true,
                stats: result.rows[0]
            });
        } catch (error) {
            console.error(
                "Admin dashboard error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not load dashboard statistics."
            });
        }
    }
);


// =========================================================
// NOT FOUND
// =========================================================

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "KASHIE API endpoint not found."
    });
});


// =========================================================
// GENERAL ERROR HANDLER
// =========================================================

app.use((error, req, res, next) => {
    console.error(
        "Unhandled server error:",
        error.message
    );

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});


// =========================================================
// START SERVER
// =========================================================

const server = app.listen(PORT, () => {
    console.log(
        `KASHIE API listening on port ${PORT}`
    );
});


// =========================================================
// GRACEFUL SHUTDOWN
// =========================================================

async function shutdown() {
    console.log("Shutting down KASHIE API...");

    server.close(async () => {
        try {
            await pool.end();
            process.exit(0);
        } catch (error) {
            console.error(
                "Error closing database:",
                error.message
            );

            process.exit(1);
        }
    });

    setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 10000).unref();
}

process.on("SIGTERM", shutdown);

process.on("SIGINT", shutdown);
5. Before deploying: check the dependencies
The code above requires the following packages:
npm install express pg bcryptjs jsonwebtoken helmet cors express-rate-limit dotenv
