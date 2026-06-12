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

// --------------------------
// MIDDLEWARES
// --------------------------
const allowedOrigins = [
  "http://localhost:3000",
  "https://onligro.com",
  "https://www.onligro.com"
];

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
  console.log("Socket connected:", socket.id);
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