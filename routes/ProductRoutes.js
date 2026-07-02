import express from "express";
import Product from "../models/Product.js";
import {Salon}from "../models/Salon.js"; // ✅ Import add karo
import multer from "multer";
import XLSX from "xlsx";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Multer setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ========================
// IMPORT PRODUCTS FROM EXCEL
// ========================
router.post("/import", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file"
      });
    }

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is empty"
      });
    }

    let imported = 0;
    let failed = 0;
    let errors = [];
    const products = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        const productData = {
          name: row["Product Name"] || row["name"] || "",
          productCode: row["Product Code"] || row["code"] || row["SKU"] || "",
          category: row["Category"] || row["category"] || "Uncategorized",
          segment: row["Segment"] || row["segment"] || "",
          packSize: row["Pack Size"] || row["packSize"] || "",
          mrp: parseFloat(row["MRP"] || row["mrp"] || 0),
          salonMargin: parseFloat(row["Salon Margin"] || row["salonMargin"] || 0),
          salonLandingPrice: parseFloat(row["Salon Landing Price"] || row["salonLandingPrice"] || 0),
          distributorMargin: parseFloat(row["Distributor Margin"] || row["distributorMargin"] || 0),
          distributorLandingPrice: parseFloat(row["DLP"] || row["distributorLandingPrice"] || 0),
          ssPrice: parseFloat(row["SS Price"] || row["ssPrice"] || 0),
          clp: parseFloat(row["CLP"] || row["clp"] || 0),
          gst: parseFloat(row["GST"] || row["gst"] || 0),
          stockQuantity: parseFloat(row["Quantity"] || row["stockQuantity"] || 0),
          lowStockThreshold: parseFloat(row["Low Stock Alert"] || row["lowStockThreshold"] || 5),
          salonId: req.owner.salonId,
          isActive: true,
        };

        if (!productData.name || !productData.productCode) {
          errors.push(`Row ${i + 1}: Missing name or code`);
          failed++;
          continue;
        }

        const existing = await Product.findOne({
          productCode: productData.productCode,
          salonId: req.owner.salonId,
        });

        if (existing) {
          errors.push(`Row ${i + 1}: Product code "${productData.productCode}" already exists`);
          failed++;
          continue;
        }

        products.push(productData);
        imported++;

      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
        failed++;
      }
    }

    if (products.length > 0) {
      await Product.insertMany(products);
    }

    res.status(200).json({
      success: true,
      message: `Import complete: ${imported} imported, ${failed} failed`,
      imported,
      failed,
      errors: errors.slice(0, 10),
    });

  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import products",
      error: error.message,
    });
  }
});
// ========================
// 1. ADD PRODUCT
// ========================
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      salonId: req.owner.salonId,
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    console.error("Product add error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: error.message,
    });
  }
});

// ========================
// 2. GET ALL PRODUCTS (Only Active)
// ========================
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({
      salonId: req.owner.salonId,
      isActive: true, // ✅ Only active products
    }).sort({ createdAt: -1 }); // Latest first

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Fetch products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

// ========================
// 3. GET LOW STOCK PRODUCTS
// ========================
router.get("/low-stock", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({
      salonId: req.owner.salonId,
      isActive: true, // ✅ Only active products
      $expr: {
        $lte: ["$stockQuantity", "$lowStockThreshold"],
      },
    }).sort({ stockQuantity: 1 }); // Lowest stock first

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Low stock error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch low stock products",
      error: error.message,
    });
  }
});

// ========================
// 4. GET SINGLE PRODUCT
// ========================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Fetch single product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
});

// ========================
// 5. UPDATE PRODUCT
// ========================
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        salonId: req.owner.salonId,
      },
      {
        ...req.body,
        salonId: req.owner.salonId,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
});

// ========================
// 6. UPDATE STOCK
// ========================
router.put("/update-stock/:id", authMiddleware, async (req, res) => {
  try {
    const { stockQuantity } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      salonId: req.owner.salonId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.stockQuantity += Number(stockQuantity);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update stock",
      error: error.message,
    });
  }
});

// ========================
// 7. DELETE PRODUCT (Soft Delete)
// ========================
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    // ✅ Soft delete - just mark as inactive
    const deletedProduct = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        salonId: req.owner.salonId,
      },
      {
        isActive: false,
      },
      {
        new: true,
      }
    );

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
});

// ========================
// 8. RESTORE PRODUCT (Optional)
// ========================
router.put("/restore/:id", authMiddleware, async (req, res) => {
  try {
    const restoredProduct = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        salonId: req.owner.salonId,
      },
      {
        isActive: true,
      },
      {
        new: true,
      }
    );

    if (!restoredProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product restored successfully",
      product: restoredProduct,
    });
  } catch (error) {
    console.error("Restore product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore product",
      error: error.message,
    });
  }
});

export default router;