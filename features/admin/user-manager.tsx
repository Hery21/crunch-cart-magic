import {
  addUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type AppUser,
} from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  settings: { sheetsEndpoint?: string };
}

const EMPTY_FORM = {
  username: "",
  password: "",
  display_name: "",
  role: "cashier",
};

// Web-compatible alert that works in browser
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Web-compatible confirm that works in browser
const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: onConfirm },
    ]);
  }
};

export default function UserManager({ settings }: Props) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);

  const loadUsers = useCallback(
    async (forceRefresh = false) => {
      if (!settings.sheetsEndpoint) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchUsers(settings.sheetsEndpoint, forceRefresh);
        if (data.length > 0) {
          setUsers(data);
        } else {
          setFetchError("Daftar pengguna kosong atau gagal dimuat dari Google Sheets.");
        }
      } catch {
        setFetchError("Gagal menghubungi Google Sheets.");
      } finally {
        setLoading(false);
      }
    },
    [settings.sheetsEndpoint],
  );

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  const startEdit = (user: AppUser) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      password: user.password,
      display_name: user.display_name,
      role: user.role,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleUpdate = async (id: number) => {
    if (!settings.sheetsEndpoint) return;
    if (!editForm.username || !editForm.password || !editForm.display_name) {
      showAlert("Error", "Semua field wajib diisi");
      return;
    }

    setSyncing(true);
    const success = await updateUser(settings.sheetsEndpoint, {
      id,
      ...editForm,
    });
    setSyncing(false);

    if (success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { id, ...editForm } : u)),
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
        if (!settings.sheetsEndpoint) return;
        setSyncing(true);
        const success = await deleteUser(settings.sheetsEndpoint, user.id);
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
    if (!settings.sheetsEndpoint) return;
    if (!addForm.username || !addForm.password || !addForm.display_name) {
      showAlert("Error", "Semua field wajib diisi");
      return;
    }

    setSyncing(true);
    const success = await addUser(settings.sheetsEndpoint, addForm);
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

  if (!settings.sheetsEndpoint) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>
          Google Sheets endpoint tidak dikonfigurasi.
        </Text>
        <Text style={s.emptySub}>Atur di Pengaturan terlebih dahulu.</Text>
      </View>
    );
  }

  if (fetchError || users.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>Gagal memuat pengguna</Text>
        <Text style={s.emptySub}>{fetchError ?? "Daftar kosong."}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => loadUsers(true)}>
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
      </View>

      <FlatList
        style={s.listStyle}
        contentContainerStyle={s.listContent}
        data={users}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={s.addSection}>
            <TouchableOpacity
              style={s.addToggleBtn}
              onPress={() => setShowAddForm((v) => !v)}
            >
              <Text style={s.addToggleBtnText}>
                {showAddForm ? "Batal" : "+ Tambah Pengguna"}
              </Text>
            </TouchableOpacity>

            {showAddForm && (
              <View style={s.card}>
                <TextInput
                  style={s.input}
                  placeholder="Username"
                  placeholderTextColor={C.mutedFg}
                  autoCapitalize="none"
                  value={addForm.username}
                  onChangeText={(t) =>
                    setAddForm((p) => ({ ...p, username: t }))
                  }
                />
                <TextInput
                  style={s.input}
                  placeholder="Password / PIN"
                  placeholderTextColor={C.mutedFg}
                  autoCapitalize="none"
                  value={addForm.password}
                  onChangeText={(t) =>
                    setAddForm((p) => ({ ...p, password: t }))
                  }
                />
                <TextInput
                  style={s.input}
                  placeholder="Nama Tampilan"
                  placeholderTextColor={C.mutedFg}
                  value={addForm.display_name}
                  onChangeText={(t) =>
                    setAddForm((p) => ({ ...p, display_name: t }))
                  }
                />
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
                      <Text
                        style={[
                          s.roleChipText,
                          addForm.role === r && s.roleChipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.saveBtn, syncing && s.saveBtnDisabled]}
                  onPress={handleAdd}
                  disabled={syncing}
                >
                  <Text style={s.saveBtnText}>
                    {syncing ? "Menyimpan..." : "Simpan Pengguna Baru"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isEditing = editingId === item.id;

          if (isEditing) {
            return (
              <View style={s.card}>
                <TextInput
                  style={s.input}
                  placeholder="Username"
                  placeholderTextColor={C.mutedFg}
                  autoCapitalize="none"
                  value={editForm.username}
                  onChangeText={(t) =>
                    setEditForm((p) => ({ ...p, username: t }))
                  }
                />
                <TextInput
                  style={s.input}
                  placeholder="Password / PIN"
                  placeholderTextColor={C.mutedFg}
                  autoCapitalize="none"
                  value={editForm.password}
                  onChangeText={(t) =>
                    setEditForm((p) => ({ ...p, password: t }))
                  }
                />
                <TextInput
                  style={s.input}
                  placeholder="Nama Tampilan"
                  placeholderTextColor={C.mutedFg}
                  value={editForm.display_name}
                  onChangeText={(t) =>
                    setEditForm((p) => ({ ...p, display_name: t }))
                  }
                />
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
                      <Text
                        style={[
                          s.roleChipText,
                          editForm.role === r && s.roleChipTextActive,
                        ]}
                      >
                        {r}
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
              <View style={s.flex1}>
                <Text style={s.rowLabel}>{item.display_name}</Text>
                <Text style={s.rowSub}>
                  @{item.username} • {item.role}
                </Text>
              </View>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => startEdit(item)}
              >
                <Text style={s.iconBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.iconBtn, s.iconBtnDanger]}
                onPress={() => handleDelete(item)}
              >
                <Text style={s.iconBtnDangerText}>Hapus</Text>
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
  contentHeader: { marginBottom: 12, paddingHorizontal: 16, paddingTop: 16 },
  listStyle: { flex: 1 },
  listContent: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
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
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },

  title: { fontFamily: "Poppins_700Bold", fontSize: 18, color: C.foreground },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    marginBottom: 4,
  },

  addSection: { marginBottom: 8, gap: 8 },
  addToggleBtn: {
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 10,
    alignItems: "center",
  },
  addToggleBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: C.primary,
  },

  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 12,
    backgroundColor: C.card,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 10,
    backgroundColor: C.card,
  },
  flex1: { flex: 1 },
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

  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
    backgroundColor: C.background,
  },

  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  roleChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  roleChipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.mutedFg,
    textTransform: "capitalize",
  },
  roleChipTextActive: { color: C.primaryFg },

  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 10,
    alignItems: "center",
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
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: C.mutedFg,
  },

  iconBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.foreground,
  },
  iconBtnDanger: { borderColor: C.destructive },
  iconBtnDangerText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.destructive,
  },
});
