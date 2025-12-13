// backend/index.js
import express from "express";
import multer from "multer";
import FormData from "form-data";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import wav from "wav";
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Multer: handles file upload
const upload = multer({ dest: "uploads/" });

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded" });

    const filePath = path.resolve(req.file.path);
    const googleKey = process.env.GOOGLE_API_KEY;

    const audioBytes = fs.readFileSync(filePath).toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Transcribe the following audio accurately:"
                },
                {
                  inlineData: {
                    mimeType: "audio/webm",  // match your recorder MIME type
                    data: audioBytes
                  }
                }
              ]
            }
          ]
        })
      }
    );

    fs.unlinkSync(filePath); // delete uploaded file

    const raw = await response.text(); // read raw text

    console.log("RAW RESPONSE:", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Invalid JSON from Gemini",
        raw
      });
    }

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    const transcript =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No transcript found";

    return res.json({ text: transcript });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({
      error: "STT Server Error",
      details: err.message
    });
  }
});


// ================= GOOGLE TEXT-TO-SPEECH (Text → Audio) ===================
app.post("/synthesize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });


    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GOOGLE_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Say normally: ${text}`
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore"
                }
              }
            }
          }
        })
      }
    );

    const raw = await response.text();
    console.log("GEMINI TTS RAW:", raw);

    const data = JSON.parse(raw);

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    // Extract base64 PCM audio
    const audioBase64 =
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      return res.status(500).json({ error: "No audio data returned", data });
    }

    const pcmBuffer = Buffer.from(audioBase64, "base64");

    // Convert PCM → WAV
    const writer = new wav.Writer({
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16
    });

    res.setHeader("Content-Type", "audio/wav");
    writer.pipe(res);
    writer.write(pcmBuffer);
    writer.end();

  } catch (err) {
    console.error("GEMINI TTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// =================== START SERVER =======================
app.listen(port, () => {
  console.log(`Server running: http://localhost:${port}`);
});
