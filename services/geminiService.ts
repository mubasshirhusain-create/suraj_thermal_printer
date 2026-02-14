
import { GoogleGenAI } from "@google/genai";

// Fix: Direct initialization using process.env.API_KEY as per guidelines. 
// Assume API_KEY is pre-configured and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractContentFromUrl = async (url: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract only the primary text content from the following URL and format it for a 58mm thermal printer (short lines, concise): ${url}`,
      config: {
        systemInstruction: "You are a professional thermal printer assistant. Extract the most important information from URLs (titles, prices, main body) and format it as clean, readable text. Ignore ads and navigation menus.",
      }
    });
    // Fix: Access .text property directly, not as a method.
    return response.text || "Failed to extract content.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error fetching content. Please paste text manually.";
  }
};

export const formatThermalText = async (text: string): Promise<string> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Reformat this text to look like a clean thermal receipt (58mm width). Use simple dashes for separators and ensure important details are clear: ${text}`,
      });
      // Fix: Access .text property directly.
      return response.text || text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return text;
    }
};
