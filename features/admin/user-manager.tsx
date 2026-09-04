import {
  addUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type AppUser,
} from "@/lib/pos-store";
import { SHEETS_ENDPOINT } from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StatCard from "./stat-card";
import { showAlert, showConfirm } from "./utils";

const ROLE_META = {
  admin: {
    label: "Admin",
    icon: "shield-checkmark" as const,
    bg: C.orange,
    fg: C.orangeText,
  },
  cashier: {
    label: "Kasir",
    icon: "storefront" as const,
    bg: C.emerald,
    fg: C.emeraldText,
  },
};

// Initials shown in the avatar circle, e.g. "Hery Ciaputra" -> "HC"
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const EMPTY_FORM = {
  username: "",
  password: "",
  display_name: "",
  role: "cashier",
};

export default function UserManager() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");

  const adminCount = useMemo(
    () => users.filter((u) => u.role === "admin").length,
    [users],
  );
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    );
  }, [users, search]);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchUsers(SHEETS_ENDPOINT, forceRefresh);
      if (data.length > 0) {
        setUsers(data);
      } else {
        setFetchError(
          "Daftar pengguna kosong atau gagal dimuat dari Google Sheets.",
        );
      }
    } catch {
      setFetchError("Gagal menghubungi Google Sheets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  const startEdit = (user: AppUser) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      password: "", // left blank = keep the existing PIN unchanged
      display_name: user.display_name,
      role: user.role,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleUpdate = async (id: number) => {
    if (!editForm.username || !editForm.display_name) {
      showAlert("Error", "Semua field wajib diisi");
      return;
    }

    setSyncing(true);
    // Omit an empty password so the backend keeps the existing PIN hash.
    const { password, ...rest } = editForm;
    const success = await updateUser(SHEETS_ENDPOINT, {
      id,
      ...rest,
      ...(password ? { password } : {}),
    });
    setSyncing(false);

    if (success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...rest } : u)),
      );
      cancelEdit();
      showAlert("Berhasil", "Pengguna diperbarui");
    } else {
      showAlert("Error", "Gagal menyimpan ke Google Sheets");
    }
  };

  const handleDelete = (user: AppUser) => {
    showConfirm(
      "Hapus Pengguna",
      `Yakin ingin menghapus "${user.display_name}"?`,
      async () => {
        setSyncing(true);
        const success = await deleteUser(SHEETS_ENDPOINT, user.id);
        setSyncing(false);

        if (success) {
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          showAlert("Berhasil", "Pengguna dihapus");
        } else {
          showAlert("Error", "Gagal menghapus di Google Sheets");
        }
      },
    );
  };

  const handleAdd = async () => {
    if (!addForm.username || !addForm.password || !addForm.display_name) {
      showAlert("Error", "Semua field wajib diisi");
      return;
    }

    setSyncing(true);
    const success = await addUser(SHEETS_ENDPOINT, addForm);
    setSyncing(false);

    if (success) {
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      loadUsers(true);
      showAlert("Berhasil", "Pengguna ditambahkan");
    } else {
      showAlert("Error", "Gagal menambahkan ke Google Sheets");
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  if (fetchError || users.length === 0) {
    return (
      <View style={s.centered}>
        <View style={s.emptyIconWrap}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={C.destructive}
          />
        </View>
        <Text style={s.emptyText}>Gagal memuat pengguna</Text>
        <Text style={s.emptySub}>{fetchError ?? "Daftar kosong."}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => loadUsers(true)}>
          <Ionicons name="refresh" size={15} color="#fff" />
          <Text style={s.retryBtnText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.outerContainer}>
      <View style={s.contentHeader}>
        <Text style={s.title}>Manajemen Pengguna</Text>
        <Text style={s.sub}>Kelola akun kasir & admin.</Text>

        <View style={s.statsRow}>
          <View style={s.statsItem}>
            <StatCard label="Total" value={String(users.length)} />
          </View>
          <View style={s.statsItem}>
            <StatCard label="Admin" value={String(adminCount)} />
          </View>
          <View style={s.statsItem}>
            <StatCard label="Kasir" value={String(users.length - adminCount)} />
          </View>
        </View>
      </View>

      <FlatList
        style={s.listStyle}
        contentContainerStyle={s.listContent}
        data={filteredUsers}
        keyExtractor={(item) => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.addSection}>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.mutedFg} />
              <TextInput
                style={s.searchInput}
                placeholder="Cari nama atau username..."
                placeholderTextColor={C.mutedFg}
                autoCapitalize="none"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color={C.mutedFg} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[s.addToggleBtn, showAddForm && s.addToggleBtnActive]}
              onPress={() => setShowAddForm((v) => !v)}
            >
              <Ionicons
                name={showAddForm ? "close" : "person-add"}
                size={16}
                color={showAddForm ? C.mutedFg : C.primaryFg}
              />
              <Text
                style={[
                  s.addToggleBtnText,
                  showAddForm && s.addToggleBtnTextActive,
                ]}
              >
                {showAddForm ? "Batal" : "Tambah Pengguna"}
              </Text>
            </TouchableOpacity>

            {showAddForm && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Pengguna Baru</Text>
                <View style={s.inputRow}>
                  <Ionicons name="at-outline" size={16} color={C.mutedFg} />
                  <TextInput
                    style={s.inputField}
                    placeholder="Username"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    value={addForm.username}
                    onChangeText={(t) =>
                      setAddForm((p) => ({ ...p, username: t }))
                    }
                  />
                </View>
                <View style={s.inputRow}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={C.mutedFg}
                  />
                  <TextInput
                    style={s.inputField}
                    placeholder="Password / PIN"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    value={addForm.password}
                    onChangeText={(t) =>
                      setAddForm((p) => ({ ...p, password: t }))
                    }
                  />
                </View>
                <View style={s.inputRow}>
                  <Ionicons name="person-outline" size={16} color={C.mutedFg} />
                  <TextInput
                    style={s.inputField}
                    placeholder="Nama Tampilan"
                    placeholderTextColor={C.mutedFg}
                    value={addForm.display_name}
                    onChangeText={(t) =>
                      setAddForm((p) => ({ ...p, display_name: t }))
                    }
                  />
                </View>
                <View style={s.roleRow}>
                  {(["cashier", "admin"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        s.roleChip,
                        addForm.role === r && s.roleChipActive,
                      ]}
                      onPress={() => setAddForm((p) => ({ ...p, role: r }))}
                    >
                      <Ionicons
                        name={ROLE_META[r].icon}
                        size={13}
                        color={addForm.role === r ? C.primaryFg : C.mutedFg}
                      />
                      <Text
                        style={[
                          s.roleChipText,
                          addForm.role === r && s.roleChipTextActive,
                        ]}
                      >
                        {ROLE_META[r].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.saveBtn, syncing && s.saveBtnDisabled]}
                  onPress={handleAdd}
                  disabled={syncing}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color={C.primaryFg} />
                  ) : (
                    <Ionicons name="checkmark" size={16} color={C.primaryFg} />
                  )}
                  <Text style={s.saveBtnText}>
                    {syncing ? "Menyimpan..." : "Simpan Pengguna Baru"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {filteredUsers.length === 0 && (
              <View style={s.noResults}>
                <Ionicons name="search-outline" size={20} color={C.mutedFg} />
                <Text style={s.noResultsText}>
                  Tidak ada pengguna yang cocok dengan &quot;{search}&quot;
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isEditing = editingId === item.id;
          const role =
            ROLE_META[item.role as keyof typeof ROLE_META] ?? ROLE_META.cashier;

          if (isEditing) {
            return (
              <View style={s.card}>
                <Text style={s.cardTitle}>Edit Pengguna</Text>
                <View style={s.inputRow}>
                  <Ionicons name="at-outline" size={16} color={C.mutedFg} />
                  <TextInput
                    style={s.inputField}
                    placeholder="Username"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    value={editForm.username}
                    onChangeText={(t) =>
                      setEditForm((p) => ({ ...p, username: t }))
                    }
                  />
                </View>
                <View style={s.inputRow}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={C.mutedFg}
                  />
                  <TextInput
                    style={s.inputField}
                    placeholder="Kosongkan jika PIN tidak diubah"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    keyboardType="numeric"
                    maxLength={4}
                    value={editForm.password}
                    onChangeText={(t) =>
                      setEditForm((p) => ({
                        ...p,
                        password: t.replace(/\D/g, "").slice(0, 4),
                      }))
                    }
                  />
                </View>
                <View style={s.inputRow}>
                  <Ionicons name="person-outline" size={16} color={C.mutedFg} />
                  <TextInput
                    style={s.inputField}
                    placeholder="Nama Tampilan"
                    placeholderTextColor={C.mutedFg}
                    value={editForm.display_name}
                    onChangeText={(t) =>
                      setEditForm((p) => ({ ...p, display_name: t }))
                    }
                  />
                </View>
                <View style={s.roleRow}>
                  {(["cashier", "admin"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        s.roleChip,
                        editForm.role === r && s.roleChipActive,
                      ]}
                      onPress={() => setEditForm((p) => ({ ...p, role: r }))}
                    >
                      <Ionicons
                        name={ROLE_META[r].icon}
                        size={13}
                        color={editForm.role === r ? C.primaryFg : C.mutedFg}
                      />
                      <Text
                        style={[
                          s.roleChipText,
                          editForm.role === r && s.roleChipTextActive,
                        ]}
                      >
                        {ROLE_META[r].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.editActions}>
                  <TouchableOpacity
                    style={[s.saveBtn, s.flex1, syncing && s.saveBtnDisabled]}
                    onPress={() => handleUpdate(item.id)}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={C.primaryFg} />
                    ) : (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={C.primaryFg}
                      />
                    )}
                    <Text style={s.saveBtnText}>
                      {syncing ? "Menyimpan..." : "Simpan"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.cancelBtn, s.flex1]}
                    onPress={cancelEdit}
                  >
                    <Text style={s.cancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          return (
            <View style={s.row}>
              <View style={[s.avatar, { backgroundColor: role.bg }]}>
                <Text style={[s.avatarText, { color: role.fg }]}>
                  {initialsOf(item.display_name)}
                </Text>
              </View>
              <View style={s.flex1}>
                <Text style={s.rowLabel}>{item.display_name}</Text>
                <Text style={s.rowSub}>@{item.username}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: role.bg }]}>
                <Ionicons name={role.icon} size={11} color={role.fg} />
                <Text style={[s.badgeText, { color: role.fg }]}>
                  {role.label}
                </Text>
              </View>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => startEdit(item)}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={C.foreground}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.iconBtn, s.iconBtnDanger]}
                onPress={() => handleDelete(item)}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={C.destructive}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, flexDirection: "column" },
  contentHeader: { marginBottom: 4, paddingHorizontal: 16, paddingTop: 16 },
  listStyle: { flex: 1 },
  listContent: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: R.full,
    backgroundColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.mutedFg,
  },
  emptyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },

  title: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 20,
    color: C.foreground,
  },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    marginTop: 2,
  },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 4 },
  statsItem: { flex: 1 },

  addSection: { marginTop: 12, marginBottom: 8, gap: 10 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
    padding: 0,
  },

  addToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 12,
  },
  addToggleBtnActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.border,
  },
  addToggleBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: C.primaryFg,
  },
  addToggleBtnTextActive: { color: C.mutedFg },

  noResults: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  noResultsText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 14,
    backgroundColor: C.card,
    gap: 10,
    shadowColor: C.warm,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: C.foreground,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 10,
    backgroundColor: C.card,
  },
  flex1: { flex: 1 },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: R.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Poppins_700Bold", fontSize: 14 },

  rowLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: C.foreground,
  },
  rowSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.mutedFg,
    marginTop: 2,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: R.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: "Poppins_700Bold", fontSize: 10 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 10,
    backgroundColor: C.background,
  },
  inputField: {
    flex: 1,
    paddingVertical: 9,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
  },

  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  roleChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  roleChipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.mutedFg,
  },
  roleChipTextActive: { color: C.primaryFg },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 11,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: C.primaryFg,
  },

  editActions: { flexDirection: "row", gap: 8 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: C.mutedFg,
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: { borderColor: C.destructive },
});
