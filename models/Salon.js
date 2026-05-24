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
  },
  { timestamps: true }
);

export const Salon = mongoose.model("Salon", salonSchema);