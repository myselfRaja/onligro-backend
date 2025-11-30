import jwt from "jsonwebtoken";
import { Owner } from "../models/Owner.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // Token get from cookie
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    // Verify token
     const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find owner
    const owner = await Owner.findById(decoded.id).select("-password");
    if (!owner) {
      return res.status(401).json({ message: "Owner not found" });
    }

    req.owner = owner; // Attach owner to request
    next(); // Continue

  } catch (err) {
    return res.status(401).json({ message: "Unauthorized", error: err.message });
  }
};
