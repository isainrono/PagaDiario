export type TipoCasilla =
  | 'SALIDA'
  | 'PROPIEDAD'
  | 'FERROCARRIL'
  | 'SERVICIO'
  | 'IMPUESTO'
  | 'CARTA_SUERTE'
  | 'CARTA_COMUNIDAD'
  | 'CARCEL_VISITA'
  | 'VE_A_CARCEL'
  | 'PARKING';

export interface CasillaData {
  posicion: number;
  nombre: string;
  tipo: TipoCasilla;
  grupo?: string;
  precio?: number;
  alquiler?: number[];
  hipoteca?: number;
  costoEdificio?: number;
  impuesto?: number;
}

export const TABLERO: CasillaData[] = [
  { posicion: 0, nombre: 'Salida', tipo: 'SALIDA' },
  { posicion: 1, nombre: 'Calle Mediterráneo', tipo: 'PROPIEDAD', grupo: 'marron', precio: 60, alquiler: [2, 10, 30, 90, 160, 250], hipoteca: 30, costoEdificio: 50 },
  { posicion: 2, nombre: 'Caja Comunidad', tipo: 'CARTA_COMUNIDAD' },
  { posicion: 3, nombre: 'Calle Báltico', tipo: 'PROPIEDAD', grupo: 'marron', precio: 60, alquiler: [4, 20, 60, 180, 320, 450], hipoteca: 30, costoEdificio: 50 },
  { posicion: 4, nombre: 'Impuesto sobre la renta', tipo: 'IMPUESTO', impuesto: 200 },
  { posicion: 5, nombre: 'Ferrocarril Reading', tipo: 'FERROCARRIL', precio: 200, hipoteca: 100 },
  { posicion: 6, nombre: 'Calle Oriental', tipo: 'PROPIEDAD', grupo: 'celeste', precio: 100, alquiler: [6, 30, 90, 270, 400, 550], hipoteca: 50, costoEdificio: 50 },
  { posicion: 7, nombre: 'Suerte', tipo: 'CARTA_SUERTE' },
  { posicion: 8, nombre: 'Calle Vermont', tipo: 'PROPIEDAD', grupo: 'celeste', precio: 100, alquiler: [6, 30, 90, 270, 400, 550], hipoteca: 50, costoEdificio: 50 },
  { posicion: 9, nombre: 'Calle Connecticut', tipo: 'PROPIEDAD', grupo: 'celeste', precio: 120, alquiler: [8, 40, 100, 300, 450, 600], hipoteca: 60, costoEdificio: 50 },
  { posicion: 10, nombre: 'Cárcel / Visita', tipo: 'CARCEL_VISITA' },
  { posicion: 11, nombre: 'Calle St. Charles', tipo: 'PROPIEDAD', grupo: 'rosa', precio: 140, alquiler: [10, 50, 150, 450, 625, 750], hipoteca: 70, costoEdificio: 100 },
  { posicion: 12, nombre: 'Compañía Eléctrica', tipo: 'SERVICIO', precio: 150, hipoteca: 75 },
  { posicion: 13, nombre: 'Calle States', tipo: 'PROPIEDAD', grupo: 'rosa', precio: 140, alquiler: [10, 50, 150, 450, 625, 750], hipoteca: 70, costoEdificio: 100 },
  { posicion: 14, nombre: 'Calle Virginia', tipo: 'PROPIEDAD', grupo: 'rosa', precio: 160, alquiler: [12, 60, 180, 500, 700, 900], hipoteca: 80, costoEdificio: 100 },
  { posicion: 15, nombre: 'Ferrocarril Pennsylvania', tipo: 'FERROCARRIL', precio: 200, hipoteca: 100 },
  { posicion: 16, nombre: 'Calle St. James', tipo: 'PROPIEDAD', grupo: 'naranja', precio: 180, alquiler: [14, 70, 200, 550, 750, 950], hipoteca: 90, costoEdificio: 100 },
  { posicion: 17, nombre: 'Caja Comunidad', tipo: 'CARTA_COMUNIDAD' },
  { posicion: 18, nombre: 'Calle Tennessee', tipo: 'PROPIEDAD', grupo: 'naranja', precio: 180, alquiler: [14, 70, 200, 550, 750, 950], hipoteca: 90, costoEdificio: 100 },
  { posicion: 19, nombre: 'Calle New York', tipo: 'PROPIEDAD', grupo: 'naranja', precio: 200, alquiler: [16, 80, 220, 600, 800, 1000], hipoteca: 100, costoEdificio: 100 },
  { posicion: 20, nombre: 'Parking Gratis', tipo: 'PARKING' },
  { posicion: 21, nombre: 'Calle Kentucky', tipo: 'PROPIEDAD', grupo: 'rojo', precio: 220, alquiler: [18, 90, 250, 700, 875, 1050], hipoteca: 110, costoEdificio: 150 },
  { posicion: 22, nombre: 'Suerte', tipo: 'CARTA_SUERTE' },
  { posicion: 23, nombre: 'Calle Indiana', tipo: 'PROPIEDAD', grupo: 'rojo', precio: 220, alquiler: [18, 90, 250, 700, 875, 1050], hipoteca: 110, costoEdificio: 150 },
  { posicion: 24, nombre: 'Calle Illinois', tipo: 'PROPIEDAD', grupo: 'rojo', precio: 240, alquiler: [20, 100, 300, 750, 925, 1100], hipoteca: 120, costoEdificio: 150 },
  { posicion: 25, nombre: 'Ferrocarril B&O', tipo: 'FERROCARRIL', precio: 200, hipoteca: 100 },
  { posicion: 26, nombre: 'Calle Atlantic', tipo: 'PROPIEDAD', grupo: 'amarillo', precio: 260, alquiler: [22, 110, 330, 800, 975, 1150], hipoteca: 130, costoEdificio: 150 },
  { posicion: 27, nombre: 'Calle Ventnor', tipo: 'PROPIEDAD', grupo: 'amarillo', precio: 260, alquiler: [22, 110, 330, 800, 975, 1150], hipoteca: 130, costoEdificio: 150 },
  { posicion: 28, nombre: 'Compañía de Agua', tipo: 'SERVICIO', precio: 150, hipoteca: 75 },
  { posicion: 29, nombre: 'Calle Marvin Gardens', tipo: 'PROPIEDAD', grupo: 'amarillo', precio: 280, alquiler: [24, 120, 360, 850, 1025, 1200], hipoteca: 140, costoEdificio: 150 },
  { posicion: 30, nombre: 'Ve a la Cárcel', tipo: 'VE_A_CARCEL' },
  { posicion: 31, nombre: 'Calle Pacific', tipo: 'PROPIEDAD', grupo: 'verde', precio: 300, alquiler: [26, 130, 390, 900, 1100, 1275], hipoteca: 150, costoEdificio: 200 },
  { posicion: 32, nombre: 'Calle North Carolina', tipo: 'PROPIEDAD', grupo: 'verde', precio: 300, alquiler: [26, 130, 390, 900, 1100, 1275], hipoteca: 150, costoEdificio: 200 },
  { posicion: 33, nombre: 'Caja Comunidad', tipo: 'CARTA_COMUNIDAD' },
  { posicion: 34, nombre: 'Calle Pennsylvania', tipo: 'PROPIEDAD', grupo: 'verde', precio: 320, alquiler: [28, 150, 450, 1000, 1200, 1400], hipoteca: 160, costoEdificio: 200 },
  { posicion: 35, nombre: 'Ferrocarril Short Line', tipo: 'FERROCARRIL', precio: 200, hipoteca: 100 },
  { posicion: 36, nombre: 'Suerte', tipo: 'CARTA_SUERTE' },
  { posicion: 37, nombre: 'Calle Park Place', tipo: 'PROPIEDAD', grupo: 'azul', precio: 350, alquiler: [35, 175, 500, 1100, 1300, 1500], hipoteca: 175, costoEdificio: 200 },
  { posicion: 38, nombre: 'Impuesto de lujo', tipo: 'IMPUESTO', impuesto: 100 },
  { posicion: 39, nombre: 'Boardwalk', tipo: 'PROPIEDAD', grupo: 'azul', precio: 400, alquiler: [50, 200, 600, 1400, 1700, 2000], hipoteca: 200, costoEdificio: 200 },
];

export function getCasilla(posicion: number): CasillaData {
  return TABLERO[posicion];
}
