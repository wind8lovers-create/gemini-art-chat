const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
  
  // Use a real image from the user's sessions
  const sessionsDir = 'data/sessions';
  const sessions = fs.readdirSync(sessionsDir);
  let realImageBase64 = null;
  for (const s of sessions) {
    const imagesDir = `${sessionsDir}/${s}/images`;
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      if (files.length > 0) {
        realImageBase64 = fs.readFileSync(`${imagesDir}/${files[0]}`).toString('base64');
        break;
      }
    }
  }

  if (!realImageBase64) {
    console.log("No real image found");
    return;
  }

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: realImageBase64 } },
          { text: "この画像をベースにして、新しく水彩画風の画像を生成してください。元の画像と全く同じものは返さないでください。" }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  });

  const response = await result.response;
  const parts = response.candidates[0].content.parts;
  
  console.log("Text parts:", parts.filter(p => p.text).map(p => p.text));
  const images = parts.filter(p => p.inlineData);
  console.log("Image parts count:", images.length);
  if (images.length > 0) {
    const isIdentical = images[0].inlineData.data === realImageBase64;
    console.log("Is image identical to input?:", isIdentical);
    fs.writeFileSync('output_test.png', Buffer.from(images[0].inlineData.data, 'base64'));
  }
}

run().catch(console.error);
