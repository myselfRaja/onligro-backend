import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Owner } from "../models/Owner.js";

const router = express.Router();

// --------------------------
// VERIFY AUTH
// --------------------------
router.get("/verify", async (req, res) => {

  try {

    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

   const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const owner = await Owner.findById(decoded.id).select("-password");

    if (!owner) {
      return res.status(401).json({
        message: "Owner not found",
      });
    }

    return res.json({
      success: true,
      owner,
    });

  } catch (err) {

    return res.status(401).json({
      message: "Invalid token",
    });
  }
});
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

    // Check email
    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // JWT Token
    const token = jwt.sign(
      { id: owner._id, email: owner.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set token in cookie
const isProduction = process.env.NODE_ENV === "production";

res.cookie("token", token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});


  const safeOwner = {
  _id: owner._id,
  name: owner.name,
  email: owner.email,
  phone: owner.phone,
  createdAt: owner.createdAt,
};

return res.json({
  message: "Login successful",
  token,
  owner: safeOwner,
});

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------
// LOGOUT OWNER
// --------------------------
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });

  return res.json({
    message: "Logout successful",
  });
});

export default router;
