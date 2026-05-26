const SUPABASE_URL = 'https://jkmgwsrirlcsnhnnunkv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbWd3c3Jpcmxjc25obm51bmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDIwNDQsImV4cCI6MjA4NzExODA0NH0.bNl8pgDJN3d52MRgDHT0PZS8jSFUc3oeYOl-t8UODq4';

const _headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// ─── APENAS USA COMO FALLBACK SE O SDK NÃO ESTIVER DISPONÍVEL ───
if (!window.supabaseClient) {

class SupabaseQuery {
    constructor(table) {
        this.table = table;
        this.params = new URLSearchParams();
        this._single = false;
    }

    select(columns = '*') {
        this.params.set('select', columns);
        return this;
    }

    eq(col, val) {
        this.params.set(col, `eq.${val}`);
        return this;
    }

    neq(col, val) {
        this.params.set(col, `neq.${val}`);
        return this;
    }

    ilike(col, pattern) {
        this.params.set(col, `ilike.${encodeURIComponent(pattern)}`);
        return this;
    }

    order(col, opts = {}) {
        const dir = opts.ascending !== false ? 'asc' : 'desc';
        this.params.set('order', `${col}.${dir}`);
        return this;
    }

    single() {
        this._single = true;
        this.params.set('limit', '1');
        return this;
    }

    maybeSingle() {
        return this.single();
    }

    async then(resolve, reject) {
        try {
            const url = `${SUPABASE_URL}/rest/v1/${this.table}?${this.params}`;
            const res = await fetch(url, { headers: _headers });
            const data = await res.json();
            if (!res.ok) {
                reject({ code: `HTTP_${res.status}`, message: res.statusText, details: data });
                return;
            }
            resolve({ data: this._single ? (data[0] || null) : data, error: null });
        } catch (e) {
            reject({ code: 'FETCH_ERR', message: e.message });
        }
    }
}

class SupabaseInsert {
    constructor(table, rows) {
        this.table = table;
        this.rows = rows;
        this._select = '*';
        this._single = false;
    }

    select(cols) {
        if (cols) this._select = cols;
        return this;
    }

    single() {
        this._single = true;
        return this;
    }

    async then(resolve, reject) {
        try {
            const url = `${SUPABASE_URL}/rest/v1/${this.table}?select=${encodeURIComponent(this._select)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: _headers,
                body: JSON.stringify(this.rows)
            });
            const data = await res.json();
            if (!res.ok) {
                reject({ code: `HTTP_${res.status}`, message: res.statusText, details: data });
                return;
            }
            resolve({ data: this._single ? (data[0] || null) : data, error: null });
        } catch (e) {
            reject({ code: 'FETCH_ERR', message: e.message });
        }
    }
}

window.supabaseClient = {
    from(table) {
        return {
            select(columns) { return new SupabaseQuery(table).select(columns); },
            insert(rows) { return new SupabaseInsert(table, rows); }
        };
    }
};

console.log('[SupabaseAPI] Cliente REST inicializado (fallback)');

}
