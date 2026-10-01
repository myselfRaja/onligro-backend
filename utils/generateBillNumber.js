import { Salon } from "../models/Salon.js";

export const generateBillNumber = async (salonId) => {
  const salon = await Salon.findByIdAndUpdate(
    salonId,
    { $inc: { billCounter: 1 } },
    { new: true }
  );

  if (!salon) {
    throw new Error("Salon not found");
  }

  return `BILL-${String(salon.billCounter).padStart(4, "0")}`;
};