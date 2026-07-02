import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // ===== BASIC INFO =====
    name: {
      type: String,
      required: true,
      trim: true,
    },

    productCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    category: {
      type: String,
      trim: true,
      default: "",
    },

    segment: {
      type: String,
      trim: true,
      default: "",
    },

    packSize: {
      type: String,
      trim: true,
      default: "",
    },

    // ===== PRICING =====
    mrp: {
      type: Number,
      default: 0,
    },

    moq: {
      type: Number,
      default: 0,
    },

    salonMargin: {
      type: Number,
      default: 0,
    },

    salonLandingPrice: {
      type: Number,
      default: 0,
    },

    distributorMargin: {
      type: Number,
      default: 0,
    },

    distributorLandingPrice: {
      type: Number,
      default: 0,
    },

    ssPrice: {
      type: Number,
      default: 0,
    },

    clp: {
      type: Number,
      default: 0,
    },

    gst: {
      type: Number,
      default: 0,
    },

    // ===== STOCK =====
    stockQuantity: {
      type: Number,
      default: 0,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
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

// ===== VIRTUAL: Check if low stock =====
productSchema.virtual("isLowStock").get(function () {
  return this.stockQuantity <= this.lowStockThreshold;
});

// ===== VIRTUAL: Check if out of stock =====
productSchema.virtual("isOutOfStock").get(function () {
  return this.stockQuantity === 0;
});

const Product = mongoose.model("Product", productSchema);

export default Product;