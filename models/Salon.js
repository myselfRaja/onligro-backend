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
  enum: ["Men", "Women", "Unisex"],
  default: "Unisex",
},

    // ⭐ NEW: Salon image (Cloudinary URL or fallback)
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1633681926035-ec1ac984418a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8c2Fsb258ZW58MHx8MHx8fDA%3D",   // fallback image
    },
  },
  { timestamps: true }
);

export const Salon = mongoose.model("Salon", salonSchema);
