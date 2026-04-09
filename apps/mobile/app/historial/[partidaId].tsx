import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/services/api.service';
import { ICONOS_TRANSACCION } from '../../src/constants/tablero';

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

interface TransaccionDetalle {
  tipo: string;
  monto: number;
  concepto: string;
  creadaEn: string;
  jugadorNombre: string;
}

interface JugadorDetalle {
  nombre: string;
  ficha: string;
  saldo: number;
  eliminado: boolean;
}

interface PartidaDetalleCompleta {
  partidaId: string;
  codigo: string;
  modoMonetario: string;
  creadaEn: string;
  jugadores: JugadorDetalle[];
  transacciones: TransaccionDetalle[];
}

function formatearFecha(fechaStr: string): string {
  try {
    const fecha = new Date(fechaStr);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  } catch {
    return fechaStr;
  }
}

function formatearHora(fechaStr: string): string {
  try {
    const fecha = new Date(fechaStr);
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
  } catch {
    return fechaStr;
  }
}

function colorMonto(monto: number): string {
  if (monto > 0) return '#4caf50';
  if (monto < 0) return '#e63946';
  return '#aaaaaa';
}

export default function DetallePartidaScreen() {
  const router = useRouter();
  const { partidaId } = useLocalSearchParams<{ partidaId: string }>();
  const [detalle, setDetalle] = useState<PartidaDetalleCompleta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partidaId) return;
    api
      .get<PartidaDetalleCompleta>(`/partidas/${partidaId}/detalle`)
      .then((data) => {
        setDetalle(data);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Error al cargar el detalle',
        );
      })
      .finally(() => {
        setCargando(false);
      });
  }, [partidaId]);

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.botonVolver}>
        <Text style={styles.botonVolverTexto}>← Volver</Text>
      </TouchableOpacity>

      {cargando && (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#457b9d" />
          <Text style={styles.cargandoTexto}>Cargando detalle...</Text>
        </View>
      )}

      {!cargando && error && (
        <View style={styles.centrado}>
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      )}

      {!cargando && !error && detalle && (
        <>
          {/* Encabezado */}
          <View style={styles.encabezado}>
            <View style={styles.encabezadoFila}>
              <Text style={styles.codigo}>{detalle.codigo}</Text>
              <View style={styles.modoBadge}>
                <Text style={styles.modoBadgeTexto}>{detalle.modoMonetario}</Text>
              </View>
            </View>
            <Text style={styles.fecha}>{formatearFecha(detalle.creadaEn)}</Text>
          </View>

          {/* Sección Jugadores */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Jugadores</Text>
            {detalle.jugadores.map((jugador, index) => (
              <View
                key={index}
                style={[
                  styles.jugadorFila,
                  jugador.eliminado && styles.jugadorFilaEliminado,
                ]}
              >
                <Text style={styles.jugadorFicha}>
                  {FICHAS_EMOJIS[jugador.ficha] ?? '?'}
                </Text>
                <View style={styles.jugadorInfo}>
                  <Text
                    style={[
                      styles.jugadorNombre,
                      jugador.eliminado && styles.textoEliminado,
                    ]}
                  >
                    {jugador.nombre}
                  </Text>
                  <Text style={styles.jugadorSaldo}>
                    ${jugador.saldo.toLocaleString()}
                  </Text>
                </View>
                {jugador.eliminado && (
                  <View style={styles.badgeEliminado}>
                    <Text style={styles.badgeEliminadoTexto}>Eliminado</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Sección Transacciones */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>
              Transacciones ({detalle.transacciones.length})
            </Text>
            {detalle.transacciones.length === 0 && (
              <Text style={styles.vacitoTexto}>Sin transacciones registradas</Text>
            )}
            {detalle.transacciones.map((tx, index) => (
              <View key={index} style={styles.txFila}>
                <Text style={styles.txIcono}>
                  {ICONOS_TRANSACCION[tx.tipo] ?? '💲'}
                </Text>
                <View style={styles.txInfo}>
                  <View style={styles.txCabeceraRow}>
                    <View style={styles.txTipoBadge}>
                      <Text style={styles.txTipoTexto}>{tx.tipo}</Text>
                    </View>
                    <Text style={styles.txHora}>
                      {formatearHora(tx.creadaEn)}
                    </Text>
                  </View>
                  <Text style={styles.txConcepto} numberOfLines={2}>
                    {tx.concepto}
                  </Text>
                  <Text style={styles.txJugador}>{tx.jugadorNombre}</Text>
                </View>
                <Text
                  style={[styles.txMonto, { color: colorMonto(tx.monto) }]}
                >
                  {tx.monto > 0 ? '+' : tx.monto < 0 ? '-' : ''}$
                  {Math.abs(tx.monto).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

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
    gap: 16,
  },
  botonVolver: {
    alignSelf: 'flex-start',
  },
  botonVolverTexto: {
    color: '#457b9d',
    fontSize: 15,
    fontWeight: '600',
  },
  centrado: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  cargandoTexto: {
    color: '#aaaaaa',
    fontSize: 14,
  },
  errorTexto: {
    color: '#e63946',
    fontSize: 14,
    textAlign: 'center',
  },
  encabezado: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  encabezadoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codigo: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  modoBadge: {
    backgroundColor: '#0f3460',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modoBadgeTexto: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fecha: {
    color: '#9ca3af',
    fontSize: 12,
  },
  seccion: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  seccionTitulo: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  vacitoTexto: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  jugadorFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
  },
  jugadorFilaEliminado: {
    opacity: 0.6,
  },
  jugadorFicha: {
    fontSize: 22,
  },
  jugadorInfo: {
    flex: 1,
    gap: 2,
  },
  jugadorNombre: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  textoEliminado: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  jugadorSaldo: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeEliminado: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeEliminadoTexto: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '700',
  },
  txFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
  },
  txIcono: {
    fontSize: 18,
    marginTop: 2,
    width: 24,
    textAlign: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 3,
  },
  txCabeceraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txTipoBadge: {
    backgroundColor: '#1e3a5f',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  txTipoTexto: {
    color: '#87CEEB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  txHora: {
    color: '#6b7280',
    fontSize: 11,
  },
  txConcepto: {
    color: '#cccccc',
    fontSize: 12,
  },
  txJugador: {
    color: '#9ca3af',
    fontSize: 11,
    fontStyle: 'italic',
  },
  txMonto: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 70,
    marginTop: 2,
  },
});
