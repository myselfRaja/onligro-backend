import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Customer } from "../models/Customer.js";

const router = express.Router();

// SEND REMINDER (single customer)
router.post("/:id/send", authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // 👉 ABHI TEMP LOG (later WhatsApp API add karenge)
    console.log(`REMINDER SENT TO: ${customer.phone}`);

    return res.json({
      message: "Reminder sent successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;