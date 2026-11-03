let currentStudentData = null;
let projectGenerationAttempt = 0;

// ==================== CHATBOT FUNCTIONALITY ====================
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openChatBtn');
  const closeBtn = document.getElementById('closeChatBtn');
  const chatbot = document.getElementById('chatbotContainer');
  const messagesDiv = document.getElementById('chatMessages');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  // Open chatbot
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chatbot.style.display = 'flex';
    });
  }

  // Close chatbot
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chatbot.style.display = 'none';
    });
  }

  // Send message on button click
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // Send message on Enter key
  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  async function sendMessage() {
    const text = userInput?.value?.trim();
    if (!text || !userInput) return;

    // Add user message to UI
    appendMessage(text, 'user');
    userInput.value = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      if (res.ok) {
        appendMessage(data.reply, 'bot');
      } else {
        appendMessage('❌ Error: ' + (data.error || 'Unknown error'), 'bot');
      }
    } catch (error) {
      console.error('Chatbot Error:', error);
      appendMessage('⚠️ Failed to connect to server. Check console.', 'bot');
    }
  }

  function appendMessage(text, sender) {
    if (!messagesDiv) return;

    const div = document.createElement('div');
    div.classList.add('message', sender);
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    const safeText = text.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    messageText.innerHTML = safeText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.appendChild(messageText);
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (sender === 'bot') {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'copy-answer-btn';
      copyButton.textContent = 'Copy answer';
      copyButton.setAttribute('aria-label', 'Copy AI answer');
      copyButton.addEventListener('click', async () => {
        copyButton.disabled = true;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.setAttribute('readonly', '');
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            const copied = document.execCommand('copy');
            temp.remove();
            if (!copied) throw new Error('Clipboard is unavailable in this browser.');
          }
          copyButton.textContent = 'Copied ✓';
          setTimeout(() => { copyButton.textContent = 'Copy answer'; }, 1500);
        } catch (error) {
          console.error('Copy answer failed:', error);
          copyButton.textContent = 'Copy failed';
          setTimeout(() => { copyButton.textContent = 'Copy answer'; }, 1800);
        } finally {
          copyButton.disabled = false;
        }
      });
      div.appendChild(copyButton);
    }
  }
});

// ==================== EXISTING RESUME LOGIC ====================

// Upload Certificate
async function uploadCertificate() {
  const fileInput = document.getElementById('certFile');
  const resultDiv = document.getElementById('uploadResult');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Please select a certificate file to upload');
    return;
  }

  const formData = new FormData();
  // backend expects 'certificate' as the file field name
  formData.append('certificate', fileInput.files[0]);

  try {
    resultDiv.textContent = 'Uploading...';
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    resultDiv.innerHTML = `<span style="color:green">✅ ${data.message || 'Uploaded'}</span>`;
    fileInput.value = '';
    resultDiv.textContent = 'Certificate uploaded. Extracting text and generating resume sections…';
    await viewResume();

  } catch (err) {
    console.error('Upload error:', err);
    resultDiv.innerHTML = `<span style="color:red">❌ ${err.message}</span>`;
  }
}

// Regenerate section content using AI
async function regenerateSection(sectionName, textareaId) {
  const isSummary = sectionName === 'summary';
  const isProject = sectionName === 'projects';
  if (!currentStudentData || (!isSummary && !isProject && !currentStudentData.certificates?.length)) {
    alert('No certificates available for AI generation.');
    return;
  }

  const button = event.target;
  if (!button) return;

  const originalText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;

  try {
    // Combine all certificate texts
    const combinedText = (currentStudentData.certificates || [])
      .map(cert => cert.extracted_text || '')
      .filter(text => text && text !== 'Text extraction failed.')
      .join('\n\n');
    const projectDetails = document.getElementById('project-details')?.value?.trim() || '';

    if (isProject && !projectDetails) {
      alert('Add project notes first so the AI can describe your project.');
      return;
    }

    if (!isSummary && !isProject && !combinedText) {
      alert('No text available in certificates for AI generation.');
      return;
    }

    // Call backend to regenerate specific section
    const response = await fetch('/api/ai-regenerate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: combinedText,
        section: sectionName,
        targetCareer: document.getElementById('edit-target-career')?.value?.trim() || '',
        projectDetails,
        variation: isProject ? ++projectGenerationAttempt : undefined
      })
    });

    if (!response.ok) {
      throw new Error((await response.text()) || 'AI generation failed');
    }

    const newContent = await response.text();
    const textarea = document.getElementById(textareaId);
    if (textarea) {
      textarea.value = newContent;
      const editor = textarea.parentElement?.querySelector('.rich-text-editor');
      if (editor) editor.innerHTML = formatMarkupToHtml(newContent);
      if (isProject) currentStudentData.projectDescription = newContent;
    } else {
      console.warn(`Textarea with ID "${textareaId}" not found`);
    }

  } catch (err) {
    console.error("Regenerate Error:", err);
    alert('Failed to regenerate content. Please try again later.');
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Delete section
function deleteSection(sectionId) {
  if (confirm('Are you sure you want to delete this section?')) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.remove();
      alert('Section deleted successfully!');
    } else {
      console.warn(`Section with ID "${sectionId}" not found`);
    }
  }
}

function createCustomResumeSection(section = {}) {
  const sectionElement = document.createElement('section');
  const cleanId = String(section.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  sectionElement.id = cleanId.startsWith('custom-') ? cleanId : `custom-${cleanId}`;
  sectionElement.className = 'section custom-resume-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.contentEditable = 'true';
  title.textContent = section.title || 'New Section';
  const actions = document.createElement('div');
  actions.className = 'section-actions';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn';
  deleteButton.textContent = '🗑️ Delete';
  deleteButton.addEventListener('click', () => deleteSection(sectionElement.id));
  actions.appendChild(deleteButton);
  header.append(title, actions);

  const editable = document.createElement('div');
  editable.className = 'editable-content';
  const content = document.createElement('textarea');
  content.className = 'custom-section-content';
  content.placeholder = `Write about ${section.title || 'this section'}...`;
  content.value = section.content || '';
  editable.appendChild(content);
  addFormattingToolbar(content);
  sectionElement.append(header, editable);

  const actionButtons = document.querySelector('.action-buttons');
  document.querySelector('.professional-resume')?.insertBefore(sectionElement, actionButtons || null);
  return sectionElement;
}

function addFormattingToolbar(textarea) {
  if (!textarea || textarea.dataset.formattingReady === 'true') return;
  textarea.dataset.formattingReady = 'true';
  textarea.classList.add('format-source');
  const editor = document.createElement('div');
  editor.className = 'rich-text-editor';
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');
  editor.setAttribute('aria-label', textarea.getAttribute('aria-label') || textarea.placeholder || 'Resume text');
  editor.innerHTML = formatMarkupToHtml(textarea.value);

  const toolbar = document.createElement('div');
  toolbar.className = 'text-format-toolbar';
  toolbar.setAttribute('aria-label', 'Text formatting');

  const syncSource = () => {
    textarea.value = editorHtmlToFormatMarkup(editor);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };
  editor.addEventListener('input', syncSource);

  const addFormatButton = (label, title, kind, fallback) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'format-btn';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => {
      editor.focus();
      const selection = window.getSelection();
      let range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!range || !editor.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      if (range.collapsed) {
        const placeholder = document.createTextNode(fallback);
        range.insertNode(placeholder);
        range.selectNodeContents(placeholder);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (kind === 'bold') {
        document.execCommand('bold', false);
      } else {
        const styled = document.createElement('span');
        styled.style.fontSize = kind === 'large' ? '14px' : '8px';
        const fragment = range.extractContents();
        styled.appendChild(fragment);
        range.insertNode(styled);
        range.selectNodeContents(styled);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      syncSource();
    });
    toolbar.appendChild(button);
  };

  addFormatButton('B', 'Bold selected text', 'bold', 'bold text');
  toolbar.querySelector('button').style.fontWeight = '800';
  addFormatButton('A+', 'Increase selected text size', 'large', 'larger text');
  addFormatButton('A−', 'Decrease selected text size', 'small', 'smaller text');
  textarea.parentNode.insertBefore(toolbar, textarea);
  textarea.parentNode.insertBefore(editor, textarea);
  syncSource();
}

function formatMarkupToHtml(markup) {
  const escaped = String(markup || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let bold = false;
  let html = escaped.replace(/(\[\[size=\d{1,2}\]\]|\[\[\/size\]\]|\*\*|__)/g, token => {
    const size = token.match(/^\[\[size=(\d{1,2})\]\]$/);
    if (size) return `<span style="font-size:${Math.max(7, Math.min(24, Number(size[1])))}px">`;
    if (token === '[[/size]]') return '</span>';
    bold = !bold;
    return bold ? '<strong>' : '</strong>';
  });
  if (bold) html += '</strong>';
  return html.replace(/\r?\n/g, '<br>');
}

function editorHtmlToFormatMarkup(editor) {
  const serialize = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const content = [...node.childNodes].map(serialize).join('');
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${content}**`;
    if (tag === 'span' && node.style.fontSize) {
      const px = Math.max(7, Math.min(24, Math.round(parseFloat(node.style.fontSize))));
      return `[[size=${px}]]${content}[[/size]]`;
    }
    if (tag === 'div' || tag === 'p') return `${content}\n`;
    return content;
  };
  return [...editor.childNodes].map(serialize).join('').replace(/\n+$/, '');
}

function syncFormattingEditors() {
  document.querySelectorAll('.format-source').forEach(textarea => {
    const editor = textarea.parentElement?.querySelector('.rich-text-editor');
    if (editor) editor.innerHTML = formatMarkupToHtml(textarea.value);
  });
}

function setupTextFormatting() {
  document.querySelectorAll('.professional-resume textarea:not(#project-details)').forEach(addFormattingToolbar);
}

function addResumeSection() {
  const section = createCustomResumeSection({ title: 'New Section', content: '' });
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const heading = section.querySelector('.section-header h2');
  if (heading) {
    const range = document.createRange();
    range.selectNodeContents(heading);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    heading.focus();
  }
}

function renderCustomResumeSections(sections) {
  document.querySelectorAll('.custom-resume-section').forEach(section => section.remove());
  (Array.isArray(sections) ? sections : []).forEach(section => createCustomResumeSection(section));
}

function collectSectionTitles() {
  const titles = {};
  document.querySelectorAll('.professional-resume > .section:not(.custom-resume-section)').forEach(section => {
    const heading = section.querySelector('.section-header h2');
    if (heading) titles[section.id] = heading.innerText.trim();
  });
  const objective = document.getElementById('heading-objective');
  if (objective) titles.objective = objective.innerText.trim();
  return titles;
}

function collectCustomResumeSections() {
  return [...document.querySelectorAll('.custom-resume-section')].map(section => ({
    id: section.id,
    title: section.querySelector('.section-header h2')?.innerText?.trim() || 'New Section',
    content: section.querySelector('.custom-section-content')?.value || ''
  }));
}

// Save changes
async function saveChanges() {
  if (!currentStudentData) {
    alert('No resume data to save.');
    return;
  }

  const saveButton = document.querySelector('.save-btn');
  if (!saveButton) return;

  const originalText = saveButton.textContent;
  saveButton.textContent = '💾 Saving...';
  saveButton.disabled = true;

  try {
    // Collect all edited data
    const editedData = {
      rollNumber: currentStudentData.rollNumber,
      name: document.getElementById('edit-name')?.textContent || currentStudentData.name || '',
      phone: document.getElementById('edit-phone')?.textContent || '',
      email: document.getElementById('edit-email')?.textContent || '',
      targetCareer: document.getElementById('edit-target-career')?.value?.trim() || '',
      projectDetails: document.getElementById('project-details')?.value?.trim() || '',
      sectionTitles: collectSectionTitles(),
      customSections: collectCustomResumeSections(),
      location: document.getElementById('edit-location')?.textContent || 'City, State',
      linkedin: document.getElementById('edit-linkedin')?.textContent || 'linkedin.com/in/yourprofile',
      github: document.getElementById('edit-github')?.textContent || 'github.com/yourusername',
      summary: document.getElementById('edit-summary')?.value || '',
      education: document.getElementById('edit-education')?.value || '',
      skills: document.getElementById('edit-skills')?.value || '',
      projects: document.getElementById('edit-projects')?.value || '',
      experience: document.getElementById('edit-experience')?.value || '',
      achievements: document.getElementById('edit-achievements')?.value || ''
    };

    const response = await fetch('/api/resume/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedData)
    });

    if (response.ok) {
      const result = await response.json();
      currentStudentData.targetCareer = editedData.targetCareer;
      currentStudentData.projectDetails = editedData.projectDetails;
      currentStudentData.projectDescription = editedData.projects;
      currentStudentData.sectionTitles = editedData.sectionTitles;
      currentStudentData.customSections = editedData.customSections;
      const resultDiv = document.getElementById('uploadResult');
      if (resultDiv) resultDiv.textContent = `✅ ${result.message || 'Resume saved successfully!'}`;
    } else {
      const error = await response.json();
      console.error('❌ Save Error Response:', error);
      const resultDiv = document.getElementById('uploadResult');
      if (resultDiv) resultDiv.textContent = `❌ ${error.error || 'Failed to save resume'}`;
    }
  } catch (err) {
    console.error('❌ Save Error:', err);
    const resultDiv = document.getElementById('uploadResult');
    if (resultDiv) resultDiv.textContent = '❌ Network error - please try again later.';
  } finally {
    saveButton.textContent = '💾 Save Resume';
    saveButton.disabled = false;
  }
}

// Download as PDF
function downloadPDF() {
  if (!currentStudentData) {
    alert('No resume to download.');
    return;
  }

  const downloadButton = document.querySelector('.download-btn');
  if (!downloadButton) return;

  const originalText = downloadButton.textContent;
  downloadButton.textContent = '📥 Generating...';
  downloadButton.disabled = true;
  try {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('The PDF generator did not load. Refresh the page and try again.');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const bodyWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - margin;
    let y = 16;

    const readValue = id => document.getElementById(id)?.value?.trim() || '';
    const readText = id => document.getElementById(id)?.innerText?.trim() || '';
    const readHeading = id => {
      const heading = document.getElementById(id);
      return (heading?.innerText || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '').replace(/:\s*$/, '').trim();
    };
    const splitLines = (text, width) => pdf.splitTextToSize(String(text || ''), width);
    const drawFormattedLine = (rawText, x, startY, width, defaultSize = 9.3, defaultStyle = 'normal') => {
      const tokenPattern = /(\[\[size=\d{1,2}\]\]|\[\[\/size\]\]|\*\*|__)/g;
      const tokens = String(rawText).split(tokenPattern).filter(Boolean);
      let bold = defaultStyle === 'bold';
      let fontSize = defaultSize;
      let cursorX = x;
      let cursorY = startY;
      let lineHeight = Math.max(4.1, fontSize * 0.43);
      let lineCount = 1;
      const setFont = () => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);
      };

      for (const token of tokens) {
        const sizeMatch = token.match(/^\[\[size=(\d{1,2})\]\]$/);
        if (sizeMatch) {
          fontSize = Math.max(7, Math.min(24, Number(sizeMatch[1])));
          lineHeight = Math.max(lineHeight, fontSize * 0.43);
          continue;
        }
        if (token === '[[/size]]') { fontSize = defaultSize; continue; }
        if (token === '**' || token === '__') { bold = !bold; continue; }

        const words = token.split(/(\s+)/).filter(Boolean);
        for (const word of words) {
          setFont();
          const wordWidth = pdf.getTextWidth(word);
          if (/^\s+$/.test(word) && cursorX === x) continue;
          if (cursorX + wordWidth > x + width && cursorX > x) {
            cursorY += lineHeight;
            lineCount += 1;
            cursorX = x;
            lineHeight = Math.max(4.1, fontSize * 0.43);
            if (/^\s+$/.test(word)) continue;
          }
          pdf.text(word, cursorX, cursorY);
          cursorX += wordWidth;
        }
      }
      return { lines: lineCount, lineHeight: Math.max(4.1, lineHeight) };
    };
    const ensureSpace = height => {
      if (y + height > bottomLimit) {
        pdf.addPage();
        y = margin;
      }
    };

    const name = readText('edit-name') || currentStudentData.name || 'Resume';
    pdf.setTextColor(17, 17, 17);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(19);
    pdf.text(name.toUpperCase(), pageWidth / 2, y, { align: 'center', maxWidth: bodyWidth });
    y += 6;

    const personalHeading = readHeading('heading-personal');
    if (personalHeading && personalHeading.toLowerCase() !== 'personal details') {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text(personalHeading.toUpperCase(), pageWidth / 2, y, { align: 'center', maxWidth: bodyWidth });
      y += 4;
    }

    const contacts = [
      ['Phone', readText('edit-phone')],
      ['Email', readText('edit-email')],
      ['LinkedIn', readText('edit-linkedin')],
      ['GitHub', readText('edit-github')],
      ['Location', readText('edit-location')]
    ].filter(([, value]) => value && value !== '—' && value !== 'N/A')
      .map(([label, value]) => `${label}: ${value}`).join(' | ');
    if (contacts) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      const contactLines = splitLines(contacts, bodyWidth);
      pdf.text(contactLines, pageWidth / 2, y, { align: 'center', lineHeightFactor: 1.2 });
      y += contactLines.length * 3.8 + 2;
    } else {
      y += 1;
    }

    const addSection = (title, content, bullets = false) => {
      const value = String(content || '').trim();
      if (!value) return;
      ensureSpace(12);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.text(title.toUpperCase(), margin, y);
      y += 1.5;
      pdf.setLineWidth(0.35);
      pdf.setDrawColor(17, 17, 17);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;

      const entries = bullets
        ? value.split(/\r?\n/).map(line => line.replace(/^\s*[-*•▪]\s*/, '').trim()).filter(Boolean)
        : value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

      for (const entry of entries) {
        const textWidth = bullets ? bodyWidth - 6 : bodyWidth;
        ensureSpace(7);
        const startX = bullets ? margin + 5 : margin;
        if (bullets) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9.3);
          pdf.text('-', margin + 1, y);
        }
        const drawn = drawFormattedLine(entry, startX, y, textWidth, 9.3);
        y += drawn.lines * drawn.lineHeight + 0.5;
      }
      y += 1.5;
    };

    const addProjectsSection = (title, content) => {
      const value = String(content || '').trim();
      if (!value) return;
      ensureSpace(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.text(title.toUpperCase(), margin, y);
      y += 1.5;
      pdf.setLineWidth(0.35);
      pdf.setDrawColor(17, 17, 17);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;

      for (const rawLine of value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
        const isBullet = /^[-•▪]\s*/.test(rawLine) || /^\*\s+/.test(rawLine);
        const text = rawLine
          .replace(/^[-•▪]\s*/, '')
          .replace(/^\*\s+/, '')
          .replace(/^\*+|\*+$/g, '')
          .trim();
        if (!text) continue;

        const lineHeight = 4.1;
        ensureSpace(7);
        if (isBullet) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9.3);
          pdf.text('-', margin + 1, y);
          const drawn = drawFormattedLine(text, margin + 5, y, bodyWidth - 6, 9.3);
          y += drawn.lines * drawn.lineHeight + 0.5;
        } else {
          const drawn = drawFormattedLine(text, margin, y, bodyWidth, 9.5, 'bold');
          y += drawn.lines * drawn.lineHeight + 1;
        }
      }
      y += 1.5;
    };

    addSection(readHeading('heading-objective') || 'Career Objective', readValue('edit-summary'));
    addSection(readHeading('heading-education') || 'Education', readValue('edit-education'));
    addSection(readHeading('heading-skills') || 'Skills', readValue('edit-skills'), true);
    addProjectsSection(readHeading('heading-projects') || 'Projects', readValue('edit-projects'));
    addSection(readHeading('heading-experience') || 'Experience & Training', readValue('edit-experience'), true);
    addSection(readHeading('heading-achievements') || 'Achievements & Certifications', readValue('edit-achievements'), true);
    document.querySelectorAll('.custom-resume-section').forEach(section => {
      const title = section.querySelector('.section-header h2')?.innerText?.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '').trim();
      const content = section.querySelector('.custom-section-content')?.value || '';
      if (title) addSection(title, content);
    });

    const filenameName = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Student';
    pdf.save(`${filenameName}_Resume.pdf`);
  } catch (error) {
    console.error('PDF Download Error:', error);
    alert(error.message || 'Failed to generate PDF. Please try again.');
  } finally {
    downloadButton.textContent = originalText;
    downloadButton.disabled = false;
  }
}

// View Resume
async function viewResume() {
  const resultDiv = document.getElementById('uploadResult');
  if (resultDiv) {
    resultDiv.textContent = 'Loading resume and generating sections from your certificates…';
  }

  try {
    const res = await fetch('/api/resume/me');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to load resume');

    currentStudentData = data;

    // Show resume container
    const resumeContainer = document.getElementById('resume-container');
    if (resumeContainer) {
      resumeContainer.style.display = 'block';
    }

    // Debug: Log certificate data
    console.log('📄 Certificates received:', data.certificates);
    data.certificates.forEach((cert, index) => {
      console.log(`📄 Certificate ${index + 1} extracted_text length:`, cert.extracted_text?.length);
      console.log(`📄 Certificate ${index + 1} extracted_text preview:`, cert.extracted_text?.substring(0, 100));
    });

    // Populate personal details
    const nameElem = document.getElementById('edit-name');
    if (nameElem) nameElem.textContent = data.name || 'Unknown';

    const phoneElem = document.getElementById('edit-phone');
    if (phoneElem) phoneElem.textContent = data.phone || 'N/A';

    const emailElem = document.getElementById('edit-email');
    if (emailElem) emailElem.textContent = data.email || 'N/A';

    const targetCareerElem = document.getElementById('edit-target-career');
    if (targetCareerElem) targetCareerElem.value = data.targetCareer || '';

    const projectDetailsElem = document.getElementById('project-details');
    if (projectDetailsElem) projectDetailsElem.value = data.projectDetails || '';

    const sectionTitles = data.sectionTitles && typeof data.sectionTitles === 'object' ? data.sectionTitles : {};
    for (const [sectionId, title] of Object.entries(sectionTitles)) {
      const heading = sectionId === 'objective'
        ? document.getElementById('heading-objective')
        : document.getElementById(sectionId)?.querySelector('.section-header h2');
      if (heading && typeof title === 'string' && title.trim()) heading.textContent = title;
    }
    renderCustomResumeSections(data.customSections);

    // Populate AI content
    if (data.aiContent) {
      const summaryElem = document.getElementById('edit-summary');
      if (summaryElem) summaryElem.value = data.aiContent.summary || '';

      const educationElem = document.getElementById('edit-education');
      if (educationElem) educationElem.value = data.aiContent.education || '';

      const skillsElem = document.getElementById('edit-skills');
      if (skillsElem) skillsElem.value = Array.isArray(data.aiContent.skills) ? data.aiContent.skills.join('\n') : '';

      const projectsElem = document.getElementById('edit-projects');
      if (projectsElem) projectsElem.value = data.projectDescription || (Array.isArray(data.aiContent.projects) ? data.aiContent.projects.join('\n') : '');

      const experienceElem = document.getElementById('edit-experience');
      if (experienceElem) experienceElem.value = Array.isArray(data.aiContent.experience) ? data.aiContent.experience.join('\n') : '';

      const achievementsElem = document.getElementById('edit-achievements');
      if (achievementsElem) achievementsElem.value = Array.isArray(data.aiContent.achievements) ? data.aiContent.achievements.join('\n') : '';
    }
    syncFormattingEditors();

    // Populate certificates
    const certList = document.getElementById('certificates-list');
    if (certList) {
      certList.innerHTML = '';
      if (data.certificates && data.certificates.length > 0) {
        data.certificates.forEach(cert => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = cert.filePath;
          a.target = "_blank";
          a.textContent = cert.filename || 'Unnamed Certificate';
          li.appendChild(a);
          certList.appendChild(li);
        });
      } else {
        certList.innerHTML = '<li>No certificates uploaded.</li>';
      }
    }

    if (resultDiv) {
      if (data.aiError) resultDiv.textContent = `Resume loaded; AI content wasn't generated: ${data.aiError}`;
      else if (!data.certificates?.length) resultDiv.textContent = 'Resume loaded. Upload certificates to generate evidence-based sections.';
      else resultDiv.textContent = '✅ Resume loaded successfully!';
    }

  } catch (err) {
    console.error("Load Resume Error:", err);
    alert(`❌ ${err.message}`);
    if (resultDiv) {
      resultDiv.textContent = `❌ ${err.message}`;
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupTextFormatting();

  fetch('/api/auth/me')
    .then(response => {
      if (!response.ok) {
        window.location.assign('/');
        return null;
      }
      return response.json();
    })
    .then(data => {
      const username = document.getElementById('account-username');
      if (username && data?.user) username.textContent = data.user.username;
    })
    .catch(() => window.location.assign('/'));

  // Add edit mode styling
  const style = document.createElement('style');
  style.textContent = `
    .edit-mode [contenteditable="true"]:focus,
    .edit-mode textarea:focus {
      outline: 2px solid #007bff;
      background-color: #fff9e6;
    }
    .edit-mode [contenteditable="true"]:hover,
    .edit-mode textarea:hover {
      cursor: text;
    }
    
    .plain-pdf .action-buttons,
    .plain-pdf .section-actions,
    .plain-pdf .upload-section,
    .plain-pdf .view-section {
      display: none !important;
    }
    
    .plain-pdf {
      background: white !important;
      box-shadow: none !important;
    }
    
    .plain-pdf .section {
      border: 1px solid #ddd;
      box-shadow: none;
    }
  `;
  document.head.appendChild(style);

});

async function logoutAccount() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.assign('/');
  }
}
