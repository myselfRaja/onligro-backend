import express from "express";
import Distributor from "../models/Distributor.js";
import Purchase from "../models/Purchase.js"; // ✅ Import add karo
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================
// 1. ADD DISTRIBUTOR
// ========================
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const distributor = new Distributor({
      ...req.body,
      salonId: req.owner.salonId,
    });

    await distributor.save();

    res.status(201).json({
      success: true,
      message: "Distributor added successfully",
      distributor,
    });
  } catch (error) {
    console.error("Distributor add error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add distributor",
      error: error.message,
    });
  }
});

// ========================
// 2. GET ALL DISTRIBUTORS
// ========================
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const distributors = await Distributor.find({
      salonId: req.owner.salonId,
      isActive: true,
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: distributors.length,
      distributors,
    });
  } catch (error) {
    console.error("Fetch distributors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch distributors",
      error: error.message,
    });
  }
});

// ========================
// 3. GET SINGLE DISTRIBUTOR
// ========================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const distributor = await Distributor.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    });

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    res.status(200).json({
      success: true,
      distributor,
    });
  } catch (error) {
    console.error("Fetch distributor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch distributor",
      error: error.message,
    });
  }
});

// ========================
// 4. UPDATE DISTRIBUTOR
// ========================
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const updatedDistributor = await Distributor.findOneAndUpdate(
      {
        _id: req.params.id,
        salonId: req.owner.salonId,
      },
      {
        ...req.body,
        salonId: req.owner.salonId,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedDistributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Distributor updated successfully",
      distributor: updatedDistributor,
    });
  } catch (error) {
    console.error("Update distributor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update distributor",
      error: error.message,
    });
  }
});

// ========================
// 5. DISTRIBUTOR LEDGER SUMMARY
// ========================
router.get("/ledger/:id", authMiddleware, async (req, res) => {
  try {
    const distributorId = req.params.id;

    const purchases = await Purchase.find({
      distributorId,
      salonId: req.owner.salonId,
    });

    let totalPurchase = 0;
    let totalPaid = 0;

    purchases.forEach((p) => {
      // Calculate purchase total
      const purchaseTotal = p.products.reduce(
        (sum, item) => sum + item.quantity * item.purchasePrice,
        0
      );

      totalPurchase += purchaseTotal;

      // ✅ FIX: Count partial payments too
      if (p.paymentStatus === "Paid") {
        totalPaid += purchaseTotal;
      } else if (p.paymentStatus === "Partial" && p.amountPaid) {
        totalPaid += p.amountPaid;
      }
    });

    const balance = totalPurchase - totalPaid;

    res.json({
      success: true,
      distributorId,
      totalPurchase,
      totalPaid,
      balance,
      totalPurchases: purchases.length,
    });
  } catch (err) {
    console.error("Ledger error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ========================
// 6. DISTRIBUTOR PURCHASE HISTORY
// ========================
router.get("/ledger/history/:id", authMiddleware, async (req, res) => {
  try {
    const purchases = await Purchase.find({
      distributorId: req.params.id,
      salonId: req.owner.salonId,
    })
      .populate("products.productId", "name productCode")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ========================
// 7. DELETE DISTRIBUTOR
// ========================
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    // ✅ Check if distributor has any purchases
    const purchases = await Purchase.findOne({
      distributorId: req.params.id,
      salonId: req.owner.salonId,
    });

    if (purchases) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete distributor with purchase history. Archive instead.",
      });
    }

    const deletedDistributor = await Distributor.findOneAndUpdate(
      {
        _id: req.params.id,
        salonId: req.owner.salonId,
      },
      {
        isActive: false,
      },
      {
        new: true,
      }
    );

    if (!deletedDistributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Distributor archived successfully",
    });
  } catch (error) {
    console.error("Delete distributor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete distributor",
      error: error.message,
    });
  }
});

export default router;