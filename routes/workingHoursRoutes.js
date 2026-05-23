import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { WorkingHours } from "../models/WorkingHours.js";
import { Salon } from "../models/Salon.js";

const router = express.Router();

// SET OR UPDATE WORKING HOURS
router.post("/set", authMiddleware, async (req, res) => {
  try {
    const { hours } = req.body;
    // hours = array of 7 objects (mon–sun)

    if (!Array.isArray(hours) || hours.length !== 7) {
      return res.status(400).json({ message: "7 days data required" });
    }

    // find salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) return res.status(400).json({ message: "Salon not found" });

    // loop and update/insert each day
    const results = [];

    for (let day of hours) {
      const updated = await WorkingHours.findOneAndUpdate(
        { salonId: salon._id, dayOfWeek: day.dayOfWeek },
        {
          openTime: day.openTime,
          closeTime: day.closeTime,
          isClosed: day.isClosed
        },
        { upsert: true, new: true }
      );

      results.push(updated);
    }

    res.json({
      message: "Working hours updated successfully",
      workingHours: results
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET WORKING HOURS OF SALON
router.get("/get", authMiddleware, async (req, res) => {
  try {
    // find salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) return res.status(400).json({ message: "Salon not found" });

    const hours = await WorkingHours.find({ salonId: salon._id });

    res.json({
      message: "Working hours fetched successfully",
      hours
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
