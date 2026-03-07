import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DataTable, Column } from '../../components/shared/DataTable';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Plus, Edit2, Trash2, Key, Eye, EyeOff, Copy, Check, Users, BarChart3 } from 'lucide-react';
import { UserMonitoringTab } from '../../components/admin/UserMonitoringTab';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'student';
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'monitoring'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<User | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ user: User; password: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; userId: string | null }>({
    isOpen: false,
    userId: null
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('[UserManagement] Fetching users via RPC...');
      const { data, error } = await supabase.rpc('admin_get_all_profiles');

      if (error) {
        console.error('[UserManagement] Error fetching users:', error);
        throw error;
      }

      console.log('[UserManagement] Fetched users:', data?.length || 0);
      setUsers((data || []) as User[]);
    } catch (error: any) {
      console.error('[UserManagement] Exception fetching users:', error);
      if (error.message?.includes('Admin only')) {
        alert('Access denied. Admin privileges required.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      console.log('[UserManagement] Deleting user:', userId);
      const { error } = await supabase.rpc('admin_delete_profile', {
        target_user_id: userId
      });

      if (error) {
        console.error('[UserManagement] Delete error:', error);
        throw error;
      }

      console.log('[UserManagement] User deleted successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('[UserManagement] Exception deleting user:', error);
      // Refresh the list to remove stale data
      await fetchUsers();

      if (error.message?.includes('Admin only')) {
        alert('Access denied. Admin privileges required.');
      } else if (error.message?.includes('Cannot delete your own profile')) {
        alert('You cannot delete your own account.');
      } else {
        alert('Failed to delete user: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setDeleteDialog({ isOpen: false, userId: null });
    }
  };

  const filteredUsers = selectedRole === 'all'
    ? users
    : users.filter(u => u.role === selectedRole);

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      label: 'Name',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800">{item.full_name || 'N/A'}</div>
          <div className="text-xs text-slate-500">{item.id.slice(0, 8)}...</div>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (item) => <span className="text-slate-600">{item.email || 'N/A'}</span>
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.role === 'admin'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700'
          }`}>
          {item.role}
        </span>
      )
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (item) => <span className="text-slate-600">{item.phone || '-'}</span>
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.is_active
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-700'
          }`}>
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (item) => new Date(item.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditModal(item);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetPassword(item);
            }}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Reset Password"
          >
            <Key className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialog({ isOpen: true, userId: item.id });
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const handleResetPassword = async (user: User) => {
    const newPassword = generatePassword();

    try {
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: user.id,
        new_password: newPassword
      });

      if (error) throw error;

      if (data && data.success) {
        setPasswordModal({ user, password: newPassword });
      } else {
        throw new Error('Password reset failed');
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);

      // Refresh the list to remove stale data if user not found
      if (error.message?.includes('not found')) {
        await fetchUsers();
      }

      if (error.message?.includes('Admin privileges required')) {
        alert('Access denied. Admin privileges required.');
      } else if (error.message?.includes('Cannot reset your own password')) {
        alert('You cannot reset your own password. Use the normal password change flow.');
      } else if (error.message?.includes('not found')) {
        alert('User not found. The list has been refreshed.');
      } else {
        alert('Failed to reset password: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const generatePassword = (): string => {
    const length = 10;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-600 mt-1">Manage all system users and monitor student progress</p>
        </div>
        {activeTab === 'users' && (
          <div className="flex gap-2">
            <button
              onClick={() => fetchUsers()}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              title="Refresh"
            >
              Refresh
            </button>
            <button
              onClick={() => setCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create User
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'users'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
          >
            <Users className="h-4 w-4" />
            User List
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'monitoring'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
          >
            <BarChart3 className="h-4 w-4" />
            Student Monitoring
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          <div className="flex gap-4">
            {[
              { key: 'all', label: 'All Users', count: users.length },
              { key: 'admin', label: 'Admins', count: users.filter(u => u.role === 'admin').length },
              { key: 'student', label: 'Students', count: users.filter(u => u.role === 'student').length }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setSelectedRole(filter.key)}
                className={`px-4 py-2 rounded-lg transition-colors ${selectedRole === filter.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          <DataTable
            data={filteredUsers}
            columns={columns}
            searchable={true}
            searchPlaceholder="Search by name or email..."
            emptyMessage="No users found"
          />
        </>
      ) : (
        <UserMonitoringTab />
      )}

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, userId: null })}
        onConfirm={() => {
          if (deleteDialog.userId) {
            handleDelete(deleteDialog.userId);
          }
        }}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone and will also delete all associated data."
        confirmText="Delete"
        variant="danger"
      />

      {createModal && (
        <CreateUserModal
          onClose={() => setCreateModal(false)}
          onSuccess={() => {
            setCreateModal(false);
            fetchUsers();
          }}
          onPasswordGenerated={(user, password) => {
            setCreateModal(false);
            setPasswordModal({ user, password });
            fetchUsers();
          }}
        />
      )}

      {editModal && (
        <EditUserModal
          user={editModal}
          onClose={() => {
            setEditModal(null);
            fetchUsers();
          }}
          onSuccess={() => {
            setEditModal(null);
            fetchUsers();
          }}
        />
      )}

      {passwordModal && (
        <PasswordDisplayModal
          user={passwordModal.user}
          password={passwordModal.password}
          onClose={() => setPasswordModal(null)}
        />
      )}
    </div>
  );
};

interface CreateUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onPasswordGenerated: (user: User, password: string) => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ onClose, onPasswordGenerated }) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'student'>('student');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const length = 10;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !fullName) {
      alert('Email, password, and full name are required');
      return;
    }

    if (emailError) {
      alert('Please fix the email error before submitting');
      return;
    }

    setSaving(true);

    try {
      console.log('[CreateUserModal] Creating user with:', { email, fullName, role, phone });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password,
          full_name: fullName.trim(),
          role: role,
          phone: phone?.trim() || null
        })
      });

      const data = await response.json();

      console.log('[CreateUserModal] Response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      if (data && data.success) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const newUser: User = {
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          phone: phone || null,
          is_active: true,
          created_at: new Date().toISOString()
        };

        console.log('[CreateUserModal] User created successfully:', newUser);
        onPasswordGenerated(newUser, password);
      } else {
        throw new Error(data?.error || 'Failed to create user');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);

      if (error.message?.includes('already exists')) {
        setEmailError('A user with this email already exists');
      } else if (error.message?.includes('Admin only') || error.message?.includes('Only admins')) {
        alert('Access denied. Admin privileges required.');
      } else {
        alert('Failed to create user: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Create New User</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${emailError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-blue-500'
                  }`}
                required
              />
            </div>
            {emailError && (
              <p className="text-sm text-red-600 mt-1">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'student')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !!emailError}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || '');
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      console.log('[EditUserModal] Updating user:', user.id);
      const { error } = await supabase.rpc('admin_update_profile', {
        target_user_id: user.id,
        new_full_name: fullName,
        new_email: user.email,
        new_role: role,
        new_is_active: isActive
      });

      if (error) {
        console.error('[EditUserModal] Update error:', error);
        throw error;
      }

      console.log('[EditUserModal] User updated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('[EditUserModal] Exception updating user:', error);

      if (error.message?.includes('Admin only')) {
        alert('Access denied. Admin privileges required.');
      } else if (error.message?.includes('not found')) {
        alert('User not found. The user may have been deleted. Closing and refreshing...');
        onClose();
      } else {
        alert('Failed to update user: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Edit User</h3>
          <p className="text-sm text-slate-600 mt-1">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'student')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active Account</label>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PasswordDisplayModalProps {
  user: User;
  password: string;
  onClose: () => void;
}

const PasswordDisplayModal: React.FC<PasswordDisplayModalProps> = ({ user, password, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Password Created</h3>
          <p className="text-sm text-slate-600 mt-1">User: {user.email}</p>
        </div>

        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-900 font-medium mb-1">Important!</p>
            <p className="text-xs text-amber-800">
              This password will only be shown once. Make sure to copy and save it securely.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg font-mono text-lg">
                {password}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            I've Saved the Password
          </button>
        </div>
      </div>
    </div>
  );
};
