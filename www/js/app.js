/**
 * IPI - Lógica Principal
 * Lógica de Interface, Banco de Dados, Busca e Sincronização
 */

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════════════════ */
async function iniciarApp() {
    // 1. Abrir banco de dados
    await window.ipiDB.abrir();

    // 2. Inicia monitoramento de conectividade
    await window.connMgr.iniciar();

    // 3. Inicia serviço de sincronização
    window.servicoSincronizacao.iniciar(window.connMgr);

    // 4. Vincula UI
    vincularConectividade();
    vincularNavegacao();
    vincularTelaInicial();
    vincularTelaRAI();
    vincularTelaBusca();
    vincularTelaHistorico();
    vincularTelaConfiguracoes();
    vincularEventosGlobais();

    // 5. Carrega configurações do oficial
    await carregarConfiguracoesPolicial();

    // 6. Estatísticas iniciais
    await atualizarEstatisticas();

    // 7. Inicia relógio
    iniciarRelogio();

    // 8. Captura GPS automaticamente ao carregar
    //capturarGPS();

    console.log('[App] IPI iniciado.');
}

/* ════════════════════════════════════════════════════════════
   VINCULAÇÃO DA UI DE CONECTIVIDADE
   ════════════════════════════════════════════════════════════ */
function vincularConectividade() {
    const modoStatus = document.getElementById('modo-status');
    const pontoModo = modoStatus ? modoStatus.querySelector('.status-ponto') : null;
    const rotuloModo = document.getElementById('modo-rotulo');
    const barraAlerta = document.getElementById('barra-alerta');

    const pillNuvem = document.getElementById('pill-nuvem');
    const pillSMS = document.getElementById('pill-contingencia');
    const pillApagao = document.getElementById('pill-apagao');

    const badgeRAI = document.getElementById('badge-modo-rai');
    const badgeBusca = document.getElementById('badge-modo-busca');

    const configModo = {
        NUVEM: {
            classePonto: 'ponto-nuvem',
            rotulo: 'NUVEM',
            desc: 'Sincronizando com servidor central SSP-GO',
            pillAtiva: pillNuvem
        },
        SMS: {
            classePonto: 'ponto-contingencia',
            rotulo: 'SMS',
            desc: '⚠ Sinal fraco — modo SMS ativo. Dados limitados.',
            pillAtiva: pillSMS
        },
        APAGAO: {
            classePonto: 'ponto-apagao',
            rotulo: 'BLACKOUT',
            desc: '✕ OFFLINE — Apenas cache local disponível.',
            pillAtiva: pillApagao
        }
    };

    function aplicarModo(modo) {
        const cfg = configModo[modo];
        if (!cfg) return;

        // Status do Dot
        if (pontoModo) {
            pontoModo.className = 'status-ponto ' + cfg.classePonto;
        }
        if (rotuloModo) rotuloModo.textContent = cfg.rotulo;

        // Pills (nuvem, sms, blackout)
        [pillNuvem, pillSMS, pillApagao].forEach(p => p && p.classList.remove('modo-ativo'));
        if (cfg.pillAtiva) cfg.pillAtiva.classList.add('modo-ativo');

        // Descrição
        const descricaoModo = document.getElementById('modo-descricao');
        if (descricaoModo) descricaoModo.textContent = cfg.desc;

        // Tela de RAI e Busca
        if (badgeRAI) badgeRAI.textContent = cfg.rotulo;
        if (badgeBusca) badgeBusca.textContent = cfg.rotulo;

        // Barra de alerta
        if (barraAlerta) {
            if (modo === 'APAGAO') {
                barraAlerta.style.display = 'block';
                barraAlerta.textContent = '⚡ MODO BLACKOUT — Sem sinal. Dados salvos localmente.';
            } else if (modo === 'SMS') {
                barraAlerta.style.display = 'block';
                barraAlerta.textContent = '⚠ MODO SMS — Sinal degradado. Use SMS para consultas urgentes.';
            } else {
                barraAlerta.style.display = 'none';
            }
        }
    }

    // Inicial
    aplicarModo(window.connMgr.obterModo());

    // Reage a mudanças
    window.connMgr.addEventListener('mudancamodo', async (e) => {
        aplicarModo(e.detail.atual);
        await atualizarEstatisticas();
        const anterior = e.detail.anterior;
        const atual = e.detail.atual;
        if (atual === 'NUVEM' && anterior !== 'NUVEM') {
            exibirAviso('✓ Conectado ao servidor. Sincronizando...', 'sucesso');
        } else if (atual === 'SMS') {
            exibirAviso('⚠ Modo SMS ativo.', 'aviso');
        } else if (atual === 'APAGAO') {
            exibirAviso('⚡ BLACKOUT — Operando offline.', 'erro');
        }
    });

    // Badge de sincronização
    const contadorSincronizacao = document.getElementById('contagem-sync');
    window.servicoSincronizacao.addEventListener('sync-completo', async (e) => {
        await atualizarEstatisticas();
        if (e.detail.sincronizados > 0) {
            exibirAviso(`✓ ${e.detail.sincronizados} ocorrência(s) sincronizada(s).`, 'sucesso');
        }
    });
    window.servicoSincronizacao.addEventListener('inicio-sync', () => {
        if (contadorSincronizacao) contadorSincronizacao.textContent = '↻';
    });
    window.servicoSincronizacao.addEventListener('fim-sync', async () => {
        const s = await window.ipiDB.obterEstatisticas();
        if (contadorSincronizacao) contadorSincronizacao.textContent = s.pendentes;
    });
}

/* ════════════════════════════════════════════════════════════
   NAVEGAÇÃO
   ════════════════════════════════════════════════════════════ */
const telas = {};
const botoesNav = {};

function vincularNavegacao() {
    document.querySelectorAll('.tela').forEach(t => {
        telas[t.id.replace('tela-', '')] = t;
    });
    document.querySelectorAll('.botao-navegacao').forEach(b => {
        const alvo = b.dataset.tela;
        botoesNav[alvo] = b;
        b.addEventListener('click', () => navegarPara(alvo));
    });
}

function navegarPara(nomeTela) {
    // Desativa todas
    Object.values(telas).forEach(t => t.classList.remove('ativa'));
    Object.values(botoesNav).forEach(b => b.classList.remove('ativo'));

    // Ativa alvo
    const tela = telas[nomeTela];
    if (tela) {
        tela.classList.add('ativa');
        tela.scrollTop = 0;
    }
    const btn = botoesNav[nomeTela];
    if (btn) btn.classList.add('ativo');

    // Funções específicas por tela
    if (nomeTela === 'historico') renderizarHistorico();
    if (nomeTela === 'configuracoes') atualizarEstatisticasCache();
}

/* ════════════════════════════════════════════════════════════
   Tela Inicial
   ════════════════════════════════════════════════════════════ */
function vincularTelaInicial() {
    document.getElementById('btn-novo-rai')?.addEventListener('click', () => navegarPara('rai'));
    document.getElementById('btn-busca-rapida')?.addEventListener('click', () => navegarPara('busca'));
}

async function atualizarEstatisticas() {
    const s = await window.ipiDB.obterEstatisticas();
    definirTexto('estat-pendente', s.pendentes);
    definirTexto('estat-sincronizado', s.sincronizadas);
    definirTexto('estat-veiculos', s.veiculos);
    definirTexto('estat-pessoas', s.pessoas);
    definirTexto('contagem-sync', s.pendentes);
}

/* ════════════════════════════════════════════════════════════
   Tela RAI
   ════════════════════════════════════════════════════════════ */
function vincularTelaRAI() {
    document.getElementById('voltar-rai')?.addEventListener('click', () => navegarPara('inicio'));
    document.getElementById('btn-cancelar-rai')?.addEventListener('click', () => navegarPara('inicio'));
    document.getElementById('btn-salvar-rai')?.addEventListener('click', salvarRAI);
    document.getElementById('btn-capturar-gps')?.addEventListener('click', capturarGPS);
    document.getElementById('btn-add-pessoa')?.addEventListener('click', adicionarEntradaPessoa);
    document.getElementById('btn-add-veiculo')?.addEventListener('click', adicionarEntradaVeiculo);

    // Nav FAB
    document.getElementById('nav-rai')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navegarPara('rai');
    });
}

let contadorPessoas = 0, contadorVeiculos = 0;

function adicionarEntradaPessoa() {
    const id = `pessoa-${++contadorPessoas}`;
    const lista = document.getElementById('lista-pessoas');
    const div = document.createElement('div');
    div.className = 'entrada-pessoa';
    div.id = id;
    div.innerHTML = `
        <button class="btn-remover-entrada" onclick="removerEntrada('${id}')">✕</button>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">CPF</label>
            <input class="controle-formulario" type="text" placeholder="000.000.000-00" data-campo="cpf" maxlength="14">
        </div>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">Nome Completo</label>
            <input class="controle-formulario" type="text" placeholder="Nome da pessoa" data-campo="nome">
        </div>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">Envolvimento</label>
            <select class="controle-formulario" data-campo="envolvimento">
                <option value="Suspeito">Suspeito</option>
                <option value="Vítima">Vítima</option>
                <option value="Testemunha">Testemunha</option>
                <option value="Autor">Autor</option>
            </select>
        </div>
    `;
    lista.appendChild(div);
}

function adicionarEntradaVeiculo() {
    const id = `veiculo-${++contadorVeiculos}`;
    const lista = document.getElementById('lista-veiculos');
    const div = document.createElement('div');
    div.className = 'entrada-veiculo';
    div.id = id;
    div.innerHTML = `
        <button class="btn-remover-entrada" onclick="removerEntrada('${id}')">✕</button>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">Placa</label>
            <input class="controle-formulario" type="text" placeholder="ABC1D23" data-campo="placa" maxlength="7"
                   style="letter-spacing:3px; text-transform:uppercase;">
        </div>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">Modelo / Marca</label>
            <input class="controle-formulario" type="text" placeholder="Ex: Honda CG 150" data-campo="modelo">
        </div>
        <div class="grupo-formulario">
            <label class="rotulo-formulario">Cor</label>
            <input class="controle-formulario" type="text" placeholder="Ex: Prata" data-campo="cor">
        </div>
    `;
    lista.appendChild(div);
}

function removerEntrada(id) {
    document.getElementById(id)?.remove();
}

function coletarPessoas() {
    const entradas = document.querySelectorAll('.entrada-pessoa');
    return Array.from(entradas).map(e => ({
        cpf: e.querySelector('[data-campo="cpf"]')?.value || '',
        nome: e.querySelector('[data-campo="nome"]')?.value || '',
        envolvimento: e.querySelector('[data-campo="envolvimento"]')?.value || ''
    }));
}

function coletarVeiculos() {
    const entradas = document.querySelectorAll('.entrada-veiculo');
    return Array.from(entradas).map(e => ({
        placa: (e.querySelector('[data-campo="placa"]')?.value || '').toUpperCase(),
        modelo: e.querySelector('[data-campo="modelo"]')?.value || '',
        cor: e.querySelector('[data-campo="cor"]')?.value || ''
    }));
}

async function salvarRAI() {
    const tipo = document.getElementById('tipo-rai')?.value;
    const descricao = document.getElementById('desc-rai')?.value;
    const matricula = await window.ipiDB.obterConfiguracao('matricula_policial') || 'DESCONHECIDO';

    if (!tipo) { exibirAviso('Selecione o tipo de ocorrência.', 'erro'); return; }
    if (!descricao || descricao.trim().length < 10) { exibirAviso('Descreva a ocorrência (mínimo 10 caracteres).', 'erro'); return; }

    const ocorrencia = {
        id: `RAI-${Date.now()}`,
        matricula_operador: matricula,
        data_hora: new Date().toISOString(),
        tipo,
        descricao,
        referencia_endereco: document.getElementById('endereco-rai')?.value || '',
        latitude: parseFloat(document.getElementById('lat-rai')?.value) || null,
        longitude: parseFloat(document.getElementById('lng-rai')?.value) || null,
        pessoas: coletarPessoas(),
        veiculos: coletarVeiculos(),
        observacoes: document.getElementById('obs-rai')?.value || '',
        sincronizado: window.connMgr.estaEmNuvem(),
        modo: window.connMgr.obterModo()
    };

    await window.ipiDB.salvarOcorrencia(ocorrencia);
    await atualizarEstatisticas();

    // Resetar formulário
    resetarFormularioRAI();
    navegarPara('historico');

    if (ocorrencia.sincronizado) {
        exibirAviso('✓ RAI salvo e sincronizado.', 'sucesso');
    } else {
        exibirAviso('RAI salvo localmente. Sincronizará quando online.', 'aviso');
    }
}

function resetarFormularioRAI() {
    ['tipo-rai', 'desc-rai', 'endereco-rai', 'lat-rai', 'lng-rai', 'obs-rai'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('lista-pessoas').innerHTML = '';
    document.getElementById('lista-veiculos').innerHTML = '';
    contadorPessoas = 0; contadorVeiculos = 0;
}

/* ════════════════════════════════════════════════════════════
   Tela de Busca
   ════════════════════════════════════════════════════════════ */
let tipoBusca = 'veiculo';

function vincularTelaBusca() {
    document.getElementById('voltar-busca')?.addEventListener('click', () => navegarPara('inicio'));
    document.getElementById('btn-executar-busca')?.addEventListener('click', executarBusca);
    document.getElementById('entrada-busca')?.addEventListener('keyup', e => {
        if (e.key === 'Enter') executarBusca();
    });

    document.querySelectorAll('.aba-busca').forEach(aba => {
        aba.addEventListener('click', () => {
            document.querySelectorAll('.aba-busca').forEach(a => a.classList.remove('ativa'));
            aba.classList.add('ativa');
            tipoBusca = aba.dataset.tipo;
            const input = document.getElementById('entrada-busca');
            if (input) {
                input.value = '';
                input.placeholder = tipoBusca === 'veiculo'
                    ? 'Digite a placa (ex: KRT1234)'
                    : 'Digite CPF ou nome completo';
            }
            document.getElementById('resultados-busca').innerHTML = '';
        });
    });
}

async function executarBusca() {
    const consulta = document.getElementById('entrada-busca')?.value?.trim();
    if (!consulta) { exibirAviso('Digite uma placa ou CPF.', 'erro'); return; }

    const areaResultados = document.getElementById('resultados-busca');
    const areaLatencia = document.getElementById('latencia-busca');
    areaResultados.innerHTML = '<div class="sem-resultados">Pesquisando...</div>';

    try {
        if (tipoBusca === 'veiculo') {
            const { resultado, modo, latenciaMs } = await window.servicoBusca.buscarVeiculo(consulta);
            atualizarLatencia(areaLatencia, latenciaMs, modo);
            if (resultado) {
                areaResultados.innerHTML = renderizarResultadoVeiculo(resultado);
            } else {
                areaResultados.innerHTML = `<div class="sem-resultados">Nenhum veículo encontrado com placa <strong>${consulta.toUpperCase()}</strong>.<br><br>Modo: ${modo}</div>`;
            }
        } else {
            const { resultados, modo, latenciaMs } = await window.servicoBusca.buscarPessoa(consulta);
            atualizarLatencia(areaLatencia, latenciaMs, modo);
            if (resultados.length > 0) {
                areaResultados.innerHTML = resultados.map(renderizarResultadoPessoa).join('');
            } else {
                areaResultados.innerHTML = `<div class="sem-resultados">Nenhuma pessoa encontrada.<br><br>Modo: ${modo}</div>`;
            }
        }
    } catch (err) {
        areaResultados.innerHTML = '<div class="sem-resultados">Erro ao realizar consulta.</div>';
        console.error(err);
    }
}

function atualizarLatencia(el, ms, modo) {
    if (!el) return;
    el.style.display = 'block';
    document.getElementById('latencia-ms').textContent = `${ms}ms`;
    const labelModo = el.querySelector('span:last-child');
    if (labelModo) labelModo.textContent = modo === 'NUVEM' ? 'Servidor' : 'Cache Local';
}

function renderizarResultadoVeiculo(v) {
    const ehAlerta = v.situacao === 'ROUBADO' || v.situacao === 'FURTADO' || v.situacao === 'QUEIXADO';
    const classeBadge = v.situacao === 'REGULAR' ? 'status-ok' : 'status-roubado';
    return `
        <div class="card-resultado ${ehAlerta ? 'resultado-perigoso' : ''}">
            <div class="placa-resultado">${v.placa || '—'}</div>
            <div class="campo-resultado"><span class="chave-resultado">MODELO</span><span class="valor-resultado">${v.modelo || '—'}</span></div>
            <div class="campo-resultado"><span class="chave-resultado">COR</span><span class="valor-resultado">${v.cor || '—'}</span></div>
            ${v.ano_fabricacao ? `<div class="campo-resultado"><span class="chave-resultado">ANO</span><span class="valor-resultado">${v.ano_fabricacao}</span></div>` : ''}
            ${v.proprietario ? `<div class="campo-resultado"><span class="chave-resultado">PROPRIETÁRIO</span><span class="valor-resultado">${v.proprietario}</span></div>` : ''}
            ${v.numero_boletim ? `<div class="campo-resultado"><span class="chave-resultado">BOLETIM</span><span class="valor-resultado">${v.numero_boletim}</span></div>` : ''}
            <span class="badge-status ${classeBadge}">● ${v.situacao}</span>
        </div>
    `;
}

function renderizarResultadoPessoa(p) {
    const ehAlerta = p.situacao !== 'REGULAR';
    let classeBadge = 'status-ok';
    if (p.situacao === 'MANDADO_PRISAO') classeBadge = 'status-roubado';
    else if (p.situacao === 'FICHA_CRIMINAL') classeBadge = 'status-mandado';

    return `
        <div class="card-resultado ${ehAlerta ? 'resultado-perigoso' : ''}">
            <div class="placa-resultado" style="font-size:1.1rem; letter-spacing:1px;">${p.nome || '—'}</div>
            <div class="campo-resultado"><span class="chave-resultado">CPF</span><span class="valor-resultado">${p.cpf || '—'}</span></div>
            ${p.data_nascimento ? `<div class="campo-resultado"><span class="chave-resultado">NASC.</span><span class="valor-resultado">${formatarData(p.data_nascimento)}</span></div>` : ''}
            ${p.tipo_mandado ? `<div class="campo-resultado"><span class="chave-resultado">MANDADO</span><span class="valor-resultado">${p.tipo_mandado}</span></div>` : ''}
            ${p.observacao ? `<div class="campo-resultado"><span class="chave-resultado">OBS</span><span class="valor-resultado" style="font-size:0.8rem;">${p.observacao}</span></div>` : ''}
            <span class="badge-status ${classeBadge}">● ${p.situacao.replace('_', ' ')}</span>
        </div>
    `;
}

/* ════════════════════════════════════════════════════════════
   Tela de Histórico
   ════════════════════════════════════════════════════════════ */
function vincularTelaHistorico() {
    document
        .getElementById('btn-atualizar-historico')
        ?.addEventListener('click', atualizarHistoricoComFeedback);
}

async function atualizarHistoricoComFeedback() {
    const btn = document.getElementById('btn-atualizar-historico');
    if (!btn) return;

    try {
        btn.disabled = true;

        // aviso de início
        exibirAviso('⏳ Atualizando histórico...', 'info');

        await renderizarHistorico();

        exibirAviso('✓ Histórico atualizado com sucesso.', 'sucesso');

    } catch (erro) {
        console.error(erro);
        exibirAviso('❌ Erro ao atualizar histórico.', 'erro');

    } finally {
        btn.disabled = false;
    }
}

async function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;

    const ocorrencias = await window.ipiDB.obterTodasOcorrencias();
    if (ocorrencias.length === 0) {
        container.innerHTML = '<div class="estado-vazio">Nenhuma ocorrência registrada.</div>';
        return;
    }

    // Ordenar mais recente primeiro
    ocorrencias.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

    container.innerHTML = ocorrencias.map(oc => `
        <div class="item-historico ${oc.sincronizado ? 'sincronizado' : 'pendente'}">
            <div class="cabecalho-item-historico">
                <span class="tipo-historico">${oc.tipo}</span>
                <span class="data-historico">${formatarDataHora(oc.data_hora)}</span>
            </div>
            <div class="descricao-historico">${oc.descricao}</div>
            <div class="badges-historico">
                ${oc.sincronizado
        ? '<span class="badge-sincronizado-ok">✓ SINCRONIZADO</span>'
        : '<span class="badge-sincronizado-pendente">⏱ PENDENTE</span>'}
                <span class="badge-sincronizado-ok" style="color:var(--gray-muted)">${oc.modo || 'NUVEM'}</span>
            </div>
        </div>
    `).join('');
}

/* ════════════════════════════════════════════════════════════
   Tela de Configurações
   ════════════════════════════════════════════════════════════ */
function vincularTelaConfiguracoes() {
    document.getElementById('btn-salvar-configuracoes')?.addEventListener('click', salvarConfiguracoesPolicial);
    document.getElementById('btn-sincronizar-cache')?.addEventListener('click', async () => {
        try {
            exibirAviso('Sincronizando cache com a nuvem...', 'info');
            const res = await window.ipiDB.atualizarCacheNuvem();
            await atualizarEstatisticas();
            await atualizarEstatisticasCache();
            exibirAviso(`Cache atualizado! (${res.veiculos} veíc, ${res.pessoas} pess)`, 'sucesso');
        } catch (e) {
            exibirAviso('Erro ao sincronizar cache. Verifique a conexão.', 'erro');
        }
    });
    document.getElementById('btn-limpar-cache')?.addEventListener('click', () => {
        exibirModal(
            'LIMPAR CACHE',
            'Esta ação apaga TODAS as ocorrências, veículos e pessoas do cache local. Dados não sincronizados serão perdidos. Confirmar?',
            async () => {
                await window.ipiDB.limparTudo();
                await atualizarEstatisticas();
                await atualizarEstatisticasCache();
                exibirAviso('Cache limpo com sucesso.', 'aviso');
            }
        );
    });

    // Botões de teste de modo
    document.getElementById('teste-nuvem')?.addEventListener('click', () => {
        window.connMgr.forcarModo('NUVEM');
        exibirAviso('Simulando modo NUVEM.', 'sucesso');
    });
    document.getElementById('teste-contingencia')?.addEventListener('click', () => {
        window.connMgr.forcarModo('SMS');
        exibirAviso('Simulando modo CONTINGÊNCIA (SMS).', 'aviso');
    });
    document.getElementById('teste-apagao')?.addEventListener('click', () => {
        window.connMgr.forcarModo('APAGAO');
        exibirAviso('Simulando modo BLACKOUT.', 'erro');
    });
}

async function carregarConfiguracoesPolicial() {
    const nome = await window.ipiDB.obterConfiguracao('nome_policial');
    const matricula = await window.ipiDB.obterConfiguracao('matricula_policial');
    if (nome) { document.getElementById('cfg-nome-policial').value = nome; }
    if (matricula) { document.getElementById('cfg-matricula-policial').value = matricula; }
    definirTexto('nome-operador', nome || 'POLICIAL');
}

async function salvarConfiguracoesPolicial() {
    const nome = document.getElementById('cfg-nome-policial')?.value?.trim();
    const matricula = document.getElementById('cfg-matricula-policial')?.value?.trim();
    if (nome) await window.ipiDB.definirConfiguracao('nome_policial', nome);
    if (matricula) await window.ipiDB.definirConfiguracao('matricula_policial', matricula);
    definirTexto('nome-operador', nome || 'POLICIAL');
    exibirAviso('Configurações salvas.', 'sucesso');
}

async function atualizarEstatisticasCache() {
    const s = await window.ipiDB.obterEstatisticas();
    definirTexto('ec-ocorrencias', s.total);
    definirTexto('ec-veiculos', s.veiculos);
    definirTexto('ec-pessoas', s.pessoas);
}

/* ════════════════════════════════════════════════════════════
   EVENTOS GLOBAIS
   ════════════════════════════════════════════════════════════ */
function vincularEventosGlobais() {
    // Modal
    document.getElementById('cancelar-modal')?.addEventListener('click', fecharModal);
    document.getElementById('camada-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('camada-modal')) fecharModal();
    });
}

/* ════════════════════════════════════════════════════════════
   GPS
   ════════════════════════════════════════════════════════════ */
function capturarGPS() {
    // Verifica suporte
    if (!navigator.geolocation) {
        exibirAviso('❌ Seu dispositivo não suporta GPS.', 'erro');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);

            const latEl = document.getElementById('lat-rai');
            const lngEl = document.getElementById('lng-rai');

            if (latEl) latEl.value = lat;
            if (lngEl) lngEl.value = lng;

            // Atualiza indicador visual do GPS
            const rotuloGPS = document.getElementById('rotulo-gps');
            if (rotuloGPS) rotuloGPS.style.color = 'var(--green-neon)';

            exibirAviso('📍 Localização capturada com sucesso.', 'sucesso');
        },

        (err) => {
            console.warn('[GPS] Erro:', err.message);

            // Atualiza indicador visual para erro
            const rotuloGPS = document.getElementById('rotulo-gps');
            if (rotuloGPS) rotuloGPS.style.color = 'var(--red-alert)';

            if (err.code === 1) {
                exibirAviso('⚠ Localização desativada. Ative o GPS no dispositivo.', 'erro');
            } else if (err.code === 2) {
                exibirAviso('❌ Não foi possível obter a localização.', 'erro');
            } else if (err.code === 3) {
                exibirAviso('⏳ Tempo esgotado ao tentar obter GPS.', 'aviso');
            } else {
                exibirAviso('❌ Erro desconhecido ao capturar GPS.', 'erro');
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        }
    );
}

/* ════════════════════════════════════════════════════════════
   Relógio
   ════════════════════════════════════════════════════════════ */
function iniciarRelogio() {
    function tick() {
        const agora = new Date();
        const h = String(agora.getHours()).padStart(2, '0');
        const m = String(agora.getMinutes()).padStart(2, '0');
        definirTexto('exibicao-relogio', `${h}:${m}`);
    }
    tick();
    setInterval(tick, 10000);
}

/* ════════════════════════════════════════════════════════════
   Utilitários
   ════════════════════════════════════════════════════════════ */
function definirTexto(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function formatarData(isoData) {
    if (!isoData) return '—';
    const [y, m, d] = isoData.split('-');
    return `${d}/${m}/${y}`;
}

function formatarDataHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ─── Aviso (Toasts) ─── */
function exibirAviso(mensagem, tipo = 'info') {
    const container = document.getElementById('container-aviso');
    if (!container) return;

    const aviso = document.createElement('div');
    const mapaTipo = { 'info': 'info', 'sucesso': 'sucesso', 'aviso': 'aviso', 'erro': 'erro' };
    aviso.className = `toast toast-${mapaTipo[tipo] || 'info'}`;
    aviso.textContent = mensagem;
    container.appendChild(aviso);
    setTimeout(() => aviso.remove(), 3200);
}

/* ─── Modal ─── */
let _callbackModal = null;
function exibirModal(titulo, corpo, onConfirmar) {
    _callbackModal = onConfirmar;
    definirTexto('titulo-modal', titulo);
    document.getElementById('corpo-modal').textContent = corpo;
    document.getElementById('camada-modal').style.display = 'flex';
    document.getElementById('confirmar-modal').onclick = () => {
        fecharModal();
        if (_callbackModal) _callbackModal();
    };
}
function fecharModal() {
    document.getElementById('camada-modal').style.display = 'none';
    _callbackModal = null;
}

/* ════════════════════════════════════════════════════════════
   Início
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', iniciarApp);
