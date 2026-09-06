const btnDiurno = document.getElementById("modo-diurno");
const btnNoturno = document.getElementById("modo-noturno");
const btnAuto = document.getElementById("modo-automatico");
const btnDispositivo = document.getElementById("modo-dispositivo");

function aplicarTema(tema) {
    document.body.classList.remove("tema-diurno");

    if (tema === "diurno") {
        document.body.classList.add("tema-diurno");
    }

    localStorage.setItem("tema", tema);
}

function setAtivo(botao) {
    // Escopa apenas aos botões de aparência para não limpar estado dos botões de modo de operação
    const container = botao.closest('.switch-modo-teste') || document;
    container.querySelectorAll(".botao-teste-modo").forEach(b => b.classList.remove("ativo"));
    botao.classList.add("ativo");
}

// automático
function aplicarAutomatico() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 18) {
        aplicarTema("diurno");
    } else {
        aplicarTema("noturno");
    }
}

// dispositivo
function aplicarDispositivo() {
    const escuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    aplicarTema(escuro ? "noturno" : "diurno");
}

// eventos
btnDiurno.onclick = () => {
    aplicarTema("diurno");
    setAtivo(btnDiurno);
};

btnNoturno.onclick = () => {
    aplicarTema("noturno");
    setAtivo(btnNoturno);
};

btnAuto.onclick = () => {
    aplicarAutomatico();
    setAtivo(btnAuto);
};

btnDispositivo.onclick = () => {
    aplicarDispositivo();
    setAtivo(btnDispositivo);
};

// carregar tema salvo + ativa botão correspondente
const temaSalvo = localStorage.getItem("tema");

if (temaSalvo === "automatico") {
    aplicarAutomatico();
    if (btnAuto) btnAuto.classList.add('ativo');
} else if (temaSalvo === "dispositivo") {
    aplicarDispositivo();
    if (btnDispositivo) btnDispositivo.classList.add('ativo');
} else if (temaSalvo === "diurno") {
    aplicarTema(temaSalvo);
    if (btnDiurno) btnDiurno.classList.add('ativo');
} else if (temaSalvo === "noturno") {
    aplicarTema(temaSalvo);
    if (btnNoturno) btnNoturno.classList.add('ativo');
}
// Reage a mudança do sistema quando em modo dispositivo
try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (localStorage.getItem('tema') === 'dispositivo') aplicarDispositivo();
    });
} catch {}