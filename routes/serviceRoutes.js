import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Service } from "../models/Service.js";
import { Salon } from "../models/Salon.js";

const router = express.Router();

// ADD SERVICE
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { name, price, duration } = req.body;

    if (!name || !price || !duration) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get owner's salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    // Create service
    const service = await Service.create({
      name,
      price,
      duration,
      ownerId: req.owner._id,
      salonId: salon._id
    });

    res.json({
      message: "Service added successfully",
      service
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL SERVICES OF OWNER
router.get("/all", authMiddleware, async (req, res) => {
  try {
    // Find salon of owner
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    // Get services linked to that salon
    const services = await Service.find({ salonId: salon._id });

    res.json({
      message: "Services fetched successfully",
      services
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// serviceRoutes.js - Add this PUBLIC route

// Get services by salon ID (PUBLIC route)
router.get("/salon/:salonId", async (req, res) => {
  try {
    const { salonId } = req.params;
    
    const services = await Service.find({ 
      salonId: salonId,
      isActive: true 
    }).sort({ name: 1 });

    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SERVICE
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Check if service belongs to this owner
    const service = await Service.findOne({
      _id: serviceId,
      ownerId: req.owner._id
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found or unauthorized" });
    }

    await Service.findByIdAndDelete(serviceId);

    res.json({ message: "Service deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



export default router;
