import mongoose from "mongoose";

const workingHoursSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true
    },

    dayOfWeek: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ],
      required: true
    },

    openTime: {
      type: String, // "10:00"
      default: null
    },

    closeTime: {
      type: String, // "20:00"
      default: null
    },

    isClosed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export const WorkingHours = mongoose.model("WorkingHours", workingHoursSchema);
