import { GoogleGenAI, Type } from "@google/genai";

export interface ScoringResult {
  pillarScores: Record<string, number>;
  overallAlignment: number;
  mismatches: string[];
}

export async function generateHarmonyReport(scoringData: any, participants: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Generate a relationship compatibility report based on the following structured data:
    Participants: ${participants.map(p => p.name).join(' and ')}
    Scoring Data: ${JSON.stringify(scoringData)}

    CRITICAL: Use "Easy English". 
    - Use simple words and short sentences.
    - Avoid complex jargon or flowery metaphors.
    - Make it very easy to understand for everyone.
    - Be warm and encouraging.

    The report should include:
    1. A simple summary of how they align.
    2. A breakdown of each pillar (e.g., Emotional, Conflict, Financial, Family, Life Vision, Parenting, Intimacy, Lifestyle). For each pillar, provide:
       - The name of the pillar.
       - A score (0-100) based on the data.
       - A specific, AI-driven insight explaining why they scored that way and what it means for their relationship.
    3. Clear, simple discussion prompts for areas where they differ.
    
    Do not predict success or failure. Focus on understanding and growth.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            pillars: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  insight: { type: Type.STRING }
                }
              }
            },
            discussionPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export function calculateScores(questions: any[], responses: any[], participants: any[]): ScoringResult {
  const pillarScores: Record<string, number> = {};
  const pillarCounts: Record<string, number> = {};
  const mismatches: string[] = [];

  const pillars = Array.from(new Set(questions.map(q => q.pillar)));
  
  pillars.forEach(p => {
    pillarCounts[p] = 0;
    // Don't initialize pillarScores[p] here
  });

  questions.forEach(q => {
    const qResponses = responses.filter(r => r.question_id === q.id);
    if (qResponses.length === 2) {
      const val1 = qResponses[0].value;
      const val2 = qResponses[1].value;
      
      // Simple similarity score
      let score = 0;
      if (val1 === val2) {
        score = 100;
      } else {
        // Check distance if options are ordinal (simplified for MVP)
        const idx1 = q.options.indexOf(val1);
        const idx2 = q.options.indexOf(val2);
        const distance = Math.abs(idx1 - idx2);
        score = Math.max(0, 100 - (distance * (100 / (q.options.length - 1))));
        
        if (score < 50) {
          mismatches.push(`Significant difference in ${q.pillar}: "${q.text}"`);
        }
      }
      
      if (pillarScores[q.pillar] === undefined) pillarScores[q.pillar] = 0;
      pillarScores[q.pillar] += score;
      pillarCounts[q.pillar] += 1;
    }
  });

  let totalScore = 0;
  let activePillars = 0;

  pillars.forEach(p => {
    if (pillarCounts[p] > 0) {
      pillarScores[p] = Math.round(pillarScores[p] / pillarCounts[p]);
      totalScore += pillarScores[p];
      activePillars++;
    }
  });

  const overallAlignment = activePillars > 0 ? Math.round(totalScore / activePillars) : 0;

  return {
    pillarScores,
    overallAlignment,
    mismatches
  };
}
