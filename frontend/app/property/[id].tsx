import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ImageBackground, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const FALLBACK = "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85";

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [prop, setProp] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [shares, setShares] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await api(`/properties/${id}`);
      setProp(p);
      if (user?.role === "Investor") {
        const w = await api("/wallet");
        setWallet(w);
      }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [id, user?.role]);

  useEffect(() => { load(); }, [load]);

  const submitBuy = async () => {
    setErr(null);
    const n = parseInt(shares || "0");
    if (!n || n <= 0) { setErr("Enter valid share count"); return; }
    setBusy(true);
    try {
      await api("/investments/buy", { body: { property_id: prop.id, shares: n } });
      setShowBuy(false); setShares("1");
      setToast(`Purchased ${n} shares!`);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (loading || !prop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const img = prop.images?.[0] || FALLBACK;
  const gallery: string[] = (prop.images && prop.images.length > 0) ? prop.images : [FALLBACK];
  const src = img.startsWith("data:") || img.startsWith("http") ? { uri: img } : { uri: `data:image/jpeg;base64,${img}` };
  const available = prop.total_shares - prop.shares_sold;
  const nShares = parseInt(shares || "0") || 0;
  const totalCost = nShares * prop.share_price;
  const enoughBalance = (wallet?.balance || 0) >= totalCost;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <PropertyGallery images={gallery} onBack={() => router.back()} type={prop.property_type} name={prop.name} location={prop.location} />

        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatCard label="Valuation" value={fmtInr(prop.total_value)} />
            <StatCard label="Share Price" value={fmtInr(prop.share_price)} />
            <StatCard label="ROI" value={`${prop.monthly_return_rate}% mo`} highlight />
          </View>
          <Card>
            <Text style={styles.section}>About this property</Text>
            <Text style={styles.desc}>{prop.description || "No description."}</Text>
          </Card>
          <Card>
            <Text style={styles.section}>Share allocation</Text>
            <StatRow label="Total shares" value={String(prop.total_shares)} />
            <StatRow label="Shares sold" value={String(prop.shares_sold)} />
            <StatRow label="Available" value={String(available)} highlight />
            <StatRow label="Company" value={prop.company_name} />
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(prop.shares_sold / prop.total_shares) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{((prop.shares_sold / prop.total_shares) * 100).toFixed(1)}% funded</Text>
          </Card>

          {toast && (
            <View style={styles.toast} testID="prop-toast">
              <Text style={{ color: colors.success }}>{toast}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {user?.role === "Investor" && (
        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <View>
            <Text style={styles.stickyLabel}>SHARE PRICE</Text>
            <Text style={styles.stickyValue}>{fmtInr(prop.share_price)}</Text>
          </View>
          <GoldButton
            testID="prop-buy-btn"
            title="Buy Shares"
            onPress={() => setShowBuy(true)}
            disabled={available === 0}
            style={{ paddingHorizontal: spacing.xl }}
          />
        </View>
      )}

      <Modal transparent visible={showBuy} animationType="slide" onRequestClose={() => setShowBuy(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buy shares</Text>
              <TouchableOpacity onPress={() => setShowBuy(false)} testID="buy-modal-close"><Ionicons name="close" color={colors.onSurface} size={22} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{prop.name}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
              <Text style={styles.miniLabel}>SHARES (max {available})</Text>
              <Text style={styles.miniLabel}>WALLET {fmtInr(wallet?.balance || 0)}</Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity onPress={() => setShares(String(Math.max(1, nShares - 1)))} style={styles.stepBtn} testID="buy-step-down"><Ionicons name="remove" color={colors.brand} size={22} /></TouchableOpacity>
              <TextInput
                testID="buy-shares-input"
                keyboardType="numeric"
                value={shares}
                onChangeText={setShares}
                style={styles.stepperInput}
                placeholderTextColor={colors.info}
              />
              <TouchableOpacity onPress={() => setShares(String(Math.min(available, nShares + 1)))} style={styles.stepBtn} testID="buy-step-up"><Ionicons name="add" color={colors.brand} size={22} /></TouchableOpacity>
            </View>
            <View style={styles.summary}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.summaryLabel}>Total cost</Text>
                <Text style={styles.summaryValue}>{fmtInr(totalCost)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.summaryLabel}>Monthly return (est.)</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>+{fmtInr(totalCost * prop.monthly_return_rate / 100)}</Text>
              </View>
            </View>
            {err ? <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text> : null}
            {!enoughBalance && nShares > 0 && (
              <Text style={{ color: colors.warning, marginTop: 8, fontSize: 12 }}>Insufficient wallet balance. Add funds first.</Text>
            )}
            <View style={{ height: spacing.md }} />
            <GoldButton
              testID="buy-confirm-btn"
              title={enoughBalance ? "Confirm purchase" : "Add funds"}
              onPress={enoughBalance ? submitBuy : () => { setShowBuy(false); router.push("/wallet/deposit"); }}
              loading={busy}
              disabled={nShares <= 0}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, highlight }: any) {
  return (
    <View style={[styles.statCard, highlight && { borderColor: colors.brand }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.brand }]}>{value}</Text>
    </View>
  );
}

function PropertyGallery({ images, onBack, type, name, location }: { images: string[]; onBack: () => void; type: string; name: string; location: string }) {
  const [idx, setIdx] = useState(0);
  const width = Dimensions.get("window").width;
  return (
    <View style={{ height: 380 }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}`}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => {
          const src = item.startsWith("data:") || item.startsWith("http") ? { uri: item } : { uri: `data:image/jpeg;base64,${item}` };
          return (
            <ImageBackground source={src} style={{ width, height: 380 }}>
              <LinearGradient colors={["rgba(18,18,21,0.4)", "rgba(18,18,21,0.2)", "rgba(18,18,21,0.9)"]} style={StyleSheet.absoluteFillObject} />
            </ImageBackground>
          );
        }}
      />
      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, padding: spacing.md, flexDirection: "row", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="prop-back-btn">
          <Ionicons name="chevron-back" color={colors.onSurface} size={24} />
        </TouchableOpacity>
        {images.length > 1 && (
          <View style={styles.counter}><Text style={{ color: colors.onSurface, fontSize: 12 }}>{idx + 1} / {images.length}</Text></View>
        )}
      </SafeAreaView>
      <View style={styles.heroBottomAbs}>
        <Text style={styles.type}>{type}</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.loc}><Ionicons name="location" size={14} color={colors.onSurfaceTertiary} /> {location}</Text>
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && { backgroundColor: colors.brand, width: 16 }]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function StatRow({ label, value, highlight }: any) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, highlight && { color: colors.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 380, justifyContent: "space-between" },
  heroBottomAbs: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl },
  counter: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(28,28,33,0.7)", borderWidth: 0.5, borderColor: colors.borderStrong },
  dots: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(28,28,33,0.7)", alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: colors.borderStrong },
  heroBottom: { padding: spacing.xl },
  type: { color: colors.brand, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  name: { color: colors.onSurface, fontSize: 30, fontFamily: fonts.display, marginTop: 6 },
  loc: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 6 },
  statCard: { flex: 1, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  statValue: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display, marginTop: 4 },
  section: { color: colors.onSurface, fontSize: 18, fontFamily: fonts.display, marginBottom: spacing.md },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  statRowLabel: { color: colors.onSurfaceTertiary, fontSize: 13 },
  statRowValue: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  progressBar: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  progressText: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 6 },
  toast: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success, backgroundColor: "rgba(42,157,143,0.15)" },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 0.5, borderColor: colors.borderStrong },
  stickyLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  stickyValue: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, borderTopWidth: 0.5, borderColor: colors.borderStrong },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  modalTitle: { color: colors.onSurface, fontSize: 24, fontFamily: fonts.display },
  modalSub: { color: colors.onSurfaceTertiary, fontSize: 13 },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1.5 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  stepBtn: { padding: spacing.md, width: 56, alignItems: "center" },
  stepperInput: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: 28, fontFamily: fonts.display, padding: spacing.md },
  summary: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { color: colors.onSurfaceTertiary, fontSize: 13 },
  summaryValue: { color: colors.onSurface, fontSize: 14, fontFamily: fonts.display },
});
