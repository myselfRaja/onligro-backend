import mongoose from "mongoose";

const distributorSchema = new mongoose.Schema(
  {
    // ===== BASIC INFO =====
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },

    // ===== GST & BUSINESS =====
    gstNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // ===== PAYMENT TERMS =====
    paymentTerms: {
      type: String,
      enum: ["Cash", "Credit", "Partial", "Other"],
      default: "Cash",
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    creditLimit: {
      type: Number,
      default: 0,
    },

    // ===== NOTES =====
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ===== RELATIONS =====
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },

    // ===== STATUS =====
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ===== VIRTUAL: Total Purchases =====
distributorSchema.virtual("totalPurchases", {
  ref: "Purchase",
  localField: "_id",
  foreignField: "distributorId",
  count: true,
});

// ===== VIRTUAL: Balance Due =====
distributorSchema.virtual("balanceDue", {
  ref: "Purchase",
  localField: "_id",
  foreignField: "distributorId",
  select: "balanceDue",
});

const Distributor = mongoose.model("Distributor", distributorSchema);

export default Distributor;