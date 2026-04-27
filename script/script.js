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

// verifica se a documentação é válida baseada no padrão estabelecido
function docValida(texto) {
    if (!texto || texto === "Sem resumo detalhado") return false;
    const textoLimpo = texto.replace(/\s+/g, ' ').trim();
    const regexPadrao = /cliente.*da empresa.*entrou em contato.*após verificação, foi identificado que.*informei ao cliente/i;
    return regexPadrao.test(textoLimpo);
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

function carregarCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const linhas = parseCSV(e.target.result);
        dadosGlobais = []; 
        let datasEncontradas = new Set(); 

        if (linhas.length < 2) return alert("O arquivo parece estar vazio.");

        const header = linhas[0];
        const idx = {
            tempo: header.indexOf("Tempo total de atendimento"), cliente: header.indexOf("Nome"),
            atendente: header.indexOf("Atendente"), resumo: header.indexOf("Resumo do chamado"),
            depto: header.indexOf("Departamento"), inicio: header.indexOf("Data de início"), fim: header.indexOf("Data de encerramento")
        };

        for (let i = 1; i < linhas.length; i++) {
            const col = linhas[i]; 
            if (col.length <= idx.tempo) continue;

            // Extração de datas para montar o período
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

            const minutosTotais = convMinutos(tempoStr);

            // REGRA ATUALIZADA: Ignora chamados com menos de 1 minuto (59s ou menos) ou mais de 8 horas
            if (minutosTotais < 1 || minutosTotais > 480) continue;

            dadosGlobais.push({
                minutos: minutosTotais,
                cliente: col[idx.cliente]?.trim() || "Não identificado",
                atendente: col[idx.atendente]?.trim().replace(" (Suporte)", "") || "Não atribuído",
                resumo: col[idx.resumo]?.trim() || "Sem resumo detalhado"
            });
        }

        // Lógica de formatação de período
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

        // Atualiza cabeçalho principal
        document.getElementById('dataRelatorioStatus').innerHTML = `<i class="fa-regular fa-calendar text-primary mr-1"></i> Dados referentes a: <strong class="text-slate-800">${textoPeriodo}</strong>`;
        
        // Atualiza cabeçalho da exportação do Ranking
        const pRanking = document.getElementById('periodoRanking');
        if(pRanking) pRanking.innerHTML = `<i class="fa-regular fa-calendar mr-1"></i> Referência: ${textoPeriodo}`;

        const nomesAtendentes = [...new Set(dadosGlobais.map(d => d.atendente))].sort();
        ['filtroAtendente', 'filtroAtendenteDoc'].forEach(id => {
            const select = document.getElementById(id);
            select.innerHTML = '<option value="Todos">Todos da Equipe</option>';
            nomesAtendentes.forEach(nome => select.appendChild(new Option(nome, nome)));
        });

        document.getElementById('navMenu').classList.remove('hidden');
        mudarAba('dashboard');
        aplicarFiltros();
    };
    reader.readAsText(file);
}

function aplicarFiltros() {
    const atendente = document.getElementById('filtroAtendente').value;
    const qtd = document.getElementById('filtroQuantidade').value;
    let base = dadosGlobais;
    if (atendente !== "Todos") base = base.filter(d => d.atendente === atendente);
    if (base.length === 0) return;

    base.sort((a, b) => b.minutos - a.minutos); 
    document.getElementById('kpiTma').innerText = formTempo(base.reduce((acc, curr) => acc + curr.minutos, 0) / base.length);
    document.getElementById('kpiTotal').innerText = base.length;
    document.getElementById('kpiPior').innerText = formTempo(base[0].minutos);
    const naoCriticos = base.filter(d => d.minutos <= REGRAS.ATENCAO).length;
    document.getElementById('kpiSla').innerText = `${Math.round((naoCriticos / base.length) * 100)}%`;

    const limite = qtd === "todos" ? base.length : parseInt(qtd);
    const lista = base.slice(0, limite);
    const container = document.getElementById('listaChamados');
    container.innerHTML = '';

    lista.forEach((item, index) => {
        const info = classificar(item.minutos);
        container.innerHTML += `
            <div class="flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-xl ${info.classe} bg-opacity-40">
                <div class="flex items-start gap-4">
                    <div class="bg-white p-3 rounded-full shadow-sm"><i class="fa-solid ${info.icone} text-xl"></i></div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-lg">#${index + 1} &bull; ${formTempo(item.minutos)}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-60 border font-semibold uppercase tracking-wide">${info.label}</span>
                        </div>
                        <div class="text-sm font-medium"><i class="fa-regular fa-user mr-1 opacity-70"></i> ${item.cliente} &nbsp;|&nbsp; <i class="fa-solid fa-headset mr-1 opacity-70"></i> ${item.atendente}</div>
                        <div class="text-sm mt-1 opacity-80 italic">"${item.resumo}"</div>
                    </div>
                </div>
            </div>`;
    });

    document.getElementById('areaGraficos').style.display = (atendente === "Todos") ? "grid" : "none";
    if(atendente === "Todos") desenharGraficos();
}

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
            datasets: [{ label: 'TMA (Minutos)', data: dadosBarra.map(d => d.media), backgroundColor: '#4f46e5', borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const contagem = { normal: 0, atencao: 0, critico: 0 };
    dadosGlobais.forEach(d => contagem[classificar(d.minutos).id]++);
    if(chartSeveridadeInstancia) chartSeveridadeInstancia.destroy();
    chartSeveridadeInstancia = new Chart(document.getElementById('chartSeveridade').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Normal', 'Atenção', 'Crítico'],
            datasets: [{ data: [contagem.normal, contagem.atencao, contagem.critico], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}

function mudarAba(abaDestino) {
    ['dashboard', 'documentacao', 'ranking'].forEach(aba => {
        document.getElementById(aba + 'Area').classList.add('hidden');
        const btn = document.getElementById('btnAba' + aba.charAt(0).toUpperCase() + aba.slice(1));
        btn.className = "px-4 py-2 rounded-md text-slate-500 hover:text-slate-700 font-medium transition-all";
    });
    document.getElementById(abaDestino + 'Area').classList.remove('hidden');
    const btnAtivo = document.getElementById('btnAba' + abaDestino.charAt(0).toUpperCase() + abaDestino.slice(1));
    btnAtivo.className = "px-4 py-2 rounded-md bg-white shadow-sm font-bold transition-all " + (abaDestino === 'dashboard' ? 'text-primary' : (abaDestino === 'documentacao' ? 'text-emerald-600' : 'text-yellow-600'));
    
    if (abaDestino === 'documentacao') calcularEExibirDocs();
    if (abaDestino === 'ranking') calcularEExibirRanking();
}

function calcularEExibirDocs() {
    const filtro = document.getElementById('filtroAtendenteDoc').value;
    let base = dadosGlobais;
    if (filtro !== "Todos") base = base.filter(d => d.atendente === filtro);

    let docsOk = 0, docsNok = 0;
    const container = document.getElementById('listaDocsAudit');
    container.innerHTML = '';

    base.forEach(item => {
        const valido = docValida(item.resumo);
        valido ? docsOk++ : docsNok++;

        container.innerHTML += `
            <div class="flex items-start gap-4 p-4 border rounded-xl ${valido ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}">
                <div class="bg-white p-3 rounded-full shadow-sm ${valido ? 'text-emerald-500' : 'text-red-500'}">
                    <i class="fa-solid ${valido ? 'fa-check' : 'fa-triangle-exclamation'} text-xl"></i>
                </div>
                <div class="w-full">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-800">${item.atendente}</span>
                        <span class="text-xs px-2 py-0.5 rounded border ${valido ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} font-semibold uppercase">${valido ? 'Válido' : 'Pendente'}</span>
                    </div>
                    <div class="text-sm font-medium opacity-70">Cliente: ${item.cliente} &nbsp;|&nbsp; TMA: ${formTempo(item.minutos)}</div>
                    <div class="text-sm mt-2 p-2 bg-white rounded border ${valido ? 'border-emerald-100 text-slate-700' : 'border-red-100 text-red-800'} italic">"${item.resumo}"</div>
                </div>
            </div>`;
    });

    document.getElementById('kpiDocTotal').innerText = base.length;
    document.getElementById('kpiDocOk').innerText = docsOk;
    document.getElementById('kpiDocNok').innerText = docsNok;
}

function calcularEExibirRanking() {
    const pontuacoes = {};
    dadosGlobais.forEach(d => {
        if (d.atendente === "Não atribuído") return;
        if (!pontuacoes[d.atendente]) pontuacoes[d.atendente] = { pontosTempo: 0, pontosDoc: 0, qtd: 0, docOk: 0, min: 0 };
        if (docValida(d.resumo)) { pontuacoes[d.atendente].pontosDoc += 10; pontuacoes[d.atendente].docOk++; }
        pontuacoes[d.atendente].qtd++;
        pontuacoes[d.atendente].min += d.minutos;
        pontuacoes[d.atendente].pontosTempo += Math.max(0, 50 - Math.floor(d.minutos / 5));
    });

    const ranking = Object.keys(pontuacoes).map(nome => ({
        nome, total: Math.round(pontuacoes[nome].pontosTempo + pontuacoes[nome].pontosDoc), ...pontuacoes[nome]
    })).sort((a, b) => b.total - a.total);

    const container = document.getElementById('listaRanking');
    container.innerHTML = '';
    ranking.forEach((user, i) => {
        const top = i === 0 ? "bg-yellow-100 border-yellow-300" : (i === 1 ? "bg-gray-100" : (i === 2 ? "bg-orange-50" : "bg-slate-50"));
        container.innerHTML += `
            <div class="flex flex-col md:flex-row items-center justify-between p-5 border rounded-xl ${top}">
                <div class="flex items-center gap-6 w-full md:w-auto">
                    <div class="text-2xl font-black w-8">#${i + 1}</div>
                    <div>
                        <h3 class="text-xl font-bold">${user.nome}</h3>
                        <div class="text-sm opacity-80 mt-1 flex gap-3">
                            <span><i class="fa-solid fa-ticket"></i> ${user.qtd}</span>
                            <span><i class="fa-solid fa-file-signature"></i> ${user.docOk}/${user.qtd} Docs</span>
                            <span><i class="fa-solid fa-stopwatch"></i> TMA: ${formTempo(user.min/user.qtd)}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-4 md:mt-0 text-right w-full md:w-auto flex flex-row md:justify-end items-center md:items-end">
                    <div class="text-3xl font-black">${user.total.toLocaleString()} pts</div>
                    <div class="text-xs font-semibold opacity-70 uppercase tracking-wide ml-4 md:ml-0">
                        Agilidade: ${Math.round(user.pontosTempo)} | Doc: ${user.pontosDoc}
                    </div>
                </div>
            </div>`;
    });
}

function baixarRanking() {
    html2canvas(document.getElementById('areaPrintRanking'), { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'Ranking-TMAnalyzer.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput').addEventListener('change', carregarCSV);
    document.getElementById('filtroAtendente').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroQuantidade').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroAtendenteDoc').addEventListener('change', calcularEExibirDocs);
});