import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

export default function Interest() {
  const [props, setProps] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api<any[]>("/properties?status=approved"), api<any[]>("/admin/interest/history")]);
      setProps(p); setHistory(h);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const distribute = async () => {
    if (!selected) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ total_paid: number; investors: number }>("/admin/interest/distribute", { body: { property_id: selected.id, month } });
      setToast(`Paid ${fmtInr(r.total_paid)} to ${r.investors} investors.`);
      setSelected(null);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={{ padding: spacing.xl, paddingBottom: 0 }}>
          <Text style={styles.title}>Interest distribution</Text>
          <Text style={styles.sub}>Credit monthly returns to investor wallets.</Text>
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {toast && (
          <View style={styles.toastBox}>
            <Text style={{ color: colors.success }}>{toast}</Text>
            <TouchableOpacity onPress={() => setToast(null)}><Ionicons name="close" color={colors.onSurfaceTertiary} size={16} /></TouchableOpacity>
          </View>
        )}
        <Text style={styles.section}>Approved properties</Text>
        {loading && <ActivityIndicator color={colors.brand} />}
        {props.map((p) => (
          <TouchableOpacity key={p.id} style={styles.row} onPress={() => setSelected(p)} testID={`interest-prop-${p.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{p.shares_sold}/{p.total_shares} sold · {p.monthly_return_rate}% mo</Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.brand} size={20} />
          </TouchableOpacity>
        ))}

        <Text style={styles.section}>History</Text>
        {history.length === 0 && <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No payouts yet.</Text></Card>}
        {history.map((h) => (
          <View key={h.id} style={styles.hrow} testID={`interest-history-${h.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{h.month}</Text>
              <Text style={styles.meta}>{h.investors} investors</Text>
            </View>
            <Text style={{ color: colors.success, fontFamily: fonts.display, fontSize: 15 }}>{fmtInr(h.total_paid)}</Text>
          </View>
        ))}
      </ScrollView>

      <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Distribute interest</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close" color={colors.onSurface} size={22} /></TouchableOpacity>
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, marginBottom: spacing.md }}>{selected?.name}</Text>
            <Text style={styles.label}>MONTH (YYYY-MM)</Text>
            <TextInput testID="interest-month-input" value={month} onChangeText={setMonth} style={styles.modalInput} placeholderTextColor={colors.info} />
            {err ? <Text style={{ color: colors.error, marginTop: 6 }}>{err}</Text> : null}
            <View style={{ height: spacing.md }} />
            <GoldButton testID="interest-distribute-btn" title="Distribute" onPress={distribute} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 30, fontFamily: fonts.display },
  sub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5 },
  section: { color: colors.onSurface, fontSize: 18, fontFamily: fonts.display, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  hrow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  name: { color: colors.onSurface, fontSize: 15, fontFamily: fonts.display },
  meta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  toastBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success, backgroundColor: "rgba(42,157,143,0.15)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  modalTitle: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display },
  modalInput: { marginTop: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 18, fontFamily: fonts.display },
});
