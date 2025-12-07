import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Owner } from "../models/Owner.js";

const router = express.Router();

// --------------------------
// REGISTER NEW OWNER
// --------------------------
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if owner exists
    const exists = await Owner.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create owner
    const owner = await Owner.create({
      name,
      email,
      phone,
      password: hashed,
    });

    const safeOwner = {
      _id: owner._id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      createdAt: owner.createdAt,
    };

    return res.json({
      message: "Owner registered successfully",
      owner: safeOwner,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------
// LOGIN OWNER
// --------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: owner._id, email: owner.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // SEND COOKIE ONLY — NO token in JSON
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",   
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const safeOwner = {
      _id: owner._id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      createdAt: owner.createdAt,
    };

    // Response WITHOUT token
    return res.json({
      message: "Login successful",
      owner: safeOwner,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------
// ✅ ADD THIS: LOGOUT OWNER
// --------------------------
router.post("/logout", (req, res) => {
  console.log("🔵 LOGOUT ROUTE CALLED");
  
  // Clear the cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  
  console.log("🟢 Cookie cleared successfully");
  
  res.json({ 
    success: true, 
    message: "Logged out successfully" 
  });
});

// --------------------------
// ✅ ADD THIS: VERIFY OWNER (for frontend auth check)
// --------------------------
router.get("/verify", async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: "No token" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Owner.findById(decoded.id).select("-password");
    
    if (!owner) {
      res.clearCookie("token");
      return res.status(401).json({ message: "Owner not found" });
    }
    
    res.json({ owner });
    
  } catch (err) {
    res.clearCookie("token");
    return res.status(401).json({ message: "Invalid token" });
  }
});

export default router;