// Couleur de chaque niveau de crise : vert, jaune, orange, rouge, puis rouge sombre
export const LEVEL_COLORS = [
  '#16a34a',
  '#eab308',
  '#f97316',
  '#dc2626',
  '#7f1d1d',
]

export const levelColor = (level: number) => LEVEL_COLORS[level - 1]
