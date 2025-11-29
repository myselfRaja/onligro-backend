import express from "express";
import mongoose from "mongoose";

import { WorkingHours } from "../../models/WorkingHours.js";

const router = express.Router();

router.get("/:salonId", async (req, res) => {
  try {
    let salonId = req.params.salonId;
    salonId = String(salonId).trim(); // force string

 const hours = await WorkingHours.find({
  salonId: new mongoose.Types.ObjectId(salonId)
});



    return res.json({
      message: "Working hours fetched",
      hours
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});



export default router;
