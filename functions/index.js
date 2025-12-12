const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();


const openaiApiKey = defineSecret("OPENAI_API_KEY");

exports.generateNoteSummary = onRequest(
  { cors: true, secrets: [openaiApiKey] },
  async (req, res) => {

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    });

    if (req.method !== "POST") {
      res.status(405).send("Méthode non autorisée");
      return;
    }

    const { noteId, title, content } = req.body || {};

    if (!noteId) {
      res.status(400).json({ error: "noteId manquant." });
      return;
    }

    const textToSummarize = `${title ? title + "\n\n" : ""}${content || ""}`.trim();

    if (!textToSummarize) {
      res.status(400).json({
        error: "Aucun texte à résumer (titre et contenu vides).",
      });
      return;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant qui résume des notes en français en 2 ou 3 phrases, de manière claire et concise.",
          },
          {
            role: "user",
            content: `Voici le contenu de la note à résumer :\n\n${textToSummarize}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const summary = response.choices[0].message.content.trim();

      if (!summary) {
        throw new Error("Résumé vide retourné par OpenAI.");
      }

      await db.collection("notes").doc(noteId).update({
        aiSummary: summary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ summary });
    } catch (error) {
      logger.error("Erreur lors de l'appel OpenAI ou de la mise à jour Firestore:", error);
      res.status(500).json({
        error: "Erreur lors de la génération du résumé AI.",
      });
    }
  }
);
