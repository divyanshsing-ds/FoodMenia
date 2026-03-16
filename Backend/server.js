require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./Connection/Connect");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 9090);

/* ---------------- HTTP + SOCKET SERVER ---------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

/* ---------------- SOCKET EVENTS ---------------- */

io.on("connection", (socket) => {
  console.log("🔌 Client connected");

  // Chat room joining
  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`👤 Client joined chat room: ${chatId}`);
  });

  // Order tracking rooms: "user_<userId>" or "operator_<operatorId>"
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`📦 Client joined room: ${roomId}`);
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("👋 Client disconnected");
  });
});

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ---------------- REQUEST LOGGER ---------------- */

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`📡 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

/* ---------------- ROUTES ---------------- */

app.use("/api/auth", require("./routes/auth"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", require("./routes/order"));
app.use("/api/video", require("./routes/video"));
app.use("/api/creator", require("./routes/creator"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/student", require("./routes/student"));
app.use("/api/ai", require("./routes/ai"));

/* ---------------- HEALTH CHECK ---------------- */

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "FoodMenia API is running 🍕",
  });
});

/* ---------------- 404 HANDLER ---------------- */

app.use((req, res) => {
  console.log(`⚠️  404 Not Found: ${req.method} ${req.url}`);

  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
  });
});

/* ---------------- GLOBAL ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {
  console.error("💥 Global Unhandled Error:", err);

  res.status(500).json({
    success: false,
    message: "A critical server error occurred.",
    error: err.message,
  });
});

/* ---------------- START SERVER ---------------- */

const startServer = (port, attempt = 0) => {
  if (attempt >= 10) {
    console.error("❌ Could not find a free port after 10 attempts.");
    process.exit(1);
  }

  server
    .listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://192.168.1.7:${port}`);
      console.log(`🌐 Web access: http://localhost:${port}`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`⚠️ Port ${port} busy, trying ${port + 1}`);
        server.close();
        startServer(port + 1, attempt + 1);
      } else {
        console.error("💥 Server error:", err);
        process.exit(1);
      }
    });
};

/* ---------------- CONNECT DB + START ---------------- */

connectDB()
  .then(() => {
    console.log("✅ MongoDB Connected");
    startServer(PORT);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });