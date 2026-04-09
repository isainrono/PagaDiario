import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../src/stores/gameStore';
import { ICONOS_TRANSACCION } from '../../src/constants/tablero';

const DENOMINACIONES = [500, 100, 50, 20, 10, 5, 1] as const;

function calcularDesgloseBilletes(
  monto: number,
): Record<number, number> {
  let restante = monto;
  const desglose: Record<number, number> = {};

  for (const denom of DENOMINACIONES) {
    const cantidad = Math.floor(restante / denom);
    if (cantidad > 0) {
      desglose[denom] = cantidad;
      restante -= cantidad * denom;
    }
  }

  return desglose;
}

function formatearFecha(fechaStr: string): string {
  try {
    const fecha = new Date(fechaStr);
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
  } catch {
    return fechaStr;
  }
}

function colorMonto(monto: number): string {
  if (monto > 0) return '#4caf50';
  if (monto < 0) return '#e63946';
  return '#aaaaaa';
}

export default function CuentaScreen() {
  const {
    miJugadorId,
    saldos,
    transacciones,
    modoMonetario,
  } = useGameStore();

  const miSaldo = miJugadorId ? (saldos[miJugadorId] ?? 1500) : 1500;

  const misTransacciones = miJugadorId
    ? transacciones.filter((t) => t.jugadorId === miJugadorId)
    : [];

  const mostrarBilletes =
    modoMonetario === 'FISICO' || modoMonetario === 'HIBRIDO';

  const desglose = mostrarBilletes
    ? calcularDesgloseBilletes(miSaldo)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Saldo destacado */}
      <View style={styles.saldoContainer}>
        <Text style={styles.saldoLabel}>Mi saldo</Text>
        <Text style={styles.saldoValor}>${miSaldo.toLocaleString()}</Text>
        {modoMonetario === 'DIGITAL' && (
          <View style={styles.modoBadge}>
            <Text style={styles.modoBadgeTexto}>DIGITAL</Text>
          </View>
        )}
        {modoMonetario === 'FISICO' && (
          <View style={[styles.modoBadge, styles.modoBadgeFisico]}>
            <Text style={styles.modoBadgeTexto}>FISICO</Text>
          </View>
        )}
        {modoMonetario === 'HIBRIDO' && (
          <View style={[styles.modoBadge, styles.modoBadgeHibrido]}>
            <Text style={styles.modoBadgeTexto}>HIBRIDO</Text>
          </View>
        )}
      </View>

      {/* Desglose de billetes (modo FISICO / HIBRIDO) */}
      {mostrarBilletes && desglose && (
        <View style={styles.billetes}>
          <Text style={styles.seccionTitulo}>Desglose de billetes</Text>
          <View style={styles.billetesGrid}>
            {DENOMINACIONES.map((denom) => {
              const cantidad = desglose[denom] ?? 0;
              return (
                <View
                  key={denom}
                  style={[
                    styles.billeteFila,
                    cantidad === 0 && styles.billeteFilaVacia,
                  ]}
                >
                  <View style={styles.billeteValor}>
                    <Text style={styles.billeteValorTexto}>${denom}</Text>
                  </View>
                  <Text
                    style={[
                      styles.billeteCantidad,
                      cantidad === 0 && styles.billeteCantidadVacia,
                    ]}
                  >
                    x{cantidad}
                  </Text>
                  {cantidad > 0 && (
                    <Text style={styles.billeteSubtotal}>
                      = ${(denom * cantidad).toLocaleString()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Historial de transacciones */}
      <View style={styles.historial}>
        <Text style={styles.seccionTitulo}>Historial de transacciones</Text>

        {misTransacciones.length === 0 && (
          <View style={styles.sinTransacciones}>
            <Text style={styles.sinTransaccionesTexto}>
              Todavía no hay transacciones
            </Text>
          </View>
        )}

        {misTransacciones.map((transaccion, idx) => (
          <View key={`${transaccion.id}_${idx}`} style={styles.transaccionFila}>
            <Text style={styles.transaccionIcono}>
              {ICONOS_TRANSACCION[transaccion.tipo] ?? '💲'}
            </Text>
            <View style={styles.transaccionInfo}>
              <View style={styles.transaccionTipoRow}>
                <View style={styles.tipoBadge}>
                  <Text style={styles.tipoBadgeTexto}>{transaccion.tipo}</Text>
                </View>
                <Text style={styles.transaccionHora}>
                  {formatearFecha(transaccion.creadaEn)}
                </Text>
              </View>
              <Text style={styles.transaccionConcepto} numberOfLines={2}>
                {transaccion.concepto}
              </Text>
            </View>
            <Text
              style={[
                styles.transaccionMonto,
                { color: colorMonto(transaccion.monto) },
              ]}
            >
              {transaccion.monto > 0 ? '+' : ''}
              {transaccion.monto < 0 ? '-' : ''}
              ${Math.abs(transaccion.monto).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
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
    gap: 16,
  },
  saldoContainer: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4caf50',
    gap: 8,
  },
  saldoLabel: {
    color: '#aaaaaa',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  saldoValor: {
    color: '#4caf50',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  modoBadge: {
    backgroundColor: '#0f3460',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modoBadgeFisico: {
    backgroundColor: '#78350f',
  },
  modoBadgeHibrido: {
    backgroundColor: '#312e81',
  },
  modoBadgeTexto: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  billetes: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 10,
  },
  billetesGrid: {
    gap: 6,
  },
  billeteFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
  },
  billeteFilaVacia: {
    opacity: 0.4,
  },
  billeteValor: {
    backgroundColor: '#457b9d',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  billeteValorTexto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  billeteCantidad: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 32,
  },
  billeteCantidadVacia: {
    color: '#555',
  },
  billeteSubtotal: {
    color: '#4caf50',
    fontSize: 13,
    marginLeft: 'auto',
  },
  historial: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  sinTransacciones: {
    padding: 16,
    alignItems: 'center',
  },
  sinTransaccionesTexto: {
    color: '#555',
    fontSize: 14,
  },
  transaccionFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f1a2e',
    gap: 8,
  },
  transaccionIcono: {
    fontSize: 18,
    marginTop: 2,
    width: 22,
    textAlign: 'center',
  },
  transaccionInfo: {
    flex: 1,
    gap: 4,
  },
  transaccionTipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipoBadge: {
    backgroundColor: '#1e3a5f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tipoBadgeTexto: {
    color: '#87CEEB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  transaccionHora: {
    color: '#666',
    fontSize: 11,
  },
  transaccionConcepto: {
    color: '#cccccc',
    fontSize: 13,
  },
  transaccionMonto: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 80,
  },
});
