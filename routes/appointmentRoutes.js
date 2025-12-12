import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Appointment } from "../models/Appointment.js";
import { calcServiceTotals } from "../utils/calcServiceTotals.js";
import { Salon } from "../models/Salon.js";
import { Staff } from "../models/Staff.js";

const router = express.Router();

// CREATE APPOINTMENT — PART 1
router.post("/create", authMiddleware, async (req, res) => {
  try {
   const { serviceIds, date, time, customerName, customerPhone } = req.body;


    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ message: "Service IDs required" });
    }

    if (!date || !time) {
      return res.status(400).json({ message: "Date & Time required" });
    }

    // 1) Get salon
    const salon = await Salon.findOne({ ownerId: req.owner._id });
    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    // 2) Calculate total duration + price
    const { totalDuration, totalPrice, services } =
      await calcServiceTotals(serviceIds, req.owner._id);

    // 3) Create startAt and endAt
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + totalDuration * 60000);

   // 4) STAFF AUTO ASSIGN
// fetch all staff for this salon
const staffList = await Staff.find({ salonId: salon._id });

if (staffList.length === 0) {
  return res.status(400).json({ message: "No staff found in this salon" });
}

// find free staff (no overlapping appointments)
let assignedStaff = null;

for (const staff of staffList) {

  const staffAppointments = await Appointment.find({
    staffId: staff._id,
    startAt: { $lt: endAt }, 
    endAt: { $gt: startAt },
    status: { $ne: "cancelled" }
  });

  if (staffAppointments.length === 0) {
    assignedStaff = staff;
    break;
  }
}

if (!assignedStaff) {
  return res.status(400).json({ message: "No staff available at this time" });
}

// 5) SAVE APPOINTMENT IN DB
const newAppointment = await Appointment.create({
  salonId: salon._id,
  ownerId: req.owner._id,
  staffId: assignedStaff._id,

  customerName,
  customerPhone,

  services: serviceIds,
  totalPrice,
  totalDuration,
  startAt,
  endAt,
  status: "confirmed"
});


// 6) SOCKET BROADCAST FOR REAL-TIME SLOT REFRESH
req.io.emit("slots_update", {
  salonId: salon._id,
  date
});


// ========================


// FINAL RESPONSE
return res.json({
  message: "Appointment booked successfully",
  appointment: newAppointment,
  staff: {
    id: assignedStaff._id,
    name: assignedStaff.name
  }
});



  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// GET ALL APPOINTMENTS
// ========================
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.owner._id });

    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    const appointments = await Appointment.find({ salonId: salon._id })
      .populate("staffId", "name")
      .populate("services")
        .sort({ createdAt: -1 }); 

    return res.json({
      message: "Appointments fetched successfully",
          total: appointments.length, 
      appointments
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ================================
// GET APPOINTMENTS BY DATE
// ================================
router.get("/by-date", authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const salon = await Salon.findOne({ ownerId: req.owner._id });

    if (!salon) {
      return res.status(400).json({ message: "Salon not found" });
    }

    // Start & End of day
    const startDay = new Date(`${date}T00:00:00`);
    const endDay = new Date(`${date}T23:59:59`);

    // Fetch appointments
    const appointments = await Appointment.find({
      salonId: salon._id,
      startAt: { $gte: startDay, $lte: endDay }
    })
      .populate("staffId", "name")
      .sort({ startAt: 1 });

    return res.json({
      message: "Appointments for selected date",
      date,
      appointments
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ================================
// CANCEL APPOINTMENT
// ================================
router.post("/cancel/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // check owner permission
    if (appointment.ownerId.toString() !== req.owner._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    // Refresh slots
    req.io.emit("slots_update", {
      salonId: appointment.salonId,
      date: appointment.startAt.toISOString().split("T")[0]
    });

    return res.json({
      message: "Appointment cancelled successfully",
      appointment
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// HARD DELETE APPOINTMENT
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Only owner can delete
    if (appointment.ownerId.toString() !== req.owner._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Appointment.findByIdAndDelete(id);

    return res.json({ message: "Appointment deleted successfully" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});




export default router;
