const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const winston = require("winston");
const morgan = require("morgan");
const jwt = require("jsonwebtoken")

const app = express();

// Create a winston logger instance
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

// Use morgan for HTTP request logging
app.use(
    morgan("combined", {
        stream: { write: (message) => logger.info(message.trim()) },
    })
);

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));
dotenv.config();

// Database connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "expense_tracker",
});

// Test connection and create tables if not exists
db.getConnection((err, connection) => {
    if (err) {
        console.error("Error connecting to MySQL:", err);
        return;
    }
    console.log("Connected to MySQL as id:", connection.threadId);

    // Create tables
    const createTablesQueries = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            amount DECIMAL(10, 2) NOT NULL,
            date DATE DEFAULT CURRENT_TIMESTAMP,
            category VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS income (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            source VARCHAR(255),
            amount DECIMAL(10, 2),
            date DATE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS savings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            goal VARCHAR(255),
            amount DECIMAL(10, 2),
            date DATE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`
    ];

    createTablesQueries.forEach(query => {
        connection.query(query, (err) => {
            if (err) {
                console.error("Error creating table:", err);
            } else {
                console.log("Table created/checked successfully");
            }
        });
    });

    connection.release();
});

// User registration
app.post("/register", async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json("Email, username, and password are required");
        }

        const [existingUser] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json("User already exists");
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const [result] = await db.promise().query("INSERT INTO users (email, username, password) VALUES (?, ?, ?)", [
            email,
            username,
            hashedPassword,
        ]);
        res.status(200).json("User created successfully");
    } catch (err) {
        console.error("Error in user registration:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});
// Login endpoint
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Query for the user by email
        const [rows] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);
        const existingUser = rows[0]; // Correctly access the first row

        if (!existingUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Ensure password field exists
        if (!existingUser.password) {
            return res.status(500).json({ message: "Password not found in database" });
        }

        // Compare the password
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid password" });
        }

        // Prepare user data
        const userData = {
            id: existingUser.id,
            email: existingUser.email,
            username: existingUser.username
        };

        // Generate JWT token
        const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Send response
        res.status(200).json({
            message: "Login successful",
            token
        });
    } catch (err) {
        console.error("Error in user login:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});



// Get users endpoint
app.get("/users", async (req, res) => {
    try {
        const [users] = await db.promise().query("SELECT * FROM users");
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Add expense endpoint
app.post("/expenses", async (req, res) => {
    try {
        const { user_id, amount, date, category } = req.body;

        if (!user_id || !amount || !date) {
            return res.status(400).json("User ID, amount, and date are required");
        }

        await db.promise().query(
            "INSERT INTO expenses (user_id, amount, date, category) VALUES (?, ?, ?, ?)",
            [user_id, amount, date, category]
        );
        res.status(200).json("Expense added successfully");
    } catch (err) {
        console.error("Error adding expense:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Get all expenses endpoint
app.get("/expenses", async (req, res) => {
    try {
        const [expenses] = await db.promise().query("SELECT * FROM expenses");
        res.status(200).json(expenses);
    } catch (err) {
        console.error("Error fetching expenses:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Edit expense endpoint
app.patch("/expenses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, date, category } = req.body;

        const [result] = await db.promise().query(
            "UPDATE expenses SET amount = ?, date = ?, category = ? WHERE id = ?",
            [amount, date, category, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json("Expense not found");
        }

        res.status(200).json("Expense updated successfully");
    } catch (err) {
        console.error("Error updating expense:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Delete expense endpoint
app.delete("/expenses/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.promise().query("DELETE FROM expenses WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json("Expense not found");
        }

        res.status(200).json("Expense deleted successfully");
    } catch (err) {
        console.error("Error deleting expense:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// View expenses endpoint for a specific user
app.get("/expenses/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;

        const [expenses] = await db.promise().query("SELECT * FROM expenses WHERE user_id = ?", [user_id]);
        res.status(200).json(expenses);
    } catch (err) {
        console.error("Error fetching expenses:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Add income endpoint
app.post("/income", async (req, res) => {
    try {
        const { user_id, source, amount, date } = req.body;

        if (!user_id || !source || !amount || !date) {
            return res.status(400).json("User ID, source, amount, and date are required");
        }

        await db.promise().query(
            "INSERT INTO income (user_id, source, amount, date) VALUES (?, ?, ?, ?)",
            [user_id, source, amount, date]
        );
        res.status(200).json("Income added successfully");
    } catch (err) {
        console.error("Error adding income:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Get income for a user
app.get("/income/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        const [income] = await db.promise().query(
            "SELECT * FROM income WHERE user_id = ?",
            [user_id]
        );
        res.status(200).json(income);
    } catch (err) {
        console.error("Error fetching income:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Update income endpoint
app.patch("/income/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { source, amount, date } = req.body;

        const [result] = await db.promise().query(
            "UPDATE income SET source = ?, amount = ?, date = ? WHERE id = ?",
            [source, amount, date, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json("Income not found");
        }

        res.status(200).json("Income updated successfully");
    } catch (err) {
        console.error("Error updating income:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Delete income endpoint
app.delete("/income/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.promise().query("DELETE FROM income WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json("Income not found");
        }

        res.status(200).json("Income deleted successfully");
    } catch (err) {
        console.error("Error deleting income:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Add savings endpoint
app.post("/savings", async (req, res) => {
    try {
        const { user_id, goal, amount, date } = req.body;

        if (!user_id || !goal || !amount || !date) {
            return res.status(400).json("User ID, goal, amount, and date are required");
        }

        await db.promise().query(
            "INSERT INTO savings (user_id, goal, amount, date) VALUES (?, ?, ?, ?)",
            [user_id, goal, amount, date]
        );
        res.status(200).json("Savings goal added successfully");
    } catch (err) {
        console.error("Error adding savings:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Get savings for a user
app.get("/savings/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        const [savings] = await db.promise().query(
            "SELECT * FROM savings WHERE user_id = ?",
            [user_id]
        );
        res.status(200).json(savings);
    } catch (err) {
        console.error("Error fetching savings:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Update savings endpoint
app.patch("/savings/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { goal, amount, date } = req.body;

        const [result] = await db.promise().query(
            "UPDATE savings SET goal = ?, amount = ?, date = ? WHERE id = ?",
            [goal, amount, date, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json("Savings goal not found");
        }

        res.status(200).json("Savings goal updated successfully");
    } catch (err) {
        console.error("Error updating savings:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Delete savings endpoint
app.delete("/savings/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.promise().query("DELETE FROM savings WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json("Savings goal not found");
        }

        res.status(200).json("Savings goal deleted successfully");
    } catch (err) {
        console.error("Error deleting savings:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Serve static files (if applicable)
app.use(express.static(path.join(__dirname, "public")));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
