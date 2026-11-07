import type {WindowMacro} from './MacroManager';
export interface ArticlePackageAssets {
  id: string;
  sources: {path:string;data:Uint8Array}[];
  macros: WindowMacro[];
  diagnostics: string[];
}
