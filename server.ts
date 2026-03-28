import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import cors from "cors";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hero.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    year_level TEXT NOT NULL,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    event_name TEXT NOT NULL,
    time_in DATETIME NOT NULL,
    time_out DATETIME,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS finance (
    receipt_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    purpose TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    collector TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add email column to students if it doesn't exist
try {
  db.prepare("ALTER TABLE students ADD COLUMN email TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add notes column if it doesn't exist
try {
  db.prepare("ALTER TABLE finance ADD COLUMN notes TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Seed initial staff if empty
const staffCount = db.prepare("SELECT COUNT(*) as count FROM staff").get() as { count: number };
if (staffCount.count === 0) {
  db.prepare("INSERT INTO staff (email, name, role) VALUES (?, ?, ?)").run(
    "davie.sialongo@csucc.edu.ph",
    "Davie Sialongo",
    "Admin"
  );
}

// Seed initial events if empty
const eventCount = db.prepare("SELECT COUNT(*) as count FROM events").get() as { count: number };
if (eventCount.count === 0) {
  const initialEvents = [
    ["General Assembly 2026", "2026-04-15"],
    ["HERO Sports Fest", "2026-05-20"],
    ["Leadership Seminar", "2026-06-10"]
  ];
  const stmt = db.prepare("INSERT INTO events (name, date, status) VALUES (?, ?, 'Active')");
  initialEvents.forEach(e => stmt.run(e[0], e[1]));
}

// Remove initial seed students if they exist
try {
  db.prepare("DELETE FROM students WHERE name IN (?, ?, ?, ?, ?, ?)").run(
    "Juan Dela Cruz", "Maria Clara", "Jose Rizal", "Andres Bonifacio", "Melchora Aquino", "Melchor Aquino"
  );
} catch (e) {
  console.error("Error removing seed students:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.get("/api/staff", (req, res) => {
    const staff = db.prepare("SELECT * FROM staff").all();
    res.json(staff);
  });

  app.post("/api/auth", (req, res) => {
    const { email } = req.body;
    const staff = db.prepare("SELECT * FROM staff WHERE email = ?").get(email);
    if (staff) {
      res.json({ success: true, user: staff });
    } else {
      res.status(401).json({ success: false, message: "Unauthorized" });
    }
  });

  // Student Endpoints
  app.get("/api/students", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || "";
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM students";
    let countQuery = "SELECT COUNT(*) as total FROM students";
    const params: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      query += " WHERE name LIKE ? OR student_id LIKE ? OR course LIKE ?";
      countQuery += " WHERE name LIKE ? OR student_id LIKE ? OR course LIKE ?";
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY name ASC LIMIT ? OFFSET ?";
    const students = db.prepare(query).all(...params, limit, offset);
    const totalCount = db.prepare(countQuery).get(...params) as { total: number };

    res.json({
      students,
      total: totalCount.total,
      page,
      limit,
      totalPages: Math.ceil(totalCount.total / limit)
    });
  });

  app.get("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const student = db.prepare("SELECT * FROM students WHERE student_id = ?").get(id);
    if (student) {
      res.json(student);
    } else {
      res.status(404).json({ success: false, message: "Student not found" });
    }
  });

  app.post("/api/students", (req, res) => {
    const { student_id, name, course, year_level, email } = req.body;
    try {
      db.prepare(`
        INSERT INTO students (student_id, name, course, year_level, email)
        VALUES (?, ?, ?, ?, ?)
      `).run(student_id, name, course, year_level, email || "");
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post("/api/students/bulk", (req, res) => {
    const { students } = req.body; // Array of student objects
    const insert = db.prepare("INSERT OR REPLACE INTO students (student_id, name, course, year_level, email) VALUES (?, ?, ?, ?, ?)");
    const insertMany = db.transaction((data) => {
      for (const s of data) insert.run(s.student_id, s.name, s.course, s.year_level, s.email || "");
    });

    try {
      insertMany(students);
      res.json({ success: true, count: students.length });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const { name, course, year_level, email } = req.body;
    try {
      db.prepare(`
        UPDATE students SET name = ?, course = ?, year_level = ?, email = ?
        WHERE student_id = ?
      `).run(name, course, year_level, email || "", id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/students/${id} requested`);
    try {
      const result = db.prepare("DELETE FROM students WHERE student_id = ?").run(id);
      console.log(`DELETE /api/students/${id} result:`, result);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`DELETE /api/students/${id} error:`, err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Event Endpoints
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY date ASC").all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { name, date } = req.body;
    try {
      db.prepare("INSERT INTO events (name, date, status) VALUES (?, ?, 'Active')").run(name, date);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.put("/api/events/:id", (req, res) => {
    const { id } = req.params;
    const { name, date, status } = req.body;
    try {
      db.prepare("UPDATE events SET name = ?, date = ?, status = ? WHERE id = ?").run(name, date, status, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/events/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/events/${id} requested`);
    try {
      const result = db.prepare("DELETE FROM events WHERE id = ?").run(id);
      console.log(`DELETE /api/events/${id} result:`, result);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`DELETE /api/events/${id} error:`, err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Attendance Endpoints
  app.get("/api/attendance", (req, res) => {
    const logs = db.prepare("SELECT * FROM attendance ORDER BY timestamp DESC").all();
    res.json(logs);
  });

  app.post("/api/attendance/scan", (req, res) => {
    let { studentId, name, course, eventName } = req.body;
    
    // Auto-lookup student if name is generic or missing
    if (!name || name === "Unknown Student" || name === "Manual Scan") {
      const student = db.prepare("SELECT * FROM students WHERE student_id = ?").get(studentId) as any;
      if (student) {
        name = student.name;
        course = student.course;
      }
    }

    // Check for active session (Time-In but no Time-Out)
    const activeSession = db.prepare(`
      SELECT * FROM attendance 
      WHERE student_id = ? AND event_name = ? AND time_out IS NULL
    `).get(studentId, eventName) as any;

    if (activeSession) {
      // Time-Out
      db.prepare(`
        UPDATE attendance 
        SET time_out = CURRENT_TIMESTAMP, status = 'Completed' 
        WHERE id = ?
      `).run(activeSession.id);
      res.json({ success: true, action: "Time-Out", data: activeSession });
    } else {
      // Time-In
      const result = db.prepare(`
        INSERT INTO attendance (student_id, name, course, event_name, time_in, status)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'In')
      `).run(studentId, name, course, eventName);
      res.json({ success: true, action: "Time-In", id: result.lastInsertRowid });
    }
  });

  app.delete("/api/attendance/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/attendance/${id} requested`);
    try {
      const result = db.prepare("DELETE FROM attendance WHERE id = ?").run(id);
      console.log(`DELETE /api/attendance/${id} result:`, result);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`DELETE /api/attendance/${id} error:`, err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Finance Endpoints
  app.get("/api/finance", (req, res) => {
    const query = `
      SELECT f.*, s.course, s.year_level, s.email
      FROM finance f
      LEFT JOIN students s ON f.student_id = s.student_id
      ORDER BY f.date DESC
    `;
    const records = db.prepare(query).all();
    res.json(records);
  });

  app.get("/api/finance/status", (req, res) => {
    const { purpose } = req.query;
    const query = `
      SELECT s.student_id, s.name, s.course, s.year_level, 
             f.receipt_id, f.amount, f.date
      FROM students s
      LEFT JOIN finance f ON s.student_id = f.student_id AND f.purpose = ?
      ORDER BY s.name ASC
    `;
    const status = db.prepare(query).all(purpose || "Membership Fee");
    res.json(status);
  });

  app.post("/api/finance/record", async (req, res) => {
    let { studentId, name, amount, purpose, collector, notes } = req.body;
    
    // Auto-lookup student if name is missing
    if (!name) {
      const student = db.prepare("SELECT * FROM students WHERE student_id = ?").get(studentId) as any;
      if (student) {
        name = student.name;
      }
    }

    const receiptId = `HERO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    db.prepare(`
      INSERT INTO finance (receipt_id, student_id, name, amount, purpose, collector, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(receiptId, studentId, name, amount, purpose, collector, notes || "");

    // Mock Email Logic (since we don't have real SMTP credentials)
    console.log(`Sending receipt ${receiptId} to student ${studentId}...`);
    
    res.json({ success: true, receiptId });
  });

  app.delete("/api/finance/:receiptId", (req, res) => {
    const { receiptId } = req.params;
    console.log(`DELETE /api/finance/${receiptId} requested`);
    try {
      const result = db.prepare("DELETE FROM finance WHERE receipt_id = ?").run(receiptId);
      console.log(`DELETE /api/finance/${receiptId} result:`, result);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`DELETE /api/finance/${receiptId} error:`, err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post("/api/finance/email", async (req, res) => {
    const { receiptId, email: emailOverride } = req.body;
    try {
      const record = db.prepare(`
        SELECT f.*, s.email, s.name as student_name
        FROM finance f
        JOIN students s ON f.student_id = s.student_id
        WHERE f.receipt_id = ?
      `).get(receiptId) as any;

      if (!record) {
        return res.status(404).json({ success: false, message: "Receipt not found" });
      }

      const targetEmail = emailOverride || record.email;

      if (!targetEmail) {
        return res.status(400).json({ success: false, message: "Student email not found and no override provided" });
      }

      // Configure nodemailer
      // For real usage, user needs to set these in .env
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"HERO Organization" <${process.env.EMAIL_USER}>`,
        to: targetEmail,
        subject: `Payment Receipt - ${record.purpose}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #001F3F; text-align: center;">HERO Organization</h2>
            <h3 style="text-align: center; color: #666;">Official Payment Receipt</h3>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <div style="padding: 20px 0;">
              <p><strong>Receipt ID:</strong> ${record.receipt_id}</p>
              <p><strong>Student Name:</strong> ${record.student_name}</p>
              <p><strong>Student ID:</strong> ${record.student_id}</p>
              <p><strong>Purpose:</strong> ${record.purpose}</p>
              <p><strong>Amount Paid:</strong> ₱${record.amount.toLocaleString()}</p>
              <p><strong>Date:</strong> ${new Date(record.date).toLocaleDateString()}</p>
              <p><strong>Collector:</strong> ${record.collector}</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated receipt. Thank you for your payment!
            </p>
          </div>
        `
      };

      // If credentials are not set, inform the user clearly
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("SIMULATED EMAIL SENT TO:", targetEmail);
        console.log("SUBJECT:", mailOptions.subject);
        return res.status(400).json({ 
          success: false, 
          message: "Email credentials not configured. Please add EMAIL_USER and EMAIL_PASS to the 'Secrets' section in Settings." 
        });
      }

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Email error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
