import { Modal, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../stores/gameStore';
import {
  NOMBRES_CASILLAS,
  COLORES_GRUPO,
  GRUPO_POR_CASILLA,
} from '../constants/tablero';

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

interface ResultadoSubasta {
  ganadorId: string | null;
  monto: number;
  casilla: number;
}

interface Props {
  resultado: ResultadoSubasta;
  onCerrar: () => void;
}

export function ModalResultadoSubasta({ resultado, onCerrar }: Props) {
  const { jugadores, miJugadorId } = useGameStore();
  const router = useRouter();

  const ganador = jugadores.find((j) => j.id === resultado.ganadorId) ?? null;
  const esGanador = resultado.ganadorId === miJugadorId;

  const nombreProp = NOMBRES_CASILLAS[resultado.casilla] ?? `Casilla ${resultado.casilla}`;
  const grupo = GRUPO_POR_CASILLA[resultado.casilla];
  const colorProp = grupo && COLORES_GRUPO[grupo] ? COLORES_GRUPO[grupo] : '#888';
  const fichaEmoji = ganador ? (FICHAS_EMOJIS[ganador.ficha] ?? '👤') : null;

  const handleVolverTablero = () => {
    onCerrar();
    router.push('/juego/tablero');
  };

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCerrar}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.screen}>
        {/* Gradient celebration background */}
        <View style={s.celebrationBg} pointerEvents="none" />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Resultado de Subasta</Text>
        </View>

        <View style={s.content}>
          {/* Headline */}
          <View style={s.headlineSection}>
            <View style={s.badgeRow}>
              <Text style={s.badgeText}>✓  SUBASTA FINALIZADA</Text>
            </View>
            <Text style={s.mainTitle}>
              {resultado.ganadorId ? '¡SUBASTA\nFINALIZADA!' : 'SIN\nGANADOR'}
            </Text>
          </View>

          {/* Winner card */}
          <View style={s.winnerCard}>
            {/* Trophy icon floating above */}
            <View style={s.trophyContainer}>
              <View style={[s.trophyBg, !resultado.ganadorId && s.trophyBgNeutral]}>
                <Text style={s.trophyIcon}>{resultado.ganadorId ? '🏆' : '🏷️'}</Text>
              </View>
            </View>

            <View style={s.winnerInfo}>
              <Text style={s.winnerLabel}>
                {resultado.ganadorId ? 'GANADOR' : 'RESULTADO'}
              </Text>
              <Text style={[s.winnerName, !resultado.ganadorId && s.winnerNameNeutral]}>
                {ganador
                  ? `${fichaEmoji}  ${ganador.nombre}${esGanador ? ' (vos)' : ''}`
                  : 'Nadie pujó'}
              </Text>
              <View style={s.winnerDivider} />
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Precio Final</Text>
                <Text style={s.statValue}>
                  {resultado.ganadorId ? `$${resultado.monto}` : '—'}
                </Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Estado</Text>
                <Text style={[s.statValue, resultado.ganadorId ? s.statValueGreen : s.statValueNeutral]}>
                  {resultado.ganadorId ? '🏠 OK' : '🔓 Libre'}
                </Text>
              </View>
            </View>
          </View>

          {/* Property card */}
          <View style={s.propCardWrapper}>
            {/* Shadow card behind */}
            <View style={s.propCardShadow} />
            <View style={s.propCard}>
              <View style={[s.propCardHeader, { backgroundColor: colorProp }]}>
                <Text style={s.propCardHeaderText}>{nombreProp.toUpperCase()}</Text>
              </View>
              <View style={s.propCardBody}>
                <View style={s.propCardIcon}>
                  <Text style={{ fontSize: 36 }}>🏢</Text>
                </View>
                <View style={s.propCardFooter}>
                  <Text style={s.propCardFooterLabel}>
                    {resultado.ganadorId ? 'COLECCIÓN AÑADIDA' : 'PROPIEDAD LIBRE'}
                  </Text>
                  <Text style={s.propCardFooterSub}>
                    {ganador ? `${ganador.nombre}'s Empire` : 'Disponible'}
                  </Text>
                </View>
              </View>
              {resultado.ganadorId && (
                <View style={s.verifiedBadge}>
                  <Text style={{ fontSize: 18 }}>✅</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* CTA button */}
        <View style={s.bottomArea}>
          <TouchableOpacity style={s.ctaButton} onPress={handleVolverTablero} activeOpacity={0.85}>
            <Text style={s.ctaText}>VOLVER AL TABLERO</Text>
            <Text style={s.ctaArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#f7f7f2',
  onBg: '#2d2f2c',
  primary: '#006a35',
  primaryContainer: '#75f39c',
  onPrimaryFixed: '#004420',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f1f1ec',
  surfaceHigh: '#e2e3dd',
  onSurface: '#2d2f2c',
  onSurfaceVariant: '#5a5c58',
  outlineVariant: '#adada9',
};

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  celebrationBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: '#75f39c',
    opacity: 0.22,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
  },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onBg,
    letterSpacing: -0.3,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
  },

  // Headline
  headlineSection: {
    alignItems: 'center',
    gap: 12,
  },
  badgeRow: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onPrimaryFixed,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: C.onBg,
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 48,
  },

  // Winner card
  winnerCard: {
    backgroundColor: C.surfaceLowest,
    borderRadius: 20,
    padding: 24,
    paddingTop: 40,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(173,173,169,0.1)',
  },
  trophyContainer: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    backgroundColor: C.bg,
    borderRadius: 999,
    padding: 6,
  },
  trophyBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyBgNeutral: {
    backgroundColor: C.onSurfaceVariant,
  },
  trophyIcon: {
    fontSize: 26,
  },
  winnerInfo: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  winnerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  winnerName: {
    fontSize: 32,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  winnerNameNeutral: {
    color: C.onSurfaceVariant,
    fontSize: 24,
  },
  winnerDivider: {
    width: 48,
    height: 4,
    backgroundColor: C.primaryContainer,
    borderRadius: 2,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statItem: {
    flex: 1,
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onBg,
  },
  statValueGreen: {
    color: C.primary,
  },
  statValueNeutral: {
    color: C.onSurfaceVariant,
  },

  // Property card
  propCardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  propCardShadow: {
    position: 'absolute',
    width: 160,
    height: 200,
    backgroundColor: C.surfaceHigh,
    borderRadius: 12,
    transform: [{ rotate: '-3deg' }, { translateX: 12 }, { translateY: 12 }],
    opacity: 0.4,
  },
  propCard: {
    width: 160,
    height: 200,
    backgroundColor: C.surfaceLowest,
    borderRadius: 12,
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(173,173,169,0.2)',
  },
  propCardHeader: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  propCardHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  propCardBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  propCardIcon: {
    width: 56,
    height: 56,
    backgroundColor: C.surfaceHigh,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propCardFooter: {
    alignItems: 'center',
    gap: 2,
  },
  propCardFooterLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  propCardFooterSub: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onBg,
    textAlign: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },

  // Bottom CTA
  bottomArea: {
    padding: 24,
    paddingBottom: 40,
  },
  ctaButton: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#cdffd4',
    letterSpacing: 0.5,
  },
  ctaArrow: {
    fontSize: 18,
    color: '#cdffd4',
    fontWeight: '700',
  },
});
