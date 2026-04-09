import { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useSocketStore } from '../../src/stores/socketStore';
import { useGameStore } from '../../src/stores/gameStore';
import { ModalAvisoSubasta } from '../../src/components/ModalAvisoSubasta';
import { ModalResultadoSubasta } from '../../src/components/ModalResultadoSubasta';

interface PartidaFinalizadaPayload {
  ganadorId: string;
  ranking: { jugadorId: string; patrimonio: number }[];
}

interface SubastaIniciadaPayload {
  subastaId: string;
  casilla: number;
  expiraEn: number;
}

interface SubastaNuevaPujaPayload {
  subastaId: string;
  jugadorId: string;
  monto: number;
}

interface SubastaResueltaPayload {
  subastaId: string;
  ganadorId: string | null;
  monto: number;
  casilla: number;
}

export default function JuegoLayout() {
  const { escuchar } = useSocketStore();
  const { setEstado, resultadoSubasta } = useGameStore();
  const router = useRouter();
  const escuchando = useRef(false);

  useEffect(() => {
    if (escuchando.current) return;
    escuchando.current = true;

    escuchar('partida:finalizada', (data) => {
      const payload = data as PartidaFinalizadaPayload;
      setEstado({
        ganadorId: payload.ganadorId,
        ranking: payload.ranking,
      });
      router.replace('/juego/fin');
    });

    escuchar('subasta:iniciada', (data) => {
      const payload = data as SubastaIniciadaPayload;
      setEstado({
        subastaActiva: {
          subastaId: payload.subastaId,
          casilla: payload.casilla,
          expiraEn: payload.expiraEn,
          pujas: [],
        },
      });
    });

    escuchar('subasta:nuevaPuja', (data) => {
      const payload = data as SubastaNuevaPujaPayload;
      const subasta = useGameStore.getState().subastaActiva;
      if (!subasta || subasta.subastaId !== payload.subastaId) return;
      const pujasFiltradas = subasta.pujas.filter(
        (p) => p.jugadorId !== payload.jugadorId,
      );
      pujasFiltradas.push({ jugadorId: payload.jugadorId, monto: payload.monto });
      setEstado({ subastaActiva: { ...subasta, pujas: pujasFiltradas } });
    });

    escuchar('subasta:resuelta', (data) => {
      const payload = data as SubastaResueltaPayload;
      setEstado({
        subastaActiva: null,
        resultadoSubasta: {
          ganadorId: payload.ganadorId,
          monto: payload.monto,
          casilla: payload.casilla,
        },
      });
    });
  }, [escuchar, setEstado, router]);

  return (
    <>
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="tablero" options={{ title: 'Tablero' }} />
        <Tabs.Screen name="cuenta" options={{ title: 'Mi cuenta' }} />
        <Tabs.Screen name="propiedades" options={{ title: 'Propiedades' }} />
        <Tabs.Screen name="jugadores" options={{ title: 'Jugadores' }} />
        <Tabs.Screen name="fin" options={{ href: null }} />
      </Tabs>
      <ModalAvisoSubasta />
      {resultadoSubasta && (
        <ModalResultadoSubasta
          resultado={resultadoSubasta}
          onCerrar={() => setEstado({ resultadoSubasta: null })}
        />
      )}
    </>
  );
}
