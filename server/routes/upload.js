
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const pdf = require('pdf-parse');

const db = require('../db');
const { extractImageText } = require('../services/ocrService');

const router = express.Router();

// Use the same upload directory locally and on Render
const UPLOADS_DIR = process.env.UPLOADS_DIR ||
  path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1E9);

    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File upload configuration
const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      const error = new Error(
        'Only PDF, JPG and PNG files are allowed'
      );
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  }
});

// Extract text from PDF
async function extractPDFText(filePath) {
  try {
    const pdfBuffer = await fsp.readFile(filePath);
    const pdfData = await pdf(pdfBuffer);

    return pdfData.text.substring(0, 5000).trim();

  } catch (error) {
    console.warn('PDF extraction failed:', error.message);

    return `Text extraction failed. Filename: ${path.basename(filePath)}`;
  }
}

// Upload certificate
router.post('/', upload.single('certificate'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  try {
    const studentId = req.user?.studentId;

    if (!studentId) {
      throw new Error('Student account not found');
    }

    // Extract text
    let extractedText = `Uploaded file: ${file.originalname}`;

    if (file.mimetype === 'application/pdf') {
      extractedText = await extractPDFText(file.path);
    } else if (file.mimetype.startsWith('image/')) {
      extractedText = await extractImageText(file.path);

      if (!extractedText) {
        const error = new Error(
          'No text could be read from this image. Try a clearer image.'
        );

        error.status = 422;
        throw error;
      }
    }

    // Save certificate information in MySQL
    const certData = {
      student_id: studentId,
      file_path: file.filename,
      original_name: file.originalname,
      extracted_text: extractedText,
      upload_date: new Date()
    };

    const result = await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO certificates SET ?',
        certData,
        (err, insertResult) => {
          if (err) {
            reject(err);
          } else {
            resolve(insertResult);
          }
        }
      );
    });

    // Successful response
    res.status(201).json({
      success: true,
      message: 'Certificate uploaded successfully',
      fileId: result.insertId,
      url: `/uploads/${encodeURIComponent(file.filename)}`,
      originalName: file.originalname,
      textPreview:
        extractedText.substring(0, 200) +
        (extractedText.length > 200 ? '...' : ''),
      mimeType: file.mimetype
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Remove file if processing or database insertion fails
    try {
      await fsp.unlink(file.path);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        console.warn('File cleanup failed:', cleanupError.message);
      }
    }

    res.status(error.status || 500).json({
      success: false,
      error: error.status ? error.message : 'Server error during upload'
    });
  }
});

// Handle Multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  if (error.status) {
    return res.status(error.status).json({
      success: false,
      error: error.message
    });
  }

  next(error);
});

module.exports = router;
