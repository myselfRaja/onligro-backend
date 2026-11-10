import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Owner } from "../models/Owner.js";
import { Salon } from "../models/Salon.js";

const router = express.Router();

// GET OWNER PROFILE
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const owner = await Owner.findById(req.owner._id).select("-password");
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const salon = await Salon.findOne({ ownerId: req.owner._id });

    return res.json({
      message: "Owner profile fetched successfully",
      owner,
      salon,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ✅ GET SUBSCRIPTION STATUS
router.get("/subscription-status", authMiddleware, async (req, res) => {
  try {
    if (!req.owner) {
      return res.status(403).json({ message: "Owner only" });
    }

    const owner = await Owner.findById(req.owner._id).select(
      "name email phone subscriptionEndDate isActive"
    );

    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    if (!owner.subscriptionEndDate) {
      return res.json({
        success: true,
        status: "no-subscription",
        daysLeft: null,
        message: "No subscription set",
        isActive: owner.isActive,
      });
    }

    const daysLeft = Math.ceil(
      (new Date(owner.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    let status = "active";
    let message = "";

    if (daysLeft < 0) {
      status = "expired";
      message = `Account expired ${Math.abs(daysLeft)} days ago. Please renew.`;
    } else if (daysLeft === 0) {
      status = "expires-today";
      message = "Your subscription expires today. Renew now!";
    } else if (daysLeft <= 3) {
      status = "urgent";
      message = `Only ${daysLeft} days left! Renew now to avoid freeze.`;
    } else if (daysLeft <= 7) {
      status = "due-soon";
      message = `Your subscription expires in ${daysLeft} days. Please renew.`;
    } else {
      status = "active";
      message = `Subscription active. ${daysLeft} days left.`;
    }

    res.json({
      success: true,
      status,
      daysLeft,
      message,
      subscriptionEndDate: owner.subscriptionEndDate,
      isActive: owner.isActive,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

