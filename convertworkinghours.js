import mongoose from "mongoose";
import { WorkingHours } from "./models/WorkingHours.js";  // correct path lagao

// 🟩 Database connection
const MONGO_URI = "mongodb://127.0.0.1:27017/salon-saas"; // <-- YOUR DB NAME

const map = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

async function fixWorkingHours() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const docs = await WorkingHours.find({});
    console.log(`Found ${docs.length} working hours docs`);

    for (const doc of docs) {
      if (typeof doc.dayOfWeek === "string") {
        const num = map[doc.dayOfWeek.toLowerCase()];

        if (num !== undefined) {
          await WorkingHours.updateOne(
            { _id: doc._id },
            { $set: { dayOfWeek: num } }
          );
          console.log(`Updated ${doc.dayOfWeek} → ${num}`);
        }
      }
    }

    console.log("DONE ✔ All dayOfWeek values converted to numbers");
    process.exit();
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
}

fixWorkingHours();
import mongoose from "mongoose";
import { WorkingHours } from "./models/WorkingHours.js";  // correct path lagao

// 🟩 Database connection
const MONGO_URI = "mongodb://127.0.0.1:27017/yourdbname"; // <-- YOUR DB NAME

const map = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

async function fixWorkingHours() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const docs = await WorkingHours.find({});
    console.log(`Found ${docs.length} working hours docs`);

    for (const doc of docs) {
      if (typeof doc.dayOfWeek === "string") {
        const num = map[doc.dayOfWeek.toLowerCase()];

        if (num !== undefined) {
          await WorkingHours.updateOne(
            { _id: doc._id },
            { $set: { dayOfWeek: num } }
          );
          console.log(`Updated ${doc.dayOfWeek} → ${num}`);
        }
      }
    }

    console.log("DONE ✔ All dayOfWeek values converted to numbers");
    process.exit();
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
}

fixWorkingHours();
