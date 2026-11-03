const express = require('express');
const db = require('../db');
const AIService = require('../services/aiService');
const path = require('path');
const fs = require('fs');
const { extractImageText } = require('../services/ocrService');

const router = express.Router();

router.get('/me', async (req, res) => {
  const studentId = req.user.studentId;

  const query = `
    SELECT 
      s.id,
      s.name, 
      s.roll_number, 
      s.email, 
      s.phone, 
      s.cgpa,
      s.target_career,
      s.project_details,
      s.project_description,
      s.section_titles,
      s.custom_sections,
      c.id as cert_id, 
      c.file_path, 
      c.original_name, 
      c.extracted_text,
      c.upload_date
    FROM students s
    LEFT JOIN certificates c ON s.id = c.student_id
    WHERE s.id = ?
    ORDER BY c.upload_date DESC
  `;

  try {
    // ✅ Use Promise wrapper for async/await
    const results = await new Promise((resolve, reject) => {
      db.query(query, [studentId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (results.length === 0) {
      return res.status(404).json({ error: "Student profile not found for this account" });
    }

    // Build student object
    const student = {
      id: results[0].id,
      name: results[0].name || "Unknown",
      rollNumber: results[0].roll_number || null,
      email: results[0].email || "N/A",
      phone: results[0].phone || "N/A",
      cgpa: results[0].cgpa ? parseFloat(results[0].cgpa) : null,
      targetCareer: results[0].target_career || '',
      projectDetails: results[0].project_details || '',
      projectDescription: results[0].project_description || '',
      sectionTitles: (() => {
        try { return JSON.parse(results[0].section_titles || '{}'); } catch { return {}; }
      })(),
      customSections: (() => {
        try {
          const sections = JSON.parse(results[0].custom_sections || '[]');
          return Array.isArray(sections) ? sections : [];
        } catch { return []; }
      })(),
      certificates: results
        .filter(r => r.cert_id) // Only include rows with certificate data
        .map(cert => {
          const certObj = {
            id: cert.cert_id,
            filename: cert.original_name || "Unnamed Certificate",
            filePath: cert.file_path ? `/uploads/${cert.file_path}` : "#",
            extracted_text: cert.extracted_text || ""
          };
          return certObj;
        })
    };

    console.log(`✅ Student data loaded for account: ${student.name}`);
    console.log(`📄 Certificates found: ${student.certificates.length}`);

    let aiContent = AIService.getEmptyContent();
    let aiError = null;

    // Generate AI content only if certificates with text exist
    if (student.certificates.length > 0) {
      try {
        console.log("🤖 Starting AI content generation...");
        
        for (const certificate of student.certificates) {
          if (!/^image certificate:/i.test(certificate.extracted_text)) continue;
          const filename = path.basename(certificate.filePath);
          const imagePath = path.join(__dirname, '../uploads', filename);
          if (!fs.existsSync(imagePath)) continue;
          try {
            const extractedText = await extractImageText(imagePath);
            if (extractedText) {
              certificate.extracted_text = extractedText;
              await new Promise((resolve, reject) => db.query(
                'UPDATE certificates SET extracted_text = ? WHERE id = ? AND student_id = ?',
                [extractedText, certificate.id, student.id],
                error => error ? reject(error) : resolve()
              ));
            }
          } catch (ocrError) {
            console.error('Certificate OCR failed:', ocrError.message);
          }
        }

        aiContent = await AIService.generateContentFromCertificates(student.certificates);
      } catch (error) {
        console.error("AI generation failed:", error.message);
        aiError = error.message;
      }
    }

    if (student.targetCareer) {
      try {
        aiContent.summary = await AIService.generateCareerObjective(student.targetCareer);
      } catch (error) {
        console.error('Career objective generation failed:', error.message);
        aiError = [aiError, error.message].filter(Boolean).join(' ');
      }
    }
    if (student.projectDescription) aiContent.projects = [student.projectDescription];

    // ✅ Return complete resume data
    res.json({
      ...student,
      aiContent: {
        summary: aiContent.summary,
        education: aiContent.education,
        skills: Array.isArray(aiContent.skills) ? aiContent.skills : [],
        projects: Array.isArray(aiContent.projects) ? aiContent.projects : [],
        experience: Array.isArray(aiContent.experience) ? aiContent.experience : [],
        achievements: Array.isArray(aiContent.achievements) ? aiContent.achievements : []
      },
      aiError
    });

  } catch (error) {
    console.error("❌ Resume Generation Error:", error);
    res.status(500).json({
      error: "Failed to load resume",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ Add save endpoint
router.post('/save', async (req, res) => {
  try {
    const { name, phone, email, targetCareer, projectDetails, projects, sectionTitles, customSections } = req.body;
    const safeSectionTitles = Object.fromEntries(
      Object.entries(sectionTitles && typeof sectionTitles === 'object' && !Array.isArray(sectionTitles) ? sectionTitles : {})
        .filter(([key, value]) => /^[a-z0-9_-]{1,80}$/i.test(key) && typeof value === 'string')
        .map(([key, value]) => [key, value.trim().slice(0, 120)])
    );
    const safeCustomSections = (Array.isArray(customSections) ? customSections : [])
      .slice(0, 20)
      .filter(section => section && typeof section === 'object')
      .map(section => ({
        id: String(section.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
        title: typeof section.title === 'string' ? section.title.trim().slice(0, 120) : '',
        content: typeof section.content === 'string' ? section.content.slice(0, 12000) : ''
      }))
      .filter(section => section.id && section.title);

    console.log('💾 Saving resume for account:', req.user.username);

    // Update student info
    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE students SET name = ?, phone = ?, email = ?, target_career = ?,
         project_details = ?, project_description = ?, section_titles = ?, custom_sections = ? WHERE id = ?`,
        [name, phone, email,
          typeof targetCareer === 'string' ? targetCareer.trim().slice(0, 120) : null,
          typeof projectDetails === 'string' ? projectDetails.trim().slice(0, 8000) : '',
          typeof projects === 'string' ? projects.trim().slice(0, 12000) : '',
          JSON.stringify(safeSectionTitles),
          JSON.stringify(safeCustomSections),
          req.user.studentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Resume saved successfully!' });
  } catch (err) {
    console.error("❌ Save Error:", err);
    res.status(500).json({ error: 'Failed to save resume' });
  }
});

module.exports = router;
