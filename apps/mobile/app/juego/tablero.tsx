import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../src/stores/gameStore';
import { useSocketStore } from '../../src/stores/socketStore';
import type { Jugador, Propiedad } from '@pagadiario/types';
import { NOMBRES_CASILLAS as NOMBRES_CASILLAS_ARRAY, COLORES_GRUPO, GRUPO_POR_CASILLA, TIPO_CASILLA_ICONO } from '../../src/constants/tablero';

const FICHAS_EMOJIS: Record<string, string> = {
  PERRO: '🐕',
  SOMBRERO: '🎩',
  COCHE: '🚗',
  BARCO: '🚢',
  DEDAL: '🧵',
  CARRETILLA: '🛒',
  CABALLO: '🐴',
  PLANCHA: '🪣',
};

interface DetalleAlquiler {
  tipo: 'PROPIEDAD' | 'FERROCARRIL' | 'SERVICIO';
  nombrePropiedad: string;
  monto: number;
  casas?: number;
  hotel?: boolean;
  grupoCompleto?: boolean;
  alquilerBase?: number;
  tablaAlquiler?: number[]; // [0casas, 1casa, 2casas, 3casas, 4casas, hotel]
  totalFerrocarriles?: number;
  totalServicios?: number;
  totalDados?: number;
  multiplicador?: number;
}

interface MovimientoPayload {
  jugadorId: string;
  posicionAnterior: number;
  posicionNueva: number;
  dado1: number;
  dado2: number;
  dobles: boolean;
  accion: string;
  propietarioId?: string;
  monto?: number;
  detalleAlquiler?: DetalleAlquiler;
}

interface TurnoCambioPayload {
  jugadorActivoId: string;
  turnoNumero: number;
}

interface TransaccionPayload {
  jugadorId: string;
  tipo: string;
  monto: number;
  concepto: string;
  saldoNuevo: number;
}

interface CarcelPayload {
  jugadorId: string;
  motivo: string;
}

interface CarcelSalidaPayload {
  jugadorId: string;
  metodo?: string;
  motivo?: string;
}

interface CartaEjecutadaPayload {
  jugadorId: string;
  tipo: string;
  efecto: string;
}

interface ErrorPayload {
  codigo: string;
  mensaje: string;
}

interface BancarrotaPayload {
  jugadorId: string;
  acreedorId: string | null;
}

interface PropiedadCompradaPayload {
  casilla: number;
  propietarioId: string;
  precio: number;
  saldoNuevo?: number;
}

interface ConstruccionActualizadaPayload {
  propiedadId: string;
  casas: number;
  hotel: boolean;
  casasDisponibles: number;
  hotelesDisponibles: number;
}

type TipoModal =
  | 'COMPRAR'
  | 'PAGAR_ALQUILER'
  | 'IMPUESTO'
  | 'CARTA_SUERTE'
  | 'CARTA_COMUNIDAD'
  | null;

interface EstadoModal {
  tipo: TipoModal;
  casilla: number;
  nombreCasilla: string;
  precio: number;
  monto: number;
  propietarioId: string | null;
  nombrePropietario: string | null;
  detalleAlquiler: DetalleAlquiler | null;
}

const MODAL_INICIAL: EstadoModal = {
  tipo: null,
  casilla: 0,
  nombreCasilla: '',
  precio: 0,
  monto: 0,
  propietarioId: null,
  nombrePropietario: null,
  detalleAlquiler: null,
};

const NOMBRES_CASILLAS: Record<number, string> = {
  0: 'Salida',
  1: 'C. Mediterráneo',
  2: 'Caja Comunidad',
  3: 'C. Báltico',
  4: 'Imp. Renta',
  5: 'FC Reading',
  6: 'C. Oriental',
  7: 'Suerte',
  8: 'C. Vermont',
  9: 'C. Connecticut',
  10: 'Cárcel / Visita',
  11: 'C. St. Charles',
  12: 'Cía. Eléctrica',
  13: 'C. States',
  14: 'C. Virginia',
  15: 'FC Pennsylvania',
  16: 'C. St. James',
  17: 'Caja Comunidad',
  18: 'C. Tennessee',
  19: 'C. New York',
  20: 'Parking Gratis',
  21: 'C. Kentucky',
  22: 'Suerte',
  23: 'C. Indiana',
  24: 'C. Illinois',
  25: 'FC B&O',
  26: 'C. Atlantic',
  27: 'C. Ventnor',
  28: 'Cía. de Agua',
  29: 'C. Marvin Gardens',
  30: 'Ve a la Cárcel',
  31: 'C. Pacific',
  32: 'C. North Carolina',
  33: 'Caja Comunidad',
  34: 'C. Pennsylvania',
  35: 'FC Short Line',
  36: 'Suerte',
  37: 'C. Park Place',
  38: 'Imp. de Lujo',
  39: 'Boardwalk',
};

const PRECIOS_CASILLAS: Record<number, number> = {
  1: 60, 3: 60, 5: 200, 6: 100, 8: 100, 9: 120,
  11: 140, 12: 150, 13: 140, 14: 160, 15: 200,
  16: 180, 18: 180, 19: 200, 21: 220, 23: 220, 24: 240,
  25: 200, 26: 260, 27: 260, 28: 150, 29: 280,
  31: 300, 32: 300, 34: 320, 35: 200,
  37: 350, 39: 400,
};

const IMPUESTOS_CASILLAS: Record<number, number> = {
  4: 200,
  38: 100,
};

const ETIQUETAS_ACCION: Record<string, string> = {
  LIBRE: 'Casilla libre',
  COMPRAR: 'Podés comprar esta propiedad',
  PAGAR_ALQUILER: 'Debés pagar alquiler',
  IMPUESTO: 'Debés pagar impuesto',
  CARTA_SUERTE: 'Tomá una carta de Suerte',
  CARTA_COMUNIDAD: 'Tomá una carta de Caja Comunidad',
  CARCEL: 'Vas a la cárcel',
  PARKING: 'Parking Gratis',
  VISITA: 'De visita en la cárcel',
};

const VALORES_DADO = [1, 2, 3, 4, 5, 6];
const DADO_ITEM_HEIGHT = 64;

function DadoPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const idx = value - 1;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * DADO_ITEM_HEIGHT, animated: false });
    }, 50);
  }, []);

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / DADO_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(VALORES_DADO.length - 1, idx));
    onChange(VALORES_DADO[clamped]);
  };

  return (
    <View style={dadoPickerStyles.container}>
      <View style={dadoPickerStyles.highlight} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={DADO_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{  }}
      >
        {VALORES_DADO.map((v) => (
          <View key={v} style={dadoPickerStyles.item}>
            <Text style={[dadoPickerStyles.itemText, v === value && dadoPickerStyles.itemTextSelected]}>
              {v}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const dadoPickerStyles = StyleSheet.create({
  container: {
    width: 80,
    height: DADO_ITEM_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0f3460',
    borderWidth: 2,
    borderColor: '#457b9d',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(69,123,157,0.15)',
    zIndex: 1,
  },
  item: {
    height: DADO_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    color: '#456',
    fontSize: 22,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: 'bold',
  },
});

function parsearDado(valor: number): number {
  return valor;
}

export default function TableroScreen() {
  const {
    partidaId,
    codigo,
    jugadores,
    miJugadorId,
    jugadorActivoId,
    posiciones,
    saldos,
    propiedades,
    turnoConfirmado,
    setEstado,
  } = useGameStore();

  const { emitir, escuchar, conectar, conectado } = useSocketStore();

  const [dado1, setDado1] = useState(1);
  const [dado2, setDado2] = useState(1);
  const [ultimaAccion, setUltimaAccion] = useState<string | null>(null);
  const [mensajeCarcel, setMensajeCarcel] = useState<string | null>(null);
  const [modal, setModal] = useState<EstadoModal>(MODAL_INICIAL);
  const [textoCarta, setTextoCarta] = useState<string | null>(null);
  const [cartaUsada, setCartaUsada] = useState(false);
  const [notificacionCompra, setNotificacionCompra] = useState<{
    nombre: string;
    precio: number;
    saldoNuevo: number;
  } | null>(null);
  const notificacionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const escuchando = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const dadosPanelRef = useRef<View>(null);

  const esMiTurno = miJugadorId !== null && miJugadorId === jugadorActivoId;

  const cerrarModal = () => setModal(MODAL_INICIAL);

  useEffect(() => {
    if (escuchando.current) return;
    escuchando.current = true;

    console.log('[TABLERO] useEffect montado. conectado:', conectado, 'codigo:', codigo, 'miJugadorId:', miJugadorId, 'jugadorActivoId:', jugadorActivoId);

    // Reconectar socket si espera.tsx lo desconectó al hacer unmount
    if (!conectado && codigo && miJugadorId) {
      console.log('[TABLERO] Socket desconectado, reconectando...');
      conectar(codigo, miJugadorId);
    } else {
      console.log('[TABLERO] Socket ya conectado, no reconecta.');
    }

    escuchar('tablero:movimiento', (data) => {
      const payload = data as MovimientoPayload;
      const estadoActual = useGameStore.getState();

      setEstado({
        posiciones: {
          ...estadoActual.posiciones,
          [payload.jugadorId]: payload.posicionNueva,
        },
      });

      const etiqueta = ETIQUETAS_ACCION[payload.accion] ?? payload.accion;
      const casilla = NOMBRES_CASILLAS[payload.posicionNueva] ?? `Casilla ${payload.posicionNueva}`;
      setUltimaAccion(
        `${payload.dado1}+${payload.dado2}${payload.dobles ? ' (DOBLES)' : ''} → ${casilla}: ${etiqueta}`,
      );

      if (payload.jugadorId === estadoActual.miJugadorId) {
        setEstado({ turnoConfirmado: true });

        // Mostrar modal según acción, solo si es mi movimiento
        const accion = payload.accion;

        if (accion === 'COMPRAR') {
          const precio = PRECIOS_CASILLAS[payload.posicionNueva] ?? 0;
          setModal({
            tipo: 'COMPRAR',
            casilla: payload.posicionNueva,
            nombreCasilla: NOMBRES_CASILLAS[payload.posicionNueva] ?? `Casilla ${payload.posicionNueva}`,
            precio,
            monto: precio,
            propietarioId: null,
            nombrePropietario: null,
          });
        } else if (accion === 'PAGAR_ALQUILER' && payload.propietarioId) {
          const propietario = estadoActual.jugadores.find(
            (j) => j.id === payload.propietarioId,
          );
          setModal({
            tipo: 'PAGAR_ALQUILER',
            casilla: payload.posicionNueva,
            nombreCasilla: NOMBRES_CASILLAS[payload.posicionNueva] ?? `Casilla ${payload.posicionNueva}`,
            precio: 0,
            monto: payload.monto ?? 0,
            propietarioId: payload.propietarioId,
            nombrePropietario: propietario?.nombre ?? 'otro jugador',
            detalleAlquiler: payload.detalleAlquiler ?? null,
          });
        } else if (accion === 'IMPUESTO') {
          const monto = IMPUESTOS_CASILLAS[payload.posicionNueva] ?? payload.monto ?? 0;
          setModal({
            tipo: 'IMPUESTO',
            casilla: payload.posicionNueva,
            nombreCasilla: NOMBRES_CASILLAS[payload.posicionNueva] ?? `Casilla ${payload.posicionNueva}`,
            precio: 0,
            monto,
            propietarioId: null,
            nombrePropietario: null,
          });
        } else if (accion === 'CARTA_SUERTE') {
          setModal({
            tipo: 'CARTA_SUERTE',
            casilla: payload.posicionNueva,
            nombreCasilla: 'Suerte',
            precio: 0,
            monto: 0,
            propietarioId: null,
            nombrePropietario: null,
          });
        } else if (accion === 'CARTA_COMUNIDAD') {
          setModal({
            tipo: 'CARTA_COMUNIDAD',
            casilla: payload.posicionNueva,
            nombreCasilla: 'Caja Comunidad',
            precio: 0,
            monto: 0,
            propietarioId: null,
            nombrePropietario: null,
          });
        }
      }
    });

    escuchar('turno:cambio', (data) => {
      const payload = data as TurnoCambioPayload;
      setEstado({
        jugadorActivoId: payload.jugadorActivoId,
        turnoConfirmado: false,
      });
      setUltimaAccion(null);
      setMensajeCarcel(null);
      setTextoCarta(null);
      setCartaUsada(false);
      cerrarModal();
    });

    escuchar('economia:transaccion', (data) => {
      const payload = data as TransaccionPayload;
      const estadoActual = useGameStore.getState();
      const nuevaTransaccion = {
        id: `${payload.jugadorId}_${Date.now()}`,
        jugadorId: payload.jugadorId,
        tipo: payload.tipo,
        monto: payload.monto,
        concepto: payload.concepto,
        creadaEn: new Date().toISOString(),
      };
      setEstado({
        saldos: {
          ...estadoActual.saldos,
          [payload.jugadorId]: payload.saldoNuevo,
        },
        transacciones: [nuevaTransaccion, ...estadoActual.transacciones],
      });
    });

    escuchar('carcel:entrada', (data) => {
      const payload = data as CarcelPayload;
      const estadoActual = useGameStore.getState();
      const jugador = estadoActual.jugadores.find((j) => j.id === payload.jugadorId);
      const nombre = jugador?.nombre ?? 'Un jugador';
      setMensajeCarcel(`¡${nombre} fue a la cárcel!`);
      setEstado({
        jugadores: estadoActual.jugadores.map((j) =>
          j.id === payload.jugadorId ? { ...j, enCarcel: true, posicion: 10 } : j,
        ),
      });
    });

    escuchar('carcel:salida', (data) => {
      const payload = data as CarcelSalidaPayload;
      const estadoActual = useGameStore.getState();
      const jugador = estadoActual.jugadores.find((j) => j.id === payload.jugadorId);
      const nombre = jugador?.nombre ?? 'Un jugador';
      const clave = payload.metodo ?? payload.motivo ?? '';
      const descripcion =
        clave === 'DOBLES'
          ? 'sacó dobles'
          : clave === 'PAGO'
            ? 'pagó la fianza'
            : clave === 'CARTA'
              ? 'usó una carta de salida'
              : 'salió';
      setMensajeCarcel(`${nombre} ${descripcion} y salió de la cárcel.`);

      // Actualizar cartaSalida en el store si es el jugador propio y usó carta
      if (payload.jugadorId === estadoActual.miJugadorId && clave === 'CARTA') {
        setEstado({
          jugadores: estadoActual.jugadores.map((j) =>
            j.id === payload.jugadorId ? { ...j, enCarcel: false, cartaSalida: false } : j,
          ),
        });
      } else if (payload.jugadorId === estadoActual.miJugadorId) {
        setEstado({
          jugadores: estadoActual.jugadores.map((j) =>
            j.id === payload.jugadorId ? { ...j, enCarcel: false } : j,
          ),
        });
      }
    });

    escuchar('propiedad:comprada', (data) => {
      const payload = data as PropiedadCompradaPayload;
      const estadoActual = useGameStore.getState();
      const yaExiste = estadoActual.propiedades.some(
        (p) => p.casilla === payload.casilla,
      );
      if (!yaExiste) {
        const nuevaPropiedad: Propiedad = {
          id: `temp_${payload.casilla}`,
          casilla: payload.casilla,
          propietarioId: payload.propietarioId,
          casas: 0,
          hotel: false,
          hipotecada: false,
        };
        setEstado({
          propiedades: [...estadoActual.propiedades, nuevaPropiedad],
        });
      }
      if (payload.propietarioId === estadoActual.miJugadorId) {
        const nombreCasilla = NOMBRES_CASILLAS_ARRAY[payload.casilla] ?? `Casilla ${payload.casilla}`;
        const precio = payload.precio ?? PRECIOS_CASILLAS[payload.casilla] ?? 0;
        const saldoNuevo = payload.saldoNuevo ?? (estadoActual.saldos[payload.propietarioId] ?? 0) - precio;
        if (notificacionTimer.current) clearTimeout(notificacionTimer.current);
        setNotificacionCompra({ nombre: nombreCasilla, precio, saldoNuevo });
        notificacionTimer.current = setTimeout(() => setNotificacionCompra(null), 4000);
      }
    });

    escuchar('construccion:actualizada', (data) => {
      const payload = data as ConstruccionActualizadaPayload;
      setEstado({
        propiedades: useGameStore.getState().propiedades.map((p) =>
          p.id === payload.propiedadId
            ? { ...p, casas: payload.casas, hotel: payload.hotel }
            : p,
        ),
        casasDisponibles: payload.casasDisponibles,
        hotelesDisponibles: payload.hotelesDisponibles,
      });
    });

    escuchar('carta:ejecutada', (data) => {
      const payload = data as CartaEjecutadaPayload;
      setTextoCarta(payload.efecto);
    });

    escuchar('error:accion', (data) => {
      const payload = data as ErrorPayload;
      Alert.alert('Error', payload.mensaje);
    });

    escuchar('jugador:bancarrota', (data) => {
      const payload = data as BancarrotaPayload;
      const estadoActual = useGameStore.getState();
      const jugador = estadoActual.jugadores.find(
        (j) => j.id === payload.jugadorId,
      );
      const nombre = jugador?.nombre ?? 'Un jugador';

      if (payload.jugadorId === estadoActual.miJugadorId) {
        Alert.alert('Fuiste eliminado', 'Declaraste bancarrota y quedaste fuera de la partida.');
      } else {
        Alert.alert('Jugador eliminado', `${nombre} fue eliminado por bancarrota.`);
      }

      // Marcar jugador como eliminado en el store
      setEstado({
        jugadores: estadoActual.jugadores.map((j) =>
          j.id === payload.jugadorId ? { ...j, eliminado: true } : j,
        ),
      });
    });


    escuchar('juego:reconexion', (data) => {
      const payload = data as {
        jugadores: Jugador[];
        posiciones: Record<string, number>;
        saldos: Record<string, number>;
        jugadorActivoId: string;
        propiedades: Propiedad[];
        casasDisponibles: number;
        hotelesDisponibles: number;
        transacciones: Array<{
          id: string;
          jugadorId: string;
          tipo: string;
          monto: number;
          concepto: string;
          creadaEn: string;
        }>;
      };
      setEstado({
        jugadores: payload.jugadores,
        posiciones: payload.posiciones,
        saldos: payload.saldos,
        jugadorActivoId: payload.jugadorActivoId,
        propiedades: payload.propiedades,
        casasDisponibles: payload.casasDisponibles,
        hotelesDisponibles: payload.hotelesDisponibles,
        transacciones: payload.transacciones,
      });
    });
  }, [escuchar, setEstado]);

  const handleConfirmarDados = () => {
    if (!partidaId) return;
    emitir('turno:dados', { partidaId, dado1, dado2 });
  };

  const handleTerminarTurno = () => {
    if (!partidaId) return;
    emitir('turno:terminar', { partidaId });
  };

  const handleComprarPropiedad = () => {
    if (!partidaId) return;
    emitir('propiedad:comprar', { partidaId, casilla: modal.casilla });
    cerrarModal();
  };

  const handleRechazarPropiedad = () => {
    if (!partidaId) return;
    emitir('propiedad:rechazar', { partidaId, casilla: modal.casilla });
    cerrarModal();
  };

  const handlePagarAlquiler = () => {
    if (!partidaId || !modal.propietarioId) return;
    emitir('economia:pagarAlquiler', {
      partidaId,
      propietarioId: modal.propietarioId,
      monto: modal.monto,
    });
    cerrarModal();
  };

  const handlePagarImpuesto = () => {
    if (!partidaId) return;
    // Pago de impuesto al banco (propietarioId = jugadorId para evitar error, monto al banco)
    // El backend trata propietarioId nulo como banco, pero la firma requiere un id.
    // Enviamos el mismo jugadorId como propietario y el gateway no transfiere saldo a nadie.
    // En realidad enviaremos el evento con propietarioId vacío, y el gateway lo manejará.
    emitir('economia:pagarAlquiler', {
      partidaId,
      propietarioId: '',
      monto: modal.monto,
    });
    cerrarModal();
  };

  const handleRobarCarta = () => {
    if (!partidaId || cartaUsada) return;
    const tipo = modal.tipo === 'CARTA_SUERTE' ? 'SUERTE' : 'COMUNIDAD';
    emitir('carta:ejecutar', { partidaId, tipo });
    setCartaUsada(true);
  };

  const handleCarcelPagarMulta = () => {
    if (!partidaId) return;
    emitir('carcel:pagarMulta', { partidaId });
  };

  const handleCarcelUsarCarta = () => {
    if (!partidaId) return;
    emitir('carcel:usarCarta', { partidaId });
  };

  const handleDeclararBancarrota = () => {
    if (!partidaId) return;
    Alert.alert(
      'Declarar bancarrota',
      'Vas a declarar bancarrota voluntaria. Perderás todas tus propiedades y serás eliminado. ¿Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Declarar bancarrota',
          style: 'destructive',
          onPress: () => {
            emitir('jugador:declarar_bancarrota', { partidaId });
          },
        },
      ],
    );
  };

  const jugadorActivo = jugadores.find((j) => j.id === jugadorActivoId);
  const nombreActivo = jugadorActivo?.nombre ?? '...';
  const miJugador = jugadores.find((j) => j.id === miJugadorId);
  const estoyEnCarcel = miJugador?.enCarcel === true;
  const tengoCartaSalida = miJugador?.cartaSalida === true;

  // Verificar si la casilla del modal ya tiene propietario
  const casillaConPropietario = propiedades.find(
    (p) => p.casilla === modal.casilla && p.propietarioId !== null,
  );

  return (
    <SafeAreaView style={styles.screenWrapper} edges={['top']}>
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Indicador de turno */}
      <View style={styles.turnoContainer}>
        {esMiTurno ? (
          <Text style={styles.turnoPropio}>Tu turno</Text>
        ) : (
          <Text style={styles.turnoAjeno}>Turno de {nombreActivo}</Text>
        )}
      </View>

      {/* Panel de cárcel (solo si es mi turno, estoy en cárcel y no tiré dados aún) */}
      {esMiTurno && estoyEnCarcel && !turnoConfirmado && (
        <View style={styles.carcelPanel}>
          <Text style={styles.seccionTitulo}>Estás en la cárcel</Text>
          <Text style={styles.carcelPanelTexto}>
            Podés pagar $50, usar tu carta de salida, o intentar sacar dobles con los dados.
          </Text>
          <View style={styles.carcelPanelBotones}>
            <TouchableOpacity
              style={styles.botonCarcelPagar}
              onPress={handleCarcelPagarMulta}
            >
              <Text style={styles.botonTexto}>Pagar $50</Text>
            </TouchableOpacity>
            {tengoCartaSalida && (
              <TouchableOpacity
                style={styles.botonCarcelCarta}
                onPress={handleCarcelUsarCarta}
              >
                <Text style={styles.botonTexto}>Usar carta de salida</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Panel de dados (solo si es mi turno y no confirmé aún) */}
      {esMiTurno && !turnoConfirmado && (
        <View ref={dadosPanelRef} style={styles.dadosPanel}>
          <Text style={styles.seccionTitulo}>Tirá los dados</Text>
          <View style={styles.dadosRow}>
            <View style={styles.dadoItem}>
              <Text style={styles.dadoLabel}>Dado 1</Text>
              <DadoPicker value={dado1} onChange={setDado1} />
            </View>
            <View style={styles.dadoTotalContainer}>
              <Text style={styles.dadoTotalLabel}>Total</Text>
              <Text style={styles.dadoTotalValor}>{dado1 + dado2}</Text>
            </View>
            <View style={styles.dadoItem}>
              <Text style={styles.dadoLabel}>Dado 2</Text>
              <DadoPicker value={dado2} onChange={setDado2} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.botonConfirmar}
            onPress={handleConfirmarDados}
          >
            <Text style={styles.botonTexto}>Confirmar dados</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Última acción */}
      {ultimaAccion && (
        <View style={styles.accionContainer}>
          <Text style={styles.accionTexto}>{ultimaAccion}</Text>
        </View>
      )}

      {/* Texto de carta robada */}
      {textoCarta && (
        <View style={styles.cartaContainer}>
          <Text style={styles.cartaTitulo}>Carta robada</Text>
          <Text style={styles.cartaTexto}>{textoCarta}</Text>
        </View>
      )}

      {/* Badge dobles — pulsar para tirar de nuevo */}
      {esMiTurno && turnoConfirmado && parsearDado(dado1) === parsearDado(dado2) && (
        <TouchableOpacity
          style={styles.doblesBadge}
          onPress={() => {
            setDado1(1);
            setDado2(1);
            setEstado({ turnoConfirmado: false });
          }}
        >
          <Text style={styles.doblesTexto}>¡Dobles! Toca aquí para tirar de nuevo</Text>
        </TouchableOpacity>
      )}

      {/* Mensaje de cárcel */}
      {mensajeCarcel && (
        <View style={styles.carcelContainer}>
          <Text style={styles.carcelTexto}>{mensajeCarcel}</Text>
        </View>
      )}

      {/* Botón terminar turno */}
      {esMiTurno && turnoConfirmado && (
        <TouchableOpacity
          style={styles.botonTerminar}
          onPress={handleTerminarTurno}
        >
          <Text style={styles.botonTexto}>Terminar turno</Text>
        </TouchableOpacity>
      )}

      {/* Botón declarar bancarrota (solo visible en mi turno) */}
      {esMiTurno && (
        <TouchableOpacity
          style={styles.botonBancarrota}
          onPress={handleDeclararBancarrota}
        >
          <Text style={styles.botonTexto}>Declarar bancarrota</Text>
        </TouchableOpacity>
      )}

      {/* Lista de casillas del tablero */}
      <View style={styles.tableroPanel}>
        <Text style={styles.seccionTitulo}>Tablero</Text>
        {NOMBRES_CASILLAS_ARRAY.map((nombre, posicion) => {
          const miPosicion = posiciones[miJugadorId ?? ''] ?? 0;
          const esMiCasilla = posicion === miPosicion;
          const grupo = GRUPO_POR_CASILLA[posicion];
          const colorGrupo = grupo ? COLORES_GRUPO[grupo] : null;
          const icono = TIPO_CASILLA_ICONO[posicion];
          const jugadoresAqui = jugadores.filter(
            (j) => !j.eliminado && (posiciones[j.id] ?? 0) === posicion,
          );
          return (
            <View
              key={posicion}
              style={[styles.casillaFila, esMiCasilla && styles.casillaFilaActiva]}
            >
              <Text style={[styles.casillaNumero, esMiCasilla && styles.casillaNumeroActivo]}>
                {posicion}
              </Text>
              {colorGrupo ? (
                <View style={[styles.casillaColorDot, { backgroundColor: colorGrupo }]} />
              ) : (
                <Text style={styles.casillaIcono}>{icono ?? '  '}</Text>
              )}
              <Text
                style={[styles.casillaNombre, esMiCasilla && styles.casillaNombreActivo]}
                numberOfLines={esMiCasilla ? undefined : 1}
              >
                {nombre}
              </Text>
              {jugadoresAqui.length > 0 && (
                <Text style={styles.casillaFichas}>
                  {jugadoresAqui.map((j) => FICHAS_EMOJIS[j.ficha] ?? '?').join('')}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Modal de acción de casilla */}
      <Modal
        visible={modal.tipo !== null && esMiTurno}
        transparent
        animationType="fade"
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {modal.tipo === 'COMPRAR' && (
              <>
                <Text style={styles.modalTitulo}>
                  {casillaConPropietario ? 'Propiedad con dueño' : 'Propiedad disponible'}
                </Text>
                <Text style={styles.modalSubtitulo}>{modal.nombreCasilla}</Text>
                {casillaConPropietario ? (
                  <>
                    <View style={styles.facturaBox}>
                      <View style={styles.facturaFila}>
                        <Text style={styles.facturaConcepto}>Propietario</Text>
                        <Text style={styles.facturaValor}>
                          {jugadores.find((j) => j.id === casillaConPropietario.propietarioId)?.nombre ?? 'otro jugador'}
                        </Text>
                      </View>
                      {casillaConPropietario.hotel ? (
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Mejoras</Text>
                          <Text style={styles.facturaValorDestacado}>🏨 Hotel</Text>
                        </View>
                      ) : casillaConPropietario.casas > 0 ? (
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Mejoras</Text>
                          <Text style={styles.facturaValorDestacado}>🏠 {casillaConPropietario.casas} casa{casillaConPropietario.casas > 1 ? 's' : ''}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.modalTexto}>
                      No podés comprar esta propiedad, ya tiene dueño.
                    </Text>
                    <View style={styles.modalBotones}>
                      <TouchableOpacity
                        style={styles.modalBotonSecundario}
                        onPress={cerrarModal}
                      >
                        <Text style={styles.modalBotonTexto}>Cerrar</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalTexto}>
                      Precio: ${modal.precio}
                    </Text>
                    <View style={styles.modalBotones}>
                      <TouchableOpacity
                        style={styles.modalBotonPrincipal}
                        onPress={handleComprarPropiedad}
                      >
                        <Text style={styles.modalBotonTexto}>Comprar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalBotonSecundario}
                        onPress={handleRechazarPropiedad}
                      >
                        <Text style={styles.modalBotonTexto}>Subasta</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            {modal.tipo === 'PAGAR_ALQUILER' && (
              <>
                <Text style={styles.modalTitulo}>Propiedad con dueño</Text>
                <Text style={styles.modalSubtitulo}>{modal.nombreCasilla}</Text>
                <Text style={styles.facturaArrendador}>
                  Propietario: {modal.nombrePropietario ?? 'otro jugador'}
                </Text>

                {modal.detalleAlquiler && (
                  <View style={styles.facturaBox}>
                    {modal.detalleAlquiler.tipo === 'PROPIEDAD' && (
                      <>
                        {modal.detalleAlquiler.tablaAlquiler ? (
                          <>
                            {[
                              { label: 'Sin casas', idx: 0, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 0 && !modal.detalleAlquiler.grupoCompleto },
                              { label: 'Monopolio', idx: 0, esMonopolio: true, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 0 && !!modal.detalleAlquiler.grupoCompleto },
                              { label: '1 casa', idx: 1, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 1 },
                              { label: '2 casas', idx: 2, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 2 },
                              { label: '3 casas', idx: 3, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 3 },
                              { label: '4 casas', idx: 4, activo: !modal.detalleAlquiler.hotel && (modal.detalleAlquiler.casas ?? 0) === 4 },
                              { label: 'Hotel', idx: 5, activo: !!modal.detalleAlquiler.hotel },
                            ].map((fila) => {
                              const valor = fila.esMonopolio
                                ? (modal.detalleAlquiler!.tablaAlquiler![0] ?? 0) * 2
                                : (modal.detalleAlquiler!.tablaAlquiler![fila.idx] ?? 0);
                              return (
                                <View key={fila.label} style={[styles.facturaFila, fila.activo && styles.facturaFilaActiva]}>
                                  <Text style={[styles.facturaConcepto, fila.activo && styles.facturaConceptoActivo]}>
                                    {fila.activo ? '▶ ' : ''}{fila.label}
                                  </Text>
                                  <Text style={[styles.facturaValor, fila.activo && styles.facturaValorActivo]}>
                                    ${valor}
                                  </Text>
                                </View>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <View style={styles.facturaFila}>
                              <Text style={styles.facturaConcepto}>Alquiler base</Text>
                              <Text style={styles.facturaValor}>${modal.detalleAlquiler.alquilerBase}</Text>
                            </View>
                            {modal.detalleAlquiler.hotel ? (
                              <View style={styles.facturaFila}>
                                <Text style={styles.facturaConcepto}>Hotel</Text>
                                <Text style={styles.facturaValorDestacado}>+bonus hotel</Text>
                              </View>
                            ) : modal.detalleAlquiler.casas && modal.detalleAlquiler.casas > 0 ? (
                              <View style={styles.facturaFila}>
                                <Text style={styles.facturaConcepto}>{modal.detalleAlquiler.casas} casa{modal.detalleAlquiler.casas > 1 ? 's' : ''}</Text>
                                <Text style={styles.facturaValorDestacado}>+${modal.detalleAlquiler.monto - (modal.detalleAlquiler.alquilerBase ?? 0)}</Text>
                              </View>
                            ) : modal.detalleAlquiler.grupoCompleto ? (
                              <View style={styles.facturaFila}>
                                <Text style={styles.facturaConcepto}>Monopolio completo</Text>
                                <Text style={styles.facturaValorDestacado}>×2</Text>
                              </View>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                    {modal.detalleAlquiler.tipo === 'FERROCARRIL' && (
                      <>
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Ferrocarriles del dueño</Text>
                          <Text style={styles.facturaValor}>{modal.detalleAlquiler.totalFerrocarriles} de 4</Text>
                        </View>
                        <View style={styles.facturaDivisor} />
                        {[
                          { label: '1 FC', monto: 25, activo: modal.detalleAlquiler.totalFerrocarriles === 1 },
                          { label: '2 FC', monto: 50, activo: modal.detalleAlquiler.totalFerrocarriles === 2 },
                          { label: '3 FC', monto: 100, activo: modal.detalleAlquiler.totalFerrocarriles === 3 },
                          { label: '4 FC', monto: 200, activo: modal.detalleAlquiler.totalFerrocarriles === 4 },
                        ].map((fila) => (
                          <View key={fila.label} style={[styles.facturaFila, fila.activo && styles.facturaFilaActiva]}>
                            <Text style={[styles.facturaConcepto, fila.activo && styles.facturaConceptoActivo]}>
                              {fila.activo ? '▶ ' : ''}{fila.label}
                            </Text>
                            <Text style={[styles.facturaValor, fila.activo && styles.facturaValorActivo]}>
                              ${fila.monto}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                    {modal.detalleAlquiler.tipo === 'SERVICIO' && (
                      <>
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Servicios del dueño</Text>
                          <Text style={styles.facturaValor}>{modal.detalleAlquiler.totalServicios} de 2</Text>
                        </View>
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Multiplicador actual</Text>
                          <Text style={styles.facturaValor}>×{modal.detalleAlquiler.multiplicador}</Text>
                        </View>
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>Dados ({modal.detalleAlquiler.totalDados})</Text>
                          <Text style={styles.facturaValor}>{modal.detalleAlquiler.totalDados} × {modal.detalleAlquiler.multiplicador}</Text>
                        </View>
                        <View style={styles.facturaDivisor} />
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>1 servicio</Text>
                          <Text style={styles.facturaValor}>dados ×4</Text>
                        </View>
                        <View style={styles.facturaFila}>
                          <Text style={styles.facturaConcepto}>2 servicios</Text>
                          <Text style={styles.facturaValor}>dados ×10</Text>
                        </View>
                      </>
                    )}
                    <View style={styles.facturaDivisor} />
                    <View style={styles.facturaFila}>
                      <Text style={styles.facturaTotal}>TOTAL A PAGAR</Text>
                      <Text style={styles.facturaTotalValor}>${modal.monto}</Text>
                    </View>
                  </View>
                )}

                {!modal.detalleAlquiler && (
                  <Text style={styles.modalTexto}>
                    Debés pagar ${modal.monto} de alquiler.
                  </Text>
                )}

                <View style={styles.modalBotones}>
                  <TouchableOpacity
                    style={styles.modalBotonPrincipal}
                    onPress={handlePagarAlquiler}
                  >
                    <Text style={styles.modalBotonTexto}>Pagar ${modal.monto}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {modal.tipo === 'IMPUESTO' && (
              <>
                <Text style={styles.modalTitulo}>Impuesto</Text>
                <Text style={styles.modalSubtitulo}>{modal.nombreCasilla}</Text>
                <Text style={styles.modalTexto}>
                  Debés pagar un impuesto de ${modal.monto}.
                </Text>
                <TouchableOpacity
                  style={styles.modalBotonPrincipal}
                  onPress={handlePagarImpuesto}
                >
                  <Text style={styles.modalBotonTexto}>Pagar</Text>
                </TouchableOpacity>
              </>
            )}

            {(modal.tipo === 'CARTA_SUERTE' ||
              modal.tipo === 'CARTA_COMUNIDAD') && (
              <>
                <Text style={styles.modalTitulo}>
                  {modal.tipo === 'CARTA_SUERTE'
                    ? '🍀 Carta de Suerte'
                    : '🏦 Caja Comunidad'}
                </Text>
                <Text style={styles.modalTexto}>
                  {textoCarta
                    ? textoCarta
                    : 'Tocá el botón para robar una carta del mazo.'}
                </Text>
                <View style={styles.modalBotones}>
                  <TouchableOpacity
                    style={[
                      styles.modalBotonPrincipal,
                      cartaUsada && styles.modalBotonDeshabilitado,
                    ]}
                    onPress={handleRobarCarta}
                    disabled={cartaUsada}
                  >
                    <Text style={styles.modalBotonTexto}>
                      {cartaUsada ? '✓ Carta robada' : 'Robar carta'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {cartaUsada && textoCarta && (
                  <View style={styles.modalBotones}>
                    <TouchableOpacity
                      style={styles.modalBotonSecundario}
                      onPress={cerrarModal}
                    >
                      <Text style={styles.modalBotonTexto}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Notificación de propiedad comprada */}
    {notificacionCompra && (
      <View style={styles.notifOverlay} pointerEvents="box-none">
        <View style={styles.notifCard}>
          <View style={styles.notifIconContainer}>
            <Text style={styles.notifIcon}>🏠</Text>
          </View>
          <View style={styles.notifContent}>
            <Text style={styles.notifTitulo}>Propiedad comprada</Text>
            <Text style={styles.notifNombre}>{notificacionCompra.nombre}</Text>
            <View style={styles.notifFila}>
              <Text style={styles.notifEtiqueta}>Precio</Text>
              <Text style={styles.notifPrecio}>-${notificacionCompra.precio}</Text>
            </View>
            <View style={styles.notifFila}>
              <Text style={styles.notifEtiqueta}>Saldo restante</Text>
              <Text style={styles.notifSaldo}>${notificacionCompra.saldoNuevo}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notifCerrar}
            onPress={() => {
              if (notificacionTimer.current) clearTimeout(notificacionTimer.current);
              setNotificacionCompra(null);
            }}
          >
            <Text style={styles.notifCerrarTexto}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  turnoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#333',
  },
  turnoPropio: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  turnoAjeno: {
    fontSize: 18,
    color: '#aaaaaa',
  },
  dadosPanel: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  dadosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dadoItem: {
    alignItems: 'center',
    gap: 6,
  },
  dadoLabel: {
    color: '#aaaaaa',
    fontSize: 13,
  },
  dadoTotalContainer: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  dadoTotalLabel: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  dadoTotalValor: {
    color: '#f4d03f',
    fontSize: 36,
    fontWeight: 'bold',
    minWidth: 48,
    textAlign: 'center',
  },
  botonConfirmar: {
    backgroundColor: '#457b9d',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonTerminar: {
    backgroundColor: '#e63946',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonBancarrota: {
    backgroundColor: '#7c2d12',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  accionContainer: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#457b9d',
  },
  accionTexto: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  carcelContainer: {
    backgroundColor: '#2a1a1e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e63946',
  },
  carcelTexto: {
    color: '#e63946',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableroPanel: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 4,
  },
  casillaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
    gap: 8,
  },
  casillaFilaActiva: {
    backgroundColor: '#1a3a4e',
    borderWidth: 2,
    borderColor: '#f4d03f',
    paddingVertical: 12,
  },
  casillaNumero: {
    color: '#666',
    fontSize: 11,
    width: 22,
    textAlign: 'right',
  },
  casillaNumeroActivo: {
    color: '#f4d03f',
    fontSize: 13,
    fontWeight: '700',
  },
  casillaColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  casillaIcono: {
    fontSize: 12,
    width: 18,
    textAlign: 'center',
  },
  casillaNombre: {
    flex: 1,
    color: '#cccccc',
    fontSize: 13,
  },
  casillaNombreActivo: {
    color: '#f4d03f',
    fontSize: 16,
    fontWeight: '700',
  },
  casillaFichas: {
    fontSize: 14,
    letterSpacing: 1,
  },
  doblesBadge: {
    backgroundColor: '#14532d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#4caf50',
    alignItems: 'center',
  },
  doblesTexto: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#457b9d',
    gap: 12,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalSubtitulo: {
    fontSize: 16,
    color: '#4caf50',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalTexto: {
    fontSize: 15,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBotonPrincipal: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBotonSecundario: {
    flex: 1,
    backgroundColor: '#457b9d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBotonTexto: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBotonDeshabilitado: {
    backgroundColor: '#555555',
  },
  facturaArrendador: {
    fontSize: 13,
    color: '#aaaaaa',
    textAlign: 'center',
    marginBottom: 4,
  },
  facturaBox: {
    width: '100%',
    backgroundColor: '#0d1a2e',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2a4a6e',
  },
  facturaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
  },
  facturaFilaActiva: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  facturaConcepto: {
    color: '#aaaaaa',
    fontSize: 13,
    flex: 1,
  },
  facturaConceptoActivo: {
    color: '#4caf50',
    fontWeight: '600',
  },
  facturaValor: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '500',
  },
  facturaValorActivo: {
    color: '#4caf50',
    fontWeight: '700',
  },
  facturaValorDestacado: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
  },
  facturaDivisor: {
    height: 1,
    backgroundColor: '#2a4a6e',
    marginVertical: 4,
  },
  facturaTotal: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  facturaTotalValor: {
    color: '#e63946',
    fontSize: 18,
    fontWeight: '800',
  },
  cartaContainer: {
    backgroundColor: '#1a2e1a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4caf50',
    gap: 6,
  },
  cartaTitulo: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cartaTexto: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  carcelPanel: {
    backgroundColor: '#2a1a1e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e63946',
    gap: 12,
  },
  carcelPanelTexto: {
    color: '#cccccc',
    fontSize: 13,
    lineHeight: 20,
  },
  carcelPanelBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  botonCarcelPagar: {
    flex: 1,
    backgroundColor: '#e63946',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonCarcelCarta: {
    flex: 1,
    backgroundColor: '#457b9d',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  notifOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  notifCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d6a4f',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  notifIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f3020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: {
    fontSize: 22,
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifTitulo: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  notifNombre: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  notifFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifEtiqueta: {
    color: '#888',
    fontSize: 12,
  },
  notifPrecio: {
    color: '#e63946',
    fontSize: 13,
    fontWeight: '700',
  },
  notifSaldo: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  notifCerrar: {
    padding: 6,
  },
  notifCerrarTexto: {
    color: '#666',
    fontSize: 16,
  },
});
