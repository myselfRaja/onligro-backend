import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: "Staff"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // ✅ NEW FIELDS (for staff login)
    email: {
      type: String,
      sparse: true,    // ✅ Multiple null values allow
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      select: false    // ✅ Password never comes in queries by default
    },
    loginEnabled: {
      type: Boolean,
      default: false   // ✅ Staff can login only if owner enables
    },

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