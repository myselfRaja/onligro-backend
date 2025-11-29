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
res.cookie("token", token, {
  httpOnly: true,
  secure: false, // local me false rahega
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

export default router;
