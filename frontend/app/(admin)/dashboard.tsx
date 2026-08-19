import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ImageBackground, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { KPI, Card, fmtInr } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const HEADER_BG = "https://images.unsplash.com/photo-1728853696418-c2c2a7f998fb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwZ29sZCUyMGZpbmFuY2UlMjBjaGFydCUyMGRhcmslMjAzZHxlbnwwfHx8fDE3ODU1MDMwODV8MA&ixlib=rb-4.1.0&q=85";

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api("/admin/dashboard"); setData(d); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hi}>Platform overview</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.avatarBtn} testID="admin-logout-btn">
            <Ionicons name="log-out-outline" color={colors.onSurface} size={20} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <ImageBackground source={{ uri: HEADER_BG }} style={styles.hero} imageStyle={{ borderRadius: radius.lg }}>
            <LinearGradient colors={["rgba(18,18,21,0.4)", "rgba(18,18,21,0.9)"]} style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }} />
            <View style={styles.heroInner}>
              <Text style={styles.heroLabel}>PLATFORM EARNINGS · 0.5% COMMISSION</Text>
              {loading ? <ActivityIndicator color={colors.brand} /> : (
                <>
                  <Text style={styles.heroValue}>{fmtInr(data?.platform_earnings || 0)}</Text>
                  <Text style={styles.heroSub}>Total AUM {fmtInr(data?.total_investments || 0)} · {data?.total_shares_sold} shares sold</Text>
                </>
              )}
            </View>
          </ImageBackground>
        </View>

        <View style={styles.gridRow}>
          <KPI label="Users" value={String(data?.total_users || 0)} testID="admin-kpi-users" />
          <KPI label="Companies" value={String(data?.total_companies || 0)} testID="admin-kpi-companies" />
        </View>
        <View style={styles.gridRow}>
          <KPI label="Properties" value={String(data?.total_properties || 0)} />
          <KPI label="Wallet total" value={fmtInr(data?.total_wallet_balance || 0)} />
        </View>
        <View style={styles.gridRow}>
          <KPI label="Pending Props" value={String(data?.pending_properties || 0)} />
          <KPI label="Pending Withdrawals" value={String(data?.pending_withdrawals || 0)} />
        </View>
        <View style={styles.gridRow}>
          <KPI label="Pending KYC" value={String(data?.pending_kyc || 0)} testID="admin-kpi-kyc" />
          <KPI label="AUM" value={fmtInr(data?.total_investments || 0)} />
        </View>

        <View style={{ padding: spacing.xl }}>
          <Text style={styles.section}>Recent activity</Text>
          {(data?.recent_activities || []).length === 0 && !loading && (
            <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No activity yet.</Text></Card>
          )}
          {(data?.recent_activities || []).map((a: any) => (
            <View key={a.id} style={styles.actRow} testID={`admin-activity-${a.id}`}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actAction}>{a.action.replace(/_/g, " ")}</Text>
                <Text style={styles.actMeta}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
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
  hero: { height: 160, borderRadius: radius.lg, overflow: "hidden" },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  heroLabel: { color: colors.brand, fontSize: 11, letterSpacing: 2 },
  heroValue: { color: colors.onSurface, fontSize: 34, fontFamily: fonts.display, marginTop: 4 },
  heroSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4 },
  gridRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.md },
  section: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginBottom: spacing.md },
  actRow: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, alignItems: "center", gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  actAction: { color: colors.onSurface, fontSize: 14, textTransform: "capitalize" },
  actMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
});
