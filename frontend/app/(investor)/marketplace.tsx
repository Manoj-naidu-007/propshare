import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, Chip, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

export default function Marketplace() {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [orders, setOrders] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSell, setShowSell] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any>(null);
  const [sellShares, setSellShares] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([api<any[]>("/marketplace"), api<any>("/portfolio")]);
      setOrders(o); setHoldings(p.holdings || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accept = async (orderId: string) => {
    try {
      await api(`/marketplace/${orderId}/accept`, { body: {} });
      setToast("Order filled");
      load();
    } catch (e: any) { setToast(e.message); }
  };

  const submitSell = async () => {
    setErr(null);
    const s = parseInt(sellShares || "0"); const pr = parseFloat(sellPrice || "0");
    if (!s || s <= 0 || !pr || pr <= 0) { setErr("Enter valid shares and price"); return; }
    if (!selectedHolding) return;
    setBusy(true);
    try {
      await api("/marketplace", { body: { property_id: selectedHolding.property_id, shares: s, price_per_share: pr, order_type: "sell" } });
      setShowSell(false); setSelectedHolding(null); setSellShares(""); setSellPrice("");
      setToast("Sell order listed");
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.sub}>Peer-to-peer share trading.</Text>
        </View>
        <View style={styles.tabsRow}>
          <TouchableOpacity testID="market-tab-buy" style={[styles.tab, tab === "buy" && styles.tabActive]} onPress={() => setTab("buy")}>
            <Text style={[styles.tabText, tab === "buy" && styles.tabTextActive]}>Buy Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="market-tab-sell" style={[styles.tab, tab === "sell" && styles.tabActive]} onPress={() => setTab("sell")}>
            <Text style={[styles.tabText, tab === "sell" && styles.tabTextActive]}>Sell My Shares</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"], gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {toast && (
          <View style={styles.toast}>
            <Text style={{ color: colors.brand }}>{toast}</Text>
            <TouchableOpacity onPress={() => setToast(null)}><Ionicons name="close" color={colors.onSurfaceTertiary} size={16} /></TouchableOpacity>
          </View>
        )}

        {loading && <ActivityIndicator color={colors.brand} />}

        {tab === "buy" && (
          orders.length === 0 && !loading ? (
            <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No open orders yet.</Text></Card>
          ) : (
            orders.map((o) => (
              <View key={o.id} style={styles.orderCard} testID={`market-order-${o.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderName}>{o.property?.name || "Property"}</Text>
                  <Text style={styles.orderMeta}>{o.shares} shares · {fmtInr(o.price_per_share)} / share</Text>
                  <Text style={styles.orderTotal}>Total: {fmtInr(o.shares * o.price_per_share)}</Text>
                </View>
                <GoldButton testID={`market-accept-${o.id}`} title="Buy" onPress={() => accept(o.id)} style={{ height: 40, paddingHorizontal: spacing.lg }} />
              </View>
            ))
          )
        )}

        {tab === "sell" && (
          holdings.length === 0 && !loading ? (
            <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>You don&apos;t own shares yet.</Text></Card>
          ) : (
            holdings.filter((h: any) => h.shares > 0).map((h: any) => (
              <View key={h.property_id} style={styles.orderCard} testID={`sell-holding-${h.property_id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderName}>{h.property.name}</Text>
                  <Text style={styles.orderMeta}>{h.shares} shares owned · Cur. {fmtInr(h.property.share_price)}</Text>
                </View>
                <TouchableOpacity
                  testID={`sell-list-${h.property_id}`}
                  style={styles.sellBtn}
                  onPress={() => { setSelectedHolding(h); setSellPrice(String(h.property.share_price)); setShowSell(true); }}
                >
                  <Text style={{ color: colors.brand, fontWeight: "600" }}>List</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}
      </ScrollView>

      <Modal transparent visible={showSell} animationType="slide" onRequestClose={() => setShowSell(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List shares for sale</Text>
              <TouchableOpacity onPress={() => setShowSell(false)}><Ionicons name="close" color={colors.onSurface} size={22} /></TouchableOpacity>
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{selectedHolding?.property?.name}</Text>
            <Text style={styles.miniLabel}>SHARES ({selectedHolding?.shares} owned)</Text>
            <TextInput testID="sell-shares-input" keyboardType="numeric" value={sellShares} onChangeText={setSellShares} placeholder="0" placeholderTextColor={colors.info} style={styles.modalInput} />
            <Text style={styles.miniLabel}>PRICE PER SHARE (₹)</Text>
            <TextInput testID="sell-price-input" keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} placeholder="0" placeholderTextColor={colors.info} style={styles.modalInput} />
            {err ? <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text> : null}
            <View style={{ height: spacing.md }} />
            <GoldButton testID="sell-submit-btn" title="List order" onPress={submitSell} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  sub: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: 4 },
  tabsRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  tabActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  tabText: { color: colors.onSurfaceSecondary, fontSize: 13 },
  tabTextActive: { color: colors.brand, fontWeight: "600" },
  orderCard: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  orderName: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display },
  orderMeta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  orderTotal: { color: colors.brand, fontSize: 13, marginTop: 4 },
  sellBtn: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  toast: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, marginTop: spacing.md, marginBottom: 6 },
  modalInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 18, fontFamily: fonts.display },
});
