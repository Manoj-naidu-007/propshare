// Company wallet — reuses similar layout as investor wallet
import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

export default function CompanyWallet() {
  const [wallet, setWallet] = useState<any>(null);
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([api("/wallet"), api<any[]>("/wallet/transactions")]);
      setWallet(w); setTx(t);
    } catch (e) { console.warn(e); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setErr(null); const n = parseFloat(amount);
    if (!n || n <= 0) { setErr("Enter valid amount"); return; }
    setBusy(true);
    try { await api("/wallet/withdraw", { body: { amount: n } }); setShowWithdraw(false); setAmount(""); load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}><View style={styles.header}><Text style={styles.title}>Company Wallet</Text></View></SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <Card style={{ padding: spacing.xl }}>
          <Text style={styles.label}>WALLET BALANCE</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.balance}>{fmtInr(wallet?.balance || 0)}</Text>}
          <View style={{ marginTop: spacing.lg }}>
            <GoldButton testID="cwallet-withdraw" title="Request withdrawal" onPress={() => setShowWithdraw(true)} />
          </View>
        </Card>
        <Text style={styles.section}>Transactions</Text>
        {tx.length === 0 && !loading && <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No transactions yet.</Text></Card>}
        {tx.map((t) => (
          <View key={t.id} style={styles.txRow} testID={`ctx-${t.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txTitle}>{t.type.replace(/_/g, " ")}</Text>
              <Text style={styles.txDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmt, { color: t.amount >= 0 ? colors.success : colors.onSurface }]}>{t.amount >= 0 ? "+" : ""}{fmtInr(t.amount)}</Text>
          </View>
        ))}
      </ScrollView>
      <Modal transparent visible={showWithdraw} animationType="slide" onRequestClose={() => setShowWithdraw(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request withdrawal</Text>
              <TouchableOpacity onPress={() => setShowWithdraw(false)}><Ionicons name="close" color={colors.onSurface} size={22} /></TouchableOpacity>
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, marginBottom: spacing.md }}>Available: {fmtInr(wallet?.balance || 0)}</Text>
            <Text style={styles.label}>AMOUNT (₹)</Text>
            <TextInput testID="cwallet-amount" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={colors.info} style={styles.modalInput} />
            {err ? <Text style={{ color: colors.error, marginTop: 6 }}>{err}</Text> : null}
            <View style={{ height: spacing.md }} />
            <GoldButton testID="cwallet-submit" title="Request" onPress={submit} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: 0 },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5 },
  balance: { color: colors.onSurface, fontSize: 40, fontFamily: fonts.display, marginTop: 6 },
  section: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: spacing.xl, marginBottom: spacing.md },
  txRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  txTitle: { color: colors.onSurface, fontSize: 14, textTransform: "capitalize" },
  txDate: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  txAmt: { fontSize: 15, fontFamily: fonts.display },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  modalTitle: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display },
  modalInput: { marginTop: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 20, fontFamily: fonts.display },
});
