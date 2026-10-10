import express from "express";
import { Bill } from "../models/Bill.js";
import { Staff } from "../models/Staff.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ==================== SUMMARY API ====================
// ==================== SUMMARY API ====================
router.get("/summary", authMiddleware, async (req, res) => {
  
  try {

    const { startDate, endDate } = req.query;

  let salonId;
if (req.owner) {
  salonId = req.owner.salonId;
} else if (req.staff) {
  salonId = req.staff.salonId;
}

    if (!salonId) {
      return res.status(400).json({
        success: false,
        message: "Salon not found",
      });
    }

    let query = { salonId };

    if (startDate && endDate) {

      const start = new Date(startDate);

      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);

       query.createdAt = {
    $gte: start,
    $lte: end,
  };
}

const bills = await Bill.find(query);



const totalRevenue = bills.reduce(
  (sum, bill) => sum + bill.finalAmount,
  0
);

const totalBills = bills.length;

const avgBillValue =
  totalBills > 0
    ? Math.round(totalRevenue / totalBills)
    : 0;

const customerPhones = [
  ...new Set(
    bills
      .map((bill) => bill.customerPhone)
      .filter(Boolean)
  )
];

let repeatCustomers = 0;

for (const phone of customerPhones) {

  const totalVisits =
    await Bill.countDocuments({
      salonId,
      customerPhone: phone
    });

  if (totalVisits > 1) {
    repeatCustomers++;
  }
}

const totalCustomers = customerPhones.length;

    const repeatCustomerPercentage =
      totalCustomers > 0
        ? Math.round(
            (repeatCustomers / totalCustomers) * 100
          )
        : 0;

res.json({
  success: true,
  summary: {
    totalRevenue,
    totalBills,
    avgBillValue,
    repeatCustomerPercentage,
  },
});

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
});
// ==================== REVENUE OVERVIEW API ====================
// ==================== REVENUE OVERVIEW API ====================
router.get("/revenue-overview", authMiddleware, async (req, res) => {
  
  try {

    const { startDate, endDate } = req.query;

  let salonId;
if (req.owner) {
  salonId = req.owner.salonId;
} else if (req.staff) {
  salonId = req.staff.salonId;
}

    if (!salonId) {
      return res.status(400).json({
        success: false,
        message: "Salon not found",
      });
    }

    let query = { salonId };

    if (startDate && endDate) {

      const start = new Date(startDate);

      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);

      query.startAt = {
        $gte: start,
        $lte: end,
      };
    }



const bills = await Bill.find(query);
const revenueMap = {};
bills.forEach((bill) => {

  const date = new Date(bill.createdAt);

      const day = date.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
        }
      );

     revenueMap[day] =
  (revenueMap[day] || 0) +
  (bill.finalAmount ?? 0);

    });

    const chartData = Object.entries(revenueMap)
      .map(([date, revenue]) => ({
        date,
        revenue,
      }));

    res.json({
      success: true,
      chartData,
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
});

// ==================== TOP SERVICES API ====================
// ==================== TOP SERVICES API ====================
router.get("/top-services", authMiddleware, async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

   let salonId;
if (req.owner) {
  salonId = req.owner.salonId;
} else if (req.staff) {
  salonId = req.staff.salonId;
}

    if (!salonId) {
      return res.status(400).json({
        success: false,
        message: "Salon not found",
      });
    }

    let matchCondition = { salonId };

    if (startDate && endDate) {

      const start = new Date(startDate);

      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);

     matchCondition.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    const data = await Bill.aggregate([
  {
    $match: matchCondition,
  },

  {
    $unwind: "$services",
  },

  {
    $group: {
      _id: "$services.serviceName",

      count: {
        $sum: 1,
      },

      revenue: {
        $sum: "$services.price",
      },
    },
  },

  {
    $sort: {
      count: -1,
      revenue: -1,
    },
  },
]);

    res.json({
      success: true,
      data,
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
    });

  }
});

// ==================== STAFF PERFORMANCE API ====================
// ==================== STAFF PERFORMANCE API ====================
// ==================== STAFF PERFORMANCE API ====================
router.get("/staff-performance", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let salonId;
    if (req.owner) salonId = req.owner.salonId;
    else if (req.staff) salonId = req.staff.salonId;

    if (!salonId) {
      return res.status(400).json({ success: false, message: "Salon not found" });
    }

    let matchCondition = { salonId };

    // Timezone abhi purana hi (aapne bola rehne do)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchCondition.createdAt = { $gte: start, $lte: end };
    }

    const bills = await Bill.find(matchCondition).lean();

    // staffStats[staffId] = { actualRevenue, bookings, services }
    const staffStats = {};

    const ensureStaff = (staffId) => {
      if (!staffStats[staffId]) {
        staffStats[staffId] = {
          actualRevenue: 0,
          bookings: 0,
          services: {},
        };
      }
    };

    const addService = (staffId, serviceName, count, actual) => {
      const s = staffStats[staffId].services;
      if (!s[serviceName]) {
        s[serviceName] = { count: 0, actual: 0 };
      }
      s[serviceName].count += count;
      s[serviceName].actual += actual;
    };

    for (const bill of bills) {
      if (bill.billStatus === "cancelled") continue;

      const services = bill.services || [];
      const isNewBill = services.some(
        (s) => Array.isArray(s.staff_ids) && s.staff_ids.length > 0
      );

      // ---------- OLD BILL ----------
      // Poora finalAmount bill.staffId ko (locked)
      if (!isNewBill) {
        if (!bill.staffId) continue;

        const staffId = bill.staffId.toString();
        ensureStaff(staffId);

        const amt = bill.finalAmount || 0;
        staffStats[staffId].actualRevenue += amt;
        staffStats[staffId].bookings += 1;

        // Service breakdown (best effort — old bills mein data adhoora hai)
        for (const svc of services) {
          const name = svc.serviceName || "Unknown Service";
          addService(staffId, name, 1, svc.price || 0);
        }

        continue;
      }

      // ---------- NEW BILL ----------
      const totalAmount = bill.totalAmount || 0;
      const finalAmount = bill.finalAmount || 0;
      const discountRatio = totalAmount > 0 ? finalAmount / totalAmount : 1;

      for (const svc of services) {
        const staffIds = Array.isArray(svc.staff_ids) ? svc.staff_ids : [];
        const qty = svc.quantity || 1;

        const lineTotal =
          svc.line_total ??
          (svc.unit_price || svc.price || 0) * qty;

        const actualTotal = lineTotal * discountRatio;
        const serviceName = svc.serviceName || "Unknown Service";

        if (staffIds.length === 0) {
          // Unassigned
          ensureStaff("unassigned");
          staffStats["unassigned"].actualRevenue += actualTotal;
          staffStats["unassigned"].bookings += qty;
          addService("unassigned", serviceName, qty, actualTotal);
          continue;
        }

        const actualPer = actualTotal / staffIds.length;

        for (const sid of staffIds) {
          const staffId = sid.toString();
          ensureStaff(staffId);

          staffStats[staffId].actualRevenue += actualPer;
          staffStats[staffId].bookings += qty;
          addService(staffId, serviceName, qty, actualPer);
        }
      }
    }

    // Staff names bulk fetch
    const realIds = Object.keys(staffStats).filter((id) => id !== "unassigned");
    const staffDocs = await Staff.find({ _id: { $in: realIds } })
      .select("name")
      .lean();

    const nameMap = {};
    for (const s of staffDocs) nameMap[s._id.toString()] = s.name;

    // Final array
    const data = Object.entries(staffStats).map(([staffId, stats]) => {
      const servicesArr = Object.entries(stats.services)
        .map(([name, v]) => ({
          serviceName: name,
          count: v.count,
          actualRevenue: Math.round(v.actual),
        }))
        .sort((a, b) => b.actualRevenue - a.actualRevenue);

      return {
        staffId: staffId === "unassigned" ? null : staffId,
        staffName:
          staffId === "unassigned"
            ? "Unassigned"
            : nameMap[staffId] || "Unknown",
        actualRevenue: Math.round(stats.actualRevenue),
        bookings: stats.bookings,
        services: servicesArr,
      };
    });

    data.sort((a, b) => {
      if (a.staffId === null) return 1;
      if (b.staffId === null) return -1;
      return b.actualRevenue - a.actualRevenue;
    });

    // ✅ TOTALS — data se sum karo (Qty mismatch fix)
    const totals = data.reduce(
      (acc, s) => {
        acc.actualRevenue += s.actualRevenue;
        acc.bookings += s.bookings;
        return acc;
      },
      { actualRevenue: 0, bookings: 0 }
    );

    res.json({
      success: true,
      data,
      totals,
      startDate: startDate || null,
      endDate: endDate || null,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==================== PEAK HOURS API ====================
// ==================== PEAK HOURS API ====================
router.get("/peak-hours", authMiddleware, async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

 let salonId;
if (req.owner) {
  salonId = req.owner.salonId;
} else if (req.staff) {
  salonId = req.staff.salonId;
}

    if (!salonId) {
      return res.status(400).json({
        success: false,
        message: "Salon not found",
      });
    }

    let query = { salonId };

    if (startDate && endDate) {

      const start = new Date(startDate);

      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end,
      };
    }


const bills = await Bill.find(query);

   if (bills.length < 3) {
      return res.json({
        success: true,
        data: {
          peakHours: "Not enough data",
          slowHours: "Not enough data",
          busiestDay: "Not enough data",
        },
      });
    }

    const hourMap = {};

    const dayMap = {};

    bills.forEach((bill) => {

      if (!bill.createdAt) return;

      const date = new Date(bill.createdAt);

      const hour = date.getHours();

      const day = date.toLocaleDateString(
        "en-US",
        {
          weekday: "long",
        }
      );

      hourMap[hour] =
        (hourMap[hour] || 0) + 1;

      dayMap[day] =
        (dayMap[day] || 0) + 1;

    });

    let peakHour = null;

    let maxCount = 0;

    let slowHour = null;

    let minCount = Infinity;

    Object.entries(hourMap).forEach(
      ([hour, count]) => {

        if (count > maxCount) {
          maxCount = count;
          peakHour = hour;
        }

        if (count < minCount) {
          minCount = count;
          slowHour = hour;
        }

      }
    );

    let busiestDay = "";

    let maxDayCount = 0;

    Object.entries(dayMap).forEach(
      ([day, count]) => {

        if (count > maxDayCount) {
          maxDayCount = count;
          busiestDay = day;
        }

      }
    );

    const formatHour = (h) => {

      const hour = Number(h);

      const ampm =
        hour >= 12 ? "PM" : "AM";

      const formatted =
        hour % 12 || 12;

      return `${formatted} ${ampm}`;

    };

    res.json({
      success: true,
      data: {
        peakHours: `${formatHour(
          peakHour
        )} – ${formatHour(
          Number(peakHour) + 2
        )}`,

        slowHours: `${formatHour(
          slowHour
        )} – ${formatHour(
          Number(slowHour) + 2
        )}`,

        busiestDay,
      },
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
    });

  }
});
export default router;