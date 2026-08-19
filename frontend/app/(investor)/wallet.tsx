import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

export default function Wallet() {
  const router = useRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showMock, setShowMock] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([api("/wallet"), api<any[]>("/wallet/transactions")]);
      setWallet(w); setTx(t);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doWithdraw = async () => {
    setErr(null);
    const n = parseFloat(amount);
    if (!n || n <= 0) { setErr("Enter valid amount"); return; }
    setBusy(true);
    try {
      await api("/wallet/withdraw", { body: { amount: n } });
      setShowWithdraw(false); setAmount("");
      setMsg("Withdrawal requested. Awaiting admin approval.");
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const doMockDeposit = async () => {
    setErr(null);
    const n = parseFloat(amount);
    if (!n || n <= 0) { setErr("Enter valid amount"); return; }
    setBusy(true);
    try {
      await api("/wallet/mock-deposit", { body: { amount: n } });
      setShowMock(false); setAmount("");
      setMsg(`₹${n.toLocaleString("en-IN")} added (demo).`);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <Card style={{ padding: spacing.xl }}>
          <Text style={styles.label}>AVAILABLE BALANCE</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.balance}>{fmtInr(wallet?.balance || 0)}</Text>}
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <GoldButton testID="wallet-deposit-btn" title="Deposit" onPress={() => router.push("/wallet/deposit")} />
            </View>
            <View style={{ flex: 1 }}>
              <GoldButton testID="wallet-withdraw-btn" title="Withdraw" variant="secondary" onPress={() => setShowWithdraw(true)} />
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowMock(true)} style={styles.demoBtn} testID="wallet-mock-btn">
            <Text style={styles.demoText}>+ Add demo balance (skip payment)</Text>
          </TouchableOpacity>
        </Card>

        {msg && (
          <View style={styles.toast}>
            <Text style={{ color: colors.success }}>{msg}</Text>
            <TouchableOpacity onPress={() => setMsg(null)}><Ionicons name="close" color={colors.onSurfaceTertiary} size={16} /></TouchableOpacity>
          </View>
        )}

        <Text style={styles.section}>Transactions</Text>
        {tx.length === 0 && !loading && <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No transactions yet.</Text></Card>}
        {tx.map((t) => (
          <TxRow key={t.id} tx={t} />
        ))}
      </ScrollView>

      {/* Withdraw modal */}
      <TxModal
        visible={showWithdraw}
        onClose={() => { setShowWithdraw(false); setErr(null); setAmount(""); }}
        title="Withdraw funds"
        subtitle="Available balance"
        balanceText={fmtInr(wallet?.balance || 0)}
        amount={amount}
        setAmount={setAmount}
        err={err}
        busy={busy}
        submitLabel="Request withdrawal"
        onSubmit={doWithdraw}
        testIDPrefix="withdraw"
      />
      <TxModal
        visible={showMock}
        onClose={() => { setShowMock(false); setErr(null); setAmount(""); }}
        title="Add demo balance"
        subtitle="Instant, no payment"
        balanceText={fmtInr(wallet?.balance || 0)}
        amount={amount}
        setAmount={setAmount}
        err={err}
        busy={busy}
        submitLabel="Add funds"
        onSubmit={doMockDeposit}
        testIDPrefix="mock"
      />
    </View>
  );
}

function TxRow({ tx }: { tx: any }) {
  const positive = tx.amount >= 0;
  const iconMap: Record<string, any> = {
    deposit: "arrow-down",
    deposit_mock: "sparkles",
    share_purchase: "business",
    share_sale_received: "cash",
    interest: "trending-up",
    withdrawal_requested: "arrow-up",
    withdrawal_refunded: "return-down-back",
    marketplace_buy: "cart",
    marketplace_sell: "cart",
  };
  return (
    <View style={styles.txRow} testID={`tx-row-${tx.id}`}>
      <View style={styles.txIcon}>
        <Ionicons name={iconMap[tx.type] || "swap-horizontal"} color={positive ? colors.success : colors.onSurfaceSecondary} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle}>{tx.type.replace(/_/g, " ")}</Text>
        <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.txAmt, { color: positive ? colors.success : colors.onSurface }]}>
        {positive ? "+" : ""}{fmtInr(tx.amount)}
      </Text>
    </View>
  );
}

function TxModal({ visible, onClose, title, subtitle, balanceText, amount, setAmount, err, busy, submitLabel, onSubmit, testIDPrefix }: any) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} testID={`${testIDPrefix}-close`}><Ionicons name="close" color={colors.onSurface} size={22} /></TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>{subtitle}: {balanceText}</Text>
          <Text style={styles.label}>AMOUNT (₹)</Text>
          <TextInput
            testID={`${testIDPrefix}-amount-input`}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.info}
            style={styles.modalInput}
          />
          {err ? <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text> : null}
          <View style={{ height: spacing.md }} />
          <GoldButton testID={`${testIDPrefix}-submit`} title={submitLabel} onPress={onSubmit} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: 0 },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5 },
  balance: { color: colors.onSurface, fontSize: 42, fontFamily: fonts.display, marginTop: 6 },
  demoBtn: { marginTop: spacing.md, alignItems: "center" },
  demoText: { color: colors.brand, fontSize: 13 },
  toast: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(42,157,143,0.15)", borderWidth: 1, borderColor: colors.success, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: spacing.xl, marginBottom: spacing.md },
  txRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.md },
  txIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  txTitle: { color: colors.onSurface, fontSize: 14, textTransform: "capitalize" },
  txDate: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  txAmt: { fontSize: 15, fontFamily: fonts.display },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, borderTopWidth: 0.5, borderColor: colors.borderStrong },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display },
  modalSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.lg },
  modalInput: { marginTop: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 20, fontFamily: fonts.display },
});
