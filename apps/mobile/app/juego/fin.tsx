import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import { useSocketStore } from '../../src/stores/socketStore';
import { limpiarSesion } from '../../src/services/session.service';
import { useMemo } from 'react';

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

export default function FinScreen() {
  const router = useRouter();
  const { jugadores, ganadorId, ranking, reset, creadaEn, partidaId } = useGameStore();
  const { desconectar } = useSocketStore();

  const ganador = jugadores.find((j) => j.id === ganadorId);

  const duracionMinutos = useMemo(() => {
    if (!creadaEn) return null;
    return Math.round((Date.now() - new Date(creadaEn).getTime()) / 60000);
  }, [creadaEn]);

  const handleVolverInicio = () => {
    reset();
    desconectar();
    void limpiarSesion();
    router.replace('/');
  };

  const rankingConNombres =
    ranking?.map((entrada, index) => {
      const jugador = jugadores.find((j) => j.id === entrada.jugadorId);
      return {
        posicion: index + 1,
        nombre: jugador?.nombre ?? entrada.jugadorId,
        ficha: jugador?.ficha ?? '',
        patrimonio: entrada.patrimonio,
      };
    }) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Partida terminada!</Text>

      {ganador && (
        <View style={styles.ganadorContainer}>
          <Text style={styles.ganadorFicha}>
            {FICHAS_EMOJIS[ganador.ficha] ?? '?'}
          </Text>
          <Text style={styles.ganadorNombre}>{ganador.nombre}</Text>
          <Text style={styles.ganadorEtiqueta}>GANADOR</Text>
        </View>
      )}

      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitulo}>Ranking final</Text>

        {rankingConNombres.map((entrada) => (
          <View
            key={entrada.posicion}
            style={[
              styles.rankingFila,
              entrada.posicion === 1 && styles.rankingFilaPrimero,
            ]}
          >
            <Text style={styles.rankingPosicion}>
              {entrada.posicion === 1
                ? '1°'
                : entrada.posicion === 2
                  ? '2°'
                  : entrada.posicion === 3
                    ? '3°'
                    : `${entrada.posicion}°`}
            </Text>
            <Text style={styles.rankingFicha}>
              {FICHAS_EMOJIS[entrada.ficha] ?? '?'}
            </Text>
            <Text style={styles.rankingNombre}>{entrada.nombre}</Text>
            <Text style={styles.rankingPatrimonio}>${entrada.patrimonio}</Text>
          </View>
        ))}
      </View>

      {duracionMinutos !== null && (
        <View style={styles.duracionContainer}>
          <Text style={styles.duracionTexto}>
            Duración: {duracionMinutos} minuto{duracionMinutos !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {partidaId && (
        <TouchableOpacity
          style={styles.botonDetalle}
          onPress={() => router.push(`/historial/${partidaId}`)}
        >
          <Text style={styles.botonTexto}>Ver detalle</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.botonVolver} onPress={handleVolverInicio}>
        <Text style={styles.botonTexto}>Volver al inicio</Text>
      </TouchableOpacity>
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
    padding: 24,
    paddingBottom: 48,
    gap: 24,
    alignItems: 'center',
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 16,
  },
  ganadorContainer: {
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 28,
    borderWidth: 2,
    borderColor: '#f59e0b',
    width: '100%',
    gap: 8,
  },
  ganadorFicha: {
    fontSize: 64,
  },
  ganadorNombre: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  ganadorEtiqueta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 2,
  },
  rankingContainer: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
    gap: 8,
  },
  rankingTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  rankingFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
    gap: 10,
  },
  rankingFilaPrimero: {
    backgroundColor: '#2a2000',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  rankingPosicion: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '700',
    width: 30,
  },
  rankingFicha: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  rankingNombre: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  rankingPatrimonio: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '700',
  },
  duracionContainer: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  duracionTexto: {
    color: '#aaaaaa',
    fontSize: 14,
    textAlign: 'center',
  },
  botonDetalle: {
    backgroundColor: '#2d6a4f',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  botonVolver: {
    backgroundColor: '#457b9d',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
