import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { api } from '../../src/services/api.service';
import { useGameStore } from '../../src/stores/gameStore';
import { guardarSesion } from '../../src/services/session.service';
import type { Ficha, ModoMonetario } from '@pagadiario/types';

const FICHAS: Ficha[] = [
  'PERRO',
  'SOMBRERO',
  'COCHE',
  'BARCO',
  'DEDAL',
  'CARRETILLA',
  'CABALLO',
  'PLANCHA',
];

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

const MODOS: { valor: ModoMonetario; etiqueta: string }[] = [
  { valor: 'DIGITAL', etiqueta: 'Digital' },
  { valor: 'FISICO', etiqueta: 'Físico' },
  { valor: 'HIBRIDO', etiqueta: 'Híbrido' },
];

interface PartidaResponse {
  partidaId: string;
  codigo: string;
  estado: string;
  modoMonetario: string;
}

interface UnirseResponse {
  jugadorId: string;
  partida: {
    partidaId: string;
    codigo: string;
    estado: string;
    modoMonetario: string;
    jugadores: unknown[];
  };
}

export default function CrearPartidaScreen() {
  const router = useRouter();
  const setEstado = useGameStore((s) => s.setEstado);

  const [nombre, setNombre] = useState('');
  const [fichaSeleccionada, setFichaSeleccionada] = useState<Ficha | null>(null);
  const [modoMonetario, setModoMonetario] = useState<ModoMonetario>('DIGITAL');
  const [cargando, setCargando] = useState(false);

  const puedeCrear = nombre.trim().length > 0 && fichaSeleccionada !== null;

  const handleCrear = async () => {
    if (!puedeCrear || cargando) return;

    setCargando(true);
    try {
      const partida = await api.post<PartidaResponse>('/partidas', {
        modoMonetario,
      });

      setEstado({
        partidaId: partida.partidaId,
        codigo: partida.codigo,
      });

      const respuesta = await api.post<UnirseResponse>(
        `/partidas/${partida.codigo}/unirse`,
        { nombre: nombre.trim(), ficha: fichaSeleccionada },
      );

      setEstado({
        miJugadorId: respuesta.jugadorId,
        creadaEn: new Date().toISOString(),
      });

      await guardarSesion({
        partidaId: partida.partidaId,
        miJugadorId: respuesta.jugadorId,
        codigo: partida.codigo,
        estado: 'ESPERANDO',
        modoMonetario: modoMonetario,
      });

      router.push(`/sala/${partida.codigo}/espera`);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al crear la partida';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titulo}>Crear partida</Text>

      <Text style={styles.etiqueta}>Tu nombre</Text>
      <TextInput
        style={styles.input}
        placeholder="Ingresá tu nombre"
        placeholderTextColor="#888"
        value={nombre}
        onChangeText={setNombre}
        maxLength={20}
        autoCapitalize="words"
      />

      <Text style={styles.etiqueta}>Elegí tu ficha</Text>
      <View style={styles.fichasGrid}>
        {FICHAS.map((ficha) => (
          <TouchableOpacity
            key={ficha}
            style={[
              styles.fichaBoton,
              fichaSeleccionada === ficha && styles.fichaSeleccionada,
            ]}
            onPress={() => setFichaSeleccionada(ficha)}
          >
            <Text style={styles.fichaEmoji}>{FICHAS_EMOJI[ficha]}</Text>
            <Text style={styles.fichaNombre}>{ficha}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.etiqueta}>Modo monetario</Text>
      <View style={styles.modosRow}>
        {MODOS.map((modo) => (
          <TouchableOpacity
            key={modo.valor}
            style={[
              styles.modoBoton,
              modoMonetario === modo.valor && styles.modoSeleccionado,
            ]}
            onPress={() => setModoMonetario(modo.valor)}
          >
            <Text
              style={[
                styles.modoTexto,
                modoMonetario === modo.valor && styles.modoTextoSeleccionado,
              ]}
            >
              {modo.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.boton, !puedeCrear && styles.botonDeshabilitado]}
        onPress={handleCrear}
        disabled={!puedeCrear || cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>Crear partida</Text>
        )}
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
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 32,
    textAlign: 'center',
  },
  etiqueta: {
    fontSize: 14,
    color: '#aaaaaa',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#ffffff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  fichasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fichaBoton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaSeleccionada: {
    borderColor: '#e63946',
    backgroundColor: '#2a1a1e',
  },
  fichaEmoji: {
    fontSize: 24,
  },
  fichaNombre: {
    color: '#aaaaaa',
    fontSize: 9,
    marginTop: 2,
  },
  modosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modoBoton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
  },
  modoSeleccionado: {
    borderColor: '#457b9d',
    backgroundColor: '#1a2a3e',
  },
  modoTexto: {
    color: '#aaaaaa',
    fontSize: 14,
    fontWeight: '500',
  },
  modoTextoSeleccionado: {
    color: '#ffffff',
  },
  boton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
  },
  botonDeshabilitado: {
    backgroundColor: '#666',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
