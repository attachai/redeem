"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, Pencil, Trash2, KeyRound, X } from "lucide-react";

interface UserRow {
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: "", password: "", display_name: "", role: "STAFF" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      setUsers(json.data || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditUser(null);
    setForm({ username: "", password: "", display_name: "", role: "STAFF" });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (user: UserRow) => {
    setEditUser(user);
    setForm({ username: user.username, password: "", display_name: user.display_name, role: user.role });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      if (editUser) {
        // Update
        const body: Record<string, string> = { display_name: form.display_name, role: form.role };
        if (form.password) body.password = form.password;

        const res = await fetch(`/api/users/${editUser.user_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setSaving(false); return; }
      } else {
        // Create
        if (!form.username || !form.password || !form.display_name) {
          setError("กรุณากรอกข้อมูลให้ครบ");
          setSaving(false);
          return;
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setSaving(false); return; }
      }

      setShowModal(false);
      fetchUsers();
    } catch {
      setError("เกิดข้อผิดพลาด");
    }
    setSaving(false);
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`ต้องการลบผู้ใช้ "${user.display_name}" (${user.username})?`)) return;
    try {
      const res = await fetch(`/api/users/${user.user_id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      fetchUsers();
    } catch {
      alert("เกิดข้อผิดพลาด");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">จัดการผู้ใช้</h2>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          เพิ่มผู้ใช้
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">ชื่อผู้ใช้</th>
              <th className="px-4 py-3 font-medium text-gray-600">ชื่อแสดง</th>
              <th className="px-4 py-3 font-medium text-gray-600">สิทธิ์</th>
              <th className="px-4 py-3 font-medium text-gray-600">สร้างเมื่อ</th>
              <th className="px-4 py-3 font-medium text-gray-600">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">กำลังโหลด...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">ไม่พบข้อมูล</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">{u.display_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(u)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        title="แก้ไข"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {u.user_id !== currentUserId && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="ลบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อผู้ใช้ (Username)</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  disabled={!!editUser}
                  placeholder="เช่น admin1"
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {editUser ? (
                    <span className="flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" />
                      รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)
                    </span>
                  ) : (
                    "รหัสผ่าน"
                  )}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editUser ? "เว้นว่างถ้าไม่ต้องการเปลี่ยน" : "อย่างน้อย 6 ตัวอักษร"}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อที่แสดง</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="ชื่อ-สกุล"
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">สิทธิ์ (Role)</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="STAFF">STAFF — บันทึก earn/redeem + ดูรายงาน</option>
                  <option value="ADMIN">ADMIN — จัดการทุกอย่าง + CRUD ผู้ใช้</option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
