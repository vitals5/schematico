import {
  getAiProvider,
  readSetting,
  writeSetting,
  getOpenRouterKey,
  getOpenRouterModel,
} from '../ProviderConfig';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
  getGeminiThinkingLevel,
  setGeminiThinkingLevel,
  testGeminiApiKey,
  type GeminiModelId,
  type GeminiThinkingLevel,
} from '../GeminiConfig';
import { cachedModels, refreshModels, routerRequest } from '../openrouter/api';
import { tr } from '../../i18n';
import { escapeSvg as esc } from '../../model/ImportedDrawing';
export function showProviderSettings(onSave: () => void): void {
  document.getElementById('aiApiKeyModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'aiApiKeyModal';
  modal.className = 'modal-backdrop';
  modal.style.cssText =
    'position:fixed;inset:0;background:#000b;z-index:10000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `<style>
#aiApiKeyModal section{font-size:13px;line-height:1.5;box-sizing:border-box}
#aiApiKeyModal h3{margin:0 0 12px;font-size:18px}
#aiApiKeyModal p{margin:12px 0}
#aiApiKeyModal label{display:block;font-weight:600}
#aiApiKeyModal input,#aiApiKeyModal select{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:8px 10px;background:#18202b;color:#eef2f7;border:1px solid #526170;border-radius:5px;font:inherit;font-weight:400}
#aiApiKeyModal a{color:#90cdf4}
#aiApiKeyModal #apiKeyTestResult{min-height:20px;color:#f6ad55;overflow-wrap:anywhere}
</style><section role="dialog" aria-modal="true" aria-label="${esc(tr('KI-Einstellungen', 'AI Settings'))}" style="background:#232731;color:#eee;padding:24px;width:560px;max-width:95vw;max-height:90vh;overflow:auto;border:1px solid #526170;border-radius:8px">
<h3>${esc(tr('KI-Anbieter und Modell', 'AI Provider & Model'))}</h3>
<p>${esc(tr('API-Schlüssel werden lokal auf diesem Gerät gespeichert. Anfragen und Schaltplandaten gehen direkt an den gewählten Anbieter.', 'API keys are stored locally on this device. Requests and schematic data are sent directly to the selected provider.'))}</p>
<label>${esc(tr('Anbieter', 'Provider'))} <select id="aiProvider"><option value="openrouter">OpenRouter</option><option value="gemini">Google Gemini</option></select></label>
<p><label>${esc(tr('API-Schlüssel', 'API Key'))} <input id="inputModalApiKey" type="password" autocomplete="off" style="width:100%"></label></p>
<div id="routerControls"><button id="refreshRouterModels" class="btn">${esc(tr('Modelle aktualisieren', 'Refresh Models'))}</button><p id="routerUpdated"></p><label>${esc(tr('Modelle filtern', 'Filter Models'))} <input id="routerModelFilter" type="search" style="width:100%"></label><p>${esc(tr('Für den Zeichenassistenten werden Modelle mit Werkzeugunterstützung angezeigt.', 'Only models with tool-calling support are shown for the drawing assistant.'))}</p></div>
<p><label>${esc(tr('Modell', 'Model'))} <select id="selectModalModel" style="width:100%;max-width:100%"></select></label></p>
<div id="geminiControls"><label>Thinking <select id="selectModalThinkingLevel"><option value="minimal">Minimal</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
<p id="apiKeyTestResult" role="status"></p><a id="providerKeyLink" target="_blank" rel="noopener noreferrer">${esc(tr('API-Schlüssel verwalten ↗', 'Manage API Keys ↗'))}</a>
<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" id="btnModalClose">${esc(tr('Abbrechen', 'Cancel'))}</button><button class="btn" id="btnTestKey">${esc(tr('Verbindung testen', 'Test Connection'))}</button><button class="btn btn-primary" id="btnSaveKey">${esc(tr('Speichern', 'Save'))}</button></footer></section>`;
  document.body.append(modal);
  const $ = <T extends HTMLElement>(id: string) =>
    modal.querySelector<T>('#' + id)!;
  const provider = $<HTMLSelectElement>('aiProvider'),
    key = $<HTMLInputElement>('inputModalApiKey'),
    model = $<HTMLSelectElement>('selectModalModel'),
    filter = $<HTMLInputElement>('routerModelFilter'),
    thinking = $<HTMLSelectElement>('selectModalThinkingLevel'),
    status = $('apiKeyTestResult');
  const drafts: Record<
    'gemini' | 'openrouter',
    { key: string; model: string }
  > = {
    openrouter: { key: getOpenRouterKey(), model: getOpenRouterModel() },
    gemini: { key: getGeminiApiKey(), model: getGeminiModel() },
  };
  let current = getAiProvider(),
    models = cachedModels();
  provider.value = current;
  thinking.value = getGeminiThinkingLevel();
  const renderModels = () => {
    const selected = drafts[current].model;
    model.replaceChildren();
    const entries: { id: string; name: string }[] =
      current === 'gemini'
        ? [
            { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
            { id: 'gemini-4-argon', name: 'Gemini 4 Argon' },
          ]
        : models.filter((m) =>
            (m.name + ' ' + m.id)
              .toLowerCase()
              .includes(filter.value.toLowerCase()),
          );
    if (selected && !entries.some((m) => m.id === selected))
      entries.unshift({ id: selected, name: selected });
    model.add(new Option(tr('Modell auswählen …', 'Select a model …'), ''));
    for (const entry of entries) model.add(new Option(entry.name + (current === 'openrouter' && models.find(m => m.id === entry.id)?.vision ? tr(' [Bild]', ' [Image]') : '') + (current === 'openrouter' && models.find(m=>m.id===entry.id)?.pdf ? ' [PDF]' : ''), entry.id));
    model.value = selected;
    $('routerUpdated').textContent = readSetting('openrouter_models_updated')
      ? tr('Modellliste: ', 'Model list: ') +
        new Date(readSetting('openrouter_models_updated')).toLocaleString()
      : tr('Noch keine Modellliste geladen.', 'No model list loaded yet.');
  };
  const renderProvider = () => {
    key.value = drafts[current].key;
    filter.value = '';
    status.textContent = '';
    $('routerControls').hidden = current !== 'openrouter';
    $('geminiControls').hidden = current !== 'gemini';
    const link = $<HTMLAnchorElement>('providerKeyLink');
    link.href =
      current === 'openrouter'
        ? 'https://openrouter.ai/settings/keys'
        : 'https://aistudio.google.com/app/apikey';
    renderModels();
  };
  provider.onchange = () => {
    drafts[current] = { key: key.value, model: model.value };
    current = provider.value as typeof current;
    renderProvider();
  };
  model.onchange = () => {
    drafts[current].model = model.value;
  };
  filter.oninput = renderModels;
  $('refreshRouterModels').onclick = async () => {
    const button = $<HTMLButtonElement>('refreshRouterModels');
    button.disabled = true;
    status.textContent = tr('Modellliste wird geladen …', 'Loading model list …');
    try {
      models = await refreshModels(key.value.trim());
      if (!modal.isConnected) return;
      renderModels();
      status.textContent = `${models.length} ${tr('Modelle mit Werkzeugunterstützung geladen.', 'models with tool support loaded.')}`;
    } catch (e) {
      status.textContent = (e as Error).message;
    } finally {
      button.disabled = false;
    }
  };
  $('btnTestKey').onclick = async () => {
    const button = $<HTMLButtonElement>('btnTestKey');
    button.disabled = true;
    status.textContent = tr('Verbindung wird getestet …', 'Testing connection …');
    try {
      if (!key.value.trim()) throw new Error(tr('Bitte API-Schlüssel eingeben.', 'Please enter an API key.'));
      if (current === 'openrouter') {
        await routerRequest('/key', key.value.trim());
        status.textContent =
          tr('OpenRouter-Schlüssel gültig. Modellverfügbarkeit und Guthaben werden bei der Anfrage geprüft.', 'OpenRouter key is valid. Model availability and credits are checked per request.');
      } else {
        const result = await testGeminiApiKey(key.value.trim(), model.value);
        status.textContent = result.message;
      }
    } catch (e) {
      status.textContent = (e as Error).message;
    } finally {
      button.disabled = false;
    }
  };
  $('btnSaveKey').onclick = () => {
    if (key.value.trim() && !model.value) {
      status.textContent =
        tr('Bitte zuerst ein Modell auswählen (ggf. Modellliste aktualisieren).', 'Please select a model first (refresh the model list if needed).');
      return;
    }
    try {
      if (current === 'openrouter') {
        writeSetting('openrouter_api_key', key.value.trim());
        writeSetting('openrouter_model', model.value);
      } else {
        setGeminiApiKey(key.value);
        setGeminiModel(model.value as GeminiModelId);
        setGeminiThinkingLevel(thinking.value as GeminiThinkingLevel);
      }
      writeSetting('ai_provider', current);
      onSave();
      modal.remove();
    } catch {
      status.textContent =
        tr('Einstellungen konnten nicht lokal gespeichert werden.', 'Could not save settings locally.');
    }
  };
  $('btnModalClose').onclick = () => modal.remove();
  modal.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') modal.remove();
  });
  renderProvider();
}
