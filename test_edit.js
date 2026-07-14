const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
  
  // Create a 1x1 dummy image
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: dummyBase64 } },
          { text: "この画像を水彩画風に変更してください" }
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
    const isIdentical = images[0].inlineData.data === dummyBase64;
    console.log("Is image identical to input?:", isIdentical);
  }
}

run().catch(console.error);
