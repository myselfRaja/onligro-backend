import express from "express";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================
// 1. CREATE PURCHASE
// ========================
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const purchase = new Purchase({
      ...req.body,
      salonId: req.owner.salonId,
    });

    await purchase.save();

    // Update stock for each product
    for (const item of req.body.products) {
      await Product.findOneAndUpdate(
        {
          _id: item.productId,
          salonId: req.owner.salonId,
        },
        {
          $inc: {
            stockQuantity: item.quantity,
          },
        }
      );
    }

    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      purchase,
    });
  } catch (error) {
    console.error("Purchase create error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase",
      error: error.message,
    });
  }
});

// ========================
// 2. GET ALL PURCHASES
// ========================
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { distributorId, startDate, endDate } = req.query;

    const filter = {
      salonId: req.owner.salonId,
    };

    if (distributorId) {
      filter.distributorId = distributorId;
    }

    if (startDate || endDate) {
      filter.purchaseDate = {};

      if (startDate) {
        filter.purchaseDate.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.purchaseDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(filter)
      .populate("distributorId", "name phone address")
      .populate("products.productId", "name productCode mrp")
      .sort({ purchaseDate: -1 }); // Latest first

    res.status(200).json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    console.error("Purchase fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
      error: error.message,
    });
  }
});

// ========================
// 3. GET SINGLE PURCHASE
// ========================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    })
      .populate("distributorId", "name phone address")
      .populate("products.productId", "name productCode mrp");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (error) {
    console.error("Fetch single purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase",
      error: error.message,
    });
  }
});

// ========================
// 4. UPDATE PAYMENT
// ========================
router.put("/update-payment/:id", authMiddleware, async (req, res) => {
  try {
    const { amountPaid, paymentMode, paymentDate } = req.body;

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Update payment fields
    purchase.amountPaid = amountPaid || purchase.amountPaid;
    purchase.paymentMode = paymentMode || purchase.paymentMode;
    purchase.paymentDate = paymentDate || purchase.paymentDate || new Date();

    // Auto-calculate balance due
    purchase.balanceDue = purchase.totalAmount - purchase.amountPaid;

    // Auto-update payment status
    if (purchase.balanceDue <= 0) {
      purchase.paymentStatus = "Paid";
    } else if (purchase.amountPaid > 0 && purchase.balanceDue > 0) {
      purchase.paymentStatus = "Partial";
    } else {
      purchase.paymentStatus = "Pending";
    }

    await purchase.save();

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      purchase,
    });
  } catch (error) {
    console.error("Update payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment",
      error: error.message,
    });
  }
});

// ========================
// 5. DELETE PURCHASE
// ========================
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Restore stock before deleting
    for (const item of purchase.products) {
      await Product.findOneAndUpdate(
        {
          _id: item.productId,
          salonId: req.owner.salonId,
        },
        {
          $inc: {
            stockQuantity: -item.quantity, // Remove stock
          },
        }
      );
    }

    await Purchase.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully and stock restored",
    });
  } catch (error) {
    console.error("Delete purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete purchase",
      error: error.message,
    });
  }
});

export default router;