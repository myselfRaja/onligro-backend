import express from "express";
import { Salon } from "../../models/Salon.js";
import { uploadSalonImage } from "../../config/multerCloudinary.js";

const router = express.Router();

router.post("/upload-image/:id", uploadSalonImage.single("image"), async (req, res) => {
  try {
    console.log("📸 Upload request received:");
    console.log("Params:", req.params);
    console.log("File:", req.file);
    console.log("Body:", req.body);

    if (!req.file) {
      console.log("❌ No file in request");
      return res.status(400).json({ message: "No image uploaded" });
    }

    if (!req.file.path) {
      console.log("❌ No file path available");
      return res.status(400).json({ message: "File upload failed" });
    }

 
    
    const updatedSalon = await Salon.findByIdAndUpdate(
      req.params.id,
      { image: req.file.path },
      { new: true }
    );

    if (!updatedSalon) {
      console.log("❌ Salon not found with ID:", req.params.id);
      return res.status(404).json({ message: "Salon not found" });
    }

    console.log("✅ Salon image updated successfully");
    console.log("Image URL:", req.file.path);

    return res.json({
      message: "Salon image uploaded successfully",
      salon: updatedSalon,
    });

  } catch (err) {
    console.log("🔥 Server Error:", err);
    console.log("Error stack:", err.stack);
    return res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

export default router;