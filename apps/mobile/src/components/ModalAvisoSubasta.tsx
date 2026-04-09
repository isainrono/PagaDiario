import { Modal, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useGameStore } from '../stores/gameStore';
import {
  NOMBRES_CASILLAS,
  COLORES_GRUPO,
  GRUPO_POR_CASILLA,
  PRECIO_POR_CASILLA,
} from '../constants/tablero';

const INCREMENTO_MINIMO = 10;
const DURACION_SEGUNDOS = 60;

function segundosRestantes(expiraEn: number): number {
  return Math.max(0, Math.floor((expiraEn - Date.now()) / 1000));
}

export function ModalAvisoSubasta() {
  const subastaActiva = useGameStore((s) => s.subastaActiva);
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const subastaIdVista = useRef<string | null>(null);
  const [segundos, setSegundos] = useState(DURACION_SEGUNDOS);

  // Mostrar el modal cada vez que inicia una nueva subasta
  useEffect(() => {
    if (subastaActiva && subastaActiva.subastaId !== subastaIdVista.current) {
      subastaIdVista.current = subastaActiva.subastaId;
      setSegundos(segundosRestantes(subastaActiva.expiraEn));
      // Pequeño delay para evitar conflicto con Modals que se estén cerrando (ej. tablero)
      const t = setTimeout(() => setVisible(true), 350);
      return () => clearTimeout(t);
    }
    if (!subastaActiva) {
      setVisible(false);
    }
  }, [subastaActiva]);

  // Countdown
  useEffect(() => {
    if (!visible || !subastaActiva) return;
    const interval = setInterval(() => {
      const s = segundosRestantes(subastaActiva.expiraEn);
      setSegundos(s);
      if (s <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, subastaActiva]);

  if (!subastaActiva) return null;

  const nombre = NOMBRES_CASILLAS[subastaActiva.casilla] ?? `Casilla ${subastaActiva.casilla}`;
  const grupo = GRUPO_POR_CASILLA[subastaActiva.casilla];
  const colorGrupo = grupo && COLORES_GRUPO[grupo] ? COLORES_GRUPO[grupo] : '#888';
  const precio = PRECIO_POR_CASILLA[subastaActiva.casilla] ?? 0;
  const esFerrocarril = grupo === 'ferrocarril';
  const esServicio = grupo === 'servicio';
  const tiempoUrgente = segundos <= 10;

  const handleEntrar = () => {
    setVisible(false);
    router.push('/juego/jugadores');
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f7f7f2" />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>¡Nueva Subasta!</Text>
          <View style={[styles.timerBadge, tiempoUrgente && styles.timerBadgeUrgente]}>
            <Text style={[styles.timerText, tiempoUrgente && styles.timerTextUrgente]}>
              {segundos}s
            </Text>
          </View>
        </View>

        {/* Auction Alert Section */}
        <View style={styles.alertSection}>
          <View style={styles.campaignIconContainer}>
            <Text style={styles.campaignIcon}>📢</Text>
          </View>
          <Text style={styles.mainTitle}>¡NUEVA{'\n'}SUBASTA!</Text>
          <Text style={styles.subtitle}>
            Nadie ha comprado esta propiedad.{'\n'}¡Empieza la puja!
          </Text>
        </View>

        {/* Property Card */}
        <View style={styles.propertyCard}>
          <View style={[styles.propertyColorStripe, { backgroundColor: colorGrupo }]} />
          <View style={styles.propertyNameSection}>
            <Text style={styles.titleDeedLabel}>Title Deed</Text>
            <Text style={styles.propertyName}>{nombre.toUpperCase()}</Text>
          </View>
          <View style={styles.propertyRentSection}>
            <View style={styles.propertyRentRow}>
              <Text style={styles.rentLabel}>RENT</Text>
              <Text style={styles.rentValue}>
                ${precio > 0 ? Math.floor(precio * 0.01) + (precio <= 100 ? 6 : 10) : '—'}
              </Text>
            </View>
            <View style={styles.propertyRentRow}>
              <Text style={styles.rentLabelSmall}>Con 1 Casa</Text>
              <Text style={styles.rentValueSmall}>
                ${precio > 0 ? Math.floor(precio * 0.5) : '—'}
              </Text>
            </View>
            <View style={styles.mortgageRow}>
              <Text style={styles.mortgageLabel}>Valor hipoteca: ${Math.floor(precio / 2)}</Text>
              {esFerrocarril && <Text style={styles.propertyTypeTag}>🚂</Text>}
              {esServicio && <Text style={styles.propertyTypeTag}>⚡</Text>}
            </View>
          </View>
        </View>

        {/* Auction Details Panel */}
        <View style={styles.detailsPanel}>
          <View style={styles.precioSalidaRow}>
            <Text style={styles.precioSalidaIcon}>💰</Text>
            <View>
              <Text style={styles.precioSalidaLabel}>PRECIO DE SALIDA</Text>
              <Text style={styles.precioSalidaValor}>${precio}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailIcon}>✅</Text>
            <Text style={styles.detailText}>
              Incremento mínimo: <Text style={styles.detailBold}>${INCREMENTO_MINIMO}</Text>
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailIcon}>⏱️</Text>
            <Text style={styles.detailText}>
              Duración: <Text style={styles.detailBold}>{DURACION_SEGUNDOS} segundos</Text>
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleEntrar} activeOpacity={0.85}>
          <Text style={styles.ctaText}>¡ENTRAR A LA PUJA!</Text>
          <Text style={styles.ctaArrow}>↗</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Design system colors ──────────────────────────────────────────────────
const C = {
  background: '#f7f7f2',
  onBackground: '#2d2f2c',
  primary: '#006a35',
  primaryContainer: '#75f39c',
  onPrimary: '#cdffd4',
  secondary: '#ba0015',
  secondaryContainer: '#ffc3bd',
  onSecondaryContainer: '#94000f',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f1ec',
  surfaceContainer: '#e8e9e3',
  surfaceContainerHigh: '#e2e3dd',
  onSurface: '#2d2f2c',
  onSurfaceVariant: '#5a5c58',
  outlineVariant: '#adada9',
  error: '#b31b25',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onBackground,
    letterSpacing: -0.5,
  },
  timerBadge: {
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timerBadgeUrgente: {
    backgroundColor: C.error,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.onSurfaceVariant,
  },
  timerTextUrgente: {
    color: '#ffffff',
  },

  // Alert section
  alertSection: {
    alignItems: 'center',
    gap: 8,
  },
  campaignIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignIcon: {
    fontSize: 28,
  },
  mainTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: C.onBackground,
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Property card
  propertyCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    alignSelf: 'center',
    width: '70%',
  },
  propertyColorStripe: {
    height: 40,
    width: '100%',
  },
  propertyNameSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainerHigh,
  },
  titleDeedLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: '900',
    color: C.onSurface,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  propertyRentSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  propertyRentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rentLabel: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    fontWeight: '600',
  },
  rentValue: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurface,
  },
  rentLabelSmall: {
    fontSize: 10,
    color: C.onSurfaceVariant,
  },
  rentValueSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onSurface,
  },
  mortgageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.surfaceContainerHigh,
  },
  mortgageLabel: {
    fontSize: 9,
    color: C.onSurfaceVariant,
    fontStyle: 'italic',
  },
  propertyTypeTag: {
    fontSize: 16,
  },

  // Details panel
  detailsPanel: {
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  precioSalidaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  precioSalidaIcon: {
    fontSize: 32,
  },
  precioSalidaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  precioSalidaValor: {
    fontSize: 36,
    fontWeight: '900',
    color: C.onBackground,
    letterSpacing: -1,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailIcon: {
    fontSize: 18,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.onSurface,
  },
  detailBold: {
    fontWeight: '700',
  },

  // CTA button
  ctaButton: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '900',
    color: C.onPrimary,
    letterSpacing: 0.5,
  },
  ctaArrow: {
    fontSize: 18,
    color: C.onPrimary,
    fontWeight: '700',
  },
});
