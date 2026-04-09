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
import { useRouter } from 'expo-router';
import { api } from '../src/services/api.service';

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

interface PartidaResumen {
  partidaId: string;
  codigo: string;
  modoMonetario: string;
  creadaEn: string;
  duracionMinutos: number;
  cantidadJugadores: number;
  ganadorNombre: string | null;
  ganadorFicha: string | null;
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

export default function HistorialScreen() {
  const router = useRouter();
  const [partidas, setPartidas] = useState<PartidaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PartidaResumen[]>('/partidas/historial')
      .then((data) => {
        setPartidas(data);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Error al cargar el historial',
        );
      })
      .finally(() => {
        setCargando(false);
      });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.cabecera}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonVolver}>
          <Text style={styles.botonVolverTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Historial de partidas</Text>
      </View>

      {cargando && (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#457b9d" />
          <Text style={styles.cargandoTexto}>Cargando historial...</Text>
        </View>
      )}

      {!cargando && error && (
        <View style={styles.centrado}>
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      )}

      {!cargando && !error && partidas.length === 0 && (
        <View style={styles.centrado}>
          <Text style={styles.vacitoTexto}>Aún no hay partidas jugadas</Text>
        </View>
      )}

      {!cargando &&
        !error &&
        partidas.map((item) => (
          <TouchableOpacity
            key={item.partidaId}
            style={styles.card}
            onPress={() => router.push(`/historial/${item.partidaId}`)}
          >
            <View style={styles.cardCabecera}>
              <Text style={styles.cardCodigo}>{item.codigo}</Text>
              <View style={styles.modoBadge}>
                <Text style={styles.modoBadgeTexto}>{item.modoMonetario}</Text>
              </View>
            </View>

            <Text style={styles.cardFecha}>{formatearFecha(item.creadaEn)}</Text>

            <View style={styles.cardInfo}>
              <Text style={styles.cardInfoItem}>
                {item.cantidadJugadores} jugadores
              </Text>
              <Text style={styles.cardInfoSeparador}>·</Text>
              <Text style={styles.cardInfoItem}>
                {item.duracionMinutos} min
              </Text>
            </View>

            {item.ganadorNombre ? (
              <View style={styles.ganadorRow}>
                <Text style={styles.ganadorEmoji}>
                  {item.ganadorFicha ? (FICHAS_EMOJIS[item.ganadorFicha] ?? '?') : '?'}
                </Text>
                <Text style={styles.ganadorTexto}>
                  Ganador: {item.ganadorNombre}
                </Text>
              </View>
            ) : (
              <Text style={styles.sinGanadorTexto}>Sin ganador registrado</Text>
            )}

            <Text style={styles.cardVerDetalle}>Ver detalle →</Text>
          </TouchableOpacity>
        ))}
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
    gap: 12,
  },
  cabecera: {
    gap: 8,
    marginBottom: 4,
  },
  botonVolver: {
    alignSelf: 'flex-start',
  },
  botonVolverTexto: {
    color: '#457b9d',
    fontSize: 15,
    fontWeight: '600',
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
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
  vacitoTexto: {
    color: '#aaaaaa',
    fontSize: 15,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  cardCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCodigo: {
    color: '#ffffff',
    fontSize: 18,
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
  cardFecha: {
    color: '#9ca3af',
    fontSize: 12,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardInfoItem: {
    color: '#aaaaaa',
    fontSize: 13,
  },
  cardInfoSeparador: {
    color: '#555',
    fontSize: 13,
  },
  ganadorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ganadorEmoji: {
    fontSize: 18,
  },
  ganadorTexto: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  sinGanadorTexto: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  cardVerDetalle: {
    color: '#457b9d',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
});
