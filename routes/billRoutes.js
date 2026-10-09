import express from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/authMiddleware.js";

import { Bill } from "../models/Bill.js";
import { Salon } from "../models/Salon.js";
import { Staff } from "../models/Staff.js";
import { Service } from "../models/Service.js";
import { Customer } from "../models/Customer.js";
import Product from "../models/Product.js";
import { Appointment } from "../models/Appointment.js";
import { generateBillNumber } from "../utils/generateBillNumber.js";

const router = express.Router();

// GET ALL BILLS
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { salonId } = req.query;
    let targetSalonId = salonId;

    // Agar salonId query mein nahi hai, toh owner/staff se nikaalo
    if (!targetSalonId) {
      if (req.owner) {
        const salon = await Salon.findOne({ ownerId: req.owner._id });
        targetSalonId = salon?._id;
      } else if (req.staff) {
        targetSalonId = req.staff.salonId;
      }
    }

    if (!targetSalonId) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }

    const bills = await Bill.find({
      salonId: targetSalonId,
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

// GET SINGLE BILL - PUBLIC (No Auth)
router.get("/:id", async (req, res) => {
  try {
   
    
    const bill = await Bill.findById(req.params.id)
      .populate("salonId", "name address phone")
      .populate("services.staff_ids", "name"); 
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    
    res.json({ bill });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
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
  
}).populate("salonId", "name address")
  .populate("services.staff_ids", "name"); 

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
       discount,      // ← ADD
  discountType, 
    } = req.body;

        // ===== 🔥 CHANGE 1: VALIDATION =====
    if (
      !customerName ||
      !customerPhone ||
      !paymentMode ||
      finalAmount === undefined
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    // ✅ NEW: Har service me kam se kam 1 staff hona chahiye
    // (sirf naye format ke liye — jisme staff_ids array hai)
    const hasNewFormat = services && services.some(s => s.staff_ids !== undefined);
    
    if (hasNewFormat) {
      for (const service of services) {
        if (!service.staff_ids || service.staff_ids.length === 0) {
          return res.status(400).json({
            message: "Each service must have at least one staff assigned",
          });
        }
      }
    } else {
      // ✅ Purana format — bill-level staffId required
      if (!staffId) {
        return res.status(400).json({
          message: "Staff is required",
        });
      }
    }

    // 🔥 NEW: Service OR Product check
    if ((!services || services.length === 0) && (!products || products.length === 0)) {
      return res.status(400).json({
        message: "Please select at least one service or product",
      });
    }

    // Find salon
    // Find salon - Owner OR Staff
let salon;
if (req.owner) {
  salon = await Salon.findOne({ ownerId: req.owner._id });
} else if (req.staff) {
  salon = await Salon.findOne({ _id: req.staff.salonId });
}

if (!salon) {
  return res.status(404).json({
    message: "Salon not found",
  });
}

    // Verify staff
        // Verify staff (sirf purane format ke liye)
    let staff = null;
    if (staffId) {
      staff = await Staff.findOne({
        _id: staffId,
        salonId: salon._id,
      });

      if (!staff) {
        return res.status(404).json({
          message: "Staff not found",
        });
      }
    }

    // ===== FETCH SERVICES (ONLY IF PROVIDED) =====
    let billServices = [];
    let serviceTotal = 0;
   if (services && services.length > 0) {
  const serviceIds = services.map(item => item.serviceId);
  
  const selectedServices = await Service.find({
    _id: { $in: serviceIds },
    salonId: salon._id,
  });

  if (selectedServices.length !== serviceIds.length) {
    return res.status(400).json({
      message: "One or more services are invalid",
    });
  }

  // ✅ Naya format — quantity + line_total + staff_ids
  billServices = services.map((item) => {
    const service = selectedServices.find(s => s._id.toString() === item.serviceId);
    
    // Unit price (purana ya naya)
    const unitPrice = item.unit_price !== undefined && Number(item.unit_price) >= 0
      ? Number(item.unit_price)
      : (item.price !== undefined && Number(item.price) >= 0 ? Number(item.price) : service.price);
    
    // Quantity (default 1)
    const quantity = Math.max(1, Number(item.quantity) || 1);
    
    // Line total
    const lineTotal = unitPrice * quantity;

    // Staff assignment (naya ya purana format)
    const staffIds = item.staff_ids && item.staff_ids.length > 0
      ? item.staff_ids
      : (staff ? [staff._id] : []);
    
    const staffNames = item.staff_names && item.staff_names.length > 0
      ? item.staff_names
      : (staff ? [staff.name] : []);

    return {
      serviceId: service._id,
      serviceName: item.serviceName || service.name,
      unit_price: unitPrice,
      quantity: quantity,
      line_total: lineTotal,
      staff_ids: staffIds,
      staff_names: staffNames,
      // Backward compatibility
      price: unitPrice,
      duration: service.duration,
    };
  });

  serviceTotal = billServices.reduce((sum, s) => sum + s.line_total, 0);
    }

    // ===== FETCH PRODUCTS (ONLY IF PROVIDED) =====
    let billProducts = [];
    let productTotal = 0;

    if (products && products.length > 0) {
      const selectedProducts = await Product.find({
        _id: { $in: products.map(p => p.productId) },
        salonId: salon._id,
      });

      if (selectedProducts.length !== products.length) {
        return res.status(400).json({
          message: "One or more products are invalid",
        });
      }

      // Check stock
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

   billProducts = products.map((p) => {
  const product = selectedProducts.find(
    (sp) => sp._id.toString() === p.productId
  );
  const price = p.price !== undefined && Number(p.price) >= 0 
    ? Number(p.price) 
    : product.mrp;
  return {
    productId: product._id,
    productName: p.productName || product.name, // ✅ Custom name use karo
    price: price,
    quantity: p.quantity,
    total: price * p.quantity,
  };
});

productTotal = billProducts.reduce(
  (sum, product) => sum + product.total,
  0
);
    }

    // ===== CALCULATE TOTAL =====
    const totalAmount = serviceTotal + productTotal;

    if (Number(finalAmount) < 0) {
      return res.status(400).json({
        message: "Final amount must be greater than 0",
      });
    }

   // Generate bill number (per salon)
const billNumber = await generateBillNumber(salon._id);

    const ownerId = req.owner ? req.owner._id : req.staff.ownerId;

   // ✅ Bill-level staff (sirf purane format ke liye)
  // Naya format me har service ka apna staff_ids hai
  let billStaffId = null;
  let billStaffName = null;

  if (staff) {
    // Purana format — bill-level staff
    billStaffId = staff._id;
    billStaffName = staff.name;
  } else if (billServices.length > 0 && billServices[0].staff_ids.length > 0) {
    // Naya format — pehle service ka pehla staff as reference
    const firstStaffId = billServices[0].staff_ids[0];
    const firstStaff = await Staff.findById(firstStaffId);
    if (firstStaff) {
      billStaffId = firstStaff._id;
      billStaffName = firstStaff.name;
    }
  }

  const bill = await Bill.create({
  salonId: salon._id,
  ownerId: ownerId,
  billNumber,
  customerName,
  customerPhone,
  services: billServices,
  products: billProducts,
  staffId: billStaffId,        // ✅ Optional
  staffName: billStaffName,    // ✅ Optional
  totalAmount,
  discount: discount || 0,
  discountType: discountType || 'flat',
  taxAmount: 0,
  finalAmount: Number(finalAmount),
  paymentMode,
});
    // Update staff stats
       // ✅ Update staff stats — per-service equal split
    const staffRevenueMap = {};

    for (const service of billServices) {
      const staffCount = service.staff_ids.length;
      if (staffCount === 0) continue;

      const share = service.line_total / staffCount;

      for (const staffIdItem of service.staff_ids) {
        const id = staffIdItem.toString();
        if (!staffRevenueMap[id]) {
          staffRevenueMap[id] = { revenue: 0, services: 0 };
        }
        staffRevenueMap[id].revenue += share;
        staffRevenueMap[id].services += service.quantity || 1;
      }
    }

    // Ab har staff ko update karo
    for (const [staffIdKey, data] of Object.entries(staffRevenueMap)) {
      await Staff.updateOne(
        { _id: staffIdKey, salonId: salon._id },
        {
          $inc: {
            bookingCount: data.services,
            revenue: data.revenue,
          },
        }
      );
    }

    // Update customer stats
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

    // 🔥 Update Appointment - Mark as Billed
if (req.body.appointmentId) {
  await Appointment.findByIdAndUpdate(req.body.appointmentId, {
    billGenerated: true,
    billId: bill._id,
  });
}

    const populatedBill = await Bill.findById(bill._id)
      .populate("salonId", "name address");

    await session.commitTransaction();
    session.endSession();
    
 // 🔥 Real-time emit - Appointment updated
    if (req.body.appointmentId) {
      req.io.emit("appointment_updated", {
        appointmentId: req.body.appointmentId,
        status: "billed",
      });
    }

    
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
    // ✅ Update staff stats — per-service equal split (reverse)
    const staffRevenueMap = {};

    for (const service of bill.services || []) {
      const staffCount = (service.staff_ids || []).length;
      if (staffCount === 0) continue;

      const share = (service.line_total || service.price * (service.quantity || 1)) / staffCount;

      for (const staffIdItem of service.staff_ids) {
        const id = staffIdItem.toString();
        if (!staffRevenueMap[id]) {
          staffRevenueMap[id] = { revenue: 0, services: 0 };
        }
        staffRevenueMap[id].revenue += share;
        staffRevenueMap[id].services += service.quantity || 1;
      }
    }

    // Ab har staff ko deduct karo
    for (const [staffIdKey, data] of Object.entries(staffRevenueMap)) {
      await Staff.updateOne(
        { _id: staffIdKey, salonId: salon._id },
        {
          $inc: {
            bookingCount: -data.services,
            revenue: -data.revenue,
          },
        }
      );
    }
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