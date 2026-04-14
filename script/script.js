let dadosGlobais = [];
let chartTMAInstancia = null;
let chartSeveridadeInstancia = null;

const REGRAS = { NORMAL: 15, ATENCAO: 40 };

// funções aux
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

// verifica se a documentação é válida, menor de 5 letras e diferente do padrão
function docValida(texto) {
    return texto && texto !== "Sem resumo detalhado" && texto.trim().length > 5;
}

function parseCSV(texto) {
    const arr = [];
    let quote = false;
    let row = 0, col = 0;
    
    for (let c = 0; c < texto.length; c++) {
        let cc = texto[c], nc = texto[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';

        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ';' && !quote) { ++col; continue; }
        if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; continue; }
        
        arr[row][col] += cc;
    }
    
    return arr.filter(r => r.join('').trim() !== '');
}

// processa planilha
function carregarCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const linhas = parseCSV(e.target.result);
        dadosGlobais = []; 
        let datasEncontradas = new Set(); 

        if (linhas.length < 2) return alert("O arquivo parece estar vazio ou não contém dados suficientes.");

        const header = linhas[0];
        const idx = {
            tempo: header.indexOf("Tempo total de atendimento"), cliente: header.indexOf("Nome"),
            atendente: header.indexOf("Atendente"), resumo: header.indexOf("Resumo do chamado"),
            depto: header.indexOf("Departamento"), inicio: header.indexOf("Data de início"), fim: header.indexOf("Data de encerramento")
        };

        if (idx.tempo === -1) return alert("Erro: Coluna de 'Tempo total de atendimento' não encontrada.");

        for (let i = 1; i < linhas.length; i++) {
            const col = linhas[i]; 
            
            if (col.length <= idx.tempo) continue;

            if (idx.inicio !== -1 && idx.fim !== -1) {
                const inicio = col[idx.inicio]?.trim();
                const fim = col[idx.fim]?.trim();
                
                if (inicio && fim) {
                    const dataIn = inicio.split(' ')[0];
                    if (dataIn !== fim.split(' ')[0]) continue; 
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

        if (dadosGlobais.length === 0) return alert("Nenhum atendimento válido encontrado.");

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
            textoPeriodo = (strMin === strMax) ? strMin : `${strMin} até ${strMax}`;
        }

        document.getElementById('dataRelatorioStatus').innerHTML = `<i class="fa-regular fa-calendar text-primary"></i> Dados referentes a: <strong class="text-slate-800">${textoPeriodo}</strong>`;
        
        // select de atendentes
        const select = document.getElementById('filtroAtendente');
        select.innerHTML = '<option value="Todos">Todos da Equipe</option>';
        [...new Set(dadosGlobais.map(d => d.atendente))].sort().forEach(nome => {
            select.appendChild(new Option(nome, nome));
        });

        document.getElementById('navMenu').classList.remove('hidden');
        mudarAba('dashboard');
        
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

//abas
function mudarAba(abaDestino) {
    ['dashboard', 'documentacao', 'ranking'].forEach(aba => {
        document.getElementById(aba + 'Area').classList.add('hidden');
        const btn = document.getElementById('btnAba' + aba.charAt(0).toUpperCase() + aba.slice(1));
        btn.className = "px-4 py-2 rounded-md text-slate-500 hover:text-slate-700 font-medium transition-all";
    });

    document.getElementById(abaDestino + 'Area').classList.remove('hidden');
    const btnAtivo = document.getElementById('btnAba' + abaDestino.charAt(0).toUpperCase() + abaDestino.slice(1));

    if (abaDestino === 'dashboard') {
        btnAtivo.className = "px-4 py-2 rounded-md bg-white shadow-sm text-primary font-bold transition-all";
    } else if (abaDestino === 'documentacao') {
        btnAtivo.className = "px-4 py-2 rounded-md bg-white shadow-sm text-emerald-600 font-bold transition-all";
        calcularEExibirDocs();
    } else if (abaDestino === 'ranking') {
        btnAtivo.className = "px-4 py-2 rounded-md bg-white shadow-sm text-yellow-600 font-bold transition-all";
        calcularEExibirRanking();
    }
}

function calcularEExibirDocs() {
    let docsOk = 0;
    let docsNok = 0;
    const listaNok = [];

    dadosGlobais.forEach(d => {
        if (d.atendente === "Não atribuído") return; // Ignora fantasmas

        if (docValida(d.resumo)) {
            docsOk++;
        } else {
            docsNok++;
            listaNok.push(d);
        }
    });

    document.getElementById('kpiDocTotal').innerText = docsOk + docsNok;
    document.getElementById('kpiDocOk').innerText = docsOk;
    document.getElementById('kpiDocNok').innerText = docsNok;

    const container = document.getElementById('listaDocsInvalidos');
    container.innerHTML = '';

    if (listaNok.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-4"><i class="fa-solid fa-party-horn text-2xl mb-2 block"></i> Parabéns! Todos os chamados possuem documentação válida.</div>`;
        return;
    }

    listaNok.sort((a, b) => b.minutos - a.minutos);

    listaNok.forEach((item) => {
        container.innerHTML += `
            <div class="flex items-start gap-4 p-4 border rounded-xl bg-red-50 border-red-100">
                <div class="bg-white p-3 rounded-full shadow-sm text-red-500">
                    <i class="fa-solid fa-triangle-exclamation text-xl"></i>
                </div>
                <div class="w-full">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-slate-800">${item.atendente}</span>
                        <span class="text-xs px-2 py-0.5 rounded border border-red-200 bg-white text-red-600 font-semibold uppercase tracking-wide">Pendente</span>
                    </div>
                    <div class="text-sm font-medium opacity-70"><i class="fa-regular fa-user mr-1"></i> Cliente: ${item.cliente} &nbsp;|&nbsp; <i class="fa-regular fa-clock mr-1"></i> TMA: ${formTempo(item.minutos)}</div>
                    <div class="text-sm mt-2 p-2 bg-white rounded border border-red-100 text-red-800 italic">"${item.resumo}"</div>
                </div>
            </div>
        `;
    });
}
// ranking
function calcularEExibirRanking() {
    const pontuacoes = {};

    dadosGlobais.forEach(d => {
        if (d.atendente === "Não atribuído") return;

        if (!pontuacoes[d.atendente]) {
            pontuacoes[d.atendente] = { pontosTempo: 0, pontosDoc: 0, total: 0, qtdChamados: 0, chamadosDoc: 0, minTotais: 0 };
        }

        if (docValida(d.resumo)) {
            pontuacoes[d.atendente].pontosDoc += 10;
            pontuacoes[d.atendente].chamadosDoc += 1;
        }

        pontuacoes[d.atendente].qtdChamados += 1;
        pontuacoes[d.atendente].minTotais += d.minutos;

        let ptsTempo = Math.max(0, 50 - d.minutos);
        pontuacoes[d.atendente].pontosTempo += ptsTempo;
    });

    const rankingArray = Object.keys(pontuacoes).map(nome => {
        const p = pontuacoes[nome];
        p.total = Math.round(p.pontosTempo + p.pontosDoc);
        p.tmaGlobal = formTempo(p.minTotais / p.qtdChamados);
        return { nome, ...p };
    });

    rankingArray.sort((a, b) => b.total - a.total);
    renderizarRanking(rankingArray);
}

function renderizarRanking(ranking) {
    const container = document.getElementById('listaRanking');
    container.innerHTML = '';

    ranking.forEach((user, index) => {
        let corPosicao = "bg-slate-100 text-slate-600";
        let icone = `<span class="text-2xl font-black">#${index + 1}</span>`;

        if (index === 0) {
            corPosicao = "bg-yellow-100 border-yellow-300 text-yellow-700 shadow-md transform scale-[1.02]";
            icone = `<i class="fa-solid fa-trophy text-3xl text-yellow-500"></i>`;
        } else if (index === 1) {
            corPosicao = "bg-gray-100 border-gray-300 text-gray-700 shadow-sm";
            icone = `<i class="fa-solid fa-medal text-3xl text-gray-400"></i>`;
        } else if (index === 2) {
            corPosicao = "bg-orange-50 border-orange-200 text-orange-800 shadow-sm";
            icone = `<i class="fa-solid fa-medal text-3xl text-orange-400"></i>`;
        }

        container.innerHTML += `
            <div class="flex flex-col md:flex-row items-center justify-between p-5 border rounded-xl transition-all ${corPosicao}">
                <div class="flex items-center gap-6 w-full md:w-auto">
                    <div class="w-12 flex justify-center">
                        ${icone}
                    </div>
                    <div>
                        <h3 class="text-xl font-bold">${user.nome}</h3>
                        <div class="text-sm opacity-80 mt-1 flex gap-3">
                            <span title="Total de Chamados"><i class="fa-solid fa-ticket mr-1"></i> ${user.qtdChamados}</span>
                            <span title="Chamados Documentados corretamente"><i class="fa-solid fa-file-signature mr-1"></i> ${user.chamadosDoc}/${user.qtdChamados} Docs</span>
                            <span title="Tempo Médio de Atendimento"><i class="fa-solid fa-stopwatch mr-1"></i> TMA: ${user.tmaGlobal}</span>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4 md:mt-0 text-right w-full md:w-auto flex flex-row md:flex-col justify-between md:justify-end items-center md:items-end">
                    <div class="text-3xl font-black">${user.total.toLocaleString()} pts</div>
                    <div class="text-xs font-semibold opacity-70 uppercase tracking-wide">
                        Agilidade: ${Math.round(user.pontosTempo)} | Doc: ${user.pontosDoc}
                    </div>
                </div>
            </div>
        `;
    });
}

function baixarRanking() {
    const areaPrint = document.getElementById('areaPrintRanking');
    
    html2canvas(areaPrint, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'Ranking-TMAnalyzer.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput').addEventListener('change', carregarCSV);
    document.getElementById('filtroAtendente').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroQuantidade').addEventListener('change', aplicarFiltros);
});