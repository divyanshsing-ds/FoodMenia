const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");
const path = require("path");
const fs = require("fs");

// ── Gemini Vision helper ─────────────────────────────────────────
async function analyzeStudentIdWithGemini(imagePath) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in backend .env");

    // Read the uploaded image and base64-encode it
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Detect mime type from extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
    const mimeType = mimeMap[ext] || "image/jpeg";

    const prompt = `You are a student ID card verification AI.
Carefully examine this image and determine if it is a valid student ID card from any recognized school, college, or university.

Return ONLY a raw JSON object (no markdown, no explanation) in this exact format:
{
  "isStudentId": true or false,
  "institutionName": "exact institution name or empty string",
  "expiryDate": "YYYY-MM-DD or empty string if not visible/not applicable",
  "studentName": "student name or empty string",
  "confidence": "high" or "medium" or "low",
  "rejectionReason": "reason if isStudentId is false, else empty string"
}

Rules:
- isStudentId = true only if this clearly looks like a school/college/university ID card
- If the image is blurry, unreadable, not an ID card, or is something else entirely, set isStudentId = false
- Institution name should be the full name of the school/college/university as shown on the card
- Expiry date: look for "Valid till", "Expires", "Valid upto", "Expiry" etc. Format as YYYY-MM-DD. If only year is shown (e.g. 2026), use YYYY-12-31. If not present, return today's year + 4 years.
- Any real educational institution (school, college, university, polytechnic, ITI, etc.) worldwide is acceptable`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }]
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Strip possible markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
}


/**
 * POST /api/student/verify
 * Upload student ID card image. Gemini Vision AI analyzes the image
 * to determine if it's a valid student ID from a real institution.
 */
router.post(
    "/verify",
    authMiddleware,
    upload.single("studentId"),
    async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ success: false, message: "User not found" });

            if (!req.file) {
                return res.status(400).json({ success: false, message: "Please upload your student ID card image." });
            }

            const uploadedPath = req.file.path;

            // The user still provides institution name and expiry as hints,
            // but AI is the final judge.
            const { institutionName: hintInstitution, idExpiryDate: hintExpiry } = req.body;

            let aiResult;
            try {
                aiResult = await analyzeStudentIdWithGemini(uploadedPath);
            } catch (aiErr) {
                console.error("Gemini Vision Error:", aiErr.message);
                // If AI fails, fall back to hint-based logic (graceful degradation)
                aiResult = null;
            }

            // ── AI-based verification ──────────────────────────────────────
            if (aiResult) {
                if (!aiResult.isStudentId) {
                    fs.unlinkSync(uploadedPath);
                    return res.status(400).json({
                        success: false,
                        message: `❌ AI could not verify this as a valid student ID. ${aiResult.rejectionReason || "Please upload a clear photo of your student ID card."}`,
                        reason: "not_student_id"
                    });
                }

                if (aiResult.confidence === "low") {
                    fs.unlinkSync(uploadedPath);
                    return res.status(400).json({
                        success: false,
                        message: "❌ The ID card image is unclear or hard to read. Please upload a better quality photo.",
                        reason: "low_confidence"
                    });
                }

                // Determine expiry: use AI-extracted date, fall back to user-provided hint
                let expiry = null;
                if (aiResult.expiryDate) {
                    expiry = new Date(aiResult.expiryDate);
                } else if (hintExpiry) {
                    expiry = new Date(hintExpiry);
                } else {
                    // Default: 4 years from now if no date found
                    expiry = new Date();
                    expiry.setFullYear(expiry.getFullYear() + 4);
                }

                if (isNaN(expiry.getTime()) || expiry < new Date()) {
                    fs.unlinkSync(uploadedPath);
                    return res.status(400).json({
                        success: false,
                        message: `❌ Your student ID has expired or the expiry date is invalid. Please renew and try again.`,
                        reason: "expired_id"
                    });
                }

                // Use AI-extracted institution name, fall back to user hint
                const finalInstitution = aiResult.institutionName || hintInstitution || "Unknown Institution";

                // Delete old student ID image if present
                if (user.studentIdImage) {
                    const oldPath = path.join(__dirname, "..", user.studentIdImage.replace(/^\//, ""));
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }

                user.studentStatus = "verified";
                user.studentIdImage = `/uploads/${req.file.filename}`;
                user.institutionName = finalInstitution;
                user.idExpiryDate = expiry;
                user.studentVerifiedAt = new Date();
                await user.save();

                return res.json({
                    success: true,
                    message: `✅ Student ID verified by AI! You get 20% off. Institution: ${finalInstitution}. Valid till ${expiry.toLocaleDateString("en-IN")}.`,
                    studentStatus: "verified",
                    institutionName: finalInstitution,
                    idExpiryDate: expiry,
                });

            } else {
                // ─── Graceful fallback (Gemini API unavailable) ─────────────
                // Fall back to manual field validation
                if (!hintInstitution) {
                    fs.unlinkSync(uploadedPath);
                    return res.status(400).json({ success: false, message: "AI verification unavailable. Please enter your institution name." });
                }

                let expiry = hintExpiry ? new Date(hintExpiry) : null;
                if (!expiry || isNaN(expiry.getTime()) || expiry < new Date()) {
                    fs.unlinkSync(uploadedPath);
                    return res.status(400).json({ success: false, message: "❌ Your student ID has expired or date is invalid." });
                }

                if (user.studentIdImage) {
                    const oldPath = path.join(__dirname, "..", user.studentIdImage.replace(/^\//, ""));
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }

                user.studentStatus = "verified";
                user.studentIdImage = `/uploads/${req.file.filename}`;
                user.institutionName = hintInstitution;
                user.idExpiryDate = expiry;
                user.studentVerifiedAt = new Date();
                await user.save();

                return res.json({
                    success: true,
                    message: `✅ Student ID submitted! You get 20% off. Valid till ${expiry.toLocaleDateString("en-IN")}.`,
                    studentStatus: "verified",
                    institutionName: hintInstitution,
                    idExpiryDate: expiry,
                });
            }
        } catch (err) {
            console.error("Student verify error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);


/**
 * GET /api/student/status
 * Returns current student verification status for the logged-in user.
 */
router.get("/status", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(
            "studentStatus institutionName idExpiryDate studentVerifiedAt"
        );
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Auto-expire: if verified but ID has expired, downgrade
        if (user.studentStatus === "verified" && user.idExpiryDate && user.idExpiryDate < new Date()) {
            user.studentStatus = "none";
            await user.save();
        }

        return res.json({
            success: true,
            studentStatus: user.studentStatus,
            institutionName: user.institutionName,
            idExpiryDate: user.idExpiryDate,
            studentVerifiedAt: user.studentVerifiedAt,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


/**
 * DELETE /api/student/revoke
 * Lets a user remove their student verification.
 */
router.delete("/revoke", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.studentIdImage) {
            const oldPath = path.join(__dirname, "..", user.studentIdImage.replace(/^\//, ""));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        user.studentStatus = "none";
        user.studentIdImage = "";
        user.institutionName = "";
        user.idExpiryDate = null;
        user.studentVerifiedAt = null;
        await user.save();

        return res.json({ success: true, message: "Student verification removed." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
