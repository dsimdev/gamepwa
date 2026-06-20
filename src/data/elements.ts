export type ElementType = 'fire' | 'electro' | 'plasma'

export const ELEMENT_COLORS: Record<ElementType, number> = {
  fire: 0xff5500,
  electro: 0xffd700,
  plasma: 0xb14aff,
}

export const ELEMENT_CSS: Record<ElementType, string> = {
  fire: '#ff5500',
  electro: '#ffd700',
  plasma: '#b14aff',
}

export const ELEMENT_NAMES: Record<ElementType, string> = {
  fire: 'FUEGO',
  electro: 'ELECTRO',
  plasma: 'PLASMA',
}
