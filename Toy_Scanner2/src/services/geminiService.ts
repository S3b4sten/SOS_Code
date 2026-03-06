import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ToyAnalysisResult {
  name: string;
  category: string;
  description: string;
  confidence: string;
  box2d?: [number, number, number, number];
}

export async function analyzeToys(base64Image: string, mimeType: string): Promise<ToyAnalysisResult[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Identify all the toys in this image. Return a list where EACH individual toy is a separate item in the array. Do not group them together into one item. For each individual toy, provide its specific name, a suitable category (e.g., Action Figure, Vehicle, Puzzle, Educational, Plush, Building Blocks), a brief description, your confidence level in the identification, and a bounding box `box2d` representing its location in the image as [ymin, xmin, ymax, xmax] with values normalized between 0.0 and 1.0.",
        },
      ],
    },
    config: {
      systemInstruction: "You are an expert toy appraiser. You must return a JSON array where each element represents exactly one toy. Never group multiple toys into a single object.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "The specific name or type of the toy." },
            category: { type: Type.STRING, description: "The general category the toy belongs to." },
            description: { type: Type.STRING, description: "A brief description of the toy's appearance or function." },
            confidence: { type: Type.STRING, description: "Confidence level of the identification (High, Medium, Low)." },
            box2d: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Bounding box [ymin, xmin, ymax, xmax] normalized between 0.0 and 1.0"
            },
          },
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    return [];
  }
}
