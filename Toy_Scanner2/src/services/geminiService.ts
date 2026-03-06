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
          text: "Identifie tous les jouets dans cette image. Retourne une liste où CHAQUE jouet individuel est un élément séparé du tableau. Ne les regroupe pas. Pour chaque jouet, fournis son nom spécifique, une catégorie appropriée (ex : Figurine d'action, Véhicule, Puzzle, Éducatif, Peluche, Blocs de construction), une brève description, ton niveau de confiance dans l'identification (Élevée, Moyenne, Faible), et une boîte englobante `box2d` représentant sa position dans l'image sous la forme [ymin, xmin, ymax, xmax] avec des valeurs normalisées entre 0.0 et 1.0. Réponds UNIQUEMENT en français.",
        },
      ],
    },
    config: {
      systemInstruction: "Tu es un expert en jouets. Tu dois retourner un tableau JSON où chaque élément représente exactement un jouet. Ne regroupes jamais plusieurs jouets dans un seul objet. Toutes les valeurs textuelles (name, category, description) doivent être en français.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "The specific name or type of the toy." },
            category: { type: Type.STRING, description: "The general category the toy belongs to." },
            description: { type: Type.STRING, description: "A brief description of the toy's appearance or function." },
            confidence: { type: Type.STRING, description: "Niveau de confiance de l'identification (\u00c9lev\u00e9e, Moyenne, Faible)." },
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
