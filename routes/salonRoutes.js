import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Salon } from "../models/Salon.js";
import { Owner } from "../models/Owner.js";

const router = express.Router();

// Create salon for owner
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { name, address, city, description } = req.body;

    // Prevent creating 2 salons for 1 owner
    const exists = await Salon.findOne({ ownerId: req.owner._id });
    if (exists) {
      return res.status(400).json({ message: "Salon already exists for this owner" });
    }

    // Create salon
    const salon = await Salon.create({
      ownerId: req.owner._id,
      name,
      address,
      city,
      description
    });

    // Update owner model: set salonId
    await Owner.findByIdAndUpdate(req.owner._id, {
      salonId: salon._id
    });

    res.json({
      message: "Salon created successfully",
      salon
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get salon of logged-in owner
router.get("/my-salon", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.owner._id });

    if (!salon) {
      return res.json({ salon: null });
    }

    return res.json({ salon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update salon
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { name, address, city, description } = req.body;

    const salon = await Salon.findOneAndUpdate(
      { ownerId: req.owner._id },
      { name, address, city, description },
      { new: true }
    );

    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    res.json({ message: "Salon updated", salon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



export default router;
