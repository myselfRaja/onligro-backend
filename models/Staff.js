import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Staff",
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    
gender: {
  type: String,
  enum: ["male", "female", "other"],
  default: "male",
},
    // ✅ LOGIN FIELDS
    email: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false,
    },
    loginEnabled: {
      type: Boolean,
      default: false,
    },

    // ✅ SALARY + COMMISSION (Industry Standard)
    baseSalary: {
      type: Number,
      default: 0,          // Monthly fixed salary
      min: 0,
    },
    commissionPercent: {
      type: Number,
      default: 0,          // Service commission %
      min: 0,
      max: 100,
    },
    productCommissionPercent: {
      type: Number,
      default: 0,          // Product commission %
      min: 0,
      max: 100,
    },

    // ✅ EARNINGS SNAPSHOT
    commissionEarned: {
      type: Number,
      default: 0,          // Total commission earned (counter)
    },
    advanceBalance: {
      type: Number,
      default: 0,          // Pending advance (to be adjusted)
    },

    // ⚠️ PURANE COUNTERS (source of truth nahi — bills se calculate karo)
    revenue: {
      type: Number,
      default: 0,
    },
    bookingCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Staff = mongoose.model("Staff", staffSchema);