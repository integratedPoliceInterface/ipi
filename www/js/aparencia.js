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
    document.querySelectorAll(".botao-teste-modo").forEach(b => b.classList.remove("ativo"));
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

// carregar tema salvo
const temaSalvo = localStorage.getItem("tema");

if (temaSalvo === "automatico") {
    aplicarAutomatico();
} else if (temaSalvo === "dispositivo") {
    aplicarDispositivo();
} else if (temaSalvo) {
    aplicarTema(temaSalvo);
}