require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./Connection/Connect");

const path = require("path");

const app = express();
const PORT = process.env.PORT || 9090;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- Request Logger ----------
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`📡 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});



// ---------- Routes ----------
app.use("/api/auth", require("./routes/auth"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", require("./routes/order"));
app.use("/api/video", require("./routes/video"));

// ---------- Health check ----------
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "FoodMenia API is running 🍕" });
});

// ---------- 404 Catch-All ----------
app.use((req, res) => {
    console.log(`⚠️  404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

// ---------- Start ----------
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
});
