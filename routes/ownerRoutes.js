import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Owner } from "../models/Owner.js";
import { Salon } from "../models/Salon.js";

const router = express.Router();

// GET OWNER PROFILE
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const owner = await Owner.findById(req.owner._id).select("-password");
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const salon = await Salon.findOne({ ownerId: req.owner._id });

    return res.json({
      message: "Owner profile fetched successfully",
      owner,
      salon,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
