import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useGameStore } from '../src/stores/gameStore';
import { obtenerSesion, limpiarSesion, type SesionGuardada } from '../src/services/session.service';
import { api } from '../src/services/api.service';

export default function BienvenidaScreen() {
  const router = useRouter();
  const setEstado = useGameStore((s) => s.setEstado);

  const [sesion, setSesion] = useState<SesionGuardada | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [retomando, setRetomando] = useState(false);

  useEffect(() => {
    obtenerSesion().then((s) => {
      setSesion(s);
      setVerificando(false);
    });
  }, []);

  const handleRetomarPartida = async () => {
    if (!sesion || retomando) return;
    setRetomando(true);
    try {
      // Verificar que la partida sigue activa en el servidor
      const partida = await api.get<{ estado: string; codigo: string }>(
        `/partidas/${sesion.partidaId}`,
      );

      if (partida.estado === 'FINALIZADA') {
        await limpiarSesion();
        setSesion(null);
        return;
      }

      // Restaurar el store con los datos de la sesión
      setEstado({
        partidaId: sesion.partidaId,
        miJugadorId: sesion.miJugadorId,
        codigo: sesion.codigo,
        modoMonetario: sesion.modoMonetario as never,
      });

      if (partida.estado === 'EN_CURSO') {
        router.replace('/juego/tablero');
      } else {
        router.replace(`/sala/${sesion.codigo}/espera`);
      }
    } catch {
      await limpiarSesion();
      setSesion(null);
    } finally {
      setRetomando(false);
    }
  };

  const handleDescartarSesion = async () => {
    await limpiarSesion();
    setSesion(null);
  };

  if (verificando) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#457b9d" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>PagaDiario</Text>

      {sesion && (
        <View style={styles.sesionContainer}>
          <Text style={styles.sesionTitulo}>Partida en curso</Text>
          <Text style={styles.sesionInfo}>
            Sala: <Text style={styles.sesionCodigo}>{sesion.codigo}</Text>
          </Text>
          <Text style={styles.sesionEstado}>
            {sesion.estado === 'EN_CURSO' ? 'Juego iniciado' : 'En sala de espera'}
          </Text>
          <TouchableOpacity
            style={[styles.boton, styles.botonRetomarPrimario, retomando && styles.botonDeshabilitado]}
            onPress={handleRetomarPartida}
            disabled={retomando}
          >
            {retomando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Retomar partida</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDescartarSesion} style={styles.descartarBoton}>
            <Text style={styles.descartarTexto}>Descartar y empezar de nuevo</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.boton}
        onPress={() => router.push('/sala/crear')}
      >
        <Text style={styles.botonTexto}>Crear partida</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.boton, styles.botonSecundario]}
        onPress={() => router.push('/sala/unirse')}
      >
        <Text style={styles.botonTexto}>Unirse a partida</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.boton, styles.botonHistorial]}
        onPress={() => router.push('/historial')}
      >
        <Text style={styles.botonTexto}>Ver historial</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a1a2e',
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 32,
  },
  sesionContainer: {
    width: '100%',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#457b9d',
    gap: 8,
  },
  sesionTitulo: {
    color: '#457b9d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sesionInfo: {
    color: '#aaaaaa',
    fontSize: 14,
  },
  sesionCodigo: {
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  sesionEstado: {
    color: '#4caf50',
    fontSize: 13,
    marginBottom: 4,
  },
  botonRetomarPrimario: {
    backgroundColor: '#457b9d',
    marginTop: 4,
  },
  descartarBoton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  descartarTexto: {
    color: '#666',
    fontSize: 12,
  },
  boton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
    marginBottom: 12,
  },
  botonSecundario: {
    backgroundColor: '#457b9d',
  },
  botonHistorial: {
    backgroundColor: '#2d6a4f',
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
