import { Counter } from "../models/Counter.js";

export const generateBillNumber = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "bill" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `BILL-${String(counter.seq).padStart(4, "0")}`;
};