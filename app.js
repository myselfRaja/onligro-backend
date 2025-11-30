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

import salonPublicRoutes from "./routes/public/salonPublicRoutes.js";
import servicePublicRoutes from "./routes/public/servicePublicRoutes.js";
import slotPublicRoutes from "./routes/public/slotPublicRoutes.js";
import workingHoursPublicRoutes from "./routes/public/workingHoursPublicRoutes.js";
import salonImageUploadRoutes from "./routes/public/salonImageUpload.js";
import appointmentPublicRoutes from "./routes/public/appointmentPublicRoutes.js";

import ownerRoutes from "./routes/ownerRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";

// --------------------------
// DATABASE CONNECT
// --------------------------
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected (Atlas)");
  } catch (err) {
    console.log("MongoDB Error:", err.message);
  }
}
connectDB();

// --------------------------
// CREATE APP  ★ REQUIRED ★
// --------------------------
const app = express();

// --------------------------
// CORS CONFIG
// --------------------------
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://onligro.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options(/.*/, cors());


// --------------------------
// MIDDLEWARES
// --------------------------
app.use(express.json());
app.use(cookieParser());

// --------------------------
// SOCKET SERVER INIT
// --------------------------
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://onligro.vercel.app"
    ],
    credentials: true,
  },
});

// Attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

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

app.use("/public/salon", salonPublicRoutes);
app.use("/public/services", servicePublicRoutes);
app.use("/public/slots", slotPublicRoutes);
app.use("/public/working-hours", workingHoursPublicRoutes);
app.use("/public/appointments", appointmentPublicRoutes);
app.use("/public/salon", salonImageUploadRoutes);

app.use("/owner", ownerRoutes);
app.use("/protected", protectedRoutes);

// --------------------------
// DEFAULT ROUTE
// --------------------------
app.get("/", (req, res) => {
  res.json({
    message:
      "Welcome to Onligro! Your backend is running successfully."
  });
});

// --------------------------
// SOCKET.IO EVENTS
// --------------------------
io.on("connection", () => {
  console.log("Socket connected");
});

// --------------------------
// SERVER START
// --------------------------
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
