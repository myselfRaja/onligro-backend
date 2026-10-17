import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { CustomerWallet } from "../models/CustomerWallet.js";
import { Salon } from "../models/Salon.js";

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

export default router;