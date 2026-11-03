const path = require('path');
const { createWorker } = require('tesseract.js');

async function extractImageText(filePath) {
  const worker = await createWorker('eng', 1, {
    langPath: path.join(__dirname, '..'),
    gzip: false
  });
  try {
    const result = await worker.recognize(filePath);
    return (result.data.text || '').trim().slice(0, 5000);
  } finally {
    await worker.terminate();
  }
}

module.exports = { extractImageText };
