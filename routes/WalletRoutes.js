import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { CustomerWallet } from "../models/CustomerWallet.js";
import { Salon } from "../models/Salon.js";
import { Bill } from "../models/Bill.js";
import { Staff } from "../models/Staff.js";

const router = express.Router();

// ==================== GET WALLET BY PHONE ====================
router.get("/:phone", authMiddleware, async (req, res) => {
  try {
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

    const wallet = await CustomerWallet.findOne({
      salonId,
      customerPhone: req.params.phone,
    }).lean();

    if (!wallet) {
      // Naya wallet return karo (empty)
      return res.json({
        success: true,
        wallet: {
          customerPhone: req.params.phone,
          customerName: "",
          points: 0,
          balance: 0,
          transactions: [],
        },
      });
    }

    res.json({ success: true, wallet });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==================== ADD ADVANCE (Balance) ====================
router.post("/advance", authMiddleware, async (req, res) => {
  try {
    const { customerPhone, customerName, amount, note } = req.body;

    if (!customerPhone || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Phone and amount required",
      });
    }

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

    let wallet = await CustomerWallet.findOne({
      salonId,
      customerPhone,
    });

    if (!wallet) {
      wallet = new CustomerWallet({
        salonId,
        customerPhone,
        customerName: customerName || "",
      });
    }

    // ✅ Balance use karo
    wallet.balance += Number(amount);
    wallet.transactions.push({
      type: "advance_added",
      amount: Number(amount),
      note: note || `Advance added: ₹${amount}`,
    });

    await wallet.save();

    res.json({ success: true, wallet });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==================== PAY DUE ====================
// ==================== PAY DUE ====================
router.post("/due/pay", authMiddleware, async (req, res) => {
  try {
    const { customerPhone, amount, note } = req.body;

    if (!customerPhone || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Phone and amount required",
      });
    }

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

    const wallet = await CustomerWallet.findOne({
      salonId,
      customerPhone,
    });

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    const payAmount = Number(amount);

    // ✅ Due = negative balance
    if (wallet.balance >= 0) {
      return res.status(400).json({
        success: false,
        message: "No due to pay",
      });
    }

    // Due amount = -balance (positive)
    const dueAmount = Math.abs(wallet.balance);
    if (payAmount > dueAmount) {
      return res.status(400).json({
        success: false,
        message: `Due is only ₹${dueAmount}`,
      });
    }

    // ===== ✅ NEW: Due bills dhundo aur staff revenue badhao =====
    const dueBills = await Bill.find({
      salonId,
      customerPhone,
      dueAdded: { $gt: 0 },
    }).sort({ createdAt: 1 });  // purane pehle

    let remainingToCollect = payAmount;
    const staffRevenueUpdates = {};  // { staffId: amount }

    for (const bill of dueBills) {
      if (remainingToCollect <= 0) break;
      
      const dueOnThisBill = bill.dueAdded || 0;
      if (dueOnThisBill <= 0) continue;
      
      const collectedForThisBill = Math.min(dueOnThisBill, remainingToCollect);
      remainingToCollect -= collectedForThisBill;
      
      // Is bill ke staff nikalo
      const billStaffIds = [];
      
      // Naya format — per-service staff
      if (bill.services && bill.services.length > 0) {
        for (const service of bill.services) {
          for (const sid of (service.staff_ids || [])) {
            const id = sid.toString();
            if (!billStaffIds.includes(id)) billStaffIds.push(id);
          }
        }
      }
      
      // Purana format — bill level staff
      if (billStaffIds.length === 0 && bill.staffId) {
        billStaffIds.push(bill.staffId.toString());
      }
      
      // Har staff ko equal share do
      if (billStaffIds.length > 0) {
        const sharePerStaff = collectedForThisBill / billStaffIds.length;
        for (const sid of billStaffIds) {
          if (!staffRevenueUpdates[sid]) staffRevenueUpdates[sid] = 0;
          staffRevenueUpdates[sid] += sharePerStaff;
        }
      }
      
      // Bill ka due kam karo
      bill.dueAdded = Math.max(0, bill.dueAdded - collectedForThisBill);
      
      // ✅ NEW: Bill ke finalAmount mein bhi add karo (dashboard ke liye)
      // Kyunki dashboard revenue = finalAmount sum
      bill.finalAmount = (bill.finalAmount || 0) + collectedForThisBill;
      
      await bill.save();
    }

    // Staff revenue update karo
    for (const [staffId, revenue] of Object.entries(staffRevenueUpdates)) {
      await Staff.updateOne(
        { _id: staffId, salonId },
        { $inc: { revenue: revenue } }
      );
    }
    // ===== END NEW =====

    wallet.balance += payAmount;  // Due kam hoga
    wallet.transactions.push({
      type: "due_paid",
      amount: payAmount,
      note: note || `Due paid: ₹${payAmount}`,
    });

    await wallet.save();

    res.json({ success: true, wallet });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==================== ADD MEMBERSHIP (Points) ====================
router.post("/membership", authMiddleware, async (req, res) => {
  try {
    const { customerPhone, customerName, amountPaid, creditGiven, packageName, expiryMonths } = req.body;

    if (!customerPhone || !amountPaid || !creditGiven) {
      return res.status(400).json({
        success: false,
        message: "Phone, amountPaid, creditGiven required",
      });
    }

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

    let wallet = await CustomerWallet.findOne({
      salonId,
      customerPhone,
    });

    if (!wallet) {
      wallet = new CustomerWallet({
        salonId,
        customerPhone,
        customerName: customerName || "",
      });
    }

    // ✅ Membership → Points mein convert karo
    wallet.points += Number(creditGiven);
    wallet.membershipPackage = packageName || "Custom";
    
    // Expiry set karo
    const months = Number(expiryMonths) || 12;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);
    wallet.membershipExpiry = expiryDate;

    wallet.transactions.push({
      type: "membership_purchased",
      amount: Number(amountPaid),
      points: Number(creditGiven),
      note: `${packageName || "Membership"}: ₹${amountPaid} → ${creditGiven} points`,
    });

    await wallet.save();

    res.json({ success: true, wallet });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/transactions/today", authMiddleware, async (req, res) => {
  try {
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const wallets = await CustomerWallet.find({ salonId });

    let dueCollected = 0;
    wallets.forEach((wallet) => {
      (wallet.transactions || []).forEach((tx) => {
        if (tx.type === "due_paid") {
          const txDate = tx.createdAt || tx.date;
          if (txDate) {
            const d = new Date(txDate);
            if (d >= startOfDay && d <= endOfDay) {
              dueCollected += tx.amount || 0;
            }
          }
        }
      });
    });

    res.json({ success: true, dueCollected });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;