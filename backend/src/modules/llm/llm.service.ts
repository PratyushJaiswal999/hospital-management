import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Types ──────────────────────────────────────────────────────────────────
export interface PreVisitSummary {
  urgencyLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  chiefComplaint: string;
  suggestedQuestions: string[];
  generationFailed?: boolean;
}

export interface PrescriptionItem {
  drug: string;
  dose: string;
  frequency: string;
  durationDays: number;
}

// ── Helper: call Gemini with timeout ──────────────────────────────────────
async function callGemini(prompt: string, timeoutMs = 10000): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent(prompt);
    clearTimeout(timeout);
    return result.response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Pre-visit summary ──────────────────────────────────────────────────────
/**
 * Generates a pre-visit summary from the patient's symptom text.
 * On failure: returns a deterministic fallback (never blocks booking).
 */
export async function generatePreVisitSummary(
  symptomText: string,
): Promise<PreVisitSummary> {
  const prompt = `System: You are a clinical intake assistant. Given a patient's free-text symptoms, return ONLY valid JSON with keys:
"urgencyLevel" (one of "Low","Medium","High"),
"chiefComplaint" (string, <=15 words),
"suggestedQuestions" (array of exactly 3 strings, questions the doctor could ask).
Do not include any text outside the JSON object.

User: Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor.
Symptoms: ${symptomText}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGemini(prompt, 10000);

      // Strip markdown code fences if Gemini wraps in ```json
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned) as PreVisitSummary;

      // Validate shape
      if (
        parsed.urgencyLevel &&
        parsed.chiefComplaint &&
        Array.isArray(parsed.suggestedQuestions)
      ) {
        return parsed;
      }
      throw new Error('Invalid shape');
    } catch (err) {
      console.error(`[LLM] Pre-visit attempt ${attempt + 1} failed:`, err);
      if (attempt === 0) {
        // Wait 2s before retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // Deterministic fallback
  return {
    urgencyLevel: 'Unknown',
    chiefComplaint: symptomText.slice(0, 100),
    suggestedQuestions: [],
    generationFailed: true,
  };
}

// ── Post-visit summary ─────────────────────────────────────────────────────
/**
 * Generates a patient-friendly post-visit summary from doctor notes + prescription.
 * On failure: returns a templated fallback built from structured prescription data.
 */
export async function generatePostVisitSummary(
  doctorNotes: string,
  prescription: PrescriptionItem[],
): Promise<string> {
  const prescriptionJSON = JSON.stringify(prescription, null, 2);

  const prompt = `System: You are a patient-communication assistant. Rewrite clinical notes into a warm, plain-language summary a non-medical patient can understand. Include a clear medication schedule (drug, dose, when to take it) and follow-up steps as a short bulleted list. Do not add any medical advice not present in the notes.

User: Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps:
Notes: ${doctorNotes}
Prescription: ${prescriptionJSON}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callGemini(prompt, 10000);
      if (text.trim().length > 20) return text.trim();
      throw new Error('Response too short');
    } catch (err) {
      console.error(`[LLM] Post-visit attempt ${attempt + 1} failed:`, err);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // Deterministic fallback — build from structured prescription
  return buildFallbackSummary(doctorNotes, prescription);
}

function buildFallbackSummary(
  doctorNotes: string,
  prescription: PrescriptionItem[],
): string {
  const medLines = prescription
    .map(
      (p) =>
        `• ${p.drug} ${p.dose} — ${p.frequency} for ${p.durationDays} day(s)`,
    )
    .join('\n');

  return `Dear Patient,

Here is a summary of your recent visit:

${doctorNotes}

**Your Medication Schedule:**
${medLines || '• No medications prescribed'}

Please take your medications as directed and follow up if symptoms worsen.
If you have any questions, contact your doctor.`;
}
