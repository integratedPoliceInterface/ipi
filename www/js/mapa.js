let map;
let markerBusca;
let markerUsuario;
let rota;
let userLat, userLng;
let buscando = false;

const btnMapa = document.getElementById("nav-mapa");
const btnVoltarMapa = document.getElementById("voltar-mapa");
const inputBusca = document.getElementById("input-busca-mapa");
const btnBuscar = document.getElementById("btn-buscar-mapa");
const btnLimpar = document.getElementById("btn-limpar-mapa");

const iconePolicial = L.icon({
    iconUrl: './img/icone-policial.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

/* ───────── MAPA ───────── */
function iniciarMapa() {
    map = L.map('mapa-full').setView([-16.6869, -49.2648], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // GPS usuário
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;

                map.setView([userLat, userLng], 15);

                markerUsuario = L.marker([userLat, userLng], { icon: iconePolicial })
                    .addTo(map)
                    .bindPopup("📍 Você está aqui");
            },
            () => exibirAviso("GPS não permitido", "aviso")
        );
    }
}

/* ───────── ABRIR MAPA ───────── */
btnMapa?.addEventListener("click", () => {
    setTimeout(() => {
        if (!map) iniciarMapa();
        else map.invalidateSize();
    }, 300);
});

/* ───────── BUSCA LOCAL ───────── */
async function buscarLocal() {
    if (buscando) return;

    const query = inputBusca.value.trim();
    if (!query) return;

    buscando = true;
    exibirAviso("ℹ️ Buscando localização...", "info");

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
        );

        const data = await res.json();

        if (!data.length) {
            exibirAviso("❌ Local não encontrado", "erro");
            return;
        }

        const { lat, lon } = data[0];

        map.setView([lat, lon], 15);

        if (markerBusca) map.removeLayer(markerBusca);

        markerBusca = L.marker([lat, lon])
            .addTo(map)
            .bindPopup(query)
            .openPopup();

        inputBusca.blur();

        criarRota(parseFloat(lat), parseFloat(lon));

    } catch (err) {
        console.error(err);
        exibirAviso("⚠️ Erro ao buscar localização", "erro");
    } finally {
        buscando = false;
    }
}

/* ───────── ROTA ───────── */
async function criarRota(destLat, destLng) {
    if (!userLat || !userLng) return;

    try {
        const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`
        );

        const data = await res.json();

        if (!data.routes || !data.routes.length) {
            exibirAviso("❌ Não foi possível traçar a rota", "erro");
            return;
        }

        const coords = data.routes[0].geometry.coordinates;
        const latlngs = coords.map(c => [c[1], c[0]]);

        const distancia = data.routes[0].distance;
        const duracao = data.routes[0].duration;

        if (rota) map.removeLayer(rota);

        rota = L.polyline(latlngs, {
            color: "red",
            weight: 5,
            opacity: 0.9
        }).addTo(map);

        map.fitBounds(rota.getBounds());

        if (markerBusca) {
            markerBusca.bindPopup(`
                📍 Destino<br>
                🚓 ${formatarDistancia(distancia)}<br>
                ⚡ ${formatarTempo(duracao)}
            `).openPopup();
        }

        exibirAviso("📍 Rota traçada com sucesso", "sucesso");

    } catch (err) {
        console.error(err);
        exibirAviso("⚠️ Erro ao criar rota", "erro");
    }
}

/* ───────── LIMPAR MAPA ───────── */
function limparMapa() {
    if (rota) {
        map.removeLayer(rota);
        rota = null;
    }

    if (markerBusca) {
        map.removeLayer(markerBusca);
        markerBusca = null;
    }

    inputBusca.value = "";

    if (userLat && userLng) {
        map.setView([userLat, userLng], 15);
    }

    exibirAviso("🧹 Mapa limpo", "info");
}

/* ───────── VOLTAR PARA INÍCIO ───────── */
btnVoltarMapa?.addEventListener("click", () => {
    navegarPara("inicio");
});

/* ───────── EVENTOS ───────── */
btnBuscar?.addEventListener("click", buscarLocal);

inputBusca?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarLocal();
});

btnLimpar?.addEventListener("click", limparMapa);

/* ───────── UTILITÁRIOS ───────── */
function formatarDistancia(m) {
    return (m / 1000).toFixed(2) + " km";
}

function formatarTempo(s) {
    const min = Math.floor(s / 60);
    if (min < 60) return min + " min";

    const h = Math.floor(min / 60);
    const m = min % 60;

    return `${h}h ${m}min`;
}