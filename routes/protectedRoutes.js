import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route accessed",
    owner: req.owner
  });
});

export default router;
