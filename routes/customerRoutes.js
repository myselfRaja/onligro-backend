import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Customer } from "../models/Customer.js";
import { Salon } from "../models/Salon.js";
import { Bill } from "../models/Bill.js";
const router = express.Router();

// GET ALL CUSTOMERS
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({
      ownerId: req.owner._id,
    });

    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    const customers = await Customer.find({
      salonId: salon._id,
    }).sort({ lastVisit: -1 });

    res.json({
      message: "Customers fetched successfully",
      customers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET SINGLE CUSTOMER

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({
      ownerId: req.owner._id,
    });

    if (!salon) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      salonId: salon._id,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.json({
      message: "Customer fetched successfully",
      customer,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

  // CUSTOMER VISIT HISTORY

router.get("/:id/history", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({
      ownerId: req.owner._id,
    });

    if (!salon) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      salonId: salon._id,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const bills = await Bill.find({
      salonId: salon._id,
      customerPhone: customer.phone,
    }).sort({ createdAt: -1 });

    res.json({
      message: "Customer history fetched successfully",
      customer,
      bills,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});


export default router;