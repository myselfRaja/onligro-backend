import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Staff } from "../models/Staff.js";
import { Salon } from "../models/Salon.js";
import bcrypt from "bcrypt";
const router = express.Router();

// ADD STAFF (Owner only)
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { name, role } = req.body;

    // Get owner's salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found for this owner" });
    }

    // Create staff for this salon
    const staff = await Staff.create({
      name,
      role,
      ownerId: req.owner._id,
      salonId: salon._id,
    });

    res.json({
      message: "Staff added successfully",
      staff,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL STAFF OF OWNER
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { salonId } = req.query;
    let targetSalonId = salonId;

    if (!targetSalonId) {
      if (req.owner) {
        const salon = await Salon.findOne({ ownerId: req.owner._id });
        targetSalonId = salon?._id;
      } else if (req.staff) {
        targetSalonId = req.staff.salonId;
      }
    }

    if (!targetSalonId) {
      return res.status(404).json({ message: "Salon not found" });
    }

    const staffList = await Staff.find({ salonId: targetSalonId });
    res.json({ message: "Staff fetched successfully", staff: staffList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TOGGLE STAFF STATUS
router.put("/toggle-status/:id", authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      ownerId: req.owner._id,
    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.json({
      message: `Staff ${
        staff.isActive ? "activated" : "deactivated"
      } successfully`,
      staff,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
// UPDATE STAFF
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { name, role } = req.body;

    const staff = await Staff.findOne({
      _id: req.params.id,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found"
      });
    }

    staff.name = name;
    staff.role = role;

    await staff.save();

    res.json({
      message: "Staff updated successfully",
      staff
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
// DELETE STAFF
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const staffId = req.params.id;

    // Validate staff belongs to the owner
    const staff = await Staff.findOne({
      _id: staffId,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found or unauthorized" });
    }

    await Staff.findByIdAndDelete(staffId);

    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Owner sets email/password for staff
router.patch("/:id/set-access", authMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    const staffId = req.params.id;

    // Validate staff belongs to owner
    const staff = await Staff.findOne({
      _id: staffId,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Check email unique
    const existing = await Staff.findOne({
      email: email.toLowerCase(),
      _id: { $ne: staffId }
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Email already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update staff
    staff.email = email.toLowerCase();
    staff.password = hashedPassword;
    staff.loginEnabled = true;
    await staff.save();

    // Return without password
    const staffResponse = staff.toObject();
    delete staffResponse.password;

    res.json({
      message: "Staff login access enabled",
      staff: staffResponse
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
