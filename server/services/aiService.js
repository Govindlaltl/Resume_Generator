const { generateText } = require('./openaiService');
const DEFAULT_EDUCATION_INSTITUTION = 'Adi Shankara Institute Of Engineering And Technology';

const EMPTY_CONTENT = {
  summary: '',
  education: DEFAULT_EDUCATION_INSTITUTION,
  skills: [],
  projects: [],
  experience: [],
  achievements: []
};

const SKILL_TERMS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'SQL', 'HTML', 'CSS',
  'React', 'Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'TensorFlow', 'PyTorch',
  'Machine Learning', 'Deep Learning', 'Data Analysis', 'AWS', 'Azure', 'Google Cloud',
  'Docker', 'Kubernetes', 'Git', 'Linux', 'Power BI', 'Excel', 'MongoDB', 'MySQL',
  'PostgreSQL', 'Flutter', 'Firebase', 'Android', 'Cybersecurity'
];

function cleanList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/\n|,/).map(item => item.replace(/^[-*\s]+/, '').trim()).filter(Boolean);
  return [];
}

class AIService {
  static async generateContentFromCertificates(certificates) {
    const usableCertificates = (certificates || []).filter(cert => {
      const text = typeof cert.extracted_text === 'string' ? cert.extracted_text.trim() : '';
      return text && !/^(image certificate:|uploaded file:|text extraction failed)/i.test(text);
    });

    if (!usableCertificates.length) {
      const error = new Error('No readable certificate text was found. Upload a clear image or a text-based PDF.');
      error.status = 422;
      throw error;
    }

    const certificateText = usableCertificates.map((cert, index) => {
      const filename = typeof cert.filename === 'string' ? cert.filename : '';
      return `CERTIFICATE ${index + 1}\nUploaded filename: ${filename || 'not provided'}\nExtracted text:\n${cert.extracted_text.substring(0, 5000)}`;
    }).join('\n\n---\n\n');

    const prompt = `Extract resume details supported by the certificate evidence below. Include explicitly named programming languages and tools in skills. Include each uploaded certificate's exact name in achievements/certifications. Do not generate a career objective or education entry; those are handled separately. Do not invent employers, internships, completed projects, awards, results, or dates. Describe documented coursework as training, never employment. If no project is documented, provide one concise idea based on demonstrated skills, prefixed exactly with "Suggested project (not completed):". Leave unsupported details empty.\n\nReturn only valid JSON with this exact shape:\n{"skills":["string"],"projects":["string"],"experience":["string"],"achievements":["string"]}\n\nCertificate evidence:\n${certificateText}`;

    const output = await generateText(prompt, 'You write factual, evidence-based student resumes. Never make up personal history or qualifications.');
    const jsonText = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('OpenRouter did not return resume content in the expected JSON format.');

    const parsed = JSON.parse(jsonText.slice(start, end + 1));
    const sourceText = usableCertificates.map(cert => cert.extracted_text).join('\n').toLowerCase();
    const explicitSkills = SKILL_TERMS.filter(skill => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped.toLowerCase()}(?=$|[^a-z0-9])`, 'i').test(sourceText);
    });
    const generatedSkills = cleanList(parsed.skills);
    for (const skill of explicitSkills) {
      if (!generatedSkills.some(item => item.toLowerCase() === skill.toLowerCase())) generatedSkills.unshift(skill);
    }
    const generatedAchievements = cleanList(parsed.achievements);
    for (const certificate of usableCertificates) {
      const name = typeof certificate.filename === 'string'
        ? certificate.filename.replace(/\.[^.]+$/, '').trim()
        : '';
      if (name && !generatedAchievements.some(item => item.toLowerCase().includes(name.toLowerCase()))) {
        generatedAchievements.push(`Certification: ${name}`);
      }
    }

    return {
      summary: '',
      education: DEFAULT_EDUCATION_INSTITUTION,
      skills: generatedSkills,
      projects: cleanList(parsed.projects),
      experience: cleanList(parsed.experience),
      achievements: generatedAchievements
    };
  }

  static async generateCareerObjective(targetCareer) {
    const career = typeof targetCareer === 'string' ? targetCareer.trim().slice(0, 120) : '';
    if (!career) return '';

    const prompt = `Write a concise, ATS-friendly career objective for a student targeting this exact role or field: ${JSON.stringify(career)}. Treat the stated target role as the only source for this objective. Use standard keywords that belong to that profession. Do not use certificates, courses, skills, tools, or experience from any other resume section. For a medical role, use medical-care terms; for civil engineering, use civil-engineering terms; for AI development, use AI-development terms. Never mix these fields. Do not claim qualifications or experience the student has not provided. Write 1-2 polished sentences, 35-55 words, as plain text with no heading or bullets.`;
    return (await generateText(prompt, 'You write concise, ATS-friendly career objectives tailored strictly to the stated target role. Do not mix in unrelated professions or skills.')).trim();
  }

  static async generateProjectDescription(projectDetails, variation = 1) {
    const details = typeof projectDetails === 'string' ? projectDetails.trim().slice(0, 8000) : '';
    if (!details) {
      const error = new Error('Add project notes first so the AI can describe your actual project.');
      error.status = 400;
      throw error;
    }

    const version = Math.max(1, Number.parseInt(variation, 10) || 1);
    const prompt = `Rewrite the student's project notes as a clear, concise, ATS-friendly resume project entry. Preserve the actual project title and only facts, technologies, features, and results explicitly present in the notes. Do not invent metrics, tools, responsibilities, or outcomes. Format each project title on its own plain-text line with no bullet or markdown, followed by 2-4 short action-oriented description lines beginning with a hyphen. This is rewrite variation ${version}: use a meaningfully different wording and emphasis from earlier versions while keeping facts unchanged. Return plain text only; never use ** or other markdown.\n\nProject notes:\n${details}`;
    const output = await generateText(prompt, 'You are a factual resume editor. Improve clarity and impact without adding claims that are not in the supplied project notes. Use plain text only, with unbulleted project title lines followed by hyphen bullets.', { temperature: 0.8 });
    return output.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
  }

  static getEmptyContent() {
    return { ...EMPTY_CONTENT, skills: [], projects: [], experience: [], achievements: [] };
  }
}

module.exports = AIService;
