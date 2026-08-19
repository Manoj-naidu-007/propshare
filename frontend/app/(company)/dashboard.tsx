import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ImageBackground, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { KPI, Card, fmtInr } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const HEADER_BG = "https://images.unsplash.com/photo-1728853696418-c2c2a7f998fb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwZ29sZCUyMGZpbmFuY2UlMjBjaGFydCUyMGRhcmslMjAzZHxlbnwwfHx8fDE3ODU1MDMwODV8MA&ixlib=rb-4.1.0&q=85";

export default function CompanyDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/company/dashboard");
      setData(d);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const status = data?.company?.status;
  const statusColor = status === "approved" ? colors.success : status === "pending" ? colors.warning : colors.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hi}>Company</Text>
            <Text style={styles.name}>{data?.company?.name || user?.name}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.avatarBtn} testID="company-notifications-btn">
              <Ionicons name="notifications-outline" color={colors.onSurface} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/kyc")} style={styles.avatarBtn} testID="company-kyc-btn">
              <Ionicons name="shield-checkmark-outline" color={user?.kyc_status === "verified" ? colors.success : colors.brand} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={signOut} style={styles.avatarBtn} testID="company-logout-btn">
              <Ionicons name="log-out-outline" color={colors.onSurface} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {status && status !== "approved" && (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <View style={[styles.statusBanner, { borderColor: statusColor, backgroundColor: `${statusColor}22` }]}>
              <Ionicons name="information-circle" color={statusColor} size={18} />
              <Text style={{ color: statusColor, flex: 1, marginLeft: 8, fontSize: 13 }}>
                Company status: <Text style={{ fontWeight: "700" }}>{status}</Text>. You can list properties only after admin approval.
              </Text>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <ImageBackground source={{ uri: HEADER_BG }} style={styles.hero} imageStyle={{ borderRadius: radius.lg }}>
            <LinearGradient colors={["rgba(18,18,21,0.4)", "rgba(18,18,21,0.9)"]} style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }} />
            <View style={styles.heroInner}>
              <Text style={styles.heroLabel}>TOTAL RAISED</Text>
              {loading ? <ActivityIndicator color={colors.brand} /> : (
                <>
                  <Text style={styles.heroValue}>{fmtInr(data?.total_raised || 0)}</Text>
                  <Text style={styles.heroSub}>Across {data?.approved_properties || 0} approved properties</Text>
                </>
              )}
            </View>
          </ImageBackground>
        </View>

        <View style={styles.gridRow}>
          <KPI label="Wallet" value={fmtInr(data?.wallet_balance || 0)} testID="company-kpi-wallet" />
          <KPI label="Investors" value={String(data?.investors_count || 0)} testID="company-kpi-investors" />
        </View>
        <View style={styles.gridRow}>
          <KPI label="Shares Listed" value={String(data?.total_shares_listed || 0)} />
          <KPI label="Shares Sold" value={String(data?.total_shares_sold || 0)} />
        </View>
        <View style={styles.gridRow}>
          <KPI label="Properties" value={String(data?.total_properties || 0)} />
          <KPI label="Pending" value={String(data?.pending_properties || 0)} />
        </View>

        <View style={{ padding: spacing.xl }}>
          <TouchableOpacity onPress={() => router.push("/(company)/add-property")} style={styles.addBtn} testID="company-add-property">
            <Ionicons name="add" color={colors.onBrandPrimary} size={22} />
            <Text style={styles.addBtnText}>List a new property</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  hi: { color: colors.onSurfaceTertiary, fontSize: 13 },
  name: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: 2 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  statusBanner: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  hero: { height: 160, borderRadius: radius.lg, overflow: "hidden" },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  heroLabel: { color: colors.brand, fontSize: 11, letterSpacing: 2 },
  heroValue: { color: colors.onSurface, fontSize: 34, fontFamily: fonts.display, marginTop: 4 },
  heroSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4 },
  gridRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.md },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand, gap: 8 },
  addBtnText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
});
