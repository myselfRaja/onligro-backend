import express from "express";
import { Service } from "../../models/Service.js";

const router = express.Router();

// ====================================
// PUBLIC: GET SERVICES BY SALON ID
// ====================================
router.get("/:salonId", async (req, res) => {
  try {
    const { salonId } = req.params;

    const services = await Service.find({ salonId });

    return res.json({
      message: "Services fetched successfully",
      services
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
