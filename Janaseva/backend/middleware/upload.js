// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '5');

// Ensure upload directory exists
['docs', 'photos', 'logos', 'certificates'].forEach(sub => {
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
});

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const docType = req.body.doc_type || 'docs';
    const folder = ['photos', 'logos'].includes(docType) ? docType : 'docs';
    cb(null, path.join(UPLOAD_DIR, folder));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Use PDF, JPG, or PNG.`), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

module.exports = upload;
