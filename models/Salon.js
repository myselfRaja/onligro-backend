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
    },

    image: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1633681926035-ec1ac984418a?w=600&auto=format&fit=crop&q=60",
    },

    rating: {
      type: Number,
      default: 0,
    },

    reviews: {
      type: Number,
      default: 0,
    },

    startingPrice: {
      type: Number,
      default: 0,
    },

    area: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "Unisex",
    },
    billCounter: {
      type: Number,
      default: 0,
    },

    // ✅ LOYALTY SETTINGS — YE ADD KARO
    loyaltySettings: {
      enabled: {
        type: Boolean,
        default: true,      // default true — sab salons me loyalty on
      },
      pointsPerRupee: {
        type: Number,
        default: 0.01,      // ₹100 pe 1 point
      },
      pointValue: {
        type: Number,
        default: 1,         // 1 point = ₹1
      },
       maxPointsPercent: {
    type: Number,
    default: 50,          // max 50% bill points se
  },
  dueLimit: {
    type: Number,
    default: 5000,        // max ₹5000 due
  },

    },
  },
  
  { timestamps: true }
);

export const Salon = mongoose.model("Salon", salonSchema);