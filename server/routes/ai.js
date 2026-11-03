const express = require('express');
const AIService = require('../services/aiService');

const router = express.Router();

// ✅ FIX 1: Update endpoint to match frontend (/ai-regenerate-section)
router.post('/ai-regenerate-section', async (req, res) => {
  try {
    const { text, section, targetCareer, projectDetails, variation } = req.body;

    // ✅ Validate input
    if (!section || typeof section !== 'string') {
      return res.status(400).json({ error: 'Section name is required' });
    }

    console.log(`🤖 AI Regenerate Request - Section: ${section}`);
    let aiContent;
    if (section.toLowerCase() === 'summary') {
      if (!targetCareer?.trim()) return res.status(400).send('Enter your target career first.');
      aiContent = { summary: await AIService.generateCareerObjective(targetCareer) };
    } else if (section.toLowerCase() === 'projects') {
      const result = await AIService.generateProjectDescription(projectDetails, variation);
      res.set('Content-Type', 'text/plain');
      return res.send(result);
    } else {
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text content is required' });
      }
      aiContent = await AIService.generateContentFromCertificates([{ extracted_text: text }]);
    }

    // ✅ Return only the requested section
    let result = '';
    switch (section.toLowerCase()) {
      case 'summary':
        result = aiContent.summary;
        break;
      case 'education':
        result = aiContent.education;
        break;
      case 'skills':
        result = Array.isArray(aiContent.skills) ? aiContent.skills.join(', ') : aiContent.skills;
        break;
      case 'projects':
        result = Array.isArray(aiContent.projects) ? aiContent.projects.join('\n') : aiContent.projects;
        break;
      case 'experience':
        result = Array.isArray(aiContent.experience) ? aiContent.experience.join('\n') : aiContent.experience;
        break;
      case 'achievements':
        result = Array.isArray(aiContent.achievements) ? aiContent.achievements.join('\n') : aiContent.achievements;
        break;
      default:
        result = 'Section not supported. Please use: summary, education, skills, projects, experience, or achievements.';
    }

    // ✅ Send plain text response (as expected by frontend)
    res.set('Content-Type', 'text/plain');
    res.send(result);

  } catch (err) {
    console.error('❌ AI Regenerate Error:', err);
    res.status(err.status || 502).send('AI generation failed: ' + err.message);
  }
});

router.post('/generate-ai-content', async (req, res) => {
  try {
    const { student } = req.body;
    const certs = student?.certificates || [];
    const combinedText = certs.map(c => c.extracted_text || '').filter(Boolean).join('\n\n');
    if (!combinedText) {
      return res.status(400).json({ error: 'No certificate text available for AI generation' });
    }

    const aiResult = await AIService.generateContentFromCertificates([{ extracted_text: combinedText }]);
    aiResult.summary = await AIService.generateCareerObjective(student?.targetCareer);
    return res.json(aiResult);
  } catch (err) {
    console.error('AI content request failed:', err.message);
    res.status(err.status || 502).json({ error: err.message || 'AI provider error' });
  }
});

module.exports = router;
