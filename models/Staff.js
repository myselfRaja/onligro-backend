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
    }
  },
  { timestamps: true }
);

export const Staff = mongoose.model("Staff", staffSchema);
