require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./Connection/Connect");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 9090);

// Setup HTTP server with Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // allow all for dev
        methods: ["GET", "POST"]
    }
});

// Store io instance on app for route access
app.set("io", io);

io.on("connection", (socket) => {
    socket.on("join_chat", (chatId) => {
        socket.join(chatId);
        // console.log(`👤 Client joined chat room: ${chatId}`);
    });

    socket.on("disconnect", () => {
        // console.log("👋 Client disconnected");
    });
});

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
app.use("/api/creator", require("./routes/creator"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/student", require("./routes/student"));

// ---------- Health check ----------
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "FoodMenia API is running 🍕" });
});

// ---------- 404 Catch-All ----------
app.use((req, res) => {
    console.log(`⚠️  404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
    console.error("💥 Global Unhandled Error:", err);
    res.status(500).json({
        success: false,
        message: "A critical server error occurred. Please restart the backend.",
        error: err.message
    });
});

// ---------- Start ----------
const startServer = (port, attempt = 0) => {
    if (attempt >= 10) {
        console.error("❌ Could not find a free port after 10 attempts. Exiting.");
        process.exit(1);
    }

    server.listen(port, () => {
        console.log(`🚀 Realtime Server running on http://localhost:${port}`);
        if (port !== Number(process.env.PORT || 9090)) {
            console.warn(`⚠️  Port ${process.env.PORT || 9090} was busy. Using port ${port} instead. Update your frontend config if needed.`);
        }
    }).on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.warn(`⚠️  Port ${port} is in use, trying port ${port + 1}...`);
            server.close();
            startServer(port + 1, attempt + 1);
        } else {
            console.error("💥 Server error:", err);
            process.exit(1);
        }
    });
};

connectDB().then(() => {
    startServer(PORT);
});
