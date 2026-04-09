import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../../src/stores/gameStore';
import { useSocketStore } from '../../../src/stores/socketStore';
import { actualizarEstadoSesion } from '../../../src/services/session.service';
import type { Ficha } from '@pagadiario/types';

const FICHAS_EMOJI: Record<Ficha, string> = {
  PERRO: '🐶',
  SOMBRERO: '🎩',
  COCHE: '🚗',
  BARCO: '🚢',
  DEDAL: '🧵',
  CARRETILLA: '🛒',
  CABALLO: '🐴',
  PLANCHA: '🔧',
};

const VALORES_DADO = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface JugadorEnSala {
  jugadorId: string;
  nombre: string;
  ficha: string;
  ordenTurno: number;
}

interface SalaActualizadaPayload {
  jugadores: JugadorEnSala[];
}

interface PartidaIniciadaPayload {
  ordenTurnos: string[];
}

interface OrdenDado {
  jugadorId: string;
  resultado: number;
}

function WheelPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    const idx = VALORES_DADO.indexOf(value);
    if (idx >= 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, []);

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const rawIdx = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
    const idx = Math.round(rawIdx);
    const clamped = Math.max(0, Math.min(VALORES_DADO.length - 1, idx));
    onChange(VALORES_DADO[clamped]);
    isScrolling.current = false;
  };

  return (
    <View style={pickerStyles.container}>
      {/* Highlight de la selección central */}
      <View style={pickerStyles.selectionHighlight} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        style={pickerStyles.scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={pickerStyles.scrollContent}
      >
        {VALORES_DADO.map((v) => {
          const isSelected = v === value;
          return (
            <View key={v} style={pickerStyles.item}>
              <Text style={[pickerStyles.itemText, isSelected && pickerStyles.itemTextSelected]}>
                {v}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: {
    width: 80,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0f1a2e',
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(69, 123, 157, 0.25)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#457b9d',
    zIndex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    color: '#555',
    fontSize: 18,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
  },
});

export default function EsperaScreen() {
  const router = useRouter();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();

  const { partidaId, miJugadorId, setEstado } = useGameStore((s) => ({
    partidaId: s.partidaId,
    miJugadorId: s.miJugadorId,
    setEstado: s.setEstado,
  }));

  const { conectar, emitir, escuchar } = useSocketStore();

  const [jugadores, setJugadores] = useState<JugadorEnSala[]>([]);
  const [mostrandoIniciarModal, setMostrandoIniciarModal] = useState(false);
  const [ordenDados, setOrdenDados] = useState<OrdenDado[]>([]);
  const [iniciando, setIniciando] = useState(false);

  const escuchaMontada = useRef(false);

  const soyHost =
    jugadores.length > 0 &&
    jugadores.find((j) => j.jugadorId === miJugadorId)?.ordenTurno === 0;

  useEffect(() => {
    if (!codigo || !miJugadorId || escuchaMontada.current) return;
    escuchaMontada.current = true;

    conectar(codigo, miJugadorId);

    escuchar('sala:actualizada', (data) => {
      const payload = data as SalaActualizadaPayload;
      setJugadores(payload.jugadores);
      const jugadoresMapeados = payload.jugadores.map((j) => ({
        id: j.jugadorId,
        nombre: j.nombre,
        ficha: j.ficha as Ficha,
        posicion: 0,
        saldo: 1500,
        enCarcel: false,
        turnosEnCarcel: 0,
        cartaSalida: false,
        eliminado: false,
        ordenTurno: j.ordenTurno,
      }));
      const posicionesIniciales: Record<string, number> = {};
      const saldosIniciales: Record<string, number> = {};
      payload.jugadores.forEach((j) => {
        posicionesIniciales[j.jugadorId] = 0;
        saldosIniciales[j.jugadorId] = 1500;
      });
      setEstado({
        jugadores: jugadoresMapeados,
        posiciones: posicionesIniciales,
        saldos: saldosIniciales,
      });
    });

    escuchar('partida:iniciada', (data) => {
      const payload = data as PartidaIniciadaPayload;
      const jugadoresActuales = useGameStore.getState().jugadores;
      const posicionesIniciales: Record<string, number> = {};
      const saldosIniciales: Record<string, number> = {};
      jugadoresActuales.forEach((j) => {
        posicionesIniciales[j.id] = 0;
        saldosIniciales[j.id] = 1500;
      });
      setEstado({
        jugadorActivoId: payload.ordenTurnos[0] ?? null,
        posiciones: posicionesIniciales,
        saldos: saldosIniciales,
      });
      void actualizarEstadoSesion('EN_CURSO');
      router.replace('/juego/tablero');
    });

    return () => {
      // No desconectamos aquí: tablero.tsx reutiliza el mismo socket
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirModalIniciar = () => {
    const dadosIniciales: OrdenDado[] = jugadores.map((j) => ({
      jugadorId: j.jugadorId,
      resultado: 7,
    }));
    setOrdenDados(dadosIniciales);
    setMostrandoIniciarModal(true);
  };

  const actualizarDado = (jugadorId: string, valor: number) => {
    setOrdenDados((prev) =>
      prev.map((d) => d.jugadorId === jugadorId ? { ...d, resultado: valor } : d),
    );
  };

  const handleIniciar = () => {
    if (!partidaId || iniciando) return;

    const valores = ordenDados.map((d) => d.resultado);
    const hayDuplicados = new Set(valores).size !== valores.length;
    if (hayDuplicados) {
      Alert.alert(
        'Resultados duplicados',
        'Cada jugador debe tener un resultado único para determinar el orden.',
      );
      return;
    }

    setIniciando(true);
    emitir('partida:iniciar', { partidaId, ordenDados });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Sala de espera</Text>

      <View style={styles.codigoContainer}>
        <Text style={styles.codigoEtiqueta}>Código de sala</Text>
        <Text style={styles.codigo}>{codigo}</Text>
      </View>

      <Text style={styles.subtitulo}>Jugadores ({jugadores.length}/8)</Text>

      <ScrollView style={styles.lista}>
        {jugadores.length === 0 && (
          <View style={styles.vacioCentrado}>
            <ActivityIndicator color="#aaa" />
            <Text style={styles.vacioTexto}>Conectando...</Text>
          </View>
        )}
        {jugadores.map((jugador) => (
          <View key={jugador.jugadorId} style={styles.jugadorFila}>
            <Text style={styles.jugadorEmoji}>
              {FICHAS_EMOJI[jugador.ficha as Ficha] ?? '?'}
            </Text>
            <Text style={styles.jugadorNombre}>{jugador.nombre}</Text>
            {jugador.jugadorId === miJugadorId && (
              <Text style={styles.tuEtiqueta}>Tú</Text>
            )}
            {jugador.ordenTurno === 0 && (
              <Text style={styles.hostEtiqueta}>Host</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {soyHost && !mostrandoIniciarModal && (
        <TouchableOpacity
          style={[
            styles.boton,
            jugadores.length < 2 && styles.botonDeshabilitado,
          ]}
          onPress={abrirModalIniciar}
          disabled={jugadores.length < 2}
        >
          <Text style={styles.botonTexto}>Iniciar partida</Text>
        </TouchableOpacity>
      )}

      {mostrandoIniciarModal && (
        <View style={styles.modal}>
          <Text style={styles.modalTitulo}>Tirada de dados</Text>
          <Text style={styles.modalSubtitulo}>
            Girá la ruleta al total obtenido (2–12). El mayor empieza primero.
          </Text>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {jugadores.map((jugador) => {
              const dado = ordenDados.find((d) => d.jugadorId === jugador.jugadorId);
              const valorActual = dado?.resultado ?? 7;
              return (
                <View key={jugador.jugadorId} style={styles.dadoFila}>
                  <View style={styles.dadoJugadorInfo}>
                    <Text style={styles.dadoEmoji}>
                      {FICHAS_EMOJI[jugador.ficha as Ficha] ?? '?'}
                    </Text>
                    <Text style={styles.dadoNombre} numberOfLines={1}>
                      {jugador.nombre}
                    </Text>
                  </View>
                  <View style={styles.dadoPickerContainer}>
                    <WheelPicker
                      value={valorActual}
                      onChange={(v) => actualizarDado(jugador.jugadorId, v)}
                    />
                    <Text style={styles.dadoPickerLabel}>total</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalBotones}>
            <TouchableOpacity
              style={styles.botonCancelar}
              onPress={() => {
                setMostrandoIniciarModal(false);
                setIniciando(false);
              }}
            >
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.botonConfirmar,
                iniciando && styles.botonDeshabilitado,
              ]}
              onPress={handleIniciar}
              disabled={iniciando}
            >
              {iniciando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botonTexto}>Confirmar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 24,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  codigoContainer: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  codigoEtiqueta: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  codigo: {
    color: '#e63946',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  subtitulo: {
    color: '#aaaaaa',
    fontSize: 14,
    marginBottom: 12,
  },
  lista: {
    flex: 1,
  },
  vacioCentrado: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  vacioTexto: {
    color: '#aaaaaa',
    fontSize: 14,
    marginTop: 8,
  },
  jugadorFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  jugadorEmoji: {
    fontSize: 24,
  },
  jugadorNombre: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  tuEtiqueta: {
    color: '#457b9d',
    fontSize: 12,
    fontWeight: '600',
  },
  hostEtiqueta: {
    color: '#f4a261',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  boton: {
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
    marginTop: 16,
  },
  botonDeshabilitado: {
    backgroundColor: '#666',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modal: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  modalTitulo: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalSubtitulo: {
    color: '#aaaaaa',
    fontSize: 13,
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 280,
  },
  dadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  dadoJugadorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  dadoEmoji: {
    fontSize: 22,
  },
  dadoNombre: {
    color: '#ffffff',
    fontSize: 15,
    flex: 1,
  },
  dadoPickerContainer: {
    alignItems: 'center',
    gap: 4,
  },
  dadoPickerLabel: {
    color: '#666',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  botonCancelar: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  botonCancelarTexto: {
    color: '#aaaaaa',
    fontSize: 15,
  },
  botonConfirmar: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
  },
});
