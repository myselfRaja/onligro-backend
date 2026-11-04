import jwt from "jsonwebtoken";
import { Owner } from "../models/Owner.js";
import { Staff } from "../models/Staff.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Check Owner
    if (decoded.role === "owner") {
      const owner = await Owner.findById(decoded.id).select("-password");
      if (!owner) {
        return res.status(401).json({ message: "Owner not found" });
      }
      
      // ✅ Check 1: Owner ka isActive
      if (owner.isActive === false) {
        return res.status(403).json({ 
          message: "Account deactivated. Please contact support.",
          code: "ACCOUNT_DEACTIVATED"
        });
      }
      
      req.owner = owner;
      req.userRole = "owner";
      req.userId = owner._id;
      return next();
    }

    // ✅ Check Staff
    if (decoded.role === "staff") {
      const staff = await Staff.findById(decoded.id).select("-password");
      if (!staff) {
        return res.status(401).json({ message: "Staff not found" });
      }
      
      // ✅ Check 2: Staff ka apna isActive
      if (!staff.isActive) {
        return res.status(401).json({ message: "Account deactivated" });
      }
      
      // ✅ Check 3: Staff ke owner ka isActive
      const owner = await Owner.findOne({ salonId: staff.salonId })
        .select("isActive")
        .lean();
      if (owner && owner.isActive === false) {
        return res.status(403).json({
          message: "Salon account deactivated. Please contact owner.",
          code: "ACCOUNT_DEACTIVATED",
        });
      }
      
      req.staff = staff;
      req.userRole = "staff";
      req.userId = staff._id;
      req.salonId = staff.salonId;
      return next();
    }

    return res.status(401).json({ message: "Invalid role" });

  } catch (err) {
    return res.status(401).json({ 
      message: "Unauthorized", 
      error: err.message 
    });
  }
};