import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const sessionBuffers = {};

export const addMessageToBuffer = (roomId, sender, text) => {
  if (!sessionBuffers[roomId]) {
    sessionBuffers[roomId] = [];
  }

  sessionBuffers[roomId].push({
    sender,
    text,
    timestamp: new Date(),
  });
};

export const getSessionMessages = (roomId) => {
  return sessionBuffers[roomId] || [];
};

export const clearSessionBuffer = (roomId) => {
  delete sessionBuffers[roomId];
};

export const generateSummary = async (roomId) => {
  try {

    const messages = getSessionMessages(roomId);

    const formattedChat = messages
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    const prompt = `
Summarize this counseling conversation briefly.

Focus on:
- emotional state
- stress concerns
- academic issues
- social concerns

Conversation:
${formattedChat}
`;

    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are a counseling assistant that creates concise mental wellness summaries.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return response.choices[0].message.content;

  } catch (error) {

    console.error("Groq Summary Error:", error);

    return "Failed to generate summary.";
  }
};