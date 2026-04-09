import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'pagadiario_session';

export interface SesionGuardada {
  partidaId: string;
  miJugadorId: string;
  codigo: string;
  estado: string; // ESPERANDO | EN_CURSO
  modoMonetario: string;
  guardadaEn: number;
}

export async function guardarSesion(sesion: Omit<SesionGuardada, 'guardadaEn'>): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...sesion, guardadaEn: Date.now() }));
}

export async function obtenerSesion(): Promise<SesionGuardada | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const sesion = JSON.parse(raw) as SesionGuardada;
    // Descartar sesiones de más de 24 horas
    if (Date.now() - sesion.guardadaEn > 24 * 60 * 60 * 1000) {
      await limpiarSesion();
      return null;
    }
    return sesion;
  } catch {
    return null;
  }
}

export async function actualizarEstadoSesion(estado: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const sesion = JSON.parse(raw) as SesionGuardada;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...sesion, estado }));
  } catch {
    // ignorar
  }
}

export async function limpiarSesion(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
