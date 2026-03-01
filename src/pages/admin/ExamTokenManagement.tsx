import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Ticket, Plus, Download, Users, RefreshCw,
  Eye, EyeOff, Copy, Check, Calendar, Shield,
  TrendingUp, AlertCircle, Search, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Exam {
  id: string;
  title: string;
}

interface Token {
  id: string;
  token_code: string;
  token_type: 'single_use' | 'multi_use' | 'unlimited';
  max_uses: number | null;
  current_uses: number;
  assigned_to: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  allowed_attempts: number;
  created_at: string;
  applicant?: {
    full_name: string;
    registration_number: string;
  };
}

interface TokenUsage {
  id: string;
  used_at: string;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  applicant: {
    full_name: string;
    registration_number: string;
  };
}

export const ExamTokenManagement: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedTokenUsage, setSelectedTokenUsage] = useState<TokenUsage[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchTokens();
    }
  }, [selectedExam]);

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
      if (data && data.length > 0 && !selectedExam) {
        setSelectedExam(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchTokens = async () => {
    if (!selectedExam) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exam_tokens')
        .select(`
          *,
          applicant:assigned_to(registration_number, dynamic_data)
        `)
        .eq('exam_id', selectedExam)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tokensWithNames = data?.map(token => ({
        ...token,
        applicant: token.applicant ? {
          full_name: token.applicant.dynamic_data?.full_name || 'No Name',
          registration_number: token.applicant.registration_number
        } : null
      }));

      setTokens(tokensWithNames || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = (tokenCode: string) => {
    navigator.clipboard.writeText(tokenCode);
    setCopiedToken(tokenCode);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleToggleActive = async (tokenId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('exam_tokens')
        .update({ is_active: !currentStatus })
        .eq('id', tokenId);

      if (error) throw error;
      fetchTokens();
    } catch (error) {
      console.error('Error toggling token:', error);
      alert('Gagal mengubah status token');
    }
  };

  const handleViewUsage = async (tokenId: string) => {
    try {
      const { data, error } = await supabase
        .from('exam_token_usage')
        .select(`
          id,
          used_at,
          success,
          failure_reason,
          ip_address,
          applicant:applicant_id(registration_number, dynamic_data)
        `)
        .eq('token_id', tokenId)
        .order('used_at', { ascending: false });

      if (error) throw error;

      const usageWithNames = data?.map(usage => ({
        ...usage,
        applicant: {
          full_name: usage.applicant?.dynamic_data?.full_name || 'No Name',
          registration_number: usage.applicant?.registration_number || 'N/A'
        }
      }));

      setSelectedTokenUsage(usageWithNames || []);
      setShowUsageModal(true);
    } catch (error) {
      console.error('Error fetching token usage:', error);
    }
  };

  const handleExportTokens = () => {
    const exportData = filteredTokens.map(token => ({
      'Token Code': token.token_code,
      'Type': token.token_type,
      'Status': token.is_active ? 'Active' : 'Inactive',
      'Max Uses': token.max_uses || 'Unlimited',
      'Current Uses': token.current_uses,
      'Allowed Attempts': token.allowed_attempts,
      'Assigned To': token.applicant?.full_name || 'Unassigned',
      'Registration Number': token.applicant?.registration_number || '-',
      'Valid From': format(new Date(token.valid_from), 'dd/MM/yyyy HH:mm'),
      'Valid Until': token.valid_until ? format(new Date(token.valid_until), 'dd/MM/yyyy HH:mm') : 'No expiry',
      'Created At': format(new Date(token.created_at), 'dd/MM/yyyy HH:mm')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Exam Tokens');

    const examName = exams.find(e => e.id === selectedExam)?.title || 'exam';
    XLSX.writeFile(wb, `${examName}_tokens_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = token.token_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         token.applicant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         token.applicant?.registration_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || token.token_type === filterType;
    const matchesStatus = filterStatus === 'all' ||
                          (filterStatus === 'active' && token.is_active) ||
                          (filterStatus === 'inactive' && !token.is_active) ||
                          (filterStatus === 'used' && token.current_uses > 0) ||
                          (filterStatus === 'unused' && token.current_uses === 0);

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: tokens.length,
    active: tokens.filter(t => t.is_active).length,
    used: tokens.filter(t => t.current_uses > 0).length,
    unused: tokens.filter(t => t.current_uses === 0).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Exam Token Management</h2>
          <p className="text-slate-600 mt-1">Kelola token akses ujian dengan kontrol penuh</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportTokens}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            disabled={filteredTokens.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Bulk Generate
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Token
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Exam</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>{exam.title}</option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Ticket className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Tokens</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Active</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Used</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.used}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Ticket className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Unused</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.unused}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by token code, name, or registration number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Types</option>
                <option value="single_use">Single Use</option>
                <option value="multi_use">Multi Use</option>
                <option value="unlimited">Unlimited</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="used">Used</option>
                <option value="unused">Unused</option>
              </select>

              <button
                onClick={fetchTokens}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-600">Loading tokens...</div>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <Ticket className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">
                {tokens.length === 0 ? 'Belum ada token untuk ujian ini' : 'Tidak ada token yang sesuai filter'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Token Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Usage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Validity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTokens.map((token) => (
                      <tr key={token.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                              {token.token_code}
                            </code>
                            <button
                              onClick={() => handleCopyToken(token.token_code)}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              {copiedToken === token.token_code ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            token.token_type === 'single_use' ? 'bg-blue-100 text-blue-700' :
                            token.token_type === 'multi_use' ? 'bg-purple-100 text-purple-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {token.token_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {token.current_uses} / {token.max_uses || '∞'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {token.applicant ? (
                            <div>
                              <div className="font-medium text-slate-900">{token.applicant.full_name}</div>
                              <div className="text-slate-500">{token.applicant.registration_number}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {token.valid_until ? format(new Date(token.valid_until), 'dd/MM/yy') : 'No expiry'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            token.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {token.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewUsage(token.id)}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                              title="View Usage"
                            >
                              <Eye className="h-4 w-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(token.id, token.is_active)}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                              title={token.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {token.is_active ? (
                                <EyeOff className="h-4 w-4 text-red-600" />
                              ) : (
                                <Eye className="h-4 w-4 text-emerald-600" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <CreateTokenModal
          examId={selectedExam}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTokens();
          }}
        />
      )}

      {showBulkModal && (
        <BulkGenerateModal
          examId={selectedExam}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            fetchTokens();
          }}
        />
      )}

      {showUsageModal && (
        <TokenUsageModal
          usage={selectedTokenUsage}
          onClose={() => setShowUsageModal(false)}
        />
      )}
    </div>
  );
};

interface CreateTokenModalProps {
  examId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTokenModal: React.FC<CreateTokenModalProps> = ({ examId, onClose, onSuccess }) => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    token_type: 'single_use' as 'single_use' | 'multi_use' | 'unlimited',
    max_uses: 1,
    allowed_attempts: 1,
    valid_until: '',
    assigned_to: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [applicants, setApplicants] = useState<Array<{ id: string; full_name: string; registration_number: string }>>([]);

  useEffect(() => {
    fetchApplicants();
  }, []);

  const fetchApplicants = async () => {
    const { data } = await supabase
      .from('applicants')
      .select('id, registration_number, dynamic_data')
      .order('registration_number');

    if (data) {
      const applicantsWithNames = data.map(applicant => ({
        id: applicant.id,
        full_name: applicant.dynamic_data?.full_name || 'No Name',
        registration_number: applicant.registration_number
      }));
      setApplicants(applicantsWithNames);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSubmitting(true);
    try {
      const { data: tokenCode, error: rpcError } = await supabase.rpc('generate_exam_token_code');

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      console.log('Generated token code:', tokenCode);
      console.log('Creating token with:', {
        exam_id: examId,
        token_code: tokenCode,
        token_type: formData.token_type,
        max_uses: formData.token_type === 'unlimited' ? null : formData.max_uses,
        allowed_attempts: formData.allowed_attempts,
        valid_until: formData.valid_until || null,
        assigned_to: formData.assigned_to || null,
        assigned_by: profile.id
      });

      const { error } = await supabase
        .from('exam_tokens')
        .insert({
          exam_id: examId,
          token_code: tokenCode,
          token_type: formData.token_type,
          max_uses: formData.token_type === 'unlimited' ? null : formData.max_uses,
          allowed_attempts: formData.allowed_attempts,
          valid_until: formData.valid_until || null,
          assigned_to: formData.assigned_to || null,
          assigned_by: profile.id
        });

      if (error) {
        console.error('Insert Error:', error);
        throw error;
      }

      alert(`Token berhasil dibuat: ${tokenCode}`);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating token:', error);
      alert(`Gagal membuat token: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Create New Token</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Token Type</label>
            <select
              value={formData.token_type}
              onChange={(e) => setFormData({ ...formData, token_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="single_use">Single Use</option>
              <option value="multi_use">Multi Use</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>

          {formData.token_type !== 'unlimited' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Max Uses</label>
              <input
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="1"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Attempts</label>
            <input
              type="number"
              value={formData.allowed_attempts}
              onChange={(e) => setFormData({ ...formData, allowed_attempts: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Valid Until (Optional)</label>
            <input
              type="datetime-local"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Assign to Student (Optional)</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Unassigned</option>
              {applicants.map(applicant => (
                <option key={applicant.id} value={applicant.id}>
                  {applicant.full_name} - {applicant.registration_number}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BulkGenerateModalProps {
  examId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const BulkGenerateModal: React.FC<BulkGenerateModalProps> = ({ examId, onClose, onSuccess }) => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    batch_name: '',
    token_count: 10,
    token_type: 'single_use' as 'single_use' | 'multi_use' | 'unlimited',
    max_uses: 1,
    allowed_attempts: 1,
    valid_until: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (formData.token_count < 1 || formData.token_count > 10000) {
      alert('Token count must be between 1 and 10000');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Generating batch tokens with:', {
        p_exam_id: examId,
        p_batch_name: formData.batch_name,
        p_token_count: formData.token_count,
        p_token_type: formData.token_type,
        p_max_uses: formData.token_type === 'unlimited' ? null : formData.max_uses,
        p_allowed_attempts: formData.allowed_attempts,
        p_valid_from: new Date().toISOString(),
        p_valid_until: formData.valid_until || null,
        p_created_by: profile.id
      });

      const { error } = await supabase.rpc('generate_exam_token_batch', {
        p_exam_id: examId,
        p_batch_name: formData.batch_name,
        p_token_count: formData.token_count,
        p_token_type: formData.token_type,
        p_max_uses: formData.token_type === 'unlimited' ? null : formData.max_uses,
        p_allowed_attempts: formData.allowed_attempts,
        p_valid_from: new Date().toISOString(),
        p_valid_until: formData.valid_until || null,
        p_created_by: profile.id
      });

      if (error) {
        console.error('Batch generation error:', error);
        throw error;
      }

      alert(`Successfully generated ${formData.token_count} tokens!`);
      onSuccess();
    } catch (error: any) {
      console.error('Error generating tokens:', error);
      alert(`Failed to generate tokens: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Bulk Generate Tokens</h3>
          <p className="text-sm text-slate-600 mt-1">Generate multiple tokens at once</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Batch Name</label>
            <input
              type="text"
              value={formData.batch_name}
              onChange={(e) => setFormData({ ...formData, batch_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g., Batch 2024 - January"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Number of Tokens</label>
            <input
              type="number"
              value={formData.token_count}
              onChange={(e) => setFormData({ ...formData, token_count: parseInt(e.target.value) || 10 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="1"
              max="10000"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Maximum: 10,000 tokens</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Token Type</label>
            <select
              value={formData.token_type}
              onChange={(e) => setFormData({ ...formData, token_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="single_use">Single Use</option>
              <option value="multi_use">Multi Use</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>

          {formData.token_type !== 'unlimited' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Max Uses per Token</label>
              <input
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="1"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Attempts per Token</label>
            <input
              type="number"
              value={formData.allowed_attempts}
              onChange={(e) => setFormData({ ...formData, allowed_attempts: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Valid Until (Optional)</label>
            <input
              type="datetime-local"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Bulk Generation Summary:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{formData.token_count} tokens will be created</li>
                  <li>Type: {formData.token_type.replace('_', ' ')}</li>
                  <li>Each allows {formData.allowed_attempts} exam attempt(s)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Generating...' : 'Generate Tokens'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TokenUsageModalProps {
  usage: TokenUsage[];
  onClose: () => void;
}

const TokenUsageModal: React.FC<TokenUsageModalProps> = ({ usage, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Token Usage History</h3>
          <p className="text-sm text-slate-600 mt-1">{usage.length} usage record(s)</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {usage.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              Token belum pernah digunakan
            </div>
          ) : (
            <div className="space-y-3">
              {usage.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border ${
                    record.success
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {record.success ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-medium ${
                          record.success ? 'text-emerald-900' : 'text-red-900'
                        }`}>
                          {record.success ? 'Successful' : 'Failed'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-slate-600">Student:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {record.applicant.full_name}
                          </span>
                          {' '}
                          <span className="text-slate-500">
                            ({record.applicant.registration_number})
                          </span>
                        </p>
                        <p className="text-slate-600">
                          {format(new Date(record.used_at), 'dd MMM yyyy HH:mm:ss')}
                        </p>
                        {record.ip_address && (
                          <p className="text-slate-600">
                            IP: <code className="bg-slate-200 px-1 rounded">{record.ip_address}</code>
                          </p>
                        )}
                        {!record.success && record.failure_reason && (
                          <p className="text-red-700 font-medium mt-2">
                            Reason: {record.failure_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
