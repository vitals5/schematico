// src/ai/GeminiFloorPlanService.ts
// Service for extracting clean architectural vector floor plans from images/blueprints via Gemini API

import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiApiKey, getGeminiModel } from './GeminiConfig';
import { FloorPlanData } from '../model/types';
import { sanitizeFloorPlanGeometry, RawAiFloorPlanResponse, SanitizeOptions, computeImageFitBounds } from './GeometrySanitizer';

const SYSTEM_INSTRUCTION = `Du bist ein hochpräziser Architektur- und Elektro-CAD-Analyst.
Deine Aufgabe ist es, aus hochgeladenen Architektur-Grundrissen, Bauplänen, Skizzen oder Fotos einen vollständigen, sauberen, präzisen Vektorgrundriss zu extrahieren.

KOORDINATENSYSTEM (SEHR WICHTIG):
- Der Koordinatenbereich ist strikt normalisiert von 0 bis 1000 für die GESAMTE Bildbreite und Bildhöhe.
- (x=0, y=0) ist die alleräußerste obere linke Bildecke.
- (x=1000, y=1000) ist die alleräußerste untere rechte Bildecke.
- Jedes Wandsegment (x1, y1) bis (x2, y2), jede Tür und jedes Fenster muss EXAKT auf den im Bild sichtbaren Wänden liegen.

REGELN ZUR VOLLSTÄNDIGKEIT:
1. GEBÄUDEUMRISS & ANBAUTEN:
   - Erfasse nicht nur das Haupthaus, sondern auch ALLE angebauten oder freistehenden Bauteile (z. B. Garage, Carport, Abstellraum, Geräteraum, HWR, Windfang, Erker, Vorbauten, Terrassenüberdachung).
   - Wenn rechts eine Garage oder links ein Nebengebäude angebaut ist, erfasse deren Außenwände und Trennwände vollständig!
2. INNENWÄNDE & RÄUME:
   - Jeder im Grundriss beschriftete Raum (z. B. Wohnen, Essen, Kochen/Küche, Speis/Speisekammer, Flur, Diele, Windfang, Gäste-WC, Bad, Treppe, HWR/Technik, Garage) MUSS durch Wände abgegrenzt sein.
   - Wände von Ecke zu Ecke zeichnen. An T-Kreuzungen und Ecken müssen die Koordinaten exakt übereinstimmen.
   - Übersehe keine kleinen Räume wie Speisekammer (Speis), WC oder Windfang!
3. WANDTYPEN:
   - isExterior: true für Außenwände (Umfassungswände des Gebäudes und der Garage).
   - isExterior: false für Innenwände (Trennwände zwischen Räumen).
4. WANDÖFFNUNGEN (TÜREN & FENSTER):
   - Jede Tür (kind: "door") und jedes Fenster (kind: "window") MUSS genau auf der Linie eines Wandsegments liegen.
   - Gib für jede Öffnung orientation ("horizontal" oder "vertical") an.
   - Gib für Türen swingDirection an (left_in, right_in, left_out, right_out).
5. SCHUTZ VOR RAHMEN & BESCHRIFTUNGEN:
   - Ignoriere Möbel, Maßlinien, Maßzahlen, Schriftfelder, Legenden und Stempel. Konzentriere dich rein auf das architektonische Mauerwerk und die Wandöffnungen.
6. MAẞSTAB:
   - Falls im Plan lesbar, extrahiere den Maßstab (z. B. "1:100" oder "1:50") oder eine lesbare Bemaßung.
`;

export const FLOORPLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scaleEstimate: {
      type: Type.OBJECT,
      properties: {
        detectedScaleText: { type: Type.STRING },
        detectedDimensionMeters: { type: Type.NUMBER }
      }
    },
    walls: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x1: { type: Type.NUMBER, description: 'Start X (0..1000)' },
          y1: { type: Type.NUMBER, description: 'Start Y (0..1000)' },
          x2: { type: Type.NUMBER, description: 'End X (0..1000)' },
          y2: { type: Type.NUMBER, description: 'End Y (0..1000)' },
          thickness: { type: Type.NUMBER },
          isExterior: { type: Type.BOOLEAN }
        },
        required: ['x1', 'y1', 'x2', 'y2']
      }
    },
    openings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING, enum: ['door', 'window'] },
          x: { type: Type.NUMBER, description: 'Center X (0..1000)' },
          y: { type: Type.NUMBER, description: 'Center Y (0..1000)' },
          width: { type: Type.NUMBER },
          orientation: { type: Type.STRING, enum: ['horizontal', 'vertical'] },
          swingDirection: { type: Type.STRING, enum: ['left_in', 'right_in', 'left_out', 'right_out', 'none'] }
        },
        required: ['kind', 'x', 'y', 'width']
      }
    },
    rooms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Deutscher Raumname, z. B. Wohnen, Küche, Bad, Flur' },
          approxAreaM2: { type: Type.NUMBER },
          centerX: { type: Type.NUMBER },
          centerY: { type: Type.NUMBER },
          polygon: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ['x', 'y']
            }
          }
        },
        required: ['name', 'centerX', 'centerY']
      }
    }
  },
  required: ['walls', 'openings', 'rooms']
};

export interface VectorizeFloorPlanOptions extends SanitizeOptions {
  userPromptHint?: string;
  apiKey?: string;
  onProgress?: (status: string) => void;
}

/**
 * Sends a base64 encoded image to Gemini 3.8 Flash and returns a clean FloorPlanData model.
 */
export async function vectorizeFloorPlanWithGemini(
  imageDataUrl: string,
  options: VectorizeFloorPlanOptions = {}
): Promise<FloorPlanData> {
  const apiKey = (options.apiKey || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error('Kein Google Gemini API-Schlüssel hinterlegt. Bitte in den Allgemeinen Einstellungen eintragen.');
  }

  // Parse Data URL: data:image/png;base64,....
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Ungültiges Bildformat. Bitte ein Bild im Format PNG, JPEG oder WebP auswählen.');
  }

  const mimeType = match[1];
  const base64Data = match[2];

  options.onProgress?.('Verbindung zu Google Gemini 3.8 Flash wird aufgebaut...');

  const client = new GoogleGenAI({ apiKey });

  const userPrompt = options.userPromptHint
    ? `Analysiere diesen Grundriss sorgfältig. Extrahiere ALLE Außen- und Innenwände (einschließlich Garage, Speisekammer, WC, Windfang, HWR), alle Türen, Fenster und Räume als Vektorgeometrie. Hinweis des Nutzers: ${options.userPromptHint}`
    : 'Analysiere diesen Grundriss sorgfältig und vollständig. Extrahiere ALLE Außen- und Innenwände (einschließlich Garage, Speisekammer, WC, Windfang, HWR, Treppen), alle Türen, Fenster und Räume mit exakten Koordinaten [0..1000].';

  options.onProgress?.('KI analysiert den Grundriss und extrahiert Vektoren...');

  const response = await client.models.generateContent({
    model: getGeminiModel() || 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: userPrompt
          }
        ]
      }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: FLOORPLAN_RESPONSE_SCHEMA,
      temperature: 0.1
    }
  });

  if (!response.text) {
    throw new Error('Keine Antwort von der Gemini API erhalten.');
  }

  options.onProgress?.('Vektorgeometrie wird bereinigt und ausgerichtet...');

  let rawOutput: RawAiFloorPlanResponse;
  try {
    rawOutput = JSON.parse(response.text) as RawAiFloorPlanResponse;
  } catch (err) {
    throw new Error(`Ungültige JSON-Antwort von der KI: ${response.text.slice(0, 100)}...`);
  }

  if (!rawOutput.walls || rawOutput.walls.length === 0) {
    throw new Error('Die KI konnte im hochgeladenen Bild keine Wände erkennen. Bitte Bildqualität oder Kontrast prüfen.');
  }

  // Calculate target fitted bounds for the background image and vectors
  const targetW = options.canvasWidth ?? 840;
  const targetH = options.canvasHeight ?? 594;
  const targetBox = {
    x: 30,
    y: 25,
    width: targetW - 60,
    height: targetH - 64
  };

  const imageBounds = options.imageBounds ?? (
    options.imageNaturalWidth && options.imageNaturalHeight
      ? computeImageFitBounds(options.imageNaturalWidth, options.imageNaturalHeight, targetBox)
      : { x: 40, y: 30, width: targetW - 80, height: targetH - 60 }
  );

  const floorPlan = sanitizeFloorPlanGeometry(rawOutput, {
    ...options,
    canvasWidth: targetW,
    canvasHeight: targetH,
    imageBounds
  });

  // Attach background image with the EXACT SAME bounds as the vector coordinates
  floorPlan.backgroundImage = {
    dataUrl: imageDataUrl,
    opacity: 0.35,
    visible: true,
    bounds: imageBounds
  };

  options.onProgress?.('Grundriss erfolgreich vektorisiert!');

  return floorPlan;
}
