import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Staff } from "../models/Staff.js";
import { Bill } from "../models/Bill.js";
import { Salon } from "../models/Salon.js";
import bcrypt from "bcrypt";
const router = express.Router();

// ADD STAFF (Owner only)
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { name, role, phone, address, gender } = req.body;

    // Get owner's salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found for this owner" });
    }

    // Create staff for this salon
    const staff = await Staff.create({
      name,
      role: role || "Staff",
      phone: phone || "",
      address: address || "",
      gender: gender || "male",
      ownerId: req.owner._id,
      salonId: salon._id,
    });

    res.json({
      message: "Staff added successfully",
      staff,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL STAFF OF OWNER
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

    const staffList = await Staff.find({ salonId: targetSalonId }).lean();
    res.json({ message: "Staff fetched successfully", staff: staffList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// TOGGLE STAFF STATUS
router.put("/toggle-status/:id", authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      ownerId: req.owner._id,
    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.json({
      message: `Staff ${
        staff.isActive ? "activated" : "deactivated"
      } successfully`,
      staff,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
// UPDATE STAFF
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { name, role, phone, address, gender } = req.body;

    const staff = await Staff.findOne({
      _id: req.params.id,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found"
      });
    }

    staff.name = name;
    staff.role = role;
    staff.phone = phone || "";
    staff.address = address || "";
    staff.gender = gender || "male";

    await staff.save();

    res.json({
      message: "Staff updated successfully",
      staff
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
// DELETE STAFF
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const staffId = req.params.id;

    // Validate staff belongs to the owner
    const staff = await Staff.findOne({
      _id: staffId,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found or unauthorized" });
    }

    await Staff.findByIdAndDelete(staffId);

    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Owner sets email/password for staff
router.patch("/:id/set-access", authMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    const staffId = req.params.id;

    // Validate staff belongs to owner
    const staff = await Staff.findOne({
      _id: staffId,
      ownerId: req.owner._id
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Check email unique
    const existing = await Staff.findOne({
      email: email.toLowerCase(),
      _id: { $ne: staffId }
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Email already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update staff
    staff.email = email.toLowerCase();
    staff.password = hashedPassword;
    staff.loginEnabled = true;
    await staff.save();

    // Return without password
    const staffResponse = staff.toObject();
    delete staffResponse.password;

    res.json({
      message: "Staff login access enabled",
      staff: staffResponse
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==================== STAFF DETAILS ====================
// ==================== STAFF DETAILS ====================
router.get("/:id/details", authMiddleware, async (req, res) => {
  try {
    // Salon ID nikalo
    let salonId;
    if (req.owner) {
      const salon = await Salon.findOne({ ownerId: req.owner._id });
      salonId = salon?._id;
    } else if (req.staff) {
      salonId = req.staff.salonId;
    }

    if (!salonId) {
      return res.status(404).json({ success: false, message: "Salon not found" });
    }

    // Staff dhundho
    const staff = await Staff.findOne({
      _id: req.params.id,
      salonId,
    }).lean();

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    // Us staff ke saare bills dhundho
    const bills = await Bill.find({
      salonId,
      billStatus: { $ne: "cancelled" },
      $or: [
        { staffId: staff._id },
        { "services.staff_ids": staff._id },
      ],
    }).lean();

    // Helper: bill se staff ka hissa nikaalo
    function getStaffShare(bill) {
      const services = bill.services || [];
      const isNewBill = services.some(
        (s) => Array.isArray(s.staff_ids) && s.staff_ids.length > 0
      );

      if (!isNewBill) {
        if (bill.staffId?.toString() === staff._id.toString()) {
          return {
            revenue: bill.finalAmount || 0,
            services: 1,
            serviceDetails: services.map((s) => ({
              name: s.serviceName || "Unknown",
              qty: 1,
              revenue: s.price || 0,
            })),
          };
        }
        return { revenue: 0, services: 0, serviceDetails: [] };
      }

      const totalAmount = bill.totalAmount || 0;
      const finalAmount = bill.finalAmount || 0;
      const discountRatio = totalAmount > 0 ? finalAmount / totalAmount : 1;

      let revenue = 0;
      let servicesCount = 0;
      const serviceDetails = [];

      for (const svc of services) {
        const staffIds = svc.staff_ids || [];
        const staffCount = staffIds.length;
        if (staffCount === 0) continue;

        const isInService = staffIds.some(
          (id) => id.toString() === staff._id.toString()
        );
        if (!isInService) continue;

        const lineTotal =
          svc.line_total ??
          (svc.unit_price || svc.price || 0) * (svc.quantity || 1);
        const actual = lineTotal * discountRatio;
        const share = actual / staffCount;
        const qty = svc.quantity || 1;

        revenue += share;
        servicesCount += qty;
        serviceDetails.push({
          name: svc.serviceName || "Unknown",
          qty,
          revenue: Math.round(share),
        });
      }

      return { revenue, services: servicesCount, serviceDetails };
    }

    // Date ranges
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 29);
    monthStart.setHours(0, 0, 0, 0);

    // Stats
    const today = { revenue: 0, services: 0, bills: 0 };
    const week = { revenue: 0, services: 0, bills: 0 };
    const month = { revenue: 0, services: 0, bills: 0 };

    const serviceMap = {};
    const dailyMap = {};

    for (const bill of bills) {
      const share = getStaffShare(bill);
      if (share.revenue === 0 && share.services === 0) continue;

      const billDate = new Date(bill.createdAt);

      if (billDate >= todayStart) {
        today.revenue += share.revenue;
        today.services += share.services;
        today.bills += 1;
      }

      if (billDate >= weekStart) {
        week.revenue += share.revenue;
        week.services += share.services;
        week.bills += 1;
      }

      if (billDate >= monthStart) {
        month.revenue += share.revenue;
        month.services += share.services;
        month.bills += 1;

        for (const sd of share.serviceDetails) {
          if (!serviceMap[sd.name]) serviceMap[sd.name] = { count: 0, revenue: 0 };
          serviceMap[sd.name].count += sd.qty;
          serviceMap[sd.name].revenue += sd.revenue;
        }

        const dateKey = billDate.toISOString().slice(0, 10);
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, services: 0 };
        dailyMap[dateKey].revenue += share.revenue;
        dailyMap[dateKey].services += share.services;
      }
    }

    const topServices = Object.entries(serviceMap)
      .map(([name, v]) => ({
        serviceName: name,
        count: v.count,
        revenue: Math.round(v.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const dailyBreakdown = Object.entries(dailyMap)
      .map(([date, v]) => ({
        date,
        revenue: Math.round(v.revenue),
        services: v.services,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    today.revenue = Math.round(today.revenue);
    week.revenue = Math.round(week.revenue);
    month.revenue = Math.round(month.revenue);

    res.json({
      success: true,
     staff: {
  name: staff.name,
  role: staff.role,
  phone: staff.phone || null,
  address: staff.address || null,
  gender: staff.gender || "male",
  email: staff.email || null,
  joinDate: staff.joinDate || staff.createdAt,
  isActive: staff.isActive,
  baseSalary: staff.baseSalary || 0,
  commissionPercent: staff.commissionPercent || 0,
  productCommissionPercent: staff.productCommissionPercent || 0,
  commissionEarned: staff.commissionEarned || 0,
  advanceBalance: staff.advanceBalance || 0,
},
      today,
      week,
      month,
      topServices,
      dailyBreakdown,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});
export default router;
