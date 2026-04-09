import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../src/stores/gameStore';
import { useSocketStore } from '../../src/stores/socketStore';
import type { Propiedad } from '@pagadiario/types';
import { COLORES_GRUPO as COLORES_GRUPO_TABLERO } from '../../src/constants/tablero';

interface ConstruccionActualizadaPayload {
  propiedadId: string;
  casas: number;
  hotel: boolean;
  casasDisponibles: number;
  hotelesDisponibles: number;
}

interface PropiedadCompradaPayload {
  casilla: number;
  propietarioId: string;
  precio: number;
}

interface ErrorPayload {
  codigo: string;
  mensaje: string;
}

interface PropiedadHipotecadaPayload {
  propiedadId: string;
  hipotecada: boolean;
}

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

const GRUPO_COLORES: Record<string, string> = {
  marron: '#8B4513',
  celeste: '#87CEEB',
  rosa: '#FF69B4',
  naranja: '#FF8C00',
  rojo: '#DC143C',
  amarillo: '#FFD700',
  verde: '#228B22',
  azul: '#0000CD',
};

const GRUPOS_CASILLAS: Record<string, number[]> = {
  marron: [1, 3],
  celeste: [6, 8, 9],
  rosa: [11, 13, 14],
  naranja: [16, 18, 19],
  rojo: [21, 23, 24],
  amarillo: [26, 27, 29],
  verde: [31, 32, 34],
  azul: [37, 39],
  ferrocarril: [5, 15, 25, 35],
  servicio: [12, 28],
};

const PRECIOS_EDIFICIO: Record<number, number> = {
  1: 50, 3: 50,
  6: 50, 8: 50, 9: 50,
  11: 100, 13: 100, 14: 100,
  16: 100, 18: 100, 19: 100,
  21: 150, 23: 150, 24: 150,
  26: 150, 27: 150, 29: 150,
  31: 200, 32: 200, 34: 200,
  37: 200, 39: 200,
};

function obtenerGrupoDeCasilla(casilla: number): string | null {
  for (const [grupo, casillas] of Object.entries(GRUPOS_CASILLAS)) {
    if (casillas.includes(casilla)) return grupo;
  }
  return null;
}

function tieneGrupoCompleto(
  casilla: number,
  miJugadorId: string,
  todasPropiedades: Propiedad[],
): boolean {
  const grupo = obtenerGrupoDeCasilla(casilla);
  if (!grupo || grupo === 'ferrocarril' || grupo === 'servicio') return false;
  const casillasGrupo = GRUPOS_CASILLAS[grupo] ?? [];
  return casillasGrupo.every((c) =>
    todasPropiedades.some(
      (p) => p.casilla === c && p.propietarioId === miJugadorId && !p.hipotecada,
    ),
  );
}

function puedeHipotecar(propiedad: Propiedad): boolean {
  return !propiedad.hipotecada && !propiedad.hotel && propiedad.casas === 0;
}

function puedeDeshipotecar(
  propiedad: Propiedad,
  saldo: number,
): boolean {
  if (!propiedad.hipotecada) return false;
  // Necesitaríamos el valor de hipoteca, pero lo simplificamos: siempre habilitar
  // y el backend validará el saldo
  return saldo > 0;
}

function puedeConstruirCasa(
  propiedad: Propiedad,
  miJugadorId: string,
  todasPropiedades: Propiedad[],
  casasDisponibles: number,
): boolean {
  if (propiedad.hotel || propiedad.hipotecada) return false;
  if (propiedad.casas >= 4) return false;
  if (casasDisponibles <= 0) return false;
  return tieneGrupoCompleto(propiedad.casilla, miJugadorId, todasPropiedades);
}

function puedeConstruirHotel(
  propiedad: Propiedad,
  hotelesDisponibles: number,
): boolean {
  return propiedad.casas === 4 && !propiedad.hotel && hotelesDisponibles > 0;
}

function agruparPropiedades(
  propiedades: Propiedad[],
): Record<string, Propiedad[]> {
  const grupos: Record<string, Propiedad[]> = {};
  for (const propiedad of propiedades) {
    const grupo = obtenerGrupoDeCasilla(propiedad.casilla) ?? 'otro';
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(propiedad);
  }
  return grupos;
}

export default function PropiedadesScreen() {
  const {
    partidaId,
    miJugadorId,
    propiedades,
    saldos,
    casasDisponibles,
    hotelesDisponibles,
    setEstado,
  } = useGameStore();

  const { emitir, escuchar } = useSocketStore();
  const escuchando = useRef(false);

  const miSaldo = miJugadorId ? (saldos[miJugadorId] ?? 1500) : 1500;

  const misPropiedades = propiedades.filter(
    (p) => p.propietarioId === miJugadorId,
  );

  useEffect(() => {
    if (escuchando.current) return;
    escuchando.current = true;

    escuchar('construccion:actualizada', (data) => {
      const payload = data as ConstruccionActualizadaPayload;
      setEstado({
        propiedades: useGameStore.getState().propiedades.map((p) =>
          p.id === payload.propiedadId
            ? { ...p, casas: payload.casas, hotel: payload.hotel }
            : p,
        ),
        casasDisponibles: payload.casasDisponibles,
        hotelesDisponibles: payload.hotelesDisponibles,
      });
    });

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

    escuchar('propiedad:hipotecada', (data) => {
      const payload = data as PropiedadHipotecadaPayload;
      setEstado({
        propiedades: useGameStore.getState().propiedades.map((p) =>
          p.id === payload.propiedadId
            ? { ...p, hipotecada: payload.hipotecada }
            : p,
        ),
      });
    });

    escuchar('error:accion', (data) => {
      const payload = data as ErrorPayload;
      Alert.alert('Error', payload.mensaje);
    });
  }, [escuchar, setEstado]);

  const handleHipotecar = (propiedadId: string) => {
    if (!partidaId) return;
    Alert.alert(
      'Hipotecar propiedad',
      '¿Estás seguro de que querés hipotecar esta propiedad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Hipotecar',
          onPress: () => emitir('propiedad:hipotecar', { partidaId, propiedadId }),
        },
      ],
    );
  };

  const handleDeshipotecar = (propiedadId: string) => {
    if (!partidaId) return;
    Alert.alert(
      'Deshipotecar propiedad',
      '¿Estás seguro? El costo es el valor de hipoteca + 10%.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deshipotecar',
          onPress: () =>
            emitir('propiedad:deshipotecar', { partidaId, propiedadId }),
        },
      ],
    );
  };

  const handleConstruirCasa = (propiedadId: string, casilla: number) => {
    if (!partidaId) return;
    const precio = PRECIOS_EDIFICIO[casilla] ?? 0;
    Alert.alert(
      'Construir casa',
      `Costo: $${precio}. ¿Confirmás la construcción?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Construir',
          onPress: () =>
            emitir('construccion:agregarCasa', { partidaId, propiedadId }),
        },
      ],
    );
  };

  const handleConstruirHotel = (propiedadId: string, casilla: number) => {
    if (!partidaId) return;
    const precio = PRECIOS_EDIFICIO[casilla] ?? 0;
    Alert.alert(
      'Construir hotel',
      `Costo: $${precio}. Se devuelven 4 casas al banco. ¿Confirmás?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Construir',
          onPress: () =>
            emitir('construccion:agregarHotel', { partidaId, propiedadId }),
        },
      ],
    );
  };

  const gruposPropiedades = agruparPropiedades(misPropiedades);
  const ordenGrupos = [
    'marron',
    'celeste',
    'rosa',
    'naranja',
    'rojo',
    'amarillo',
    'verde',
    'azul',
    'ferrocarril',
    'servicio',
  ];

  const gruposConPropiedades = ordenGrupos.filter(
    (g) => (gruposPropiedades[g]?.length ?? 0) > 0,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Cabecera */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Mis Propiedades</Text>
        <View style={styles.bancoBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Casas</Text>
            <Text style={styles.badgeValor}>{casasDisponibles}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Hoteles</Text>
            <Text style={styles.badgeValor}>{hotelesDisponibles}</Text>
          </View>
        </View>
      </View>

      {misPropiedades.length === 0 && (
        <View style={styles.sinPropiedades}>
          <Text style={styles.sinPropiedadesTexto}>
            Todavía no tenés propiedades
          </Text>
        </View>
      )}

      {gruposConPropiedades.map((grupo) => {
        const props = gruposPropiedades[grupo] ?? [];
        const colorGrupo = GRUPO_COLORES[grupo] ?? '#555';

        return (
          <View key={grupo} style={styles.grupoContainer}>
            <View style={[styles.grupoHeader, { borderLeftColor: colorGrupo }]}>
              <Text style={styles.grupoNombre}>
                {grupo.charAt(0).toUpperCase() + grupo.slice(1)}
              </Text>
            </View>

            {props.map((propiedad) => {
              const nombre =
                NOMBRES_CASILLAS[propiedad.casilla] ?? `Casilla ${propiedad.casilla}`;
              const pHipotecar = puedeHipotecar(propiedad);
              const pDeshipotecar = puedeDeshipotecar(propiedad, miSaldo);
              const pCasa = miJugadorId
                ? puedeConstruirCasa(propiedad, miJugadorId, propiedades, casasDisponibles)
                : false;
              const pHotel = puedeConstruirHotel(propiedad, hotelesDisponibles);
              const colorBorde = COLORES_GRUPO_TABLERO[grupo] ?? colorGrupo;

              return (
                <View
                  key={propiedad.id}
                  style={[
                    styles.propiedadCard,
                    { borderLeftColor: colorBorde, borderLeftWidth: 4 },
                  ]}
                >
                  <View style={styles.propiedadInfo}>
                    <View style={styles.propiedadTituloRow}>
                      <Text style={styles.propiedadNombre}>{nombre}</Text>
                    </View>

                    <View style={styles.propiedadDetalle}>
                      {propiedad.hipotecada && (
                        <View style={styles.tagHipotecada}>
                          <Text style={styles.tagTexto}>HIPOTECADA</Text>
                        </View>
                      )}
                      {propiedad.hotel && (
                        <View style={styles.tagHotel}>
                          <Text style={styles.tagTexto}>🏨 HOTEL</Text>
                        </View>
                      )}
                      {!propiedad.hotel && !propiedad.hipotecada && (
                        <Text style={styles.casasTexto}>
                          {propiedad.casas === 0
                            ? 'Sin casas'
                            : '🏠'.repeat(propiedad.casas)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.botonesContainer}>
                    {pHipotecar && (
                      <TouchableOpacity
                        style={styles.botonHipotecar}
                        onPress={() => handleHipotecar(propiedad.id)}
                      >
                        <Text style={styles.botonTexto}>Hipotecar</Text>
                      </TouchableOpacity>
                    )}
                    {pDeshipotecar && (
                      <TouchableOpacity
                        style={styles.botonDeshipotecar}
                        onPress={() => handleDeshipotecar(propiedad.id)}
                      >
                        <Text style={styles.botonTexto}>Deshipotecar</Text>
                      </TouchableOpacity>
                    )}
                    {pCasa && !pHotel && (
                      <TouchableOpacity
                        style={styles.botonCasa}
                        onPress={() =>
                          handleConstruirCasa(propiedad.id, propiedad.casilla)
                        }
                      >
                        <Text style={styles.botonTexto}>+ Casa</Text>
                      </TouchableOpacity>
                    )}
                    {pHotel && (
                      <TouchableOpacity
                        style={styles.botonHotel}
                        onPress={() =>
                          handleConstruirHotel(propiedad.id, propiedad.casilla)
                        }
                      >
                        <Text style={styles.botonTexto}>Hotel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  bancoBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  badgeLabel: {
    color: '#aaaaaa',
    fontSize: 11,
  },
  badgeValor: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: '700',
  },
  sinPropiedades: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  sinPropiedadesTexto: {
    color: '#aaaaaa',
    fontSize: 15,
  },
  grupoContainer: {
    gap: 6,
  },
  grupoHeader: {
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginBottom: 2,
  },
  grupoNombre: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  propiedadCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  propiedadInfo: {
    flex: 1,
    gap: 4,
  },
  propiedadTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  propiedadNombre: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  propiedadDetalle: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  casasTexto: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  tagHipotecada: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagHotel: {
    backgroundColor: '#78350f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagTexto: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  botonesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: 160,
  },
  botonHipotecar: {
    backgroundColor: '#7f1d1d',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  botonDeshipotecar: {
    backgroundColor: '#065f46',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  botonCasa: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  botonHotel: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
