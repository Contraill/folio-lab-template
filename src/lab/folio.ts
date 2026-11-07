/* When Folio frames the app, it adds ?folio=1&lang=en|tr&skin=graphite|paper|blueprint|terminal to its address.
   The app then speaks the visitor's language and takes the colours of their Folio skin. Opened on its own, it
   follows the browser's language and the system's light or dark setting. */
import type { Lang, Palette } from './types.ts';

export const PALETTES: Record<string, Palette> = {
  graphite: { bg: '#0f0f10', surface: '#1a1a1c', ink: '#f3f3f1', mute: '#9d9d99', accent: '#f3f3f1', signal: '#b8f26c', danger: '#ff6a4d' },
  paper: { bg: '#f0f2f5', surface: '#fbfcfd', ink: '#0d1117', mute: '#566070', accent: '#0d1117', signal: '#2b4ad8', danger: '#d23c22' },
  blueprint: { bg: '#061529', surface: '#0b2444', ink: '#eaf3ff', mute: '#98b4da', accent: '#8fd8ff', signal: '#8fd8ff', danger: '#ff8f6b' },
  terminal: { bg: '#000000', surface: '#050b05', ink: '#c9ffd8', mute: '#7cc994', accent: '#7dffa8', signal: '#7dffa8', danger: '#ffd23f' },
};

export function folioContext(search = location.search, prefersDark = matchMedia('(prefers-color-scheme: dark)').matches, browserLang = navigator.language) {
  const params = new URLSearchParams(search);
  const lang: Lang = params.get('lang') === 'tr' || (!params.has('lang') && browserLang.toLowerCase().startsWith('tr')) ? 'tr' : 'en';
  const skin = params.get('skin') ?? '';
  const palette = PALETTES[skin] ?? (prefersDark ? PALETTES.graphite : PALETTES.paper);
  return { embedded: params.get('folio') === '1', lang, palette };
}
