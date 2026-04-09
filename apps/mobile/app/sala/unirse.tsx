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
import type { Ficha } from '@pagadiario/types';

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

export default function UnirsePartidaScreen() {
  const router = useRouter();
  const setEstado = useGameStore((s) => s.setEstado);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [fichaSeleccionada, setFichaSeleccionada] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(false);

  const puedeUnirse =
    codigo.trim().length === 6 &&
    nombre.trim().length > 0 &&
    fichaSeleccionada !== null;

  const handleUnirse = async () => {
    if (!puedeUnirse || cargando) return;

    setCargando(true);
    try {
      const respuesta = await api.post<UnirseResponse>(
        `/partidas/${codigo.trim()}/unirse`,
        { nombre: nombre.trim(), ficha: fichaSeleccionada },
      );

      setEstado({
        partidaId: respuesta.partida.partidaId,
        codigo: respuesta.partida.codigo,
        miJugadorId: respuesta.jugadorId,
      });

      await guardarSesion({
        partidaId: respuesta.partida.partidaId,
        miJugadorId: respuesta.jugadorId,
        codigo: respuesta.partida.codigo,
        estado: respuesta.partida.estado,
        modoMonetario: respuesta.partida.modoMonetario as string,
      });

      router.push(`/sala/${respuesta.partida.codigo}/espera`);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al unirse a la partida';
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
      <Text style={styles.titulo}>Unirse a partida</Text>

      <Text style={styles.etiqueta}>Código de sala</Text>
      <TextInput
        style={styles.input}
        placeholder="XXXXXX"
        placeholderTextColor="#888"
        value={codigo}
        onChangeText={(t) => setCodigo(t.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
      />

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

      <TouchableOpacity
        style={[styles.boton, !puedeUnirse && styles.botonDeshabilitado]}
        onPress={handleUnirse}
        disabled={!puedeUnirse || cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>Unirse</Text>
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
    borderColor: '#457b9d',
    backgroundColor: '#1a2030',
  },
  fichaEmoji: {
    fontSize: 24,
  },
  fichaNombre: {
    color: '#aaaaaa',
    fontSize: 9,
    marginTop: 2,
  },
  boton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#457b9d',
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
