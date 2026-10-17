import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      default: "",
    },

    // ✅ NAYE FIELDS (Industry Standard)
    points: {
      type: Number,
      default: 0,
      // Loyalty points + Membership points
    },
    balance: {
      type: Number,
      default: 0,
      // Advance - Due (net balance in ₹)
      // Positive = customer ke paas paisa hai
      // Negative = customer ne udhaar liya
    },

    // ⚠️ PURANE FIELDS (frozen — read-only, migration ke liye)
    advance: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    membershipBalance: { type: Number, default: 0 },
    membershipExpiry: { type: Date, default: null },
    membershipPackage: { type: String, default: "" },

    // Transaction history
    transactions: [
      {
        type: {
          type: String,
       enum: [
  "points_earned",
  "points_redeemed",
  "advance_added",
  "advance_used",
  "balance_used",
  "due_added",
  "due_paid",
  "membership_purchased",
  "membership_used",
  // ✅ Naye reversal types
  "points_earned_reversed",
  "points_redeemed_reversed",
  "balance_used_reversed",
  "due_added_reversed",
],
        },
        amount: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
        note: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

walletSchema.index({ salonId: 1, customerPhone: 1 }, { unique: true });

export const CustomerWallet = mongoose.model("CustomerWallet", walletSchema);