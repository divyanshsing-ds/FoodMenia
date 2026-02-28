const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Generic Gemini call
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGemini(prompt) {
    const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

/**
 * Generate a short, engaging reel description from a title.
 * @param {string} title - Reel title e.g. "Most Amazing Butter Chicken"
 * @returns {Promise<string>} Short description (2-3 sentences)
 */
export async function generateReelDescription(title) {
    const prompt = `You are a food content creator. Write a short, mouth-watering, engaging Instagram-style caption/description (2-3 sentences, max 120 characters) for a food reel titled: "${title}". Use food emojis. Only return the caption text, nothing else.`;
    return callGemini(prompt);
}

/**
 * Get nutrition breakdown for a list of ordered food items.
 * @param {Array<{name: string, quantity: number}>} items
 * @returns {Promise<string>} Formatted nutrition info
 */
export async function getNutritionInfo(items) {
    const itemList = items.map(i => `${i.quantity}x ${i.name}`).join(", ");
    const prompt = `You are a professional nutritionist. For this food order: ${itemList} — provide an estimated nutrition breakdown in this exact JSON format (no markdown, no explanation, just raw JSON):
{"totalCalories": number, "protein": "Xg", "carbs": "Xg", "fat": "Xg", "fiber": "Xg", "items": [{"name": "...", "calories": number, "protein": "Xg", "carbs": "Xg", "fat": "Xg"}]}
Use realistic Indian restaurant food estimates.`;
    const raw = await callGemini(prompt);
    // Strip possible markdown code fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
}
