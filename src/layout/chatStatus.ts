import type { ToolCallExecution } from '../ai/gemini/client';
export const layoutActions = new Set([
  'add_component',
  'update_component',
  'rotate_element',
  'move_element',
  'draw_wire',
  'update_wire',
  'add_text',
  'update_text',
  'add_device_box',
  'update_device_box',
  'place_macro',
  'create_schematic_draft',
  'optimize_schematic_layout',
  'distribute_sheet_layout',
  'delete_element',
  'clear_canvas',
  'add_cable',
]);
/** Tool success and model prose cannot override the deterministic layout verdict. */
export function checkedCompletion(
  text: string,
  calls: ToolCallExecution[],
  report?: {
    success?: boolean;
    valid?: boolean;
    issues?: { type: string; objectIds: string[]; message: string }[];
  },
): string {
  const proposal = [...calls].reverse().find((c) => c.result?.requiresUserApply)?.result;
  if (proposal)
    return proposal.status === 'preview_ready'
      ? 'Eine geprüfte Layoutvorschau wurde berechnet. Änderungen werden ausschließlich über „Übernehmen“ im Vorschaufenster übernommen. Die Berechnung selbst verändert das Projekt nicht.'
      : 'Es wurde kein gültiges Layout gefunden. Der Fehlerbericht steht in der Layoutvorschau. Sofern sinnvoll, enthält er einen Vorschlag zur Blattaufteilung. Die Berechnung hat das Projekt nicht verändert.';
  const failed = calls.filter((c) => layoutActions.has(c.name) && c.status === 'error');
  if (failed.length)
    return (
      'Nicht alle Zeichenaktionen waren erfolgreich:\n' +
      failed
        .map(
          (c) => '- ' + c.name + ': ' + (c.result?.error ?? c.result?.message ?? 'fehlgeschlagen'),
        )
        .join('\n')
    );
  if (!report?.success)
    return 'Die abschließende Layoutprüfung konnte nicht durchgeführt werden. Das Ergebnis ist nicht als geprüftes Layout bestätigt.';
  if (!report.valid)
    return (
      'Die abschließende Layoutprüfung hat Fehler gefunden:\n' +
      (report.issues ?? [])
        .filter((i) => i.type !== 'estimated_text_metrics')
        .slice(0, 8)
        .map((i) => `- ${i.type}: ${i.message} (${i.objectIds.join(', ')})`)
        .join('\n') +
      '\nBitte die Layoutvorschau zur Korrektur öffnen.'
    );
  return 'Automatische geometrische Layoutprüfung: gültig.\n\n' + text;
}
