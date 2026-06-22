import express from "express";
import { Bill } from "../models/Bill.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ==================== SUMMARY API ====================
// ==================== SUMMARY API ====================
router.get("/summary", authMiddleware, async (req, res) => {
  
  try {

    const { startDate, endDate } = req.query;

    const salonId = req.owner.salonId;

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

    const salonId = req.owner.salonId;

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

    const salonId = req.owner.salonId;

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
router.get("/staff-performance", authMiddleware, async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

    const salonId = req.owner.salonId;

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
    $group: {
      _id: "$staffId",
      bookings: {
        $sum: 1,
      },
      revenue: {
        $sum: "$finalAmount",
      },
    },
  },

  {
    $lookup: {
      from: "staffs",
      localField: "_id",
      foreignField: "_id",
      as: "staff",
    },
  },

  {
    $unwind: "$staff",
  },

  {
    $project: {
      _id: 0,
      name: "$staff.name",
      bookings: 1,
      revenue: 1,
    },
  },

  {
    $sort: {
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

// ==================== PEAK HOURS API ====================
// ==================== PEAK HOURS API ====================
router.get("/peak-hours", authMiddleware, async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

    const salonId = req.owner.salonId;

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