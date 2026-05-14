/**
 * IPI - Configuração Supabase
 * Inicializa o cliente para conexão com o banco de dados cloud.
 */

const SUPABASE_URL = 'https://jkmgwsrirlcsnhnnunkv.supabase.co';
const SUPABASE_KEY = 'sb_secret_g8IyZ5HREeokf-88vS9fkw_2zCdL1pG';

// Inicializa o cliente globalmente usando o objeto fornecido pelo SDK (window.supabase)
const supabase = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

window.supabaseClient = supabase;

console.log('[Supabase] Cliente inicializado (ambiente: ' + (SUPABASE_URL.includes('SUA_') ? 'DEMO-PLACEHOLDER' : 'PRODUÇÃO') + ')');
