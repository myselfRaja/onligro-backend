import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true,
    },

    billNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    customerPhone: {
      type: String,
      required: true,
    },

    services: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
        },

        serviceName: String,

        price: Number,

        duration: Number,
      },
    ],
products: [
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productName: {
      type: String,
    },
    price: {
      type: Number,
    },
    quantity: {
      type: Number,
    },
    total: {
      type: Number,
    },
  },
],
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    staffName: {
      type: String,
      required: true,
    },


    totalAmount: {
      type: Number,
      required: true,
    },

  discount: {
  type: Number,
  default: 0,
},

discountType: {
  type: String,
  enum: ["flat", "percent"],
  default: "flat",
},

    taxAmount: {
      type: Number,
      default: 0,
    },

    finalAmount: {
      type: Number,
      required: true,
    },

    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card"],
      required: true,
    },

    billStatus: {
      type: String,
      enum: ["paid", "cancelled"],
      default: "paid",
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
  },
  { timestamps: true }
);

export const Bill = mongoose.model("Bill", billSchema);