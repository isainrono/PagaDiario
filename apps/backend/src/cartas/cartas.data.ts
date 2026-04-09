export type EfectoCarta =
  | { tipo: 'MOVER_A'; posicion: number }
  | { tipo: 'MOVER_RELATIVO'; casillas: number }
  | { tipo: 'IR_A_CARCEL' }
  | { tipo: 'SALIR_CARCEL' }
  | { tipo: 'COBRAR'; monto: number }
  | { tipo: 'PAGAR'; monto: number }
  | { tipo: 'COBRAR_DE_JUGADORES'; monto: number }
  | { tipo: 'PAGAR_A_JUGADORES'; monto: number }
  | { tipo: 'PAGAR_POR_EDIFICIOS'; porCasa: number; porHotel: number }

export interface Carta {
  id: string;
  tipo: 'SUERTE' | 'COMUNIDAD';
  texto: string;
  efecto: EfectoCarta;
}

export const CARTAS_SUERTE: Carta[] = [
  { id: 'S01', tipo: 'SUERTE', texto: 'Avanzá hasta la Salida. Cobrá $200.', efecto: { tipo: 'MOVER_A', posicion: 0 } },
  { id: 'S02', tipo: 'SUERTE', texto: 'Avanzá hasta Boardwalk.', efecto: { tipo: 'MOVER_A', posicion: 39 } },
  { id: 'S03', tipo: 'SUERTE', texto: 'Avanzá hasta Illinois Ave.', efecto: { tipo: 'MOVER_A', posicion: 24 } },
  { id: 'S04', tipo: 'SUERTE', texto: 'Avanzá hasta St. Charles Place.', efecto: { tipo: 'MOVER_A', posicion: 11 } },
  { id: 'S05', tipo: 'SUERTE', texto: 'Retrocedé 3 casillas.', efecto: { tipo: 'MOVER_RELATIVO', casillas: -3 } },
  { id: 'S06', tipo: 'SUERTE', texto: 'Ir a la cárcel directamente.', efecto: { tipo: 'IR_A_CARCEL' } },
  { id: 'S07', tipo: 'SUERTE', texto: 'Carta de salida de la cárcel. Guardala hasta usarla.', efecto: { tipo: 'SALIR_CARCEL' } },
  { id: 'S08', tipo: 'SUERTE', texto: 'El banco te paga dividendos de $50.', efecto: { tipo: 'COBRAR', monto: 50 } },
  { id: 'S09', tipo: 'SUERTE', texto: 'Tu préstamo madura. Cobrá $150.', efecto: { tipo: 'COBRAR', monto: 150 } },
  { id: 'S10', tipo: 'SUERTE', texto: 'Pagá multa de $15.', efecto: { tipo: 'PAGAR', monto: 15 } },
  { id: 'S11', tipo: 'SUERTE', texto: 'Pagá honorarios del médico: $50.', efecto: { tipo: 'PAGAR', monto: 50 } },
  { id: 'S12', tipo: 'SUERTE', texto: 'Pagá tasas de la escuela: $150.', efecto: { tipo: 'PAGAR', monto: 150 } },
  { id: 'S13', tipo: 'SUERTE', texto: 'Reparaciones generales: $25 por casa y $100 por hotel.', efecto: { tipo: 'PAGAR_POR_EDIFICIOS', porCasa: 25, porHotel: 100 } },
  { id: 'S14', tipo: 'SUERTE', texto: 'Sos elegido presidente del consejo. Pagá $50 a cada jugador.', efecto: { tipo: 'PAGAR_A_JUGADORES', monto: 50 } },
  { id: 'S15', tipo: 'SUERTE', texto: 'Tus acciones de construcción y préstamo maduran. Cobrá $150.', efecto: { tipo: 'COBRAR', monto: 150 } },
  { id: 'S16', tipo: 'SUERTE', texto: 'Avanzá hasta la próxima estación de ferrocarril.', efecto: { tipo: 'MOVER_A', posicion: 5 } },
];

export const CARTAS_COMUNIDAD: Carta[] = [
  { id: 'C01', tipo: 'COMUNIDAD', texto: 'Avanzá hasta la Salida. Cobrá $200.', efecto: { tipo: 'MOVER_A', posicion: 0 } },
  { id: 'C02', tipo: 'COMUNIDAD', texto: 'Error bancario a tu favor. Cobrá $200.', efecto: { tipo: 'COBRAR', monto: 200 } },
  { id: 'C03', tipo: 'COMUNIDAD', texto: 'Recibís honorarios médicos de $10.', efecto: { tipo: 'COBRAR', monto: 10 } },
  { id: 'C04', tipo: 'COMUNIDAD', texto: 'Cobrá dividendos de acciones: $50.', efecto: { tipo: 'COBRAR', monto: 50 } },
  { id: 'C05', tipo: 'COMUNIDAD', texto: 'Heredás $100.', efecto: { tipo: 'COBRAR', monto: 100 } },
  { id: 'C06', tipo: 'COMUNIDAD', texto: 'Reembolso de impuestos: $20.', efecto: { tipo: 'COBRAR', monto: 20 } },
  { id: 'C07', tipo: 'COMUNIDAD', texto: 'Ganás segundo premio en concurso de belleza. Cobrá $10.', efecto: { tipo: 'COBRAR', monto: 10 } },
  { id: 'C08', tipo: 'COMUNIDAD', texto: 'Es tu cumpleaños. Cada jugador te paga $10.', efecto: { tipo: 'COBRAR_DE_JUGADORES', monto: 10 } },
  { id: 'C09', tipo: 'COMUNIDAD', texto: 'Carta de salida de la cárcel. Guardala hasta usarla.', efecto: { tipo: 'SALIR_CARCEL' } },
  { id: 'C10', tipo: 'COMUNIDAD', texto: 'Ir a la cárcel directamente.', efecto: { tipo: 'IR_A_CARCEL' } },
  { id: 'C11', tipo: 'COMUNIDAD', texto: 'Pagá factura del hospital: $50.', efecto: { tipo: 'PAGAR', monto: 50 } },
  { id: 'C12', tipo: 'COMUNIDAD', texto: 'Pagá facturas de la escuela: $50.', efecto: { tipo: 'PAGAR', monto: 50 } },
  { id: 'C13', tipo: 'COMUNIDAD', texto: 'Pagá impuesto de $100.', efecto: { tipo: 'PAGAR', monto: 100 } },
  { id: 'C14', tipo: 'COMUNIDAD', texto: 'Reparaciones: $40 por casa y $115 por hotel.', efecto: { tipo: 'PAGAR_POR_EDIFICIOS', porCasa: 40, porHotel: 115 } },
  { id: 'C15', tipo: 'COMUNIDAD', texto: 'Vendiste acciones. Cobrá $45.', efecto: { tipo: 'COBRAR', monto: 45 } },
  { id: 'C16', tipo: 'COMUNIDAD', texto: 'Recibirás $25 de servicios de consultoría.', efecto: { tipo: 'COBRAR', monto: 25 } },
];
