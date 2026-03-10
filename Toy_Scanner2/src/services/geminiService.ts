import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ToyAnalysisResult {
  name: string;
  category: string;
  description: string;
  confidence: string;
  box2d: [number, number, number, number];
  priceMin: number;
  priceMax: number;
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
          text: "Identifie tous les jouets dans cette image. Retourne une liste où CHAQUE jouet individuel est un élément séparé du tableau. Ne les regroupe pas. Pour chaque jouet, fournis : son nom spécifique, une catégorie appropriée (ex : Figurine d'action, Véhicule, Puzzle, Éducatif, Peluche, Blocs de construction), une brève description, ton niveau de confiance dans l'identification (Élevée, Moyenne, Faible), OBLIGATOIREMENT une boîte englobante `box2d` sous la forme [ymin, xmin, ymax, xmax] avec des valeurs normalisées entre 0.0 et 1.0, et une estimation du prix de revente en occasion sur le marché canadien en dollars canadiens sous forme de fourchette (priceMin et priceMax en CAD). Le champ box2d est REQUIS pour chaque jouet sans exception. Réponds UNIQUEMENT en français.",
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
            confidence: { type: Type.STRING, description: "Niveau de confiance de l'identification (Élevée, Moyenne, Faible)." },
            box2d: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "REQUIRED bounding box [ymin, xmin, ymax, xmax] normalized between 0.0 and 1.0. Must always be provided."
            },
            priceMin: { type: Type.NUMBER, description: "Estimated minimum resale price in CAD for this toy in used condition." },
            priceMax: { type: Type.NUMBER, description: "Estimated maximum resale price in CAD for this toy in used condition." },
          },
          required: ["name", "category", "description", "confidence", "box2d", "priceMin", "priceMax"],
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
