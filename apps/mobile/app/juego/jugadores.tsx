import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../src/stores/gameStore';
import { useSocketStore } from '../../src/stores/socketStore';
import type { Jugador, Propiedad, SubastaActiva } from '@pagadiario/types';
import {
  NOMBRES_CASILLAS as NOMBRES_CASILLAS_ARR,
  COLORES_GRUPO,
  GRUPO_POR_CASILLA,
} from '../../src/constants/tablero';

// ─── Payload types ─────────────────────────────────────────────────────────

interface NegociacionPropuestaPayload {
  negociacionId: string;
  remitenteId: string;
  detalles: {
    propiedadesOfrecidas: string[];
    propiedadesRequeridas: string[];
    dineroOfrecido: number;
    dineroRequerido: number;
  };
}

interface NegociacionResueltaPayload {
  negociacionId: string;
  aceptada: boolean;
}

interface PropiedadCompradaPayload {
  casilla: number;
  propietarioId: string;
  precio: number;
}

interface TransaccionPayload {
  jugadorId: string;
  tipo: string;
  monto: number;
  concepto: string;
  saldoNuevo: number;
}

interface BancarrotaPayload {
  jugadorId: string;
  acreedorId: string | null;
}

interface PropiedadTransferidaPayload {
  propiedadId: string;
  casilla: number;
  nuevoPropietarioId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const NOMBRES_CASILLAS: Record<number, string> = {
  1: 'C. Mediterráneo',
  3: 'C. Báltico',
  5: 'FC Reading',
  6: 'C. Oriental',
  8: 'C. Vermont',
  9: 'C. Connecticut',
  11: 'C. St. Charles',
  12: 'Cía. Eléctrica',
  13: 'C. States',
  14: 'C. Virginia',
  15: 'FC Pennsylvania',
  16: 'C. St. James',
  18: 'C. Tennessee',
  19: 'C. New York',
  21: 'C. Kentucky',
  23: 'C. Indiana',
  24: 'C. Illinois',
  25: 'FC B&O',
  26: 'C. Atlantic',
  27: 'C. Ventnor',
  28: 'Cía. de Agua',
  29: 'C. Marvin Gardens',
  31: 'C. Pacific',
  32: 'C. North Carolina',
  34: 'C. Pennsylvania',
  35: 'FC Short Line',
  37: 'C. Park Place',
  39: 'Boardwalk',
};

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

function nombreCasilla(casilla: number): string {
  return NOMBRES_CASILLAS[casilla] ?? `Casilla ${casilla}`;
}

function segundosRestantes(expiraEn: number): number {
  return Math.max(0, Math.floor((expiraEn - Date.now()) / 1000));
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface ModalSubastaActivaProps {
  subasta: SubastaActiva;
  miJugadorId: string;
  jugadores: Jugador[];
  onPujar: (monto: number) => void;
  visible: boolean;
}

function ModalSubastaActiva({ subasta, miJugadorId, jugadores, onPujar, visible }: ModalSubastaActivaProps) {
  const [segundos, setSegundos] = useState(() => segundosRestantes(subasta.expiraEn));
  const [montoPuja, setMontoPuja] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const s = segundosRestantes(subasta.expiraEn);
      setSegundos(s);
      if (s <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [subasta.expiraEn]);

  const pujasOrdenadas = [...subasta.pujas].sort((a, b) => b.monto - a.monto);
  const pujaMasAlta = pujasOrdenadas[0] ?? null;

  const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
  const ss = String(segundos % 60).padStart(2, '0');
  const tiempoUrgente = segundos <= 10;

  const nombreJugador = (id: string) =>
    jugadores.find((j) => j.id === id)?.nombre ?? id;

  const fichaJugador = (id: string) => {
    const ficha = jugadores.find((j) => j.id === id)?.ficha ?? '';
    return FICHAS_EMOJIS[ficha] ?? '👤';
  };

  const nombreProp = NOMBRES_CASILLAS_ARR[subasta.casilla] ?? `Casilla ${subasta.casilla}`;
  const grupo = GRUPO_POR_CASILLA[subasta.casilla];
  const colorProp = grupo && COLORES_GRUPO[grupo] ? COLORES_GRUPO[grupo] : '#888';

  const montoActual = pujaMasAlta ? pujaMasAlta.monto : 0;
  const minimoSiguiente = montoActual + 10;

  const handleQuickBid = (incremento: number) => {
    const nuevo = montoActual + incremento;
    onPujar(nuevo);
  };

  const handlePujarCustom = () => {
    // Si el input está vacío, usar el mínimo mostrado en el botón
    const monto = montoPuja.trim() === '' ? minimoSiguiente : parseInt(montoPuja, 10);
    if (isNaN(monto) || monto < minimoSiguiente) {
      Alert.alert('Monto inválido', `La puja mínima es $${minimoSiguiente}`);
      return;
    }
    onPujar(monto);
    setMontoPuja('');
  };

  const montoBoton = montoPuja.trim() !== '' && !isNaN(parseInt(montoPuja, 10))
    ? parseInt(montoPuja, 10)
    : minimoSiguiente;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={() => {}}>
      <View style={sb.screen}>
        {/* Header */}
        <View style={sb.header}>
          <View style={[sb.propColorDot, { backgroundColor: colorProp }]} />
          <Text style={sb.headerTitle}>{nombreProp}</Text>
        </View>

        <ScrollView style={sb.scroll} contentContainerStyle={sb.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Countdown */}
          <View style={sb.countdownSection}>
            <Text style={sb.closingLabel}>
              {tiempoUrgente ? '⚠️  ¡CERRANDO!' : 'Tiempo restante'}
            </Text>
            <View style={[sb.countdownBox, tiempoUrgente && sb.countdownBoxUrgente]}>
              <Text style={[sb.countdownText, tiempoUrgente && sb.countdownTextUrgente]}>
                {mm}:{ss}
              </Text>
            </View>
          </View>

          {/* Current bid card */}
          <View style={sb.bidCard}>
            <View style={sb.bidCardStripe} />
            <Text style={sb.bidCardLabel}>PUJA MÁS ALTA</Text>
            <View style={sb.bidAmountRow}>
              <Text style={sb.bidAmount}>
                {pujaMasAlta ? `$${pujaMasAlta.monto}` : '$0'}
              </Text>
            </View>
            {pujaMasAlta ? (
              <View style={sb.winnerPill}>
                <Text style={sb.winnerEmoji}>{fichaJugador(pujaMasAlta.jugadorId)}</Text>
                <View>
                  <Text style={sb.winnerName}>
                    {nombreJugador(pujaMasAlta.jugadorId)}
                    {pujaMasAlta.jugadorId === miJugadorId ? ' (vos)' : ''}
                  </Text>
                  <Text style={sb.winnerLabel}>
                    {pujaMasAlta.jugadorId === miJugadorId ? 'TU PUJA' : 'GANANDO'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={sb.winnerPill}>
                <Text style={sb.winnerName}>Sin pujas todavía</Text>
              </View>
            )}
          </View>

          {/* Bid history */}
          {pujasOrdenadas.length > 0 && (
            <View style={sb.historySection}>
              <View style={sb.historyHeader}>
                <Text style={sb.historyTitle}>HISTORIAL DE PUJAS</Text>
                <View style={sb.historyBadge}>
                  <Text style={sb.historyBadgeText}>{pujasOrdenadas.length} PUJAS</Text>
                </View>
              </View>
              {pujasOrdenadas.map((puja, i) => (
                <View key={puja.jugadorId} style={[sb.historyItem, i > 0 && sb.historyItemDim]}>
                  <View style={sb.historyItemLeft}>
                    <Text style={sb.historyEmoji}>{fichaJugador(puja.jugadorId)}</Text>
                    <Text style={[sb.historyPlayerName, i > 0 && sb.historyPlayerNameDim]}>
                      {nombreJugador(puja.jugadorId)}
                      {puja.jugadorId === miJugadorId ? ' (vos)' : ''}
                    </Text>
                  </View>
                  <Text style={[sb.historyAmount, i > 0 && sb.historyAmountDim]}>
                    ${puja.monto}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Spacer for fixed bottom */}
          <View style={{ height: 200 }} />
        </ScrollView>

        {/* Bottom interaction area */}
        <View style={sb.bottomPanel}>
          {/* Quick bid buttons */}
          <View style={sb.quickBidRow}>
            {[10, 50, 100].map((inc) => (
              <TouchableOpacity
                key={inc}
                style={[sb.quickBidBtn, segundos === 0 && sb.btnDisabled]}
                onPress={() => handleQuickBid(inc)}
                disabled={segundos === 0}
              >
                <Text style={sb.quickBidText}>+${inc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom input */}
          <View style={sb.inputRow}>
            <Text style={sb.inputPrefix}>Monto: </Text>
            <TextInput
              style={sb.input}
              value={montoPuja}
              onChangeText={setMontoPuja}
              keyboardType="numeric"
              placeholder={`${minimoSiguiente}`}
              placeholderTextColor="#adada9"
            />
            <Text style={sb.inputSuffix}>$</Text>
          </View>

          {/* Main bid button */}
          <TouchableOpacity
            style={[sb.pujarBtn, segundos === 0 && sb.btnDisabled]}
            onPress={handlePujarCustom}
            disabled={segundos === 0}
            activeOpacity={0.85}
          >
            <Text style={[sb.pujarBtnText, segundos === 0 && sb.btnDisabledText]}>
              {segundos === 0 ? 'SUBASTA CERRADA' : `🔨  PUJAR $${montoBoton}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal propiedades de jugador (solo lectura) ───────────────────────────

interface ModalPropiedadesProps {
  visible: boolean;
  jugador: Jugador;
  propiedades: Propiedad[];
  onCerrar: () => void;
}

function ModalPropiedades({ visible, jugador, propiedades, onCerrar }: ModalPropiedadesProps) {
  const propsJugador = propiedades.filter((p) => p.propietarioId === jugador.id);
  const fichaEmoji = FICHAS_EMOJIS[jugador.ficha] ?? '👤';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContenido}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalFichaContainer}>
              <Text style={styles.modalFichaEmoji}>{fichaEmoji}</Text>
            </View>
            <View style={styles.modalHeaderTexto}>
              <Text style={styles.modalTitulo} numberOfLines={1}>
                {jugador.nombre}
              </Text>
              <Text style={styles.modalSubtitulo}>
                {propsJugador.length === 0
                  ? 'Sin propiedades'
                  : `${propsJugador.length} propiedad${propsJugador.length > 1 ? 'es' : ''}`}
              </Text>
            </View>
          </View>

          {/* Property list */}
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {propsJugador.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🏚️</Text>
                <Text style={styles.emptyStateTitle}>Sin propiedades</Text>
                <Text style={styles.emptyStateDesc}>
                  {jugador.nombre} no tiene propiedades todavía
                </Text>
              </View>
            ) : (
              <View style={styles.propiedadesList}>
                {propsJugador.map((p) => {
                  const grupo = GRUPO_POR_CASILLA[p.casilla];
                  const colorGrupo = grupo ? (COLORES_GRUPO[grupo] ?? '#888') : '#888';
                  const estadoEdificio = p.hotel
                    ? '🏨 Hotel'
                    : p.casas > 0
                    ? `🏠 ${p.casas} casa${p.casas > 1 ? 's' : ''}`
                    : '—';
                  return (
                    <View key={p.id} style={styles.propiedadItem}>
                      <View style={[styles.propGrupoDot, { backgroundColor: colorGrupo }]} />
                      <View style={styles.propInfo}>
                        <Text style={styles.propiedadItemNombre} numberOfLines={1}>
                          {nombreCasilla(p.casilla)}
                        </Text>
                        <Text style={styles.propiedadItemDetalle}>{estadoEdificio}</Text>
                      </View>
                      {p.hipotecada && (
                        <View style={styles.hipotecadaBadge}>
                          <Text style={styles.hipotecadaTexto}>Hip.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.botonCerrarPrincipal} onPress={onCerrar} activeOpacity={0.85}>
            <Text style={styles.botonCerrarTexto}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal negociación ─────────────────────────────────────────────────────

interface ModalNegociacionProps {
  visible: boolean;
  miJugadorId: string;
  destinatario: Jugador;
  misPropiedades: Propiedad[];
  propiedadesDestinatario: Propiedad[];
  onProponer: (payload: {
    propiedadesOfrecidas: string[];
    propiedadesRequeridas: string[];
    dineroOfrecido: number;
    dineroRequerido: number;
  }) => void;
  onCerrar: () => void;
}

function ModalNegociacion({
  visible,
  destinatario,
  misPropiedades,
  propiedadesDestinatario,
  onProponer,
  onCerrar,
}: ModalNegociacionProps) {
  const [ofrecidas, setOfrecidas] = useState<Set<string>>(new Set());
  const [requeridas, setRequeridas] = useState<Set<string>>(new Set());
  const [dineroOfrecido, setDineroOfrecido] = useState('');
  const [dineroRequerido, setDineroRequerido] = useState('');

  const toggleOfrecida = (id: string) => {
    setOfrecidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleRequerida = (id: string) => {
    setRequeridas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleProponer = () => {
    const dOfrecido = parseInt(dineroOfrecido, 10) || 0;
    const dRequerido = parseInt(dineroRequerido, 10) || 0;

    if (ofrecidas.size === 0 && requeridas.size === 0 && dOfrecido === 0 && dRequerido === 0) {
      Alert.alert('Error', 'La negociación debe incluir al menos algo');
      return;
    }

    onProponer({
      propiedadesOfrecidas: Array.from(ofrecidas),
      propiedadesRequeridas: Array.from(requeridas),
      dineroOfrecido: dOfrecido,
      dineroRequerido: dRequerido,
    });

    // Reset
    setOfrecidas(new Set());
    setRequeridas(new Set());
    setDineroOfrecido('');
    setDineroRequerido('');
    onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContenido}>
          <Text style={styles.modalTitulo}>
            Negociación con {destinatario.nombre}
          </Text>

          <ScrollView style={styles.modalScroll}>
            <Text style={styles.seccionTitulo}>Mis propiedades que ofrezco</Text>
            {misPropiedades.length === 0 ? (
              <Text style={styles.sinPropiedadesTexto}>No tenés propiedades</Text>
            ) : (
              misPropiedades.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.checkItem, ofrecidas.has(p.id) && styles.checkItemActivo]}
                  onPress={() => toggleOfrecida(p.id)}
                >
                  <Text style={styles.checkMarca}>{ofrecidas.has(p.id) ? '☑' : '☐'}</Text>
                  <Text style={styles.checkTexto}>{nombreCasilla(p.casilla)}</Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.seccionTitulo, { marginTop: 12 }]}>
              Propiedades de {destinatario.nombre} que quiero
            </Text>
            {propiedadesDestinatario.length === 0 ? (
              <Text style={styles.sinPropiedadesTexto}>No tiene propiedades</Text>
            ) : (
              propiedadesDestinatario.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.checkItem, requeridas.has(p.id) && styles.checkItemActivo]}
                  onPress={() => toggleRequerida(p.id)}
                >
                  <Text style={styles.checkMarca}>{requeridas.has(p.id) ? '☑' : '☐'}</Text>
                  <Text style={styles.checkTexto}>{nombreCasilla(p.casilla)}</Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.seccionTitulo, { marginTop: 12 }]}>Dinero que ofrezco</Text>
            <TextInput
              style={styles.inputDinero}
              value={dineroOfrecido}
              onChangeText={setDineroOfrecido}
              keyboardType="numeric"
              placeholder="$0"
              placeholderTextColor="#666"
            />

            <Text style={[styles.seccionTitulo, { marginTop: 8 }]}>Dinero que pido</Text>
            <TextInput
              style={styles.inputDinero}
              value={dineroRequerido}
              onChangeText={setDineroRequerido}
              keyboardType="numeric"
              placeholder="$0"
              placeholderTextColor="#666"
            />
          </ScrollView>

          <View style={styles.modalBotones}>
            <TouchableOpacity style={styles.botonCancelar} onPress={onCerrar}>
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonProponer} onPress={handleProponer}>
              <Text style={styles.botonTexto}>Proponer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────

export default function JugadoresScreen() {
  const {
    partidaId,
    jugadores,
    miJugadorId,
    saldos,
    propiedades,
    subastaActiva,
    setEstado,
  } = useGameStore();

  const { emitir, escuchar } = useSocketStore();
  const escuchando = useRef(false);

  const [modalPropiedadesJugador, setModalPropiedadesJugador] =
    useState<Jugador | null>(null);
  const [modalNegociacionJugador, setModalNegociacionJugador] =
    useState<Jugador | null>(null);

  const jugadoresActivos = jugadores.filter((j) => !j.eliminado);

  // ── Listeners de socket ──────────────────────────────────────────────────
  useEffect(() => {
    if (escuchando.current) return;
    escuchando.current = true;

    escuchar('propiedad:comprada', (data) => {
      const payload = data as PropiedadCompradaPayload;
      const estadoActual = useGameStore.getState();
      const yaExiste = estadoActual.propiedades.some(
        (p) => p.casilla === payload.casilla,
      );
      if (!yaExiste) {
        setEstado({
          propiedades: [
            ...estadoActual.propiedades,
            {
              id: `temp_${payload.casilla}`,
              casilla: payload.casilla,
              propietarioId: payload.propietarioId,
              casas: 0,
              hotel: false,
              hipotecada: false,
            },
          ],
        });
      }
    });

    escuchar('negociacion:resuelta', (data) => {
      const payload = data as NegociacionResueltaPayload;
      if (payload.aceptada) {
        Alert.alert('Negociación', 'El trato fue aceptado');
      } else {
        Alert.alert('Negociación', 'El trato fue rechazado');
      }
    });

    escuchar('propiedad:transferida', (data) => {
      const payload = data as PropiedadTransferidaPayload;
      const estadoActual = useGameStore.getState();
      setEstado({
        propiedades: estadoActual.propiedades.map((p) =>
          p.casilla === payload.casilla
            ? { ...p, propietarioId: payload.nuevoPropietarioId }
            : p,
        ),
      });
    });

    escuchar('economia:transaccion', (data) => {
      const payload = data as TransaccionPayload;
      const estadoActual = useGameStore.getState();
      setEstado({
        saldos: {
          ...estadoActual.saldos,
          [payload.jugadorId]: payload.saldoNuevo,
        },
      });
    });

    escuchar('jugador:bancarrota', (data) => {
      const payload = data as BancarrotaPayload;
      const estadoActual = useGameStore.getState();
      const jugador = estadoActual.jugadores.find(
        (j) => j.id === payload.jugadorId,
      );
      const nombre = jugador?.nombre ?? 'Un jugador';

      setEstado({
        jugadores: estadoActual.jugadores.map((j) =>
          j.id === payload.jugadorId ? { ...j, eliminado: true } : j,
        ),
      });

      if (payload.jugadorId !== estadoActual.miJugadorId) {
        Alert.alert('Jugador eliminado', `${nombre} fue eliminado por bancarrota.`);
      }
    });

    escuchar('error:accion', (data) => {
      const payload = data as { codigo: string; mensaje: string };
      Alert.alert('Error', payload.mensaje);
    });

    escuchar('negociacion:enviada', () => {
      Alert.alert('Negociación', 'Tu propuesta fue enviada');
    });

    escuchar('negociacion:propuesta', (data) => {
      const payload = data as NegociacionPropuestaPayload;
      const { detalles, negociacionId, remitenteId } = payload;

      const remitenteNombre =
        useGameStore
          .getState()
          .jugadores.find((j) => j.id === remitenteId)?.nombre ?? remitenteId;

      const propOfreceNombres = detalles.propiedadesOfrecidas
        .map((id) => {
          const prop = useGameStore.getState().propiedades.find((p) => p.id === id);
          return prop ? nombreCasilla(prop.casilla) : id;
        })
        .join(', ') || 'ninguna';

      const propPideNombres = detalles.propiedadesRequeridas
        .map((id) => {
          const prop = useGameStore.getState().propiedades.find((p) => p.id === id);
          return prop ? nombreCasilla(prop.casilla) : id;
        })
        .join(', ') || 'ninguna';

      Alert.alert(
        'Propuesta de negociación',
        `${remitenteNombre} te ofrece:\n` +
          `  Propiedades: ${propOfreceNombres}\n` +
          `  Dinero: $${detalles.dineroOfrecido}\n` +
          `A cambio de:\n` +
          `  Propiedades: ${propPideNombres}\n` +
          `  Dinero: $${detalles.dineroRequerido}`,
        [
          {
            text: 'Rechazar',
            style: 'destructive',
            onPress: () =>
              emitir('negociacion:responder', {
                negociacionId,
                aceptar: false,
              }),
          },
          {
            text: 'Aceptar',
            onPress: () =>
              emitir('negociacion:responder', {
                negociacionId,
                aceptar: true,
              }),
          },
        ],
      );
    });
  }, [escuchar, setEstado, emitir]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePujar = (monto: number) => {
    if (!subastaActiva) return;
    emitir('subasta:pujar', {
      subastaId: subastaActiva.subastaId,
      monto,
    });
  };

  const handleProponer = (
    destinatario: Jugador,
    datos: {
      propiedadesOfrecidas: string[];
      propiedadesRequeridas: string[];
      dineroOfrecido: number;
      dineroRequerido: number;
    },
  ) => {
    if (!partidaId) return;
    emitir('negociacion:proponer', {
      partidaId,
      destinatarioId: destinatario.id,
      ...datos,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const misPropiedades = propiedades.filter(
    (p) => p.propietarioId === miJugadorId,
  );

  const jugadoresOrdenados = [...jugadores].sort((a, b) => {
    const saldoA = saldos[a.id] ?? a.saldo;
    const saldoB = saldos[b.id] ?? b.saldo;
    return saldoB - saldoA;
  });

  const saldoMaximo = jugadoresOrdenados.reduce((max, j) => {
    const s = saldos[j.id] ?? j.saldo;
    return s > max ? s : max;
  }, 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Modal de subasta activa */}
      {subastaActiva && miJugadorId && (
        <ModalSubastaActiva
          subasta={subastaActiva}
          miJugadorId={miJugadorId}
          jugadores={jugadores}
          onPujar={handlePujar}
          visible={true}
        />
      )}

      {/* Lista de jugadores */}
      <Text style={styles.seccionTituloGrande}>Jugadores</Text>

      {jugadoresOrdenados.map((jugador) => {
        const saldo = saldos[jugador.id] ?? jugador.saldo;
        const cantPropiedades = propiedades.filter(
          (p) => p.propietarioId === jugador.id,
        ).length;
        const esYo = jugador.id === miJugadorId;
        const eliminado = jugador.eliminado === true;
        const barraAncho = saldoMaximo > 0 ? Math.max(0, Math.min(1, saldo / saldoMaximo)) : 0;

        return (
          <View
            key={jugador.id}
            style={[
              styles.jugadorCard,
              esYo && styles.jugadorCardPropio,
              eliminado && styles.jugadorCardEliminado,
            ]}
          >
            <View style={styles.jugadorInfo}>
              <Text style={[styles.jugadorFicha, eliminado && styles.textoEliminado]}>
                {FICHAS_EMOJIS[jugador.ficha] ?? '?'}
              </Text>
              <View style={styles.jugadorDatos}>
                <Text style={[styles.jugadorNombre, eliminado && styles.textoEliminado]}>
                  {jugador.nombre}{esYo ? ' (vos)' : ''}{eliminado ? ' — eliminado' : ''}
                </Text>
                <Text style={[styles.jugadorSaldo, eliminado && styles.textoEliminado]}>
                  ${saldo}
                </Text>
                <Text style={styles.jugadorPropiedades}>
                  {cantPropiedades} propiedad{cantPropiedades !== 1 ? 'es' : ''}
                </Text>
                {!eliminado && (
                  <View style={styles.barraFondo}>
                    <View
                      style={[
                        styles.barraRelleno,
                        { width: `${Math.round(barraAncho * 100)}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
            </View>

            {!esYo && !eliminado && (
              <View style={styles.jugadorBotones}>
                <TouchableOpacity
                  style={styles.botonVerProps}
                  onPress={() => setModalPropiedadesJugador(jugador)}
                >
                  <Text style={styles.botonTextoSmall}>Ver props</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botonNegociar}
                  onPress={() => setModalNegociacionJugador(jugador)}
                >
                  <Text style={styles.botonTextoSmall}>Negociar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Modal ver propiedades de otro jugador */}
      {modalPropiedadesJugador && (
        <ModalPropiedades
          visible
          jugador={modalPropiedadesJugador}
          propiedades={propiedades}
          onCerrar={() => setModalPropiedadesJugador(null)}
        />
      )}

      {/* Modal proponer negociación */}
      {modalNegociacionJugador && miJugadorId && (
        <ModalNegociacion
          visible
          miJugadorId={miJugadorId}
          destinatario={modalNegociacionJugador}
          misPropiedades={misPropiedades}
          propiedadesDestinatario={propiedades.filter(
            (p) => p.propietarioId === modalNegociacionJugador.id,
          )}
          onProponer={(datos) => handleProponer(modalNegociacionJugador, datos)}
          onCerrar={() => setModalNegociacionJugador(null)}
        />
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },

  // Banner subasta
  bannerSubasta: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#3b82f6',
    gap: 10,
  },
  bannerSubastaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerSubastaTitulo: {
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  countdownBadge: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdownUrgente: {
    backgroundColor: '#dc2626',
  },
  countdownTexto: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  pujaInfo: {},
  pujaMasAltaTexto: {
    color: '#d1d5db',
    fontSize: 13,
  },
  pujaMonto: {
    color: '#4ade80',
    fontWeight: '700',
  },
  pujaInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pujaInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  botonPujar: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  botonDeshabilitado: {
    backgroundColor: '#374151',
  },

  // Sección jugadores
  seccionTituloGrande: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  jugadorCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  jugadorCardPropio: {
    borderColor: '#3b82f6',
  },
  jugadorCardEliminado: {
    opacity: 0.5,
    borderColor: '#4b5563',
  },
  textoEliminado: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  jugadorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  jugadorFicha: {
    fontSize: 28,
  },
  jugadorDatos: {
    gap: 2,
  },
  jugadorNombre: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  jugadorSaldo: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  jugadorPropiedades: {
    color: '#9ca3af',
    fontSize: 12,
  },
  barraFondo: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginTop: 4,
    width: 120,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: 4,
    backgroundColor: '#4ade80',
    borderRadius: 2,
  },
  jugadorBotones: {
    flexDirection: 'column',
    gap: 6,
  },
  botonVerProps: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  botonNegociar: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  botonTextoSmall: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Modales comunes
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    gap: 12,
  },
  modalTitulo: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  botonCerrar: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonCancelar: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonProponer: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal propiedades
  propiedadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  propiedadItemNombre: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  propiedadItemDetalle: {
    color: '#64748b',
    fontSize: 12,
  },
  sinPropiedadesTexto: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Modal propiedades — handle, header, empty state, list
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 4,
  },
  modalFichaContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFichaEmoji: {
    fontSize: 26,
  },
  modalHeaderTexto: {
    flex: 1,
  },
  modalSubtitulo: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyStateTitle: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateDesc: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  propiedadesList: {
    gap: 8,
    paddingVertical: 8,
  },
  propGrupoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  propInfo: {
    flex: 1,
    gap: 2,
  },
  hipotecadaBadge: {
    backgroundColor: '#450a0a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  hipotecadaTexto: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
  botonCerrarPrincipal: {
    backgroundColor: '#006a35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonCerrarTexto: {
    color: '#cdffd4',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal negociación
  seccionTitulo: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  checkItemActivo: {
    backgroundColor: '#1e3a5f',
  },
  checkMarca: {
    color: '#93c5fd',
    fontSize: 16,
  },
  checkTexto: {
    color: '#d1d5db',
    fontSize: 13,
  },
  inputDinero: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
});

// ─── Estilos del modal de subasta activa ──────────────────────────────────
const C = {
  bg: '#f7f7f2',
  onBg: '#2d2f2c',
  primary: '#006a35',
  primaryContainer: '#75f39c',
  secondary: '#ba0015',
  secondaryContainer: '#ffc3bd',
  onSecondaryContainer: '#94000f',
  tertiary: '#005f9d',
  tertiaryContainer: '#6db5ff',
  onTertiaryContainer: '#003257',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f1f1ec',
  surfaceContainer: '#e8e9e3',
  surfaceHigh: '#e2e3dd',
  surfaceHighest: '#dcddd7',
  onSurface: '#2d2f2c',
  onSurfaceVariant: '#5a5c58',
  outlineVariant: '#adada9',
  error: '#b31b25',
};

const sb = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceHigh,
  },
  propColorDot: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(45,47,44,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.onBg,
    letterSpacing: -0.3,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },

  // Countdown
  countdownSection: {
    alignItems: 'center',
    gap: 8,
  },
  closingLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: C.secondary,
    textTransform: 'uppercase',
  },
  countdownBox: {
    backgroundColor: C.surfaceLow,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(186,0,21,0.2)',
  },
  countdownBoxUrgente: {
    backgroundColor: C.secondaryContainer,
    borderBottomColor: C.secondary,
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '900',
    color: C.onBg,
    letterSpacing: -4,
    lineHeight: 80,
  },
  countdownTextUrgente: {
    color: C.secondary,
  },

  // Current bid card
  bidCard: {
    backgroundColor: C.surfaceLowest,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bidCardStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: C.tertiary,
  },
  bidCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
  },
  bidAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bidAmount: {
    fontSize: 56,
    fontWeight: '900',
    color: C.onBg,
    letterSpacing: -2,
  },
  winnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(173,173,169,0.15)',
  },
  winnerEmoji: {
    fontSize: 24,
  },
  winnerName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.onSurface,
  },
  winnerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: 0.5,
  },

  // Bid history
  historySection: {
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  historyBadge: {
    backgroundColor: C.tertiaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onTertiaryContainer,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  historyItemDim: {
    opacity: 0.55,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyEmoji: {
    fontSize: 22,
  },
  historyPlayerName: {
    fontSize: 14,
    fontWeight: '500',
    color: C.onSurface,
  },
  historyPlayerNameDim: {
    color: C.onSurfaceVariant,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: C.onBg,
  },
  historyAmountDim: {
    color: C.onSurfaceVariant,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: 'rgba(247,247,242,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(173,173,169,0.1)',
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 12,
    shadowColor: '#2d2f2c',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  quickBidRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBidBtn: {
    flex: 1,
    backgroundColor: C.surfaceHighest,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  quickBidText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceLow,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  inputPrefix: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: C.onBg,
    padding: 0,
  },
  inputSuffix: {
    fontSize: 16,
    fontWeight: '700',
    color: C.tertiary,
    marginLeft: 4,
  },
  pujarBtn: {
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pujarBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#cdffd4',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    backgroundColor: C.surfaceContainer,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnDisabledText: {
    color: C.onSurfaceVariant,
  },
});
