import express from "express";
import { WorkingHours } from "../models/WorkingHours.js";
import { Salon } from "../models/Salon.js";
import { Staff } from "../models/Staff.js";
import { Appointment } from "../models/Appointment.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// helpers
const toMinutes = (timeStr) => {
  // timeStr "HH:MM" in 24h
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};
const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

// check overlap: [aStart,aEnd) overlaps [bStart,bEnd)
const overlaps = (aStart, aEnd, bStart, bEnd) => {
  return aStart < bEnd && bStart < aEnd;
};

// POST /slots/available
// body: { salonId, date: "YYYY-MM-DD", duration: 105 } // duration in minutes
router.post("/available", async (req, res) => {
  try {
    const { salonId, date, duration } = req.body;
    console.log("=== SLOTS DEBUG START ===");
    console.log("Received request:", { salonId, date, duration });
    
    if (!salonId || !date || !duration) return res.status(400).json({ message: "salonId, date and duration required" });

    // 1) get working hours for that day
    const dayMap = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const dObj = new Date(date + "T00:00:00"); // local midnight
    const dayName = dayMap[dObj.getDay()];

    const wh = await WorkingHours.findOne({ salonId, dayOfWeek: dayName });
    if (!wh || wh.isClosed) {
      console.log("Salon is closed on", dayName);
      return res.json({ slots: [], reason: "closed" });
    }

    if (!wh.openTime || !wh.closeTime) {
      console.log("No working hours defined");
      return res.json({ slots: [], reason: "no-hours" });
    }

    // 2) generate base 30-min slots between open and close
    const openM = toMinutes(wh.openTime);
    const closeM = toMinutes(wh.closeTime);
    const slotStep = 30;

    const baseSlots = [];
    for (let t = openM; t + 1 <= closeM; t += slotStep) {
      baseSlots.push(t); // store as minutes-from-midnight
    }

    console.log("Working hours:", wh.openTime, "-", wh.closeTime);
    console.log("Base slots generated:", baseSlots.length);

    // 3) if date is today -> remove past slots - FIXED TIMEZONE ISSUE
    const now = new Date();
    
    // Get local date string (YYYY-MM-DD)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayLocalStr = `${year}-${month}-${day}`;
    
    // Get local time in minutes
    const localHours = now.getHours();
    const localMinutes = now.getMinutes();
    const currentMinuteOfDayLocal = localHours * 60 + localMinutes;
    
    console.log("DEBUG TIMEZONE INFO:");
    console.log("  Frontend date:", date);
    console.log("  Today (ISO/UTC):", now.toISOString().slice(0,10));
    console.log("  Today (Local):", todayLocalStr);
    console.log("  Current time (local):", now.toLocaleTimeString());
    console.log("  Current minute of day (local):", currentMinuteOfDayLocal);
    console.log("  Is today?", date === todayLocalStr);

    let currentMinuteOfDay = null;
    if (date === todayLocalStr) {
      currentMinuteOfDay = currentMinuteOfDayLocal;
      console.log("Filtering past slots. Current minute:", currentMinuteOfDay);
    }

    // 4) fetch salon staff count
    const staffCount = await Staff.countDocuments({ salonId });
    console.log("Total staff count:", staffCount);

    // 5) fetch existing appointments for that salon for that date (we'll compare times)
    // fetch appointments that could overlap with any slot -> range from (open - duration) to (close + duration)
    const startOfDay = new Date(date + "T00:00:00");
    const endOfDay = new Date(date + "T23:59:59");
    const appointments = await Appointment.find({
      salonId,
      startAt: { $lt: endOfDay },
      endAt: { $gt: startOfDay },
      status: { $ne: "cancelled" }
    }).lean();

    console.log("Found appointments:", appointments.length);

    // convert appointment datetimes to minutes-from-midnight for the given date
    const appts = appointments.map(a => {
      const s = new Date(a.startAt);
      const e = new Date(a.endAt);
      // compute minutes relative to date's midnight (local)
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      return { 
        staffId: a.staffId ? String(a.staffId) : null, 
        startMin: sMin, 
        endMin: eMin,
        originalStart: a.startAt,
        originalEnd: a.endAt
      };
    });

    // Log first few appointments for debugging
    if (appts.length > 0) {
      console.log("Sample appointments (first 3):");
      appts.slice(0, 3).forEach((a, i) => {
        console.log(`  ${i}: Staff ${a.staffId}, ${minutesToTime(a.startMin)}-${minutesToTime(a.endMin)}`);
      });
    }

    // 6) evaluate each base slot:
    const availableSlots = [];
    let filteredPastSlots = 0;

    for (const slotMin of baseSlots) {
      // if today and slot is past -> skip
      if (currentMinuteOfDay !== null && slotMin < currentMinuteOfDay) {
        filteredPastSlots++;
        continue;
      }

      const slotStart = slotMin;
      const slotEnd = slotStart + Number(duration);

      // if slotEnd goes beyond close -> skip
      if (slotEnd > closeM) continue;

      // count how many staff are busy during [slotStart, slotEnd)
      let busyCount = 0;
      for (const a of appts) {
        if (overlaps(slotStart, slotEnd, a.startMin, a.endMin)) {
          busyCount++;
        }
      }

      // if busyCount < staffCount -> slot available
      if (busyCount < staffCount) {
        availableSlots.push({
          time: minutesToTime(slotStart),
          capacityLeft: Math.max(0, staffCount - busyCount)
        });
      }
    }

    console.log("Filtered past slots:", filteredPastSlots);
    console.log("Available slots found:", availableSlots.length);
    console.log("=== SLOTS DEBUG END ===");

    return res.json({ slots: availableSlots });
  } catch (err) {
    console.error("SLOTS ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;