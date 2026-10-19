export interface MacroVariable {
  name: string;
  value: string;
  bindings: { componentId?: string; pageId?: string; property: number; template: string }[];
}

/** Retained source configuration is separate from printed drawing objects. */
export interface NativeMacroData {
  kind: 'WindowMacro' | 'PageMacro' | 'ContourDefinition';
  metadata: { id: string; type: string; xml: string }[];
  variables: MacroVariable[];
}

export function remapNativeMacroData(data: NativeMacroData | undefined, ids: ReadonlyMap<string,string>, pageId?: string, sourcePageId?: string): NativeMacroData | undefined {
  if (!data) return;
  const copy = structuredClone(data);
  copy.variables = copy.variables.map(variable => ({...variable, bindings: variable.bindings.flatMap<MacroVariable['bindings'][number]>(binding => {
    if (binding.componentId) {
      const componentId = ids.get(binding.componentId);
      return componentId ? [{...binding,componentId}] : [];
    }
    return binding.pageId && pageId && (!sourcePageId||binding.pageId===sourcePageId) ? [{...binding,pageId}] : [];
  })})).filter(variable => variable.bindings.length);
  return copy;
}

export function mergeNativeMacroData(current: NativeMacroData | undefined, incoming: NativeMacroData | undefined): NativeMacroData | undefined {
  if (!incoming) return current;
  if (!current) return structuredClone(incoming);
  const copy = structuredClone(incoming), names = new Set(current.variables.map(v=>v.name)), renamed = new Map<string,string>();
  for (const variable of copy.variables) {
    let name = variable.name, suffix = 2;
    while (names.has(name)) name = `${variable.name}_${suffix++}`;
    names.add(name);renamed.set(variable.name,name);variable.name=name;
  }
  for (const variable of copy.variables) for (const binding of variable.bindings)
    binding.template=binding.template.replace(/<([^<>]+)>/g,(match,name:string)=>renamed.has(name)?`<${renamed.get(name)}>`:match);
  return {...structuredClone(current), metadata:[...current.metadata,...copy.metadata], variables:[...current.variables,...copy.variables]};
}
