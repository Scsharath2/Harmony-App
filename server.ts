import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("harmony.db");
db.pragma('foreign_keys = ON');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT CHECK(type IN ('trial', 'full')) DEFAULT 'trial',
    status TEXT DEFAULT 'active',
    invite_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    user_id TEXT,
    amount REAL,
    currency TEXT DEFAULT 'USD',
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS assessment_participants (
    assessment_id TEXT,
    user_id TEXT,
    role TEXT,
    invite_status TEXT,
    PRIMARY KEY (assessment_id, user_id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    pillar TEXT,
    text TEXT,
    options TEXT, -- JSON array of options
    weight REAL DEFAULT 1.0
  );

  CREATE TABLE IF NOT EXISTS responses (
    assessment_id TEXT,
    user_id TEXT,
    question_id TEXT,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (assessment_id, user_id, question_id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    assessment_id TEXT PRIMARY KEY,
    content_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    assessment_id TEXT,
    event TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper to generate robust invite codes
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 50) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = db.prepare("SELECT id FROM assessments WHERE invite_code = ?").get(code);
    if (!existing) isUnique = true;
    attempts++;
  }
  return code;
}

// Migration: Add columns to assessments if they don't exist
try {
  db.prepare("ALTER TABLE assessments ADD COLUMN invite_code TEXT").run();
} catch (e: any) {}

try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_invite_code ON assessments(invite_code)").run();
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE assessments ADD COLUMN status TEXT DEFAULT 'active'").run();
} catch (e: any) {}

// Ensure all existing assessments have a clean, unique invite code
const fixIntegrity = () => {
  try {
    const allAssessments = db.prepare("SELECT id, invite_code FROM assessments").all() as any[];
    console.log(`[INTEGRITY] Checking ${allAssessments.length} assessments...`);
    const updateStmt = db.prepare("UPDATE assessments SET invite_code = ? WHERE id = ?");
    const seenCodes = new Set<string>();

    for (const item of allAssessments) {
      let code = item.invite_code;
      
      // 1. Clean the code
      let cleanCode = (code && typeof code === 'string') 
        ? code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') 
        : '';
      
      // 2. Check if it's valid (6 chars) and unique
      if (cleanCode.length === 6 && !seenCodes.has(cleanCode)) {
        if (code !== cleanCode) {
          console.log(`[INTEGRITY] Cleaning code for ${item.id}: "${code}" -> "${cleanCode}"`);
          updateStmt.run(cleanCode, item.id);
        }
        seenCodes.add(cleanCode);
      } else {
        // 3. If invalid, missing, or duplicate, generate a fresh one
        let newCode = generateInviteCode();
        while (seenCodes.has(newCode)) {
          newCode = generateInviteCode();
        }
        console.log(`[INTEGRITY] Regenerating invalid/duplicate code for ${item.id}: "${code}" -> "${newCode}"`);
        updateStmt.run(newCode, item.id);
        seenCodes.add(newCode);
      }
    }
    console.log("[INTEGRITY] Check complete.");
  } catch (error) {
    console.error("[INTEGRITY] Failed:", error);
  }
};

fixIntegrity();

  // Seed Questions
const seedQuestions = [
  // Emotional
  { id: 'e1', pillar: 'Emotional', text: 'After a long, exhausting day, what would feel most comforting from your future spouse?', options: JSON.stringify(["Just sitting together quietly", "Listening fully while I share", "Doing something practical", "A warm hug and reassurance"]) },
  { id: 'e2', pillar: 'Emotional', text: 'In your home growing up, how was love and care most often expressed?', options: JSON.stringify(["Acts of service", "Open words and conversations", "Sacrifices made for family", "Quality time together"]) },
  // Conflict
  { id: 'c1', pillar: 'Conflict', text: 'In many families, disagreements are kept private. How do you feel about that?', options: JSON.stringify(["Strongly agree", "Mostly agree", "Seek guidance from elders", "Open to outside perspective"]) },
  { id: 'c2', pillar: 'Conflict', text: 'If you and your partner disagree about a major decision and families have strong opinions, how do you handle it?', options: JSON.stringify(["Decide together first", "Seek family guidance then decide", "Defer to elders", "Find a compromise for everyone"]) },
  // Financial
  { id: 'f1', pillar: 'Financial', text: 'After marriage, how do you picture managing financial responsibilities towards your respective parents?', options: JSON.stringify(["Independently support own parents", "Discuss and decide together", "Pool everything", "Household comes first"]) },
  { id: 'f2', pillar: 'Financial', text: 'How do you imagine making large financial decisions?', options: JSON.stringify(["Together as equal partners", "Higher earner has bigger say", "With inputs from families", "One takes lead based on expertise"]) },
  // Family
  { id: 'fa1', pillar: 'Family', text: 'How do you envision your living arrangement in the first few years?', options: JSON.stringify(["Living with or close to in-laws", "Living independently, visiting often", "Living in a different city", "Living separately, staying connected"]) },
  { id: 'fa2', pillar: 'Family', text: 'When parents offer strong opinions about your married life, how do you handle it?', options: JSON.stringify(["Listen but decide as a couple", "Follow their guidance", "Evaluate each situation", "Maintain clear boundaries"]) },
  // Life Vision
  { id: 'lv1', pillar: 'Life Vision', text: 'Where do you see both of you living five years after your wedding?', options: JSON.stringify(["Hometown, close to family", "Metro city for career", "Abroad", "Wherever life takes us"]) },
  // Parenting
  { id: 'p1', pillar: 'Parenting', text: 'When do you imagine starting a family after marriage?', options: JSON.stringify(["Within 1–2 years", "After 3–4 years", "When both feel ready", "Still exploring"]) },
  // Intimacy
  { id: 'i1', pillar: 'Intimacy', text: 'How comfortable are you expressing your emotional needs to your future spouse?', options: JSON.stringify(["Very comfortable", "Comfortable over time", "Show through actions", "Find it difficult but want to work on it"]) },
  // Lifestyle
  { id: 'ls1', pillar: 'Lifestyle', text: 'How do you picture a typical Sunday in your married home?', options: JSON.stringify(["Family visits and meals", "Quiet morning together", "Out exploring", "Mix of family and couple time"]) },
];

const insertQ = db.prepare("INSERT OR REPLACE INTO questions (id, pillar, text, options) VALUES (?, ?, ?, ?)");
seedQuestions.forEach(q => insertQ.run(q.id, q.pillar, q.text, q.options));
console.log("Questions seeded/updated.");

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  io.on('connection', (socket) => {
    socket.on('join', (assessmentId) => {
      socket.join(assessmentId);
    });
  });

  app.use(express.json());

  // API Routes
  
  // Mock Auth - In a real app, use Supabase Auth
  app.post("/api/auth/login", (req, res) => {
    const { email, name } = req.body;
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      const id = Math.random().toString(36).substring(7);
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(id, email, name);
      user = { id, email, name };
    }
    res.json(user);
  });

  app.get("/api/questions", (req, res) => {
    const questions = db.prepare("SELECT * FROM questions").all();
    res.json(questions.map((q: any) => ({ ...q, options: JSON.parse(q.options) })));
  });

  app.get("/api/assessments/:userId", (req, res) => {
    const assessments = db.prepare(`
      SELECT a.*, ap.role, ap.invite_status,
      (SELECT COUNT(*) FROM assessment_participants WHERE assessment_id = a.id) as participant_count
      FROM assessments a
      JOIN assessment_participants ap ON a.id = ap.assessment_id
      WHERE ap.user_id = ?
    `).all(req.params.userId);
    res.json(assessments);
  });

  app.post("/api/assessments", (req, res) => {
    try {
      const { userId, type, name } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Verify user exists to prevent FK constraint failure
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
      if (!user) {
        return res.status(401).json({ error: "User session not found. Please log out and log back in." });
      }

      // Limit check
      const count = db.prepare("SELECT COUNT(*) as count FROM assessment_participants WHERE user_id = ? AND role = 'creator'").get(userId) as { count: number };
      if (count && count.count >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 assessments reached." });
      }

      const id = Math.random().toString(36).substring(7);
      const inviteCode = generateInviteCode();
      console.log(`DEBUG: Creating assessment ${id} with invite code: ${inviteCode}`);
      const assessmentName = name || `Journey ${(count?.count || 0) + 1}`;
      
      const transaction = db.transaction(() => {
        db.prepare("INSERT INTO assessments (id, type, name, invite_code) VALUES (?, ?, ?, ?)").run(id, type || 'trial', assessmentName, inviteCode);
        db.prepare("INSERT INTO assessment_participants (assessment_id, user_id, role, invite_status) VALUES (?, ?, ?, ?)")
          .run(id, userId, 'creator', 'accepted');
      });
      
      transaction();
      
      const newAssessment = db.prepare(`
        SELECT a.*, ap.role, ap.invite_status 
        FROM assessments a
        JOIN assessment_participants ap ON a.id = ap.assessment_id
        WHERE a.id = ? AND ap.user_id = ?
      `).get(id, userId);
      
      res.json(newAssessment);
    } catch (error: any) {
      console.error("Error creating assessment:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.patch("/api/assessments/:id", (req, res) => {
    try {
      const { name, userId } = req.body;
      if (!userId) return res.status(400).json({ error: "User ID is required" });

      const participant = db.prepare("SELECT role FROM assessment_participants WHERE assessment_id = ? AND user_id = ?").get(req.params.id, userId) as any;
      
      if (!participant || participant.role !== 'creator') {
        return res.status(403).json({ error: "Only the creator can rename the assessment" });
      }

      db.prepare("UPDATE assessments SET name = ? WHERE id = ?").run(name, req.params.id);
      io.to(req.params.id).emit('assessment:updated', { id: req.params.id, name });
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Error renaming assessment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/assessments/:id", (req, res) => {
    try {
      const id = req.params.id;
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM responses WHERE assessment_id = ?").run(id);
        db.prepare("DELETE FROM assessment_participants WHERE assessment_id = ?").run(id);
        db.prepare("DELETE FROM reports WHERE assessment_id = ?").run(id);
        db.prepare("DELETE FROM transactions WHERE assessment_id = ?").run(id);
        db.prepare("DELETE FROM logs WHERE assessment_id = ?").run(id);
        db.prepare("DELETE FROM assessments WHERE id = ?").run(id);
      });
      transaction();
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Error deleting assessment:", error);
      res.status(500).json({ error: error.message || "Failed to delete assessment" });
    }
  });

  app.get("/api/transactions/:userId", (req, res) => {
    const transactions = db.prepare(`
      SELECT t.*, a.name as assessment_name
      FROM transactions t
      JOIN assessments a ON t.assessment_id = a.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.userId);
    res.json(transactions);
  });

  app.post("/api/assessments/:id/invite", (req, res) => {
    const { email, name } = req.body;
    const assessmentId = req.params.id;
    
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      const id = Math.random().toString(36).substring(7);
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(id, email, name);
      user = { id, email, name };
    }

    const existing = db.prepare("SELECT * FROM assessment_participants WHERE assessment_id = ? AND user_id = ?")
      .get(assessmentId, user.id);
    
    if (existing) {
      return res.status(400).json({ error: "Partner already invited" });
    }

    db.prepare("INSERT INTO assessment_participants (assessment_id, user_id, role, invite_status) VALUES (?, ?, ?, ?)")
      .run(assessmentId, user.id, 'partner', 'accepted');
    
    res.json({ status: "ok", user });
  });

  app.post("/api/assessments/:id/upgrade", (req, res) => {
    const assessmentId = req.params.id;
    const { userId } = req.body;
    
    // Check if it already has a code
    const assessment = db.prepare("SELECT invite_code FROM assessments WHERE id = ?").get(assessmentId) as any;
    let inviteCode = assessment?.invite_code;
    
    if (!inviteCode || inviteCode === '') {
      inviteCode = generateInviteCode();
    }
    
    const transaction = db.transaction(() => {
      db.prepare("UPDATE assessments SET type = 'full', invite_code = ? WHERE id = ?").run(inviteCode, assessmentId);
      const txId = Math.random().toString(36).substring(7);
      db.prepare("INSERT INTO transactions (id, assessment_id, user_id, amount, status) VALUES (?, ?, ?, ?, ?)")
        .run(txId, assessmentId, userId, 29.00, 'completed');
    });
    
    transaction();
    res.json({ status: "ok", inviteCode });
  });

  app.post("/api/assessments/join-with-code", (req, res) => {
    try {
      const { userId, inviteCode } = req.body;
      const rawCode = String(inviteCode || '').trim();
      const sanitizedCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      console.log(`[JOIN] Attempt: User=${userId}, Raw="${rawCode}", Sanitized="${sanitizedCode}"`);
      
      if (!userId) {
        return res.status(400).json({ error: "User session lost. Please log in again." });
      }

      if (sanitizedCode.length !== 6) {
        return res.status(400).json({ error: "Invite codes must be exactly 6 characters (letters and numbers)." });
      }

      // 1. Try exact match on sanitized code
      let assessment = db.prepare("SELECT * FROM assessments WHERE invite_code = ?").get(sanitizedCode) as any;
      
      // 2. Fallback: Case-insensitive search
      if (!assessment) {
        assessment = db.prepare("SELECT * FROM assessments WHERE UPPER(invite_code) = ?").get(sanitizedCode) as any;
      }

      // 3. Ultimate Fallback: Scan all and compare sanitized versions
      if (!assessment) {
        const all = db.prepare("SELECT id, invite_code FROM assessments").all() as any[];
        const match = all.find(a => {
          if (!a.invite_code) return false;
          return a.invite_code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === sanitizedCode;
        });
        if (match) {
          assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(match.id);
        }
      }

      if (!assessment) {
        console.log(`[JOIN] Failed: Code "${sanitizedCode}" not found in database.`);
        // Debug: Log the last 5 codes created to see if they match the user's expectation
        const recent = db.prepare("SELECT id, invite_code, created_at FROM assessments ORDER BY created_at DESC LIMIT 5").all();
        console.log("[JOIN] Recent codes in DB:", JSON.stringify(recent));
        
        return res.status(404).json({ error: `Invite code "${sanitizedCode}" not found. Please double-check with your partner.` });
      }

      console.log(`[JOIN] Found Assessment: ${assessment.id} (${assessment.name})`);

      const participants = db.prepare("SELECT * FROM assessment_participants WHERE assessment_id = ?").all(assessment.id) as any[];
      const isCreator = participants.some(p => p.user_id === userId && p.role === 'creator');
      
      if (isCreator) {
        return res.status(400).json({ error: "You are the creator of this assessment and cannot join it as a partner." });
      }

      const existing = participants.find(p => p.user_id === userId);
      if (existing) {
        const participantsFull = db.prepare(`
          SELECT u.id, u.email, u.name, ap.role, ap.invite_status
          FROM assessment_participants ap
          JOIN users u ON ap.user_id = u.id
          WHERE ap.assessment_id = ?
        `).all(assessment.id);
        return res.json({ status: "ok", assessmentId: assessment.id, assessment: { ...assessment, participants: participantsFull }, message: "Already joined" });
      }

      if (participants.length >= 2) {
        return res.status(400).json({ error: "This assessment already has a partner." });
      }

      // Ensure user exists in DB
      const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
      if (!userExists) {
        return res.status(400).json({ error: "User profile not found. Please try logging out and back in." });
      }

      db.prepare("INSERT INTO assessment_participants (assessment_id, user_id, role, invite_status) VALUES (?, ?, ?, ?)")
        .run(assessment.id, userId, 'partner', 'accepted');
      
      const participantsUpdated = db.prepare(`
        SELECT u.id, u.email, u.name, ap.role, ap.invite_status
        FROM assessment_participants ap
        JOIN users u ON ap.user_id = u.id
        WHERE ap.assessment_id = ?
      `).all(assessment.id);

      io.to(assessment.id).emit('partner:joined', { assessmentId: assessment.id, participants: participantsUpdated });
      
      res.json({ status: "ok", assessmentId: assessment.id, assessment: { ...assessment, participants: participantsUpdated } });
    } catch (error: any) {
      console.error("CRITICAL Join code error:", error);
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.post("/api/assessments/:id/regenerate-code", (req, res) => {
    try {
      const { userId } = req.body;
      const assessmentId = req.params.id;
      
      const participant = db.prepare("SELECT role FROM assessment_participants WHERE assessment_id = ? AND user_id = ?").get(assessmentId, userId) as any;
      if (!participant || participant.role !== 'creator') {
        return res.status(403).json({ error: "Only the creator can regenerate the invite code." });
      }

      const newCode = generateInviteCode();
      db.prepare("UPDATE assessments SET invite_code = ? WHERE id = ?").run(newCode, assessmentId);
      
      res.json({ status: "ok", inviteCode: newCode });
    } catch (error: any) {
      console.error("Regenerate code error:", error);
      res.status(500).json({ error: "Failed to regenerate code." });
    }
  });

  app.get("/api/assessment/:id", (req, res) => {
    const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(req.params.id);
    const participants = db.prepare(`
      SELECT u.id, u.email, u.name, ap.role, ap.invite_status
      FROM assessment_participants ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.assessment_id = ?
    `).all(req.params.id);
    res.json({ ...assessment, participants });
  });

  app.post("/api/responses", (req, res) => {
    try {
      const { assessmentId, userId, responses } = req.body;
      
      // Verify assessment and user exist
      const assessment = db.prepare("SELECT id FROM assessments WHERE id = ?").get(assessmentId);
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
      
      if (!assessment || !user) {
        return res.status(400).json({ error: "Invalid assessment or user session" });
      }

      const insert = db.prepare("INSERT OR REPLACE INTO responses (assessment_id, user_id, question_id, value) VALUES (?, ?, ?, ?)");
      
      const transaction = db.transaction(() => {
        for (const [qId, val] of Object.entries(responses)) {
          // Verify question exists
          const question = db.prepare("SELECT id FROM questions WHERE id = ?").get(qId);
          if (question) {
            insert.run(assessmentId, userId, qId, val);
          }
        }
      });
      
      transaction();
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Error saving responses:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/responses/:assessmentId", (req, res) => {
    const responses = db.prepare("SELECT * FROM responses WHERE assessment_id = ?").all(req.params.assessmentId);
    res.json(responses);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
