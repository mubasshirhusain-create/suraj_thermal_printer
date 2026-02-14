
import { GoogleGenAI } from "@google/genai";

// Safe API initialization
const getAI = () => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.warn("Gemini API not available:", e);
    return null;
  }
};

export const extractContentFromUrl = async (url: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return "AI services temporarily unavailable. Please paste content manually.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract the main text content from this URL for a 58mm thermal printer receipt: ${url}. Keep it short and readable.`,
      config: {
        systemInstruction: "You are a professional text extraction tool. Return only the most relevant text, formatted cleanly for a narrow receipt.",
      }
    });
    return response.text || "No content extracted.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error fetching from URL. Try copying and pasting the text instead.";
  }
};

export const formatThermalText = async (text: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return text;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Reformat this text into a clean 58mm thermal printer receipt: ${text}`,
    });
    return response.text || text;
  } catch (error) {
    return text;
  }
};
