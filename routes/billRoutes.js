import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

import { Bill } from "../models/Bill.js";
import { Salon } from "../models/Salon.js";
import { Staff } from "../models/Staff.js";
import { Service } from "../models/Service.js";
import { Customer } from "../models/Customer.js";

import { generateBillNumber } from "../utils/generateBillNumber.js";

const router = express.Router();

// GET ALL BILLS
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({
      ownerId: req.owner._id,
    });

    if (!salon) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }

    const bills = await Bill.find({
      salonId: salon._id,
    }).sort({ createdAt: -1 });

    res.json({
      message: "Bills fetched successfully",
      bills,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET SINGLE BILL
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

   const bill = await Bill.findOne({
  _id: req.params.id,
  salonId: salon._id,
}).populate("salonId", "name address");

    if (!bill) {
      return res.status(404).json({
        message: "Bill not found",
      });
    }

    res.json({
      bill,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// CREATE BILL
router.post("/add", authMiddleware, async (req, res) => {
  try {
   const {
  customerName,
  customerPhone,
  services,
  staffId,
  finalAmount,
  paymentMode,
} = req.body;

    // Validation
    if (
      !customerName ||
      !customerPhone ||
      !services?.length ||
      !staffId ||
      !paymentMode ||
       finalAmount === undefined
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    // Find salon
    const salon = await Salon.findOne({
      ownerId: req.owner._id,
    });

    if (!salon) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }

    // Verify staff
    const staff = await Staff.findOne({
      _id: staffId,
      salonId: salon._id,
    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    // Fetch selected services
    const selectedServices = await Service.find({
      _id: { $in: services },
      salonId: salon._id,
    });

    if (selectedServices.length !== services.length) {
      return res.status(400).json({
        message: "One or more services are invalid",
      });
    }

    // Calculate total
    const totalAmount = selectedServices.reduce(
      (sum, service) => sum + service.price,
      0
    );
if (Number(finalAmount) < 0) {
  return res.status(400).json({
    message: "Final amount must be greater than 0",
  });
}


    // Generate bill number
    const billNumber = await generateBillNumber();

    // Service snapshot
    const billServices = selectedServices.map((service) => ({
      serviceId: service._id,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
    }));

    // Create bill
    const bill = await Bill.create({
      salonId: salon._id,
      ownerId: req.owner._id,

      billNumber,

      customerName,
      customerPhone,

      services: billServices,

      staffId: staff._id,
      staffName: staff.name,
totalAmount,

taxAmount: 0,

finalAmount: Number(finalAmount),

      paymentMode,
    });

await Customer.findOneAndUpdate(
  {
    salonId: salon._id,
    phone: customerPhone,
  },
  {
    $set: {
      name: customerName,
      phone: customerPhone,
      salonId: salon._id,
       lastVisit: new Date(),
    },
    $inc: {
      totalVisits: 1,
     totalSpent: Math.max(0, Number(finalAmount)),
    },
  },
  { upsert: true, new: true }
);

const populatedBill = await Bill.findById(bill._id)
  .populate("salonId", "name address");

    res.status(201).json({
      message: "Bill created successfully",
         bill: populatedBill,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});




export default router;