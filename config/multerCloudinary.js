import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js'; // Updated import

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'salon-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => {
      return `salon-${req.params.id}-${Date.now()}`;
    },
  },
});

export const uploadSalonImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});