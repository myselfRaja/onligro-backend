import express from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/authMiddleware.js";

import { Bill } from "../models/Bill.js";
import { Salon } from "../models/Salon.js";
import { Staff } from "../models/Staff.js";
import { Service } from "../models/Service.js";
import { Customer } from "../models/Customer.js";
import Product from "../models/Product.js";

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
let session;
  try {
     session = await mongoose.startSession();
session.startTransaction();
   const {
  customerName,
  customerPhone,
  services,
  staffId,
  finalAmount,
  paymentMode,
  products,
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
let billProducts = [];

if (products?.length > 0) {
  const selectedProducts = await Product.find({
    _id: { $in: products.map(p => p.productId) },
    salonId: salon._id,
  });

  if (selectedProducts.length !== products.length) {
    return res.status(400).json({
      message: "One or more products are invalid",
    });
  }

  billProducts = products.map((p) => {
    const product = selectedProducts.find(
      (sp) => sp._id.toString() === p.productId
    );

    return {
      productId: product._id,
      productName: product.name,
      price: product.mrp,
      quantity: p.quantity,
      total: product.mrp * p.quantity,
    };
  });
}
    if (selectedServices.length !== services.length) {
      return res.status(400).json({
        message: "One or more services are invalid",
      });
    }

    // Calculate total
    const serviceTotal = selectedServices.reduce(
  (sum, service) => sum + service.price,
  0
);

const productTotal = billProducts.reduce(
  (sum, product) => sum + product.total,
  0
);

const totalAmount = serviceTotal + productTotal;
if (Number(finalAmount) < 0) {
  return res.status(400).json({
    message: "Final amount must be greater than 0",
  });
}

// Check product stock and deduct
if (products?.length > 0) {
  for (const item of products) {
    const product = await Product.findOne({
      _id: item.productId,
      salonId: salon._id,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (product.stockQuantity < item.quantity) {
      return res.status(400).json({
        message: `${product.name} stock unavailable`,
      });
    }

    product.stockQuantity -= item.quantity;

    await product.save();
  }
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
      products: billProducts,

      staffId: staff._id,
      staffName: staff.name,
totalAmount,

taxAmount: 0,

finalAmount: Number(finalAmount),

      paymentMode,
    });
await Staff.updateOne(
  {
    _id: staff._id,
    salonId: salon._id,
  },
  {
    $inc: {
      bookingCount: 1,
      revenue: Number(finalAmount),
    },
  }
);
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

  await session.commitTransaction();
session.endSession();

    res.status(201).json({
      message: "Bill created successfully",
         bill: populatedBill,
    });
} catch (err) {
  if (session) {
    await session.abortTransaction();
    session.endSession();
  }

  res.status(500).json({
    error: err.message,
  });
}
});

// DELETE BILL
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    const bill = await Bill.findOne({
      _id: req.params.id,
      salonId: salon._id,
    });

    console.log("Bill products:", bill.products);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    // ✅ Update customer stats (deduct bill amount)
    await Customer.updateOne(
      { phone: bill.customerPhone, salonId: salon._id },
      {
        $inc: {
          totalVisits: -1,
          totalSpent: -(bill.finalAmount || 0),
        },
      }
    );

    // ✅ Update staff stats (deduct bill amount)
    await Staff.updateOne(
      { _id: bill.staffId, salonId: salon._id },
      {
        $inc: {
          bookingCount: -1,
          revenue: -(bill.finalAmount || 0),
        },
      }
    );

    // Restore product stock when bill is deleted
if (bill.products?.length > 0) {
  for (const item of bill.products) {
    await Product.findOneAndUpdate(
      {
        _id: item.productId,
        salonId: salon._id
      },
      {
        $inc: {
          stockQuantity: item.quantity
        }
      }
    );
  }
}
    // ✅ Delete the bill
    await Bill.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: "Bill deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


export default router;