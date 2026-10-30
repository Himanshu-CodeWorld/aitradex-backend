// src/services/groq.service.js
"use strict";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

async function generateGroqResponse({
  messages,
  temperature = 0.35,
  maxTokens = 1200,
}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Groq messages must be a non-empty array");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Groq request timed out after 55 seconds");
    }
    throw new Error(`Unable to connect to Groq: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error(`Groq returned a non-JSON response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Groq API request failed with status ${response.status}`;

    const error = new Error(message);
    error.statusCode = response.status;
    console.error("[Groq API] Request failed", {
      status: response.status,
      message,
    });
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Groq returned an empty response");
  }

  return content.trim();
}

module.exports = {
  generateGroqResponse,
  GROQ_MODEL,
};
