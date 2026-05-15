let map;
let camadaRaster;
let camadaVetor;
let markerBusca;
let markerUsuario;
let rota;
let userLat, userLng;
let buscando = false;
let fonteOfflineURL = null;

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

function normalizar(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function obterFonteMapa() {
    const offline = await window.ipiDB.obterMapaOffline();
    if (offline && offline.dados && offline.dados.byteLength > 0) {
        if (!fonteOfflineURL) {
            const blob = new Blob([offline.dados]);
            fonteOfflineURL = URL.createObjectURL(blob);
        }
        return fonteOfflineURL;
    }
    return null;
}

async function adicionarCamadaMapa() {
    if (camadaRaster) { map.removeLayer(camadaRaster); camadaRaster = null; }
    if (camadaVetor) { map.removeLayer(camadaVetor); camadaVetor = null; }

    const modo = window.connMgr.obterModo();
    const temOffline = await window.ipiDB.temMapaOffline();

    if (modo === 'APAGAO' || !navigator.onLine) {
        if (temOffline) {
            const url = await obterFonteMapa();
            if (url && typeof window.pmtiles?.PMTiles !== 'undefined') {
                const fonte = new window.pmtiles.PMTiles(url);
                camadaVetor = protomapsL.leafletLayer({ url: fonte, flavor: 'dark' }).addTo(map);
            }
        }
    } else {
        camadaRaster = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }
}

function iniciarMapa() {
    if (map) {
        map.invalidateSize();
        return;
    }
    map = L.map('mapa-full', { zoomControl: true }).setView([-16.6869, -49.2648], 13);
    adicionarCamadaMapa().then(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                    map.setView([userLat, userLng], 15);
                    if (markerUsuario) map.removeLayer(markerUsuario);
                    markerUsuario = L.marker([userLat, userLng], { icon: iconePolicial })
                        .addTo(map)
                        .bindPopup("Você está aqui");
                },
                () => exibirAviso("GPS não permitido", "aviso")
            );
        }
    });
}

btnMapa?.addEventListener("click", () => {
    setTimeout(() => {
        if (!map) iniciarMapa();
        else { map.invalidateSize(); adicionarCamadaMapa(); }
    }, 300);
});

window.connMgr?.addEventListener('mudancamodo', async () => {
    if (map) adicionarCamadaMapa();
});

function buscarMunicipioOffline(query) {
    const q = normalizar(query);
    let melhor = null;
    let melhorScore = 0;
    for (const [lat, lng, nome] of GOIAS_MUNICIPIOS) {
        const n = normalizar(nome);
        let score = 0;
        if (n === q) score = 100;
        else if (n.startsWith(q)) score = 80;
        else if (n.includes(q)) score = 50;
        else if (q.includes(n)) score = 30;
        if (score > melhorScore) {
            melhorScore = score;
            melhor = { lat, lng, nome };
        }
    }
    return melhorScore > 0 ? melhor : null;
}

async function buscarLocal() {
    if (buscando) return;
    const query = inputBusca.value.trim();
    if (!query) return;
    buscando = true;
    exibirAviso("Buscando localização...", "info");
    try {
        const modo = window.connMgr.obterModo();
        let lat, lng, nomeLocal;
        if (modo === 'APAGAO' || !navigator.onLine) {
            const r = buscarMunicipioOffline(query);
            if (r) { lat = r.lat; lng = r.lng; nomeLocal = r.nome; }
            else { exibirAviso("Local não encontrado (offline)", "erro"); return; }
        } else {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=5`,
                { signal: AbortSignal.timeout(5000) }
            );
            const data = await res.json();
            if (!data.length) {
                const r = buscarMunicipioOffline(query);
                if (r) { lat = r.lat; lng = r.lng; nomeLocal = r.nome; }
                else { exibirAviso("Local não encontrado", "erro"); return; }
            } else {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
                nomeLocal = data[0].display_name.split(',')[0];
            }
        }
        map.setView([lat, lng], 15);
        if (markerBusca) map.removeLayer(markerBusca);
        markerBusca = L.marker([lat, lng]).addTo(map).bindPopup(nomeLocal || query).openPopup();
        inputBusca.blur();
        criarRota(lat, lng);
    } catch (err) {
        const r = buscarMunicipioOffline(query);
        if (r) {
            map.setView([r.lat, r.lng], 15);
            if (markerBusca) map.removeLayer(markerBusca);
            markerBusca = L.marker([r.lat, r.lng]).addTo(map).bindPopup(r.nome).openPopup();
            criarRota(r.lat, r.lng);
        } else {
            exibirAviso("Erro ao buscar localização", "erro");
        }
    } finally {
        buscando = false;
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function criarRota(destLat, destLng) {
    if (!userLat || !userLng) return;
    if (window.connMgr.estaEmNuvem() && navigator.onLine) {
        try {
            const res = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`,
                { signal: AbortSignal.timeout(5000) }
            );
            const data = await res.json();
            if (data.routes && data.routes.length) {
                const coords = data.routes[0].geometry.coordinates;
                const latlngs = coords.map(c => [c[1], c[0]]);
                const distancia = data.routes[0].distance;
                const duracao = data.routes[0].duration;
                if (rota) map.removeLayer(rota);
                rota = L.polyline(latlngs, { color: "red", weight: 5, opacity: 0.9 }).addTo(map);
                map.fitBounds(rota.getBounds());
                if (markerBusca) {
                    markerBusca.bindPopup(
                        `Destino<br>${formatarDistancia(distancia)}<br>${formatarTempo(duracao)}`
                    ).openPopup();
                }
                exibirAviso("Rota traçada com sucesso", "sucesso");
                return;
            }
        } catch { console.warn("OSRM offline, usando rota aproximada"); }
    }
    const dist = calcularDistancia(userLat, userLng, destLat, destLng);
    if (rota) map.removeLayer(rota);
    rota = L.polyline([[userLat, userLng], [destLat, destLng]], {
        color: "red", weight: 3, opacity: 0.7, dashArray: "10, 10"
    }).addTo(map);
    map.fitBounds(rota.getBounds().pad(0.1));
    if (markerBusca) {
        markerBusca.bindPopup(`Destino (rota aproximada)<br>${dist.toFixed(2)} km`).openPopup();
    }
    exibirAviso("Rota aproximada (offline)", "info");
}

function limparMapa() {
    if (rota) { map.removeLayer(rota); rota = null; }
    if (markerBusca) { map.removeLayer(markerBusca); markerBusca = null; }
    inputBusca.value = "";
    if (userLat && userLng) map.setView([userLat, userLng], 15);
    exibirAviso("Mapa limpo", "info");
}

btnVoltarMapa?.addEventListener("click", () => navegarPara("inicio"));
btnBuscar?.addEventListener("click", buscarLocal);
inputBusca?.addEventListener("keydown", (e) => { if (e.key === "Enter") buscarLocal(); });
btnLimpar?.addEventListener("click", limparMapa);

function formatarDistancia(m) { return (m / 1000).toFixed(2) + " km"; }
function formatarTempo(s) {
    const min = Math.floor(s / 60);
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}min`;
}
