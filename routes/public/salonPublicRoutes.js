import express from "express";
import { Salon } from "../../models/Salon.js";

const router = express.Router();

// ===============================
// PUBLIC: GET ALL SALONS (LIST)
// ===============================
router.get("/", async (req, res) => {
  try {
    // READ QUERY PARAMS
    const { city, minPrice, maxPrice, rating, gender, sort, page = 1, limit = 30 } = req.query;

    // BUILD QUERY
    let query = {};
    let sortOptions = {};

    switch (sort) {
      case "rating-desc":
        sortOptions = { rating: -1 };
        break;
      case "price-asc":
        sortOptions = { startingPrice: 1 };
        break;
      case "price-desc":
        sortOptions = { startingPrice: -1 };
        break;
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 }; // default sort
    }

    if (city) {
      query.city = { $regex: city, $options: "i" };
    }
    if (minPrice || maxPrice) {
      query.startingPrice = {};
      if (minPrice) query.startingPrice.$gte = Number(minPrice);
      if (maxPrice) query.startingPrice.$lte = Number(maxPrice);
    }
    if (rating) {
      query.rating = { $gte: Number(rating) };
    }
    if (gender) {
      query.gender = gender;
    }

    // PAGINATION
    const skip = (page - 1) * limit;

    // ✅ YAHAN CHANGE KARO: createdAt field include karo
    const salons = await Salon.find(query)
      .select("name image city area rating reviews startingPrice createdAt") // ✅ createdAt ADD KARO
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      message: "Salons fetched successfully",
      salons,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ===============================
// PUBLIC: GET SALON BY ID
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const salon = await Salon.findById(req.params.id);

    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    return res.json({
      message: "Salon fetched successfully",
      salon,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
