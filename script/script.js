let dadosGlobais = [];
let chartTMAInstancia = null;
let chartSeveridadeInstancia = null;

const REGRAS = { NORMAL: 15, ATENCAO: 40 };

// funções

function convMinutos(tempo) {
    if (!tempo) return 0;
    const [h, m, s] = tempo.split(':').map(Number);
    return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
}

function formTempo(minutos) {
    const totalSegundos = Math.floor(minutos * 60);
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function classificar(min) {
    if (min <= REGRAS.NORMAL) return {id: 'normal', classe: "bg-emerald-100 text-emerald-800 border-emerald-200", icone: "fa-check-circle text-emerald-500", label: "Normal"};
    if (min <= REGRAS.ATENCAO) return {id: 'atencao', classe: "bg-amber-100 text-amber-800 border-amber-200", icone: "fa-triangle-exclamation text-amber-500", label: "Atenção"};
    return {id: 'critico', classe: "bg-red-100 text-red-800 border-red-200", icone: "fa-fire text-red-500", label: "Crítico"};
}

// processa planilha

function carregarCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const linhas = e.target.result.split('\n');
        dadosGlobais = []; 
        let datasEncontradas = new Set(); 

        const header = linhas[0].split(';');
        const idx = {
            tempo: header.indexOf("Tempo total de atendimento"), cliente: header.indexOf("Nome"),
            atendente: header.indexOf("Atendente"), resumo: header.indexOf("Resumo do chamado"),
            depto: header.indexOf("Departamento"), inicio: header.indexOf("Data de início"), fim: header.indexOf("Data de encerramento")
        };

        if (idx.tempo === -1) return alert("Erro: Coluna de tempo não encontrada.");

        for (let i = 1; i < linhas.length; i++) {
            const col = linhas[i].split(';');
            if (col.length <= idx.tempo) continue;

            // filtro para pegar apenas o departamento "Suporte"
            if (idx.depto !== -1 && col[idx.depto]?.trim().toLowerCase() !== "suporte") continue;
            
            // pegar as datas
            if (idx.inicio !== -1 && idx.fim !== -1) {
                const inicio = col[idx.inicio]?.trim();
                const fim = col[idx.fim]?.trim();
                
                if (inicio && fim) {
                    const dataIn = inicio.split(' ')[0];
                    if (dataIn !== fim.split(' ')[0]) continue; // verifica se terminou no mesmo dia
                    
                    datasEncontradas.add(dataIn); 
                }
            }

            const tempoStr = col[idx.tempo]?.trim();
            if (!tempoStr || tempoStr === "00:00:00") continue;

            dadosGlobais.push({
                minutos: convMinutos(tempoStr),
                cliente: col[idx.cliente]?.trim() || "Não identificado",
                atendente: col[idx.atendente]?.trim().replace(" (Suporte)", "") || "Não atribuído",
                resumo: col[idx.resumo]?.trim() || "Sem resumo detalhado"
            });
        }

        if (dadosGlobais.length === 0) return alert("Nenhum atendimento de suporte concluído no mesmo dia foi encontrado.");

        let textoPeriodo = "Período não identificado";
        if (datasEncontradas.size > 0) {
            const datasObj = Array.from(datasEncontradas).map(d => {
                const partes = d.split('/');
                return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`); 
            });
            
            const dataMin = new Date(Math.min(...datasObj));
            const dataMax = new Date(Math.max(...datasObj));
            
            const formatarD = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            
            const strMin = formatarD(dataMin);
            const strMax = formatarD(dataMax);
            
            // se as datas forem iguais mostra um dia só ou mostra o range
            textoPeriodo = (strMin === strMax) ? strMin : `${strMin} até ${strMax}`;
        }

        document.getElementById('dataRelatorioStatus').innerHTML = `<i class="fa-regular fa-calendar text-primary"></i> Dados referentes a: <strong class="text-slate-800">${textoPeriodo}</strong>`;
        
        // select de atendentes
        const select = document.getElementById('filtroAtendente');
        select.innerHTML = '<option value="Todos">Todos da Equipe</option>';
        [...new Set(dadosGlobais.map(d => d.atendente))].sort().forEach(nome => {
            select.appendChild(new Option(nome, nome));
        });

        document.getElementById('dashboardArea').classList.remove('hidden');
        aplicarFiltros();
    };
    reader.readAsText(file);
}

// filtros

function aplicarFiltros() {
    const atendente = document.getElementById('filtroAtendente').value;
    const qtd = document.getElementById('filtroQuantidade').value;
    
    let base = dadosGlobais;
    if (atendente !== "Todos") base = base.filter(d => d.atendente === atendente);

    if (base.length === 0) return;

    base.sort((a, b) => b.minutos - a.minutos); 
    
    const somaTma = base.reduce((acc, curr) => acc + curr.minutos, 0);
    document.getElementById('kpiTma').innerText = formTempo(somaTma / base.length);
    document.getElementById('kpiTotal').innerText = base.length;
    document.getElementById('kpiPior').innerText = formTempo(base[0].minutos);

    const naoCriticos = base.filter(d => d.minutos <= REGRAS.ATENCAO).length;
    const slaPercent = Math.round((naoCriticos / base.length) * 100);
    document.getElementById('kpiSla').innerText = `${slaPercent}%`;

    const limite = qtd === "todos" ? base.length : parseInt(qtd);
    const lista = base.slice(0, limite);
    
    document.getElementById('tituloLista').innerHTML = `<i class="fa-solid fa-list-check mr-2 text-primary"></i> Exibindo ${lista.length} chamados mais demorados`;
    const container = document.getElementById('listaChamados');
    container.innerHTML = '';

    lista.forEach((item, index) => {
        const info = classificar(item.minutos);
        container.innerHTML += `
            <div class="flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-xl ${info.classe} bg-opacity-40">
                <div class="flex items-start gap-4">
                    <div class="bg-white p-3 rounded-full shadow-sm">
                        <i class="fa-solid ${info.icone} text-xl"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-lg text-slate-800">#${index + 1}</span>
                            <span class="font-bold text-lg text-slate-800">&bull; ${formTempo(item.minutos)}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-60 border font-semibold ml-2 uppercase tracking-wide">${info.label}</span>
                        </div>
                        <div class="text-sm font-medium"><i class="fa-regular fa-user mr-1 opacity-70"></i> ${item.cliente} &nbsp;|&nbsp; <i class="fa-solid fa-headset mr-1 opacity-70"></i> ${item.atendente}</div>
                        <div class="text-sm mt-1 opacity-80"><i class="fa-regular fa-comment-dots mr-1"></i> ${item.resumo}</div>
                    </div>
                </div>
            </div>
        `;
    });

    // gráficos
    document.getElementById('areaGraficos').style.display = (atendente === "Todos") ? "grid" : "none";
    if(atendente === "Todos") desenharGraficos();
}

// gráficos
function desenharGraficos() {
    const agg = {};
    dadosGlobais.forEach(d => {
        if (!agg[d.atendente]) agg[d.atendente] = { soma: 0, qtd: 0 };
        agg[d.atendente].soma += d.minutos;
        agg[d.atendente].qtd += 1;
    });

    const dadosBarra = Object.keys(agg).map(nome => ({
        nome, media: (agg[nome].soma / agg[nome].qtd).toFixed(2)
    })).sort((a, b) => b.media - a.media);

    if(chartTMAInstancia) chartTMAInstancia.destroy();
    chartTMAInstancia = new Chart(document.getElementById('chartTMA').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dadosBarra.map(d => d.nome),
            datasets: [{
                label: 'TMA (Minutos)',
                data: dadosBarra.map(d => d.media),
                backgroundColor: '#818cf8', borderRadius: 6, hoverBackgroundColor: '#4f46e5'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const contagem = { normal: 0, atencao: 0, critico: 0 };
    dadosGlobais.forEach(d => contagem[classificar(d.minutos).id]++);

    if(chartSeveridadeInstancia) chartSeveridadeInstancia.destroy();
    chartSeveridadeInstancia = new Chart(document.getElementById('chartSeveridade').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Normal (≤ 15m)', 'Atenção (≤ 40m)', 'Crítico (> 40m)'],
            datasets: [{
                data: [contagem.normal, contagem.atencao, contagem.critico],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput').addEventListener('change', carregarCSV);
    document.getElementById('filtroAtendente').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroQuantidade').addEventListener('change', aplicarFiltros);
});