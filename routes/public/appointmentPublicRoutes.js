// routes/public/publicAppointmentRoutes.js
import express from "express";
import { Appointment } from "../../models/Appointment.js";
import { Service } from "../../models/Service.js";
import { Salon } from "../../models/Salon.js";
import { Staff } from "../../models/Staff.js";

const router = express.Router();

// PUBLIC - GET APPOINTMENT BY ID
// routes/public/publicAppointmentRoutes.js - GET route update
router.get("/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) {
      return res.status(400).json({ message: "Appointment ID is required" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("services", "name price duration")
      .populate("staffId", "name email phone specialization")
      .populate("salonId", "name address phone");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ 
      appointment,
      message: "Appointment details fetched successfully"
    });
  } catch (err) {
    console.error("Error fetching appointment:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC - CREATE APPOINTMENT (your existing route)
router.post("/create", async (req, res) => {
  try {
    const { salonId, services, date, time, customerName, customerPhone } = req.body;

    // Validation
    if (!salonId || !services || services.length === 0 || !date || !time) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1) Find salon & ownerId
    const salon = await Salon.findById(salonId);
    if (!salon) return res.status(400).json({ message: "Salon not found" });

    const ownerId = salon.ownerId;

    // 2) Calculate total duration & price
    const serviceDocs = await Service.find({ _id: { $in: services } });
    let totalDuration = 0;
    let totalPrice = 0;

    serviceDocs.forEach((s) => {
      totalDuration += s.duration;
      totalPrice += s.price;
    });

    // 3) Create appointment start/end time
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + totalDuration * 60000);

    // 4) Auto assign staff
    const staffList = await Staff.find({ salonId });

    if (staffList.length === 0)
      return res.status(400).json({ message: "No staff found" });

    let assignedStaff = null;

    for (const staff of staffList) {
      const appointments = await Appointment.find({
        staffId: staff._id,
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
        status: { $ne: "cancelled" },
      });

      if (appointments.length === 0) {
        assignedStaff = staff;
        break;
      }
    }

    if (!assignedStaff) {
      return res.status(400).json({ message: "No staff available at this time" });
    }

    // 5) Save appointment
    const newAppointment = await Appointment.create({
      salonId,
      ownerId,
      staffId: assignedStaff._id,
      customerName,
      customerPhone,
      services,
      totalPrice,
      totalDuration,
      startAt,
      endAt,
      status: "confirmed",
    });

    // Populate the newly created appointment for response
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("services", "name price duration")
      .populate("staffId", "name")
      .populate("salonId", "name");

    // 6) Emit real-time slot update
    req.io?.emit("slots_update", { salonId, date });

    return res.json({
      message: "Appointment booked successfully!",
      appointment: populatedAppointment,
      staff: {
        id: assignedStaff._id,
        name: assignedStaff.name,
      },
    });
  } catch (err) {
    console.error("Appointment creation error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;