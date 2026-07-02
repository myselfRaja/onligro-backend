import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    // ===== BASIC INFO =====
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    // ===== PRODUCTS =====
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },

        total: {
          type: Number,
          default: 0,
        },
      },
    ],

    // ===== TOTALS =====
    subtotal: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    // ===== PAYMENT TRACKING (CLIENT'S MOST IMPORTANT NEED) =====
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Pending"],
      default: "Pending",
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    balanceDue: {
      type: Number,
      default: 0,
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"],
      default: "Cash",
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
  },
  {
    timestamps: true,
  }
);

// ===== AUTO-CALCULATE BEFORE SAVE =====
purchaseSchema.pre("save", function (next) {
  // 1. Calculate each product total
  this.products.forEach((item) => {
    item.total = item.quantity * item.purchasePrice;
  });

  // 2. Calculate subtotal
  this.subtotal = this.products.reduce((sum, item) => sum + item.total, 0);

  // 3. Calculate tax (10% GST example)
  this.tax = this.subtotal * 0;

  // 4. Calculate total amount
  this.totalAmount = this.subtotal + this.tax;

  // 5. Calculate balance due
  this.balanceDue = this.totalAmount - this.amountPaid;

  // 6. Auto-update payment status based on balance
  if (this.balanceDue <= 0) {
    this.paymentStatus = "Paid";
  } else if (this.amountPaid > 0 && this.balanceDue > 0) {
    this.paymentStatus = "Partial";
  } else {
    this.paymentStatus = "Pending";
  }

  next();
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;