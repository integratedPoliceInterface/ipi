/**
 * IPI - Configuração Supabase
 * Inicializa o cliente para conexão com o banco de dados cloud.
 * Suporta override via window.__IPI_CONFIG__, meta tags ou localStorage (para Vercel env).
 */

const _DEFAULT_SUPABASE_URL = 'https://jkmgwsrirlcsnhnnunkv.supabase.co';
const _DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbWd3c3Jpcmxjc25obm51bmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDIwNDQsImV4cCI6MjA4NzExODA0NH0.bNl8pgDJN3d52MRgDHT0PZS8jSFUc3oeYOl-t8UODq4';

function _resolverSupabaseConfig() {
    const cfg = (typeof window !== 'undefined' && window.__IPI_CONFIG) || {};
    const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content;
    const metaKey = document.querySelector('meta[name="supabase-key"]')?.content;
    const lsUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('ipi_supabase_url') : null;
    const lsKey = typeof localStorage !== 'undefined' ? localStorage.getItem('ipi_supabase_key') : null;
    return {
        url: cfg.SUPABASE_URL || metaUrl || lsUrl || _DEFAULT_SUPABASE_URL,
        key: cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_KEY || metaKey || lsKey || _DEFAULT_SUPABASE_KEY
    };
}

const _cfgSupabase = _resolverSupabaseConfig();
const SUPABASE_URL = _cfgSupabase.url;
const SUPABASE_KEY = _cfgSupabase.key;

// Expõe para outros módulos (conectividade healthcheck, supabaseApi fallback)
window.IPI_SUPABASE_URL = SUPABASE_URL;
window.IPI_SUPABASE_KEY = SUPABASE_KEY;

// Inicializa o cliente globalmente usando o objeto fornecido pelo SDK (window.supabase)
const client = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

window.supabaseClient = client;

if (SUPABASE_URL === _DEFAULT_SUPABASE_URL && SUPABASE_KEY === _DEFAULT_SUPABASE_KEY) {
    console.warn('[Supabase] Usando credenciais padrão embutidas. Configure window.__IPI_CONFIG__ ou meta tags em produção e ative RLS (supabase/migrations/002_rls_policies.sql).');
}
console.log('[Supabase] Cliente inicializado (ambiente: ' + (SUPABASE_URL.includes('SUA_') ? 'DEMO-PLACEHOLDER' : 'PRODUÇÃO') + ')');
