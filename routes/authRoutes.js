import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import PasswordReset from "../models/PasswordReset.js";
import { sendEmail } from "../utils/email.js";    
import { Owner } from "../models/Owner.js";
import { Staff } from "../models/Staff.js";  // ✅ Import Staff

const router = express.Router();

// ===============================================
// ✅ STAFF LOGIN (NEW ROUTE)
// ===============================================

router.post("/staff-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await Staff.findOne({ 
      email: email.toLowerCase(),
      loginEnabled: true,
      isActive: true 
    }).select("+password");

    if (!staff) {
      return res.status(400).json({ 
        message: "Invalid credentials or login not enabled" 
      });
    }

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { 
        id: staff._id, 
        email: staff.email, 
        role: "staff",
        salonId: staff.salonId 
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ PRODUCTION COOKIE SETTINGS
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const staffResponse = staff.toObject();
    delete staffResponse.password;

    res.json({
      message: "Staff login successful",
      staff: staffResponse
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================================
// ✅ VERIFY AUTH (Modified to support both)
// ===============================================

router.get("/verify", async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Check if Owner
    if (decoded.role === "owner") {
      const owner = await Owner.findById(decoded.id).select("-password");
      if (!owner) {
        return res.status(401).json({ message: "Owner not found" });
      }
      const ownerData = { ...owner.toObject(), role: "owner" };
      return res.json({
        success: true,
        user: ownerData,
        owner: ownerData  // Backward compatible
      });
    }

    // ✅ Check if Staff
    if (decoded.role === "staff") {
      const staff = await Staff.findById(decoded.id).select("-password");
      if (!staff) {
        return res.status(401).json({ message: "Staff not found" });
      }
      if (!staff.isActive) {
        return res.status(401).json({ message: "Account deactivated" });
      }
      const staffData = { ...staff.toObject(), role: "staff" };
      return res.json({
        success: true,
        user: staffData,
        staff: staffData  // Backward compatible
      });
    }

    return res.status(401).json({ message: "Invalid role" });

  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

// ===============================================
// ✅ OTHER ROUTES (Unchanged)
// ===============================================



// 1. FORGOT PASSWORD – Send OTP
// ======a======================================

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.json({
        success: true,
        message: "If email exists, OTP sent",
      });
    }

    // ✅ OTP Generate
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedToken = crypto.createHash("sha256").update(otp).digest("hex");

    await PasswordReset.create({
      ownerId: owner._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });


    // ✅ Send Email
    const emailResult = await sendEmail({
      to: email,
      subject: "Password Reset OTP - Onligro",
      html: `
        <h2>🔐 Password Reset Request</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, ignore this email.</p>
        <hr />
        <p style="color: #888; font-size: 12px;">Onligro - Salon Management</p>
      `,
    });

    if (!emailResult.success) {
      console.error("Email send failed:", emailResult.error);
    }

    res.json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
});

// ============================================
// 2. VERIFY OTP
// ============================================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const resetRecord = await PasswordReset.findOne({
      ownerId: owner._id,
      token: hashedOTP,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP verified",
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
});

// ============================================
// 3. RESET PASSWORD
// ============================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const resetRecord = await PasswordReset.findOne({
      ownerId: owner._id,
      token: hashedOTP,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    owner.password = hashedPassword;
    await owner.save();

    resetRecord.used = true;
    await resetRecord.save();

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: "Password Reset Successful - Onligro",
      html: `
        <h2>✅ Password Reset Successful</h2>
        <p>Your password has been changed successfully.</p>
        <p>If you didn't do this, please contact support immediately.</p>
        <hr />
        <p style="color: #888; font-size: 12px;">Onligro - Salon Management</p>
      `,
    });

    res.json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
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
      { id: owner._id, email: owner.email, role: "owner" },

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
  role: "owner"   // ✅ YEH ADD KARO
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
