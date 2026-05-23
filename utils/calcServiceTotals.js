import { Service } from "../models/Service.js";

export const calcServiceTotals = async (serviceIds, ownerId) => {
  // fetch all services for this owner that match IDs
  const services = await Service.find({
    _id: { $in: serviceIds },
    ownerId
  });

  if (services.length !== serviceIds.length) {
    throw new Error("Some services are invalid or not owned by you");
  }

  let totalDuration = 0;
  let totalPrice = 0;

  services.forEach(s => {
    totalDuration += s.duration;
    totalPrice += s.price;
  });

  return {
    totalDuration,
    totalPrice,
    services
  };
};
