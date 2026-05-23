import jwt from "jsonwebtoken";
import { Owner } from "../models/Owner.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get token from cookie OR header (VERY IMPORTANT)
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    // 2. Verify token (env-based only)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find owner
    const owner = await Owner.findById(decoded.id).select("-password");

    if (!owner) {
      return res.status(401).json({ message: "Owner not found" });
    }

    req.owner = owner;
    next();

  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized",
      error: err.message,
    });
  }
};