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
    if (!salonId || !date || !duration) return res.status(400).json({ message: "salonId, date and duration required" });

    // 1) get working hours for that day
    const dayMap = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const dObj = new Date(date + "T00:00:00"); // local midnight
    const dayName = dayMap[dObj.getDay()];

    const wh = await WorkingHours.findOne({ salonId, dayOfWeek: dayName });
    if (!wh || wh.isClosed) return res.json({ slots: [], reason: "closed" });

    if (!wh.openTime || !wh.closeTime) return res.json({ slots: [], reason: "no-hours" });

    // 2) generate base 30-min slots between open and close
    const openM = toMinutes(wh.openTime);
    const closeM = toMinutes(wh.closeTime);
    const slotStep = 30;

    const baseSlots = [];
    for (let t = openM; t + 1 <= closeM; t += slotStep) {
      baseSlots.push(t); // store as minutes-from-midnight
    }

    // 3) if date is today -> remove past slots
    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    let currentMinuteOfDay = null;
    if (date === todayStr) {
      currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
    }

    // 4) fetch salon staff count
    const staffCount = await Staff.countDocuments({ salonId });

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

    // convert appointment datetimes to minutes-from-midnight for the given date
    const appts = appointments.map(a => {
      const s = new Date(a.startAt);
      const e = new Date(a.endAt);
      // compute minutes relative to date's midnight (local)
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      return { staffId: a.staffId ? String(a.staffId) : null, startMin: sMin, endMin: eMin };
    });

    // 6) evaluate each base slot:
    const availableSlots = [];

    for (const slotMin of baseSlots) {
      // if today and slot is past -> skip
      if (currentMinuteOfDay !== null && slotMin < currentMinuteOfDay) continue;

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

    return res.json({ slots: availableSlots });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
