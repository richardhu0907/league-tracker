const OVERRIDES: Record<string, string> = {
  'Wukong':          'MonkeyKing',
  'Renata Glasc':    'Renata',
  "Bel'Veth":        'Belveth',
  'Nunu & Willump':  'Nunu',
  "Cho'Gath":        'Chogath',
  "Vel'Koz":         'Velkoz',
  "Kog'Maw":         'KogMaw',
  "Rek'Sai":         'RekSai',
  "Kha'Zix":         'Khazix',
  "Kai'Sa":          'Kaisa',
  "K'Sante":         'KSante',
  "Dr. Mundo":       'DrMundo',
  'LeBlanc':         'Leblanc',
};

export function champId(name: string): string {
  if (!name) return '';
  return OVERRIDES[name] ?? name.replace(/['\s.]/g, '');
}
