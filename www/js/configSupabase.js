/**
 * IPI - Configuração Supabase
 * Inicializa o cliente para conexão com o banco de dados cloud.
 */

const SUPABASE_URL = 'https://jkmgwsrirlcsnhnnunkv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbWd3c3Jpcmxjc25obm51bmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDIwNDQsImV4cCI6MjA4NzExODA0NH0.bNl8pgDJN3d52MRgDHT0PZS8jSFUc3oeYOl-t8UODq4';

// Inicializa o cliente globalmente usando o objeto fornecido pelo SDK (window.supabase)
const client = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

window.supabaseClient = client;

console.log('[Supabase] Cliente inicializado (ambiente: ' + (SUPABASE_URL.includes('SUA_') ? 'DEMO-PLACEHOLDER' : 'PRODUÇÃO') + ')');
