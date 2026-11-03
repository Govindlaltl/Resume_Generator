const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const pdf = require('pdf-parse');
const db = require('../db');
const { extractImageText } = require('../services/ocrService');

const router = express.Router();

// ✅ Ensure uploads directory exists
const UPLOADS_DIR = 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// ✅ Add file validation
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs and images
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only PDF and image files are allowed'), false);
    }
    cb(null, true);
  }
});

// ✅ Extract text from PDF
async function extractPDFText(filePath) {
  try {
    console.log(`📄 Attempting to extract text from: ${filePath}`);
    const pdfBuffer = await fsp.readFile(filePath);
    const pdfData = await pdf(pdfBuffer);
    const extractedText = pdfData.text.substring(0, 5000).trim(); // Limit to 5000 chars
    console.log(`✅ Successfully extracted ${extractedText.length} characters`);
    return extractedText;
  } catch (error) {
    console.warn(`⚠️ PDF text extraction failed for ${filePath}:`, error.message);
    return `Text extraction failed for this file. Filename: ${path.basename(filePath)}`;
  }
}

// ✅ Main upload route
router.post('/', upload.single('certificate'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const studentId = req.user.studentId;

    // ✅ Extract text if PDF
    let extractedText = `Uploaded file: ${file.originalname}`;
    if (file.mimetype === 'application/pdf') {
      extractedText = await extractPDFText(file.path);
    } else if (file.mimetype.startsWith('image/')) {
      extractedText = await extractImageText(file.path);
      if (!extractedText) {
        const error = new Error('No text could be read from this image. Try a clearer, well-lit certificate image.');
        error.status = 422;
        throw error;
      }
    }

    // ✅ Insert certificate record with extracted text
    const certData = {
      student_id: studentId,
      file_path: file.filename,
      original_name: file.originalname,
      extracted_text: extractedText,
      upload_date: new Date()
    };

    const result = await new Promise((resolve, reject) => {
      db.query('INSERT INTO certificates SET ?', certData, (err, insertResult) => {
        if (err) reject(err);
        else resolve(insertResult);
      });
    });

    // ✅ SUCCESS RESPONSE with text preview
    res.status(201).json({
      success: true,
      message: '✅ Certificate uploaded and processed successfully!',
      fileId: result.insertId,
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      textPreview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''),
      mimeType: file.mimetype
    });

  } catch (error) {
    console.error("🔥 Upload Error:", error);

    // ✅ Cleanup: Delete uploaded file if something went wrong
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        await fsp.unlink(req.file.path);
        console.log('🗑️ Cleaned up failed upload:', req.file.filename);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup file:', cleanupError.message);
      }
    }

    res.status(error.status || 500).json({
      success: false,
      error: 'Server error during upload',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('File serving error:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

module.exports = router;
