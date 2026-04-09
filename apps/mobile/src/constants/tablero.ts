export const NOMBRES_CASILLAS: string[] = [
  'Salida', 'Mediterráneo', 'Caja Comunidad', 'Báltico', 'Impuesto renta',
  'FC Reading', 'Oriental', 'Suerte', 'Vermont', 'Connecticut',
  'Cárcel', 'St. Charles', 'Cía. Eléctrica', 'States', 'Virginia',
  'FC Pennsylvania', 'St. James', 'Caja Comunidad', 'Tennessee', 'New York',
  'Parking', 'Kentucky', 'Suerte', 'Indiana', 'Illinois',
  'FC B&O', 'Atlantic', 'Ventnor', 'Cía. Agua', 'Marvin Gardens',
  'Ve a la Cárcel', 'Pacific', 'North Carolina', 'Caja Comunidad', 'Pennsylvania',
  'FC Short Line', 'Suerte', 'Park Place', 'Impuesto lujo', 'Boardwalk',
];

export const COLORES_GRUPO: Record<string, string> = {
  marron: '#8B4513',
  celeste: '#87CEEB',
  rosa: '#FF69B4',
  naranja: '#FFA500',
  rojo: '#DC143C',
  amarillo: '#FFD700',
  verde: '#228B22',
  azul: '#000080',
};

export const GRUPO_POR_CASILLA: Record<number, string> = {
  1: 'marron', 3: 'marron',
  6: 'celeste', 8: 'celeste', 9: 'celeste',
  11: 'rosa', 13: 'rosa', 14: 'rosa',
  16: 'naranja', 18: 'naranja', 19: 'naranja',
  21: 'rojo', 23: 'rojo', 24: 'rojo',
  26: 'amarillo', 27: 'amarillo', 29: 'amarillo',
  31: 'verde', 32: 'verde', 34: 'verde',
  37: 'azul', 39: 'azul',
  5: 'ferrocarril', 15: 'ferrocarril', 25: 'ferrocarril', 35: 'ferrocarril',
  12: 'servicio', 28: 'servicio',
};

export const TIPO_CASILLA_ICONO: Record<number, string> = {
  0: '🟢', 10: '⛓️', 20: '🅿️', 30: '🚔',
  2: '📦', 17: '📦', 33: '📦',
  7: '🍀', 22: '🍀', 36: '🍀',
  4: '💸', 38: '💸',
  5: '🚂', 15: '🚂', 25: '🚂', 35: '🚂',
  12: '⚡', 28: '💧',
};

export const PRECIO_POR_CASILLA: Record<number, number> = {
  1: 60, 3: 60,
  5: 200,
  6: 100, 8: 100, 9: 120,
  11: 140, 12: 150, 13: 140, 14: 160,
  15: 200, 16: 180, 18: 180, 19: 200,
  21: 220, 23: 220, 24: 240,
  25: 200, 26: 260, 27: 260, 28: 150, 29: 280,
  31: 300, 32: 300, 34: 320,
  35: 200, 37: 350, 39: 400,
};

export const ICONOS_TRANSACCION: Record<string, string> = {
  SALARIO: '💰',
  ALQUILER: '🏠',
  COMPRA: '🛒',
  IMPUESTO: '🏛️',
  HIPOTECA: '📋',
  CONSTRUCCION: '🔨',
  SUBASTA: '🔔',
  NEGOCIACION: '🤝',
  BANCARROTA: '💸',
};
