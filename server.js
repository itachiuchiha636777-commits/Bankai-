const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { MongoClient, ObjectId } = require("mongodb");

//const nodemailer = require("nodemailer");

// ================= CONFIGURATION (APNI DETAILS YAHAN DALEIN) =================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
// =============================================================================

let db;
const otpStore = new Map(); // Temporary OTP store (Email -> { otp, expires })

// MongoDB Connection
MongoClient.connect(MONGO_URI)
  .then((client) => {
    db = client.db("signatureAppDB");
    console.log("✅ MongoDB Connected Successfully!");
  })
  .catch((err) => console.error("❌ MongoDB Error:", err));
/*
// Gmail Transporter (100% Free OTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  //auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  //});
  //host: "://gmail.com",
  //port: 465,
  //secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS ? GMAIL_APP_PASS.replace(/\s+/g, "") : "",
  },
});

transporter.verify((err) => {
  if (err) console.error("❌ Gmail Key Error:", err.message);
  else console.log("✅ Gmail Keys Connected & Ready!");
});*/
// Helper: Read JSON Body in Pure Node.js
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Helper: Send JSON Response
function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

// Pure Node.js HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // ---------------- STATIC FILES SERVE (HTML, CSS, JS) ----------------
  if (method === "GET" && !pathname.startsWith("/api/")) {
    let filePath = "." + (pathname === "/" ? "/index.html" : pathname);
    const ext = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        return res.end("File Not Found");
      }
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      res.end(content);
    });
    return;
  }
  /*
  // ---------------- REST API 1: POST (Auth, OTP, Save Signature) ----------------
  if (method === "POST" && pathname === "/api/send-otp") {
    try {
      const { email } = await getBody(req);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 min valid

      await transporter.sendMail({
        from: `"SignApp Security" <${GMAIL_USER}>`,
        to: email,
        subject: "Your Verification OTP - SignApp",
        text: `Bhai, aapka verification OTP hai: ${otp} (Ye 5 minute tak valid hai).`,
      });
      return sendJSON(res, 200, {
        success: true,
        message: "OTP Gmail par bhej diya gaya hai!",
      });
    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        message: "OTP bhejne mein error: " + err.message,
      });
    }
  }*/
  if (method === "POST" && pathname === "/api/send-otp") {
    try {
      const { email } = await getBody(req);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });
      const scriptRes = await fetch(process.env.GMAIL_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          to: email,
          subject: "Your Verification OTP - Anime SignApp",
          text: `Bhai, aapka verification OTP hai: ${otp} (Ye 5 minute tak valid hai).`,
        }),
      });
      const scriptText = await scriptRes.text();
      console.log("📩 Google Script Reply:", scriptText);

      /*await fetch(process.env.GMAIL_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Your Verification OTP - Anime SignApp",
          text: `Bhai, aapka verification OTP hai: ${otp} (Ye 5 minute tak valid hai).`,
        }),
      });*/

      return sendJSON(res, 200, {
        success: true,
        message: "OTP aapki Gmail par bhej diya gaya hai!",
      });
    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        message: "OTP Error: " + err.message,
      });
    }
  }

  if (method === "POST" && pathname === "/api/signup") {
    const { name, email, password, otp } = await getBody(req);
    const record = otpStore.get(email);
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return sendJSON(res, 400, {
        success: false,
        message: "Galat ya Expired OTP!",
      });
    }
    const existing = await db.collection("users").findOne({ email });
    if (existing)
      return sendJSON(res, 400, {
        success: false,
        message: "Ye email pehle se registered hai!",
      });

    await db.collection("users").insertOne({
      name,
      email,
      password,
      authType: "email",
      createdAt: new Date(),
    });
    otpStore.delete(email);
    return sendJSON(res, 201, { success: true, user: { name, email } });
  }

  if (method === "POST" && pathname === "/api/login") {
    const { email, password, name, isGoogle } = await getBody(req);
    if (isGoogle) {
      let user = await db.collection("users").findOne({ email });
      if (!user) {
        await db.collection("users").insertOne({
          name,
          email,
          authType: "google",
          createdAt: new Date(),
        });
      }
      return sendJSON(res, 200, { success: true, user: { name, email } });
    }
    const user = await db.collection("users").findOne({ email, password });
    if (!user)
      return sendJSON(res, 401, {
        success: false,
        message: "Email ya Password galat hai!",
      });
    return sendJSON(res, 200, {
      success: true,
      user: { name: user.name, email: user.email },
    });
  }

  if (method === "POST" && pathname === "/api/signatures") {
    const { email, title, imageData } = await getBody(req);
    const result = await db.collection("signatures").insertOne({
      email,
      title: title || `Signed_${Date.now()}`,
      imageData,
      createdAt: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),

      // createdAt: new Date().toLocaleString("en-IN"),
    });
    return sendJSON(res, 201, { success: true, id: result.insertedId });
  }

  // ---------------- REST API 2: GET (Fetch Saved Signatures) ----------------
  if (method === "GET" && pathname === "/api/signatures") {
    const email = parsedUrl.query.email;
    const list = await db
      .collection("signatures")
      .find({ email })
      .sort({ _id: -1 })
      .toArray();
    return sendJSON(res, 200, { success: true, signatures: list });
  }

  // ---------------- REST API 3: PUT (Password Reset & Rename Image) ----------------
  if (method === "PUT" && pathname === "/api/reset-password") {
    const { email, otp, newPassword } = await getBody(req);
    const record = otpStore.get(email);
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return sendJSON(res, 400, {
        success: false,
        message: "Galat ya Expired OTP!",
      });
    }
    const updated = await db
      .collection("users")
      .updateOne({ email }, { $set: { password: newPassword } });
    if (updated.matchedCount === 0)
      return sendJSON(res, 404, { success: false, message: "User nahi mila!" });

    otpStore.delete(email);
    return sendJSON(res, 200, {
      success: true,
      message: "Password successfully reset ho gaya!",
    });
  }

  if (method === "PUT" && pathname === "/api/signatures") {
    const { id, title } = await getBody(req);
    await db
      .collection("signatures")
      .updateOne({ _id: new ObjectId(id) }, { $set: { title } });
    return sendJSON(res, 200, {
      success: true,
      message: "Naam update ho gaya!",
    });
  }

  // ---------------- REST API 4: DELETE (Delete from MongoDB) ----------------
  if (method === "DELETE" && pathname === "/api/signatures") {
    const id = parsedUrl.query.id;
    await db.collection("signatures").deleteOne({ _id: new ObjectId(id) });
    return sendJSON(res, 200, {
      success: true,
      message: "MongoDB se permanently delete ho gaya!",
    });
  }

  sendJSON(res, 404, { message: "API Route Not Found" });
});

server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
