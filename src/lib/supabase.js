// @ts-nocheck
// API Client - Drop-in replacement for Supabase client
// Mimics the supabase.from().select().eq() chainable API

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
    return localStorage.getItem('auth_token');
}

function setToken(token) {
    localStorage.setItem('auth_token', token);
}

function removeToken() {
    localStorage.removeItem('auth_token');
}

function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch(path, options = {}) {
    const resp = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...options.headers },
    });
    return resp;
}

// ============================================================
// Query Builder - mimics supabase.from('table').select().eq()
// ============================================================
class QueryBuilder {
    constructor(table) {
        this._table = table;
        this._select = '*';
        this._filters = [];
        this._order = null;
        this._limit = null;
        this._offset = null;
        this._single = false;
        this._maybeSingle = false;
        this._count = null;
    }

    select(columns = '*', options) {
        this._select = columns;
        if (options?.count) this._count = options.count;
        if (options?.head) this._head = true;
        return this;
    }

    eq(column, value) { this._filters.push({ column, op: 'eq', value }); return this; }
    neq(column, value) { this._filters.push({ column, op: 'neq', value }); return this; }
    gt(column, value) { this._filters.push({ column, op: 'gt', value }); return this; }
    gte(column, value) { this._filters.push({ column, op: 'gte', value }); return this; }
    lt(column, value) { this._filters.push({ column, op: 'lt', value }); return this; }
    lte(column, value) { this._filters.push({ column, op: 'lte', value }); return this; }
    like(column, value) { this._filters.push({ column, op: 'like', value }); return this; }
    ilike(column, value) { this._filters.push({ column, op: 'ilike', value }); return this; }
    is(column, value) { this._filters.push({ column, op: 'is', value }); return this; }
    in(column, values) { this._filters.push({ column, op: 'in', value: values }); return this; }
    contains(column, value) { this._filters.push({ column, op: 'contains', value: JSON.stringify(value) }); return this; }
    not(column, op, value) {
        if (op === 'eq') this._filters.push({ column, op: 'neq', value });
        else if (op === 'is') this._filters.push({ column, op: 'is', value: value === null ? 'not_null' : null });
        return this;
    }

    order(column, options) {
        const dir = options?.ascending === false ? 'DESC' : 'ASC';
        if (this._order) {
            this._order += `, ${column} ${dir}`;
        } else {
            this._order = `${column} ${dir}`;
        }
        return this;
    }

    limit(count) { this._limit = count; return this; }
    range(from, to) { this._offset = from; this._limit = to - from + 1; return this; }
    single() { this._single = true; this._limit = 1; return this; }
    maybeSingle() { this._maybeSingle = true; this._single = true; this._limit = 1; return this; }

    /**
     * @param {any} resolve
     * @param {any} [reject]
     * @returns {Promise<any>}
     */
    then(resolve, reject) {
        return this._execute().then(resolve, reject);
    }

    /**
     * @returns {Promise<{data: any, error: any, count?: number}>}
     */
    async _execute() {
        const resp = await apiFetch('/api/data/query', {
            method: 'POST',
            body: JSON.stringify({
                table: this._table,
                select: this._select,
                filters: this._filters,
                order: this._order,
                limit: this._limit,
                offset: this._offset,
                single: this._single,
            }),
        });

        const json = await resp.json();

        if (json.error) {
            if (this._maybeSingle && json.data === null) {
                return { data: null, error: null };
            }
            return { data: null, error: { message: json.error } };
        }

        let data = json.data;
        const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
        if (this._head) {
            return { data: null, error: null, count };
        }
        if (this._count) {
            return { data, error: null, count };
        }

        return { data, error: null };
    }
}

// ============================================================
// Insert/Update/Delete/Upsert builders
// ============================================================
class InsertBuilder {
    constructor(table, data) {
        this._table = table;
        this._data = data;
        this._returning = '*';
        this._single = false;
    }
    select(cols) { this._returning = cols || '*'; return this; }
    single() { this._single = true; return this; }
    /**
     * @param {any} resolve
     * @param {any} [reject]
     * @returns {Promise<any>}
     */
    then(resolve, reject) {
        return (async () => {
            try {
                const resp = await apiFetch('/api/data/insert', {
                    method: 'POST',
                    body: JSON.stringify({ table: this._table, data: this._data, returning: this._returning }),
                });
                const json = await resp.json();
                if (json.error) return { data: null, error: { message: json.error } };
                let data = json.data;
                if (this._single && Array.isArray(data)) data = data[0] || null;
                return { data, error: null };
            } catch (err) {
                return { data: null, error: err };
            }
        })().then(resolve, reject);
    }
}

class UpdateBuilder {
    constructor(table, data) {
        this._table = table;
        this._data = data;
        this._filters = [];
        this._returning = '*';
        this._single = false;
    }
    eq(column, value) { this._filters.push({ column, op: 'eq', value }); return this; }
    in(column, values) { this._filters.push({ column, op: 'in', value: values }); return this; }
    select(cols) { this._returning = cols || '*'; return this; }
    single() { this._single = true; return this; }
    /**
     * @param {any} resolve
     * @param {any} [reject]
     * @returns {Promise<any>}
     */
    then(resolve, reject) {
        return (async () => {
            try {
                const resp = await apiFetch('/api/data/update', {
                    method: 'POST',
                    body: JSON.stringify({ table: this._table, data: this._data, filters: this._filters, returning: this._returning }),
                });
                const json = await resp.json();
                if (json.error) return { data: null, error: { message: json.error } };
                let data = json.data;
                if (this._single && Array.isArray(data)) data = data[0] || null;
                return { data, error: null };
            } catch (err) {
                return { data: null, error: err };
            }
        })().then(resolve, reject);
    }
}

class DeleteBuilder {
    constructor(table) {
        this._table = table;
        this._filters = [];
    }
    eq(column, value) { this._filters.push({ column, op: 'eq', value }); return this; }
    /**
     * @param {any} resolve
     * @param {any} [reject]
     * @returns {Promise<any>}
     */
    then(resolve, reject) {
        return (async () => {
            try {
                const resp = await apiFetch('/api/data/delete', {
                    method: 'POST',
                    body: JSON.stringify({ table: this._table, filters: this._filters }),
                });
                const json = await resp.json();
                if (json.error) return { data: null, error: { message: json.error } };
                return { data: json.data, error: null };
            } catch (err) {
                return { data: null, error: err };
            }
        })().then(resolve, reject);
    }
}

class UpsertBuilder {
    constructor(table, data, { onConflict } = {}) {
        this._table = table;
        this._data = data;
        this._onConflict = onConflict;
        this._returning = '*';
        this._single = false;
    }
    select(cols) { this._returning = cols || '*'; return this; }
    single() { this._single = true; return this; }
    /**
     * @param {any} resolve
     * @param {any} [reject]
     * @returns {Promise<any>}
     */
    then(resolve, reject) {
        return (async () => {
            try {
                const resp = await apiFetch('/api/data/upsert', {
                    method: 'POST',
                    body: JSON.stringify({ table: this._table, data: this._data, onConflict: this._onConflict, returning: this._returning }),
                });
                const json = await resp.json();
                if (json.error) return { data: null, error: { message: json.error } };
                let data = json.data;
                if (this._single && Array.isArray(data)) data = data[0] || null;
                return { data, error: null };
            } catch (err) {
                return { data: null, error: err };
            }
        })().then(resolve, reject);
    }
}

// ============================================================
// Storage interface
// ============================================================
class StorageBucketRef {
    constructor(bucket) {
        this._bucket = bucket;
    }

    async upload(filePath, file, options) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', filePath);
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/storage/${this._bucket}/upload`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData,
            });
            const json = await resp.json();
            if (json.error) return { data: null, error: { message: json.error } };
            return { data: json.data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    async download(filePath) {
        try {
            const resp = await fetch(`${API_BASE}/api/storage/${this._bucket}/download/${filePath}`);
            if (!resp.ok) return { data: null, error: { message: 'Download failed' } };
            const blob = await resp.blob();
            return { data: blob, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    async remove(paths) {
        try {
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/storage/${this._bucket}/delete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths }),
            });
            const json = await resp.json();
            if (json.error) return { data: null, error: { message: json.error } };
            return { data: json.data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    async list(prefix, options) {
        try {
            const token = getToken();
            const resp = await fetch(`${API_BASE}/api/storage/${this._bucket}/list?prefix=${prefix || ''}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            const json = await resp.json();
            return { data: json.data || [], error: json.error ? { message: json.error } : null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    getPublicUrl(filePath) {
        const publicUrl = `${API_BASE}/uploads/${this._bucket}/${filePath}`;
        return { data: { publicUrl } };
    }
}

// ============================================================
// Auth interface
// ============================================================
let _authChangeCallbacks = [];
let _currentUser = null;
let _currentSession = null;

const authRef = {
    async getSession() {
        const token = getToken();
        if (!token) return { data: { session: null }, error: null };
        try {
            const resp = await apiFetch('/api/auth/me');
            if (!resp.ok) { removeToken(); return { data: { session: null }, error: null }; }
            const json = await resp.json();
            _currentUser = json.user;
            _currentSession = { access_token: token, user: json.user };
            return { data: { session: _currentSession }, error: null };
        } catch { return { data: { session: null }, error: null }; }
    },

    async getUser() {
        const token = getToken();
        if (!token) return { data: { user: null }, error: null };
        try {
            const resp = await apiFetch('/api/auth/me');
            if (!resp.ok) return { data: { user: null }, error: null };
            const json = await resp.json();
            _currentUser = json.user;
            return { data: { user: json.user }, error: null };
        } catch { return { data: { user: null }, error: null }; }
    },

    async signInWithPassword({ email, password }) {
        try {
            const resp = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const json = await resp.json();
            if (!resp.ok || json.error) return { data: {}, error: { message: json.error || 'Login failed' } };
            setToken(json.token);
            _currentUser = json.user;
            _currentSession = { access_token: json.token, user: json.user };
            _authChangeCallbacks.forEach(cb => cb('SIGNED_IN', _currentSession));
            return { data: { user: json.user, session: _currentSession }, error: null };
        } catch (err) { return { data: {}, error: { message: err.message } }; }
    },

    async signUp({ email, password, options }) {
        try {
            const fullName = options?.data?.full_name || '';
            const phoneNumber = options?.data?.phone_number || '';
            const resp = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullName, phoneNumber }),
            });
            const json = await resp.json();
            if (!resp.ok || json.error) return { data: {}, error: { message: json.error || 'Signup failed' } };
            setToken(json.token);
            _currentUser = json.user;
            _currentSession = { access_token: json.token, user: json.user };
            _authChangeCallbacks.forEach(cb => cb('SIGNED_IN', _currentSession));
            return { data: { user: json.user, session: _currentSession }, error: null };
        } catch (err) { return { data: {}, error: { message: err.message } }; }
    },

    async signOut() {
        removeToken();
        _currentUser = null;
        _currentSession = null;
        _authChangeCallbacks.forEach(cb => cb('SIGNED_OUT', null));
    },

    onAuthStateChange(callback) {
        _authChangeCallbacks.push(callback);
        const token = getToken();
        if (token && _currentSession) {
            setTimeout(() => callback('INITIAL_SESSION', _currentSession), 0);
        }
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        _authChangeCallbacks = _authChangeCallbacks.filter(cb => cb !== callback);
                    }
                }
            }
        };
    },

    admin: {
        async listUsers() {
            try {
                const resp = await apiFetch('/api/rpc/admin_get_all_profiles', {
                    method: 'POST',
                    body: JSON.stringify({}),
                });
                const json = await resp.json();
                const users = (json.data || []).map(p => ({
                    id: p.id,
                    email: p.email,
                    user_metadata: { full_name: p.full_name },
                    created_at: p.created_at,
                }));
                return { data: { users }, error: null };
            } catch (err) { return { data: { users: [] }, error: err }; }
        }
    }
};

// ============================================================
// RPC
// ============================================================
async function rpc(functionName, params = {}) {
    try {
        const resp = await apiFetch(`/api/rpc/${functionName}`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
        const json = await resp.json();
        if (json.error) return { data: null, error: { message: json.error } };
        return { data: json.data, error: null };
    } catch (err) { return { data: null, error: err }; }
}

// ============================================================
// Realtime channel stub (no-op since we don't have Supabase realtime)
// ============================================================
class ChannelStub {
    on() { return this; }
    subscribe() { return this; }
    unsubscribe() { return this; }
}

// ============================================================
// Main export
// ============================================================
/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = {
    from: (table) => ({
        select: (columns, options) => new QueryBuilder(table).select(columns, options),
        insert: (data) => new InsertBuilder(table, data),
        update: (data) => new UpdateBuilder(table, data),
        delete: () => new DeleteBuilder(table),
        upsert: (data, options) => new UpsertBuilder(table, data, options),
    }),
    storage: {
        from: (bucket) => new StorageBucketRef(bucket),
    },
    auth: authRef,
    rpc,
    // Realtime stubs
    channel: (name) => new ChannelStub(),
    removeChannel: (channel) => { },
};

