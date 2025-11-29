import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  salonId: { type: mongoose.Schema.Types.ObjectId, ref: "Salon" },
}, { timestamps: true });

export const Owner = mongoose.model("Owner", ownerSchema);
