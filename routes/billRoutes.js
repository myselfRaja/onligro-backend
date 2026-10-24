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
import { CustomerWallet } from "../models/CustomerWallet.js";

const router = express.Router();

// GET ALL BILLS
router.get("/all", authMiddleware, async (req, res) => {
  try {
    // ✅ salonId SIRF JWT se nikaalo — query se nahi
    let targetSalonId;

    if (req.owner) {
      const salon = await Salon.findOne({ ownerId: req.owner._id });
      targetSalonId = salon?._id;
    } else if (req.staff) {
      targetSalonId = req.staff.salonId;
    }

    if (!targetSalonId) {
      return res.status(404).json({ message: "Salon not found" });
    }

    // ✅ Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const [bills, totalCount] = await Promise.all([
      Bill.find({ salonId: targetSalonId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bill.countDocuments({ salonId: targetSalonId }),
    ]);

    res.json({
      message: "Bills fetched successfully",
      bills,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
 
  try {
  
    
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

  // ✅ NEW: Staff validation sirf tab jab services hon
// Sirf products wale bill mein staff required nahi
const hasServices = services && services.length > 0;

if (hasServices) {
  const hasNewFormat = services.some(s => s.staff_ids !== undefined);
  
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
}
// Agar sirf products hain — koi staff validation nahi

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
           // ✅ Sirf check karo — deduct baad mein
      for (const item of products) {
        const product = selectedProducts.find(
          (sp) => sp._id.toString() === item.productId
        );

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
  staffId: billStaffId,
  staffName: billStaffName,
  totalAmount,
  discount: discount || 0,
  discountType: discountType || 'flat',
  taxAmount: 0,
  finalAmount: Number(finalAmount),
  paymentMode,
});

// ✅ Stock deduct AFTER bill created (atomic)
if (billProducts.length > 0) {
  for (const item of billProducts) {
    const result = await Product.findOneAndUpdate(
      { 
        _id: item.productId, 
        salonId: salon._id,
        stockQuantity: { $gte: item.quantity }
      },
      { $inc: { stockQuantity: -item.quantity } }
    );
    
    if (!result) {
      // Rollback — bill delete karo
      await Bill.deleteOne({ _id: bill._id });
      return res.status(400).json({
        message: `${item.productName} stock unavailable`,
      });
    }
  }
}

      // ===== ✅ LOYALTY: INDUSTRY-STANDARD LOGIC =====
    // Step 1: Payable amount
    let expectedDiscount = Number(discount) || 0;
    if (discountType === "percent") {
      expectedDiscount = (totalAmount * Number(discount)) / 100;
    }
    const payableAmount = Math.max(0, totalAmount - expectedDiscount);

    // Step 2: Inputs sanitize
    const pointsUsed = Math.max(0, Math.floor(Number(req.body.pointsUsed) || 0));
    const balanceUsed = Math.max(0, Number(req.body.balanceUsed) || 0);
    const dueAdded = Math.max(0, Number(req.body.dueAdded) || 0);
    const cashPaid = Math.max(0, Number(finalAmount) || 0);

    // Step 3: Total payment = payable amount
    const totalPaid = pointsUsed + balanceUsed + dueAdded + cashPaid;
    if (Math.abs(totalPaid - payableAmount) > 1) {
      return res.status(400).json({
        message: `Payment (₹${totalPaid}) bill amount (₹${payableAmount}) se match nahi kar raha.`,
      });
    }

    // Step 4: Due + Cash ek saath nahi
    if (dueAdded > 0 && cashPaid > 0) {
      return res.status(400).json({
        message: `Due aur Cash dono ek saath nahi ho sakte.`,
      });
    }

    // Step 5: Payment mode consistency
    if (dueAdded > 0 && paymentMode !== "Due") {
      return res.status(400).json({
        message: `Due ke saath payment mode "Due" hona chahiye.`,
      });
    }

    if (dueAdded === 0 && paymentMode === "Due") {
      return res.status(400).json({
        message: `Payment mode "Due" hai lekin due amount 0 hai.`,
      });
    }

    // ===== WALLET UPDATE =====
    const loyaltySettings = salon.loyaltySettings || {};
    const loyaltyEnabled = loyaltySettings.enabled || false;

    if (loyaltyEnabled) {
      let wallet = await CustomerWallet.findOne({
        salonId: salon._id,
        customerPhone,
      });

     if (!wallet) {
  wallet = new CustomerWallet({
    salonId: salon._id,
    customerPhone,
    customerName: customerName || "",
  });
  await wallet.save();   // ✅ Ye line add karo
}

      // Available check
      if (pointsUsed > wallet.points) {
        return res.status(400).json({
          message: `Insufficient points. Available: ${wallet.points}, Requested: ${pointsUsed}`,
        });
      }

      if (balanceUsed > wallet.balance) {
        return res.status(400).json({
          message: `Insufficient balance. Available: ₹${wallet.balance}, Requested: ₹${balanceUsed}`,
        });
      }

          // ✅ Points earn (cash paid pe)
      const pointsPerRupee = loyaltySettings.pointsPerRupee || 0.01;
      const pointsEarned = Math.floor(cashPaid * pointsPerRupee);

      // ✅ Build atomic update
      const walletUpdate = {
        $inc: {
          points: pointsEarned - pointsUsed,
          balance: -balanceUsed - dueAdded,
        },
      };

      const transactions = [];
      if (pointsEarned > 0) {
        transactions.push({
          type: "points_earned",
          points: pointsEarned,
          billId: bill._id,
          note: `Earned on bill ${bill.billNumber}: ${pointsEarned} points`,
          createdAt: new Date(),
        });
      }
      if (pointsUsed > 0) {
        transactions.push({
          type: "points_redeemed",
          points: pointsUsed,
          billId: bill._id,
          note: `Redeemed on bill ${bill.billNumber}: ${pointsUsed} points`,
          createdAt: new Date(),
        });
      }
      if (balanceUsed > 0) {
        transactions.push({
          type: "balance_used",
          amount: balanceUsed,
          billId: bill._id,
          note: `Balance used on bill ${bill.billNumber}: ₹${balanceUsed}`,
          createdAt: new Date(),
        });
      }
      if (dueAdded > 0) {
        transactions.push({
          type: "due_added",
          amount: dueAdded,
          billId: bill._id,
          note: `Due added on bill ${bill.billNumber}: ₹${dueAdded}`,
          createdAt: new Date(),
        });
      }

      if (transactions.length > 0) {
        walletUpdate.$push = { transactions: { $each: transactions } };
      }

      // ✅ Atomic wallet update
      await CustomerWallet.updateOne({ _id: wallet._id }, walletUpdate);

      // Bill pe loyalty data save
      bill.pointsEarned = pointsEarned;
      bill.pointsUsed = pointsUsed;
      bill.balanceUsed = balanceUsed;
      bill.dueAdded = dueAdded;
      await bill.save();
    }
    // ===== END LOYALTY =====
    
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

    // ===== ✅ LOYALTY: WALLET REVERSE =====
    const loyaltySettingsDelete = salon.loyaltySettings || {};
    const loyaltyEnabledDelete = loyaltySettingsDelete.enabled || false;

    if (loyaltyEnabledDelete) {
      const walletToReverse = await CustomerWallet.findOne({
        salonId: salon._id,
        customerPhone: bill.customerPhone,
      });

      if (walletToReverse) {
        // 1. Points earned wapas lo
        if (bill.pointsEarned > 0) {
          walletToReverse.points -= bill.pointsEarned;
          walletToReverse.transactions.push({
            type: "points_earned_reversed",
            points: -bill.pointsEarned,
            billId: bill._id,
            note: `Bill ${bill.billNumber} deleted: ${bill.pointsEarned} points reversed`,
          });
        }

        // 2. Points used wapas do
        if (bill.pointsUsed > 0) {
          walletToReverse.points += bill.pointsUsed;
          walletToReverse.transactions.push({
            type: "points_redeemed_reversed",
            points: bill.pointsUsed,
            billId: bill._id,
            note: `Bill ${bill.billNumber} deleted: ${bill.pointsUsed} points restored`,
          });
        }

        // 3. Balance used wapas do
        if (bill.balanceUsed > 0) {
          walletToReverse.balance += bill.balanceUsed;
          walletToReverse.transactions.push({
            type: "balance_used_reversed",
            amount: bill.balanceUsed,
            billId: bill._id,
            note: `Bill ${bill.billNumber} deleted: ₹${bill.balanceUsed} balance restored`,
          });
        }

        // 4. Due added wapas lo
        if (bill.dueAdded > 0) {
          walletToReverse.balance += bill.dueAdded;
          walletToReverse.transactions.push({
            type: "due_added_reversed",
            amount: -bill.dueAdded,
            billId: bill._id,
            note: `Bill ${bill.billNumber} deleted: ₹${bill.dueAdded} due removed`,
          });
        }

        await walletToReverse.save();
      }
    }
    // ===== END LOYALTY REVERSE =====
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