import { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { GoldButton, Chip } from "@/src/ui";
import { useAuth, Role } from "@/src/auth";

const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "Investor", label: "Investor", desc: "Buy fractional shares and earn monthly returns." },
  { key: "Company", label: "Company", desc: "List your properties and raise investment." },
];

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [role, setRole] = useState<Role>("Investor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name || !email || !password) {
      setError("Please fill all fields");
      return;
    }
    if (role === "Company" && !companyName) {
      setError("Please enter a company name");
      return;
    }
    setLoading(true);
    try {
      const u = await signUp({
        email: email.trim().toLowerCase(),
        password,
        name,
        role,
        company_name: role === "Company" ? companyName : undefined,
      });
      if (u.role === "Company") router.replace("/(company)/dashboard");
      else router.replace("/(investor)/home");
    } catch (e: any) {
      setError(e.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.replace("/(auth)/welcome")} style={styles.back} testID="signup-back-btn">
            <Ionicons name="chevron-back" color={colors.onSurface} size={26} />
          </TouchableOpacity>

          <Text style={styles.title}>Create your account.</Text>
          <Text style={styles.subtitle}>Choose a role to get started.</Text>

          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                testID={`signup-role-${r.key.toLowerCase()}`}
                onPress={() => setRole(r.key)}
                style={[styles.roleCard, role === r.key && styles.roleCardActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.roleLabel, role === r.key && { color: colors.brand }]}>{r.label}</Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>FULL NAME</Text>
          <TextInput testID="signup-name-input" value={name} onChangeText={setName} placeholder="Jane Doe" placeholderTextColor={colors.info} style={styles.input} />

          {role === "Company" && (
            <>
              <Text style={styles.label}>COMPANY NAME</Text>
              <TextInput testID="signup-company-input" value={companyName} onChangeText={setCompanyName} placeholder="Acme Estates Ltd" placeholderTextColor={colors.info} style={styles.input} />
            </>
          )}

          <Text style={styles.label}>EMAIL</Text>
          <TextInput testID="signup-email-input" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.info} style={styles.input} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput testID="signup-password-input" value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={colors.info} style={styles.input} secureTextEntry />

          {error ? <Text style={styles.error} testID="signup-error">{error}</Text> : null}

          <View style={{ height: spacing.lg }} />
          <GoldButton testID="signup-submit-btn" title="Create account" onPress={submit} loading={loading} />

          <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={{ marginTop: spacing.lg, alignItems: "center" }} testID="signup-goto-login">
            <Text style={{ color: colors.onSurfaceTertiary }}>
              Already have an account? <Text style={{ color: colors.brand }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8, marginBottom: spacing.lg },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: 6, fontSize: 15 },
  roleRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  roleCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  roleCardActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  roleLabel: { color: colors.onSurface, fontSize: 16, fontWeight: "600", fontFamily: fonts.text },
  roleDesc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, marginTop: spacing.lg, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontSize: 16,
  },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 13 },
});