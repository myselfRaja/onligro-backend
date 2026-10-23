// --------------------------
// ENV CONFIG
// --------------------------
import dotenv from "dotenv";
dotenv.config();

// --------------------------
// IMPORTS
// --------------------------
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";

// ROUTES
import authRoutes from "./routes/authRoutes.js";
import salonRoutes from "./routes/salonRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import workingHoursRoutes from "./routes/workingHoursRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import ProductRoutes from "./routes/ProductRoutes.js";
import DistributorRoutes from "./routes/DistributorRoutes.js";
import PurchaseRoutes from "./routes/PurchaseRoutes.js";
import walletRoutes from "./routes/WalletRoutes.js";

// PUBLIC ROUTES
import appointmentPublicRoutes from "./routes/public/appointmentPublicRoutes.js";
import salonPublicRoutes from "./routes/public/salonPublicRoutes.js";
import servicePublicRoutes from "./routes/public/servicePublicRoutes.js";
import slotPublicRoutes from "./routes/public/slotPublicRoutes.js";
import workingHoursPublicRoutes from "./routes/public/workingHoursPublicRoutes.js";
import salonImageUploadRoutes from "./routes/public/salonImageUpload.js";
// --------------------------
// APP INIT
// --------------------------
const app = express();

app.set("trust proxy", 1);
// --------------------------
// MIDDLEWARES
// --------------------------
const allowedOrigins = [
  "http://localhost:3000",
  "https://onligro.com",
  "https://www.onligro.com"
];
app.use(helmet());

// ✅ RATE LIMITERS
// General limit — 15 min mein 100 requests per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutes
  max: 100,                         // 100 requests
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit — auth routes pe 15 min mein 5 attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                          // ← 5 se 10 kar do
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  skipSuccessfulRequests: true,
});

// Bill creation limit — 1 min mein 30 bills
const billLimiter = rateLimit({
  windowMs: 60 * 1000,              // 1 minute
  max: 30,
  message: { error: "Too many bills, please slow down" },
});

    

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS blocked"));
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// --------------------------
// HTTP + SOCKET SETUP
// --------------------------
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://onligro.com",          // ✅ Add kiya
      "https://www.onligro.com",
      "https://dashboard.onligro.com",
    ],
    credentials: true,
  },
});

// attach io to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// socket connection
io.on("connection", (socket) => {
  // console.log("Socket connected:", socket.id);
});

// --------------------------
// DATABASE CONNECT
// --------------------------
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.log("MongoDB Error:", err.message);
  }
}

connectDB();

// --------------------------
// RATE LIMITERS (routes se pehle)
// --------------------------
app.use("/auth", authLimiter);      // ✅ Login pe strict
app.use("/bills", billLimiter);     // ✅ Bills pe limit
app.use(generalLimiter);            // ✅ Baaki sab pe general

// --------------------------
// ROUTES
// --------------------------
app.use("/auth", authRoutes);
app.use("/salon", salonRoutes);
app.use("/staff", staffRoutes);
app.use("/service", serviceRoutes);
app.use("/hours", workingHoursRoutes);
app.use("/slots", slotRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/reports", reportRoutes);
app.use("/owner", ownerRoutes);
app.use("/protected", protectedRoutes);
app.use("/bills", billRoutes);
app.use("/customers", customerRoutes);
app.use("/reminders", reminderRoutes);
app.use("/products", ProductRoutes);
app.use("/distributors", DistributorRoutes);
app.use("/purchases", PurchaseRoutes);
app.use("/wallet", walletRoutes);
// --------------------------
// PUBLIC ROUTES
// --------------------------
app.use("/public/salon", salonPublicRoutes);

app.use("/public/appointments", appointmentPublicRoutes);

app.use("/public/services", servicePublicRoutes);

app.use("/public/slots", slotPublicRoutes);

app.use("/public/working-hours", workingHoursPublicRoutes);

app.use("/public/salon", salonImageUploadRoutes);
// --------------------------
// ROOT ROUTE
// --------------------------
app.get("/", (req, res) => {
  res.json({
    message:
      "Welcome to Onligro SaaS Backend 🚀",
  });
});

// --------------------------
// SERVER START
// --------------------------
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log("Server running on port", PORT);
});