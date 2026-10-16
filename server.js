require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const itemRoutes = require("./routes/itemRoutes");
const loanRoutes = require("./routes/loanRoutes");
const searchRoutes = require("./routes/searchRoutes");

const app = express();


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "BorrowBack API is running",
        version: "1.0.0"
    });
});


// ==========================================
// DATABASE TEST ROUTE
// ==========================================

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.status(200).json({
            success: true,
            message: "PostgreSQL connection successful",
            time: result.rows[0].now
        });

    } catch (error) {
        console.error("Database Test Error:", error);

        res.status(500).json({
            success: false,
            message: "PostgreSQL connection failed"
        });
    }
});


// ==========================================
// AUTH ROUTES
// ==========================================

app.use("/api/auth", authRoutes);


// ==========================================
// PEOPLE ROUTES
// ==========================================

app.use("/api/people", peopleRoutes);


// ==========================================
// ITEMS ROUTES
// ==========================================

app.use("/api/items", itemRoutes);

// ==========================================
// LAON ROUTES
// ==========================================

app.use("/api/loans", loanRoutes);

// ==========================================
// SEARCH ROUTES
// ==========================================

app.use("/api/search", searchRoutes);


// ==========================================
// 404 ROUTE
// ==========================================


app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});


// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
    console.error("Global Server Error:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});


// ==========================================
// START SERVER
// ==========================================


const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("BorrowBack Backend Started");
    console.log(`Server listening on port ${PORT}`);
    console.log("========================================");
});

