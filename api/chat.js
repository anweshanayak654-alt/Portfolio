const fs = require("fs");
const path = require("path");

// Load local environment variables (.env.local or .env) when running locally
function loadLocalEnv() {
  if (process.env.CHATBOT_API_KEY) return;
  const candidateFiles = [
    path.resolve(__dirname, "..", ".env.local"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ];

  for (const envPath of candidateFiles) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const separatorIdx = trimmed.indexOf("=");
            const key = trimmed.slice(0, separatorIdx).trim();
            const val = trimmed.slice(separatorIdx + 1).trim().replace(/^["']|["']$/g, "");
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        if (process.env.CHATBOT_API_KEY) break;
      }
    } catch (e) {
      // Ignore read errors
    }
  }
}

loadLocalEnv();

const SYSTEM_PROMPT =
  "You are a helpful portfolio assistant for Anwesha Nayak, a B.Tech Computer Science student at JECRC University, Jaipur (graduation 2029). Speak briefly about her skills (Python, JavaScript, HTML5, CSS3, Git, GitHub, Vercel, REST APIs, Cursor AI), projects, and career interests. Do not invent employers or awards. If asked for contact, share that visitors can use the Contact section of the site.";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(function (item) {
      return (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      );
    })
    .slice(-12)
    .map(function (item) {
      return {
        role: item.role,
        content: item.content.slice(0, 4000),
      };
    });
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.CHATBOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "CHATBOT_API_KEY is not configured" });
  }

  const messages = sanitizeMessages(readBody(req).messages);
  if (!messages.length) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(messages),
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: (data && data.error && data.error.message) || "Upstream error",
      });
    }

    const reply =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!reply) {
      return res.status(502).json({ error: "Empty model response" });
    }

    return res.status(200).json({ reply: String(reply) });
  } catch (err) {
    return res.status(500).json({ error: "Chat request failed" });
  }
};
