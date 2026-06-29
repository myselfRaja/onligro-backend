import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
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

    stockQuantity: {
      type: Number,
      default: 0,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
    },

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;