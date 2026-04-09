# 📊 TMAnalyzer - Digisac Analytics Dashboard

Um painel gerencial interativo e de alto nível para análise de Tempo
Médio de Atendimento (TMA) extraído do sistema Digisac. Projetado para
rodar 100% no lado do cliente (navegador), garantindo agilidade e
segurança na manipulação de dados sensíveis (LGPD).


------------------------------------------------------------------------

## 🚀 Funcionalidades

-   **Processamento Local (Client-side):** Lê e processa o arquivo CSV
    diretamente no navegador.
-   **KPIs em Tempo Real:** TMA geral, total de atendimentos, maior
    tempo e saúde do SLA.
-   **Gráficos Dinâmicos:** Ranking de atendentes e distribuição de
    severidade.
-   **Filtros Avançados:** Filtro por atendente e controle de top
    atendimentos.
-   **Identificação Automática de Datas:** Detecta período
    automaticamente.

------------------------------------------------------------------------

## 🛠️ Tecnologias Utilizadas

-   HTML5 / JavaScript 
-   Tailwind CSS 
-   Chart.js
-   FontAwesome

------------------------------------------------------------------------

## 📖 Como usar

### 1. Abrir o painel

``` bash
git clone https://github.com/SEU_USUARIO/tmanalyzer.git
```

Abra o arquivo `index.html` no navegador.

------------------------------------------------------------------------

### 2. Importar dados

1.  Exporte o CSV 
2.  Clique em **Carregar dados (.csv)**
3.  Selecione o arquivo
4.  Dashboard será preenchido automaticamente

------------------------------------------------------------------------

## ⚠️ Estrutura do CSV

-   Separador: `;`
-   Colunas obrigatórias:


    Nome
    Atendente
    Departamento
    Data de início
    Data de encerramento
    Resumo do chamado
    Tempo total de atendimento

------------------------------------------------------------------------

## 📌 Regras do sistema

-   Considera apenas atendimentos do departamento **Suporte**
-   Ignora chamados que passam de um dia para outro

------------------------------------------------------------------------

## 📄 Exemplo de CSV

    Protocolo;Nome;Número;Atendente;Departamento;Data de início;Data de encerramento;Resumo do chamado;Tempo total de atendimento
    2026040979700;Cliente A;123;João;Suporte;09/04/2026 08:28:03;09/04/2026 09:28:38;Dúvida;01:00:35
    2026040979701;Cliente B;456;Maria;Suporte;09/04/2026 08:48:40;09/04/2026 10:20:33;Erro;01:31:52
    2026040979702;Cliente C;789;Vyttor;Comercial;09/04/2026 08:21:09;09/04/2026 09:40:00;Venda;00:20:15

*(A terceira linha será ignorada por não ser do departamento Suporte)*

------------------------------------------------------------------------

## 📊 Métricas

-   ⏱️ TMA
-   📈 Volume de atendimentos
-   🚨 Casos críticos
-   🧑‍💼 Ranking de atendentes

------------------------------------------------------------------------

## 💡 Melhorias futuras

-   Dashboard online
-   Integração com API
-   Alertas automáticos
-   Histórico de análises

------------------------------------------------------------------------

## 👨‍💻 Autor

Vyttor Camillo

------------------------------------------------------------------------

## 📄 Licença

Uso livre para estudos e melhorias.
