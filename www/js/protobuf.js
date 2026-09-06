/**
 * IPI - Serialização Protocol Buffers
 * Implementa serialização binária dos dados usando o schema ipi.proto.
 * Conforme documentado na arquitetura: seção 21.2 e 17.2.
 */

var PROTO_PATH = './proto/ipi.proto';
var ProtoRoot = null;
var protoCarregado = false;

async function carregarProto() {
    if (protoCarregado) return true;

    if (typeof protobuf === 'undefined') {
        console.warn('[Protobuf] protobufjs não disponível. Usando JSON como fallback.');
        return false;
    }

    try {
        const response = await fetch(PROTO_PATH);
        const protoText = await response.text();
        ProtoRoot = protobuf.parse(protoText).root;
        protoCarregado = true;
        console.log('[Protobuf] Schema carregado com sucesso.');
        return true;
    } catch (e) {
        console.warn('[Protobuf] Erro ao carregar schema:', e);
        return false;
    }
}

function serializarRAI(ocorrencia) {
    if (!ProtoRoot) return null;

    try {
        const RAI = ProtoRoot.lookupType('ipi.RAI');
        const Localizacao = ProtoRoot.lookupType('ipi.Localizacao');

        const localizacao = Localizacao.create({
            latitude: ocorrencia.latitude || 0,
            longitude: ocorrencia.longitude || 0,
            referencia_endereco: ocorrencia.referencia_endereco || ''
        });

        const pessoas = (ocorrencia.pessoas || []).map(p => {
            const Pessoa = ProtoRoot.lookupType('ipi.Pessoa');
            return Pessoa.create({
                cpf: p.cpf || '',
                nome: p.nome || '',
                situacao: p.situacao || 'REGULAR',
                envolvimento: p.envolvimento || 'Suspeito',
                municipio: ocorrencia.municipio || ''
            });
        });

        const veiculos = (ocorrencia.veiculos || []).map(v => {
            const Veiculo = ProtoRoot.lookupType('ipi.Veiculo');
            return Veiculo.create({
                placa: v.placa || '',
                modelo: v.modelo || '',
                cor: v.cor || '',
                situacao: v.situacao || 'REGULAR',
                municipio: ocorrencia.municipio || ''
            });
        });

        const mensagem = RAI.create({
            id: ocorrencia.id || `RAI-${Date.now()}`,
            data_hora: ocorrencia.data_hora || new Date().toISOString(),
            matricula_operador: ocorrencia.matricula_operador || '',
            tipo: ocorrencia.tipo || '',
            descricao: ocorrencia.descricao || '',
            localizacao,
            pessoas,
            veiculos,
            sincronizado: !!ocorrencia.sincronizado,
            municipio: ocorrencia.municipio || ''
        });

        const buffer = RAI.encode(mensagem).finish();
        const jsonStr = JSON.stringify(ocorrencia);
        const tamanhoOriginal = new TextEncoder().encode(jsonStr).length;

        return {
            buffer,
            base64: btoa(String.fromCharCode(...new Uint8Array(buffer))),
            tamanhoOriginal,
            tamanhoCompactado: buffer.length,
            economia: ((1 - buffer.length / tamanhoOriginal) * 100).toFixed(1)
        };
    } catch (e) {
        console.error('[Protobuf] Erro ao serializar RAI:', e);
        return null;
    }
}

function serializarConsulta(tipo, parametros) {
    if (!ProtoRoot) return null;

    try {
        const Consulta = ProtoRoot.lookupType('ipi.Consulta');
        const mensagem = Consulta.create({
            id: `CONS-${Date.now()}`,
            tipo_consulta: tipo,
            parametros
        });
        const buffer = Consulta.encode(mensagem).finish();
        return {
            buffer,
            base64: btoa(String.fromCharCode(...new Uint8Array(buffer)))
        };
    } catch (e) {
        console.error('[Protobuf] Erro ao serializar consulta:', e);
        return null;
    }
}

function serializarRAIEnriquecido(ocorrencia) {
    const resultado = serializarRAI(ocorrencia);

    if (resultado) {
        console.log(
            `[Protobuf] RAI ${ocorrencia.id}: ${resultado.tamanhoOriginal}B → ${resultado.tamanhoCompactado}B ` +
            `(economia de ${resultado.economia}%)`
        );
    }

    return resultado ? resultado.base64 : null;
}

window.servicoProtobuf = {
    carregarProto,
    serializarRAI,
    serializarConsulta,
    serializarRAIEnriquecido,
    estaCarregado: () => protoCarregado
};
