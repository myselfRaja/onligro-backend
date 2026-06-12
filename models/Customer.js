import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    totalVisits: {
      type: Number,
      default: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
    },

    lastVisit: {
      type: Date,
    },
  },
  { timestamps: true }
);


export const Customer = mongoose.model("Customer", customerSchema);