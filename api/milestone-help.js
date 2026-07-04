const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestLog = new Map();

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 4096) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function isRateLimited(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter(timestamp => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(ip, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

function tidySuggestion(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ error: "Too many tip requests. Try again in a minute." });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "Tips are not configured yet." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request." });
  }

  const goal = String(body.goal || "").trim().slice(0, 160);
  const milestone = String(body.milestone || "").trim();

  if (!milestone || milestone.length > 200) {
    return res.status(400).json({ error: "Choose a shorter sub-goal before asking for tips." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Give exactly two short, practical sentences on how the user can make progress toward the stated milestone. Be specific, useful, and action-oriented; avoid private assumptions and do not mention AI."
          },
          {
            role: "user",
            content: `Goal: ${goal || "Not provided"}\nMilestone: ${milestone}`
          }
        ],
        max_tokens: 90,
        temperature: 0.4
      })
    });

    const data = await deepseekResponse.json().catch(() => ({}));

    if (!deepseekResponse.ok) {
      return res.status(502).json({ error: "Tips are not available right now." });
    }

    const suggestion = tidySuggestion(data.choices?.[0]?.message?.content);

    if (!suggestion) {
      return res.status(502).json({ error: "Tips are not available right now." });
    }

    return res.status(200).json({ suggestion });
  } catch (error) {
    const message = error.name === "AbortError"
      ? "Tips took too long. Try again in a minute."
      : "Tips are not available right now.";
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
};
