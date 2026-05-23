import mongoose from "mongoose";

const salonSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

export const Salon = mongoose.model("Salon", salonSchema);
