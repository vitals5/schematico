// src/ai/GeminiFloorPlanService.ts
// Service for extracting clean architectural vector floor plans from images/blueprints via Gemini API

import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiApiKey } from './GeminiConfig';
import { FloorPlanData } from '../model/types';
import { sanitizeFloorPlanGeometry, RawAiFloorPlanResponse, SanitizeOptions } from './GeometrySanitizer';

const SYSTEM_INSTRUCTION = `Du bist ein hochpräziser Architektur- und Elektro-CAD-Analyst.
Deine Aufgabe ist es, aus hochgeladenen Architektur-Grundrissen, Bauplänen, Skizzen oder Fotos einen sauberen, präzisen Vektorgrundriss zu extrahieren.

REGELN:
1. IGNORIERE alle Möbel, Schraffuren, Detailbemaßungen, Maßhilfslinien, Schriftfelder, Legenden, Stempel, Notizen und Wasserzeichen.
2. EXTRAHIERE alle tragenden und nichttragenden Wände als zusammenhängende Liniensegmente mit normalisierten Start- und Endkoordinaten im Bereich [0..1000].
3. EXTRAHIERE alle Wandöffnungen:
   - Türen (kind: "door") mit Position, Breite und Anschlag/Aufschlagrichtung (swingDirection: left_in, right_in, left_out, right_out, none)
   - Fenster (kind: "window") mit Position und Breite.
4. EXTRAHIERE alle Räume (z. B. Wohnen/Essen, Küche, Schlafzimmer, Bad, WC, Flur/Diele, HWR, Büro, Kind, Keller) mit:
   - Deutschem Raumnamen (name)
   - Geschätzter oder abgelesener Quadratmeterzahl (approxAreaM2), falls vorhanden
   - Mittelpunkt des Raumes (centerX, centerY)
   - Eckpunkten des Raumpolygons (polygon).
5. EXTRAHIERE falls lesbar die Maßstabsangabe (z. B. "1:50", "1:100") oder eine Referenzlänge in Metern.
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
    ? `Analysiere diesen Grundriss und extrahiere Wände, Türen, Fenster und Räume. Hinweis des Nutzers: ${options.userPromptHint}`
    : 'Analysiere diesen Grundriss und extrahiere präzise alle Wände, Türen, Fenster und Räume als Vektorgeometrie.';

  options.onProgress?.('KI analysiert den Grundriss und extrahiert Vektoren...');

  const response = await client.models.generateContent({
    model: 'gemini-3.8-flash',
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

  const floorPlan = sanitizeFloorPlanGeometry(rawOutput, options);

  // Attach background image for visual reference
  floorPlan.backgroundImage = {
    dataUrl: imageDataUrl,
    opacity: 0.35,
    visible: true,
    bounds: {
      x: 0,
      y: 0,
      width: options.canvasWidth ?? 800,
      height: options.canvasHeight ?? 560
    }
  };

  options.onProgress?.('Grundriss erfolgreich vektorisiert!');

  return floorPlan;
}
