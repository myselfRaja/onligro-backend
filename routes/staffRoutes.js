import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Staff } from "../models/Staff.js";
import { Salon } from "../models/Salon.js";

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
    // Find salon of the owner
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    // Get staff linked to that salon
    const staffList = await Staff.find({ salonId: salon._id });

    res.json({
      message: "Staff fetched successfully",
      staff: staffList,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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



export default router;
