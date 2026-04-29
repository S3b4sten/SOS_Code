import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ToyAnalysisResult {
  name: string;
  category: string;
  description: string;
  confidence: string;
  box2d: [number, number, number, number];
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
          text: "Identifie tous les objets dans cette image. Retourne une liste où CHAQUE objet individuel est un élément séparé du tableau. Ne les regroupe pas. Pour chaque objet, fournis : son nom spécifique (en français sauf si le nom de marque ou de produit est notoire en anglais), une catégorie appropriée parmi : Électronique, Vêtements, Outils, Mobilier, Livres, Sport & Loisirs, Cuisine, Jouets, Décoration, Informatique, Électroménager, Autre — ou toute autre catégorie pertinente, une courte description factuelle de l'objet en une ou deux phrases (nature, couleur, état apparent), ton niveau de confiance dans l'identification (Élevée, Moyenne, Faible), et OBLIGATOIREMENT une boîte englobante `box2d` sous la forme [ymin, xmin, ymax, xmax] avec des valeurs normalisées entre 0.0 et 1.0. Le champ box2d est REQUIS pour chaque objet sans exception. Réponds UNIQUEMENT en français sauf pour les noms propres de produits.",
        },
      ],
    },
    config: {
      systemInstruction: "Tu es un expert en identification d'objets pour entrepôt. Tu dois retourner un tableau JSON où chaque élément représente exactement un objet distinct visible dans l'image. Ne regroupe jamais plusieurs objets en un seul. Toutes les valeurs textuelles (name, category, description) doivent être en français, sauf les noms de marques ou de produits reconnus en anglais.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nom spécifique de l'objet, en français sauf pour les noms de marques." },
            category: { type: Type.STRING, description: "Catégorie générale de l'objet (ex : Électronique, Vêtements, Outils, Mobilier, Jouets…)." },
            description: { type: Type.STRING, description: "Description courte et factuelle de l'objet : nature, couleur, état apparent. Une ou deux phrases maximum." },
            confidence: { type: Type.STRING, description: "Niveau de confiance de l'identification (Élevée, Moyenne, Faible)." },
            box2d: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "REQUIRED bounding box [ymin, xmin, ymax, xmax] normalized between 0.0 and 1.0. Must always be provided."
            },
          },
          required: ["name", "category", "description", "confidence", "box2d"],
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
