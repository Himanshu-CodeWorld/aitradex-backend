// src/services/groq.service.js

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  "openai/gpt-oss-120b";

const generateGroqResponse = async ({
  messages,
  temperature = 0.35,
  maxTokens = 1200,
}) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured"
    );
  }

  const response = await fetch(
    GROQ_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${process.env.GROQ_API_KEY}`,
      },

      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "❌ Groq API Error:",
      data
    );

    const errorMessage =
      data?.error?.message ||
      `Groq API request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  const content =
    data?.choices?.[0]?.message?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Groq returned an empty response"
    );
  }

  return content.trim();
};

module.exports = {
  generateGroqResponse,
  GROQ_MODEL,
};