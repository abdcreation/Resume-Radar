const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const { readDb, writeDb } = require('./db');
const { parseResume, scoreResumeAgainstJob } = require('./parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for client purposes
app.use(cors());
app.use(express.json());

// Set up Multer for memory storage (direct buffer access)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Helper to generate IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- API ROUTES ---

// 1. Get all jobs
app.get('/api/jobs', (req, res) => {
  try {
    const db = readDb();
    res.json(db.jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve jobs" });
  }
});

// 2. Create a new job
app.post('/api/jobs', (req, res) => {
  try {
    const { title, department, location, type, description, skills, experience, education } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const db = readDb();
    const newJob = {
      id: generateId('job'),
      title,
      department: department || "General",
      location: location || "Remote",
      type: type || "Full-time",
      description,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
      experience: parseInt(experience, 10) || 0,
      education: education || "Bachelor's",
      status: "Active",
      createdAt: new Date().toISOString()
    };

    db.jobs.unshift(newJob);
    writeDb(db);
    res.status(201).json(newJob);
  } catch (error) {
    res.status(500).json({ error: "Failed to create job" });
  }
});

// 3. Delete a job (and its candidates)
app.delete('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    
    db.jobs = db.jobs.filter(j => j.id !== id);
    db.candidates = db.candidates.filter(c => c.jobId !== id);
    
    writeDb(db);
    res.json({ message: "Job and associated applicants deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete job" });
  }
});

// 4. Get candidates for a specific job
app.get('/api/jobs/:jobId/candidates', (req, res) => {
  try {
    const { jobId } = req.params;
    const db = readDb();
    const jobCandidates = db.candidates.filter(c => c.jobId === jobId);
    
    // Sort candidates by score descending by default
    jobCandidates.sort((a, b) => b.score - a.score);
    res.json(jobCandidates);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve candidates" });
  }
});

// 5. Upload & Parse Resumes (Supports batch uploads)
app.post('/api/jobs/:jobId/upload', upload.array('resumes', 10), async (req, res) => {
  try {
    const { jobId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No resume files uploaded" });
    }

    const db = readDb();
    const job = db.jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job posting not found" });
    }

    const uploadedCandidates = [];
    const errors = [];

    // Process each resume in the batch
    for (const file of files) {
      try {
        let text = "";
        
        // Check file type and parse accordingly
        if (file.mimetype === 'application/pdf') {
          const parsedPdf = await pdfParse(file.buffer);
          text = parsedPdf.text;
        } else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
          text = file.buffer.toString('utf8');
        } else {
          // If we receive a document type we cannot parse cleanly, read it as UTF-8 string as fallback
          text = file.buffer.toString('utf8');
        }

        if (!text || text.trim().length === 0) {
          throw new Error("Could not extract text from the file.");
        }

        // Parse and score
        const parsedData = parseResume(text);
        
        // Fallback name if parsing failed to identify a name
        if (parsedData.name === "Unknown Candidate") {
          // Use filename without extension
          parsedData.name = file.originalname.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
        }

        const scoringData = scoreResumeAgainstJob(parsedData, job);

        const newCandidate = {
          id: generateId('cand'),
          jobId: jobId,
          name: parsedData.name,
          email: parsedData.email || "",
          phone: parsedData.phone || "",
          links: parsedData.links || [],
          skills: parsedData.skills,
          experienceText: parsedData.experienceText,
          educationText: parsedData.educationText,
          resumeText: parsedData.resumeText,
          score: scoringData.score,
          scoreBreakdown: scoringData.scoreBreakdown,
          matchedSkills: scoringData.matchedSkills,
          missingSkills: scoringData.missingSkills,
          suggestions: scoringData.suggestions,
          status: "Applied",
          createdAt: new Date().toISOString()
        };

        db.candidates.push(newCandidate);
        uploadedCandidates.push(newCandidate);
      } catch (fileError) {
        console.error(`Error parsing file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message || "Failed to parse file"
        });
      }
    }

    // Save modifications to db
    if (uploadedCandidates.length > 0) {
      writeDb(db);
    }

    res.status(200).json({
      success: uploadedCandidates,
      errors: errors
    });

  } catch (error) {
    console.error("Upload handler error:", error);
    res.status(500).json({ error: "Server error during file upload" });
  }
});

// 6. Update candidate status (Kanban stage transition)
app.patch('/api/candidates/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStages = ["Applied", "Screening", "Interview", "Offered", "Rejected"];
    if (!validStages.includes(status)) {
      return res.status(400).json({ error: "Invalid recruitment stage" });
    }

    const db = readDb();
    const candidateIdx = db.candidates.findIndex(c => c.id === id);
    if (candidateIdx === -1) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    db.candidates[candidateIdx].status = status;
    writeDb(db);

    res.json(db.candidates[candidateIdx]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update candidate status" });
  }
});

// 7. Delete a candidate record
app.delete('/api/candidates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    
    db.candidates = db.candidates.filter(c => c.id !== id);
    writeDb(db);
    
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

// Serve static frontend files if they exist in production/distribution folders
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback all non-API GET requests to index.html for SPA router support
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("ATS Backend is running. Frontend build not found.");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ATS Tracker Server running on http://localhost:${PORT}`);
});
