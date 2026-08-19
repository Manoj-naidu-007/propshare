import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, ImageBackground, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Wallet = { balance: number };
type Portfolio = {
  total_invested: number;
  total_current_value: number;
  total_returns: number;
  pnl: number;
  holdings: any[];
};
type Property = any;

const HEADER_BG = "https://images.unsplash.com/photo-1728853696418-c2c2a7f998fb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwZ29sZCUyMGZpbmFuY2UlMjBjaGFydCUyMGRhcmslMjAzZHxlbnwwfHx8fDE3ODU1MDMwODV8MA&ixlib=rb-4.1.0&q=85";

export default function InvestorHome() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [featured, setFeatured] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [w, p, props] = await Promise.all([
        api<Wallet>("/wallet"),
        api<Portfolio>("/portfolio"),
        api<Property[]>("/properties"),
      ]);
      setWallet(w);
      setPortfolio(p);
      setFeatured(props.slice(0, 8));
    } catch (e) {
      console.warn("home load", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hi}>Welcome back</Text>
            <Text style={styles.name}>{user?.name || "Investor"}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.avatarBtn} testID="home-notifications-btn">
              <Ionicons name="notifications-outline" color={colors.onSurface} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/kyc")} style={styles.avatarBtn} testID="home-kyc-btn">
              <Ionicons name="shield-checkmark-outline" color={user?.kyc_status === "verified" ? colors.success : colors.brand} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={signOut} style={styles.avatarBtn} testID="home-logout-btn">
              <Ionicons name="log-out-outline" color={colors.onSurface} size={20} />
            </TouchableOpacity>
          </View>
        </View>
        {user?.kyc_status !== "verified" && (
          <TouchableOpacity onPress={() => router.push("/kyc")} style={styles.kycBanner} testID="home-kyc-banner">
            <Ionicons name="shield-half" color={colors.brand} size={16} />
            <Text style={styles.kycBannerText}>Complete KYC to unlock full access</Text>
            <Ionicons name="chevron-forward" color={colors.brand} size={16} />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio hero */}
        <View style={styles.heroWrap}>
          <ImageBackground source={{ uri: HEADER_BG }} style={styles.hero} imageStyle={{ borderRadius: radius.lg }}>
            <LinearGradient
              colors={["rgba(18,18,21,0.4)", "rgba(18,18,21,0.9)"]}
              style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }}
            />
            <View style={styles.heroInner}>
              <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
              {loading ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <Text style={styles.heroValue}>{fmtInr(portfolio?.total_current_value || 0)}</Text>
                  <View style={styles.heroRow}>
                    <View style={styles.heroChip}>
                      <Text style={styles.heroChipLabel}>Returns</Text>
                      <Text style={[styles.heroChipValue, { color: colors.success }]}>+{fmtInr(portfolio?.total_returns || 0)}</Text>
                    </View>
                    <View style={styles.heroChip}>
                      <Text style={styles.heroChipLabel}>Wallet</Text>
                      <Text style={styles.heroChipValue}>{fmtInr(wallet?.balance || 0)}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </ImageBackground>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <QuickAction icon="arrow-down" label="Deposit" onPress={() => router.push("/wallet/deposit")} testID="home-action-deposit" />
          <QuickAction icon="arrow-up" label="Withdraw" onPress={() => router.push("/(investor)/wallet")} testID="home-action-withdraw" />
          <QuickAction icon="business" label="Browse" onPress={() => router.push("/(investor)/properties")} testID="home-action-browse" />
          <QuickAction icon="pie-chart" label="Portfolio" onPress={() => router.push("/(investor)/portfolio")} testID="home-action-portfolio" />
        </View>

        {/* Featured properties */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured properties</Text>
            <TouchableOpacity onPress={() => router.push("/(investor)/properties")} testID="home-see-all">
              <Text style={styles.link}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>

        {featured.length === 0 && !loading ? (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
            <Card>
              <Text style={{ color: colors.onSurfaceSecondary, textAlign: "center" }}>No properties listed yet. Check back soon.</Text>
            </Card>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {featured.map((p) => (
              <PropertyCardHorizontal key={p.id} property={p} onPress={() => router.push(`/property/${p.id}`)} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.qa} activeOpacity={0.8}>
      <View style={styles.qaIcon}><Ionicons name={icon} color={colors.brand} size={20} /></View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PropertyCardHorizontal({ property, onPress }: { property: Property; onPress: () => void }) {
  const img = property.images?.[0] || "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85";
  const src = img.startsWith("data:") || img.startsWith("http") ? { uri: img } : { uri: `data:image/jpeg;base64,${img}` };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.propCard} testID={`prop-card-${property.id}`}>
      <ImageBackground source={src} style={styles.propImg} imageStyle={{ borderRadius: radius.lg }}>
        <LinearGradient
          colors={["transparent", "rgba(18,18,21,0.9)"]}
          style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }}
        />
        <View style={styles.propBadge}>
          <Text style={styles.propBadgeText}>{property.monthly_return_rate}% / mo</Text>
        </View>
        <View style={styles.propInner}>
          <Text style={styles.propType}>{property.property_type}</Text>
          <Text style={styles.propName} numberOfLines={1}>{property.name}</Text>
          <Text style={styles.propLoc} numberOfLines={1}>
            <Ionicons name="location" size={11} color={colors.onSurfaceTertiary} /> {property.location}
          </Text>
          <View style={styles.propRow}>
            <View>
              <Text style={styles.propLabel}>Share price</Text>
              <Text style={styles.propValue}>{fmtInr(property.share_price)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.propLabel}>Available</Text>
              <Text style={styles.propValue}>{property.total_shares - property.shares_sold}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  hi: { color: colors.onSurfaceTertiary, fontSize: 13 },
  name: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: 2 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  kycBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.xl, marginBottom: spacing.sm, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  kycBannerText: { color: colors.brand, fontSize: 12, flex: 1 },
  heroWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  hero: { height: 180, borderRadius: radius.lg, overflow: "hidden" },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  heroLabel: { color: colors.brand, fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heroValue: { color: colors.onSurface, fontSize: 36, fontFamily: fonts.display },
  heroRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  heroChip: { backgroundColor: "rgba(28,28,33,0.7)", borderRadius: radius.md, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderStrong, flex: 1 },
  heroChipLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  heroChipValue: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  qa: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  qaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  qaLabel: { color: colors.onSurfaceSecondary, fontSize: 12 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display },
  link: { color: colors.brand, fontSize: 13 },
  featuredRow: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingRight: spacing["2xl"] },
  propCard: { width: 260, height: 320, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  propImg: { flex: 1, justifyContent: "flex-end" },
  propBadge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  propBadgeText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  propInner: { padding: spacing.md },
  propType: { color: colors.brand, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" },
  propName: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: 2 },
  propLoc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  propRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  propLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  propValue: { color: colors.onSurface, fontSize: 15, fontFamily: fonts.display },
});
