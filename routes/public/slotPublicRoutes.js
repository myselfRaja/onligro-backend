// slotsPublicRoutes.js - TEMPORARY TEST
import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    console.log("✅ Public slots route hit");
    
    // ✅ TEMPORARY: Hardcoded slots return karo
    const testSlots = [
      { time: "10:00", capacityLeft: 2 },
      { time: "10:30", capacityLeft: 1 },
      { time: "11:00", capacityLeft: 3 },
      { time: "11:30", capacityLeft: 0 },
      { time: "12:00", capacityLeft: 2 }
    ];
    
    console.log("🎯 Returning test slots for frontend testing");
    return res.json({ slots: testSlots });
    
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;