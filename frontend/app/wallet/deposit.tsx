import { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { GoldButton, Card } from "@/src/ui";
import { api } from "@/src/api";

export default function Deposit() {
  const router = useRouter();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const start = async () => {
    setErr(null);
    const n = parseFloat(amount);
    if (!n || n < 1) { setErr("Enter amount ≥ 1"); return; }
    setBusy(true);
    try {
      const res = await api<{ checkout_url: string }>("/wallet/deposit/order", { body: { amount: n } });
      setCheckoutUrl(res.checkout_url);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (checkoutUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <SafeAreaView edges={["top"]} style={styles.wvHeader}>
          <TouchableOpacity onPress={() => { setCheckoutUrl(null); router.replace("/(investor)/wallet"); }} style={styles.wvClose} testID="deposit-close">
            <Ionicons name="close" color={colors.onSurface} size={22} />
          </TouchableOpacity>
          <Text style={styles.wvTitle}>Razorpay Checkout</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>
        <WebView
          source={{ uri: checkoutUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.wvLoader}><ActivityIndicator color={colors.brand} /></View>
          )}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url.startsWith("propshare://")) {
              // Payment success deep link - go back to wallet
              setCheckoutUrl(null);
              router.replace("/(investor)/wallet");
              return false;
            }
            return true;
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="deposit-back-btn">
              <Ionicons name="chevron-back" color={colors.onSurface} size={24} />
            </TouchableOpacity>
            <Text style={styles.title}>Deposit funds</Text>
            <Text style={styles.sub}>Add money to your PropShare wallet via Razorpay.</Text>
          </View>

          <View style={{ padding: spacing.xl, gap: spacing.md, flex: 1 }}>
            <Text style={styles.label}>AMOUNT (₹)</Text>
            <TextInput
              testID="deposit-amount-input"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.info}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {[500, 1000, 5000, 10000, 50000].map((v) => (
                <TouchableOpacity key={v} onPress={() => setAmount(String(v))} style={styles.presetChip} testID={`deposit-preset-${v}`}>
                  <Text style={styles.presetText}>₹{v.toLocaleString("en-IN")}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={styles.rzp}><Text style={styles.rzpText}>Razorpay</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "600" }}>Cards, UPI, Netbanking</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 }}>Secure test-mode checkout.</Text>
                </View>
                <Ionicons name="checkmark-circle" color={colors.brand} size={20} />
              </View>
            </Card>

            {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}

            <View style={{ flex: 1 }} />
            <GoldButton testID="deposit-continue-btn" title={`Continue · ₹${parseFloat(amount || "0").toLocaleString("en-IN")}`} onPress={start} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: 0 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: 20 },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  sub: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: 4 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 28, fontFamily: fonts.display },
  presetChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  presetText: { color: colors.onSurfaceSecondary, fontSize: 13 },
  rzp: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: "#3395FF" },
  rzpText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  wvHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 0.5, borderColor: colors.borderStrong },
  wvClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  wvTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
  wvLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
