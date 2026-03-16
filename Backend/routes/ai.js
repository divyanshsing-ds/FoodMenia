const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authMiddleware } = require("../middleware/auth");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL = "gemini-2.5-flash"; // confirmed working with this API key

// =====================================================
//  AI CHAT ASSISTANT
//  POST /api/ai/chat
// =====================================================
router.post("/chat", authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: "No message provided" });

        const model = genAI.getGenerativeModel({ model: MODEL }, { apiVersion: 'v1' });

        const prompt = `You are FoodMenia AI, a premium food delivery app assistant.
The user says: "${message}"
Keep your response concise (max 3-4 sentences), helpful, and professional.
Focus on food, suggestions, and customer support.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.json({ success: true, reply: responseText });
    } catch (err) {
        console.error("AI Chat Error:", err.message);
        res.status(500).json({ success: false, message: "AI Assistant is unavailable right now." });
    }
});

// =====================================================
//  NUTRITION ANALYSIS
//  POST /api/ai/nutrition
// =====================================================
router.post("/nutrition", authMiddleware, async (req, res) => {
    try {
        const { foodName, category, price } = req.body;
        if (!foodName) return res.status(400).json({ success: false, message: "No food name provided" });

        const model = genAI.getGenerativeModel({ model: MODEL }, { apiVersion: 'v1' });

        const prompt = `Analyze this specific dish: "${foodName}" (${category || "food"}). 
Provide a realistic nutritional estimate based on common recipes.
Reply ONLY in valid JSON with this exact structure, no markdown, no explanation:
{
  "calories": "estimate",
  "protein": "estimate",
  "carbs": "estimate",
  "fat": "estimate",
  "fiber": "estimate",
  "healthScore": 1-10,
  "tip": "one-line health tip for this specific dish",
  "allergens": ["list"]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Strip any markdown code fences
        const cleaned = text.replace(/```json|```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ success: false, message: "Could not parse nutrition data." });
        }

        const nutrition = JSON.parse(jsonMatch[0]);
        res.json({ success: true, data: nutrition });
    } catch (err) {
        console.error("AI Nutrition Error:", err.message);
        res.status(500).json({ success: false, message: "Could not analyze nutrition. Try again." });
    }
});

// =====================================================
//  FOOD IMAGE ANALYSIS
//  POST /api/ai/analyze-food
// =====================================================
router.post("/analyze-food", authMiddleware, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ success: false, message: "No image provided" });

        const model = genAI.getGenerativeModel({ model: MODEL }, { apiVersion: 'v1' });

        const result = await model.generateContent([
            "Identify the food item in this image and give a brief health review (Calories, Macronutrients estimate).",
            { inlineData: { data: image, mimeType: "image/jpeg" } }
        ]);

        res.json({ success: true, analysis: result.response.text() });
    } catch (err) {
        console.error("AI Analysis Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to analyze food." });
    }
});

module.exports = router;
