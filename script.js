// Core Stock Market Simulator (real prices, persistent, $10,000 start)
class StockMarketSimulator {
    constructor() {
        const savedData = this.loadSavedData();
        this.portfolio = new Map(savedData.portfolio);
        this.cash = savedData.cash;
        this.stockPrices = new Map();
        this.chart = null;
        this.priceHistory = new Map();
        this.currentStock = 'AAPL';
        this.currentTimeframe = '1D';

        this.initializeElements();
        this.initializeEventListeners();
        this.initializeChart();
        this.startSimulation();
    }

    loadSavedData() {
        const savedData = localStorage.getItem('stockMarketData');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            return {
                cash: typeof parsed.cash === 'number' ? parsed.cash : 10000,
                portfolio: parsed.portfolio ? JSON.parse(parsed.portfolio) : []
            };
        }
        return {
            cash: 10000,
            portfolio: []
        };
    }

    saveData() {
        const dataToSave = {
            cash: this.cash,
            portfolio: JSON.stringify([...this.portfolio])
        };
        localStorage.setItem('stockMarketData', JSON.stringify(dataToSave));
    }

    initializeElements() {
        this.portfolioValue = document.getElementById('portfolioValue');
        this.availableCash = document.getElementById('availableCash');
        this.currentPrice = document.getElementById('currentPrice');
        this.stockSelect = document.getElementById('stockSelect');
        this.sharesInput = document.getElementById('shares');
        this.buyBtn = document.getElementById('buyBtn');
        this.sellBtn = document.getElementById('sellBtn');
        this.portfolioList = document.getElementById('portfolioList');
    }

    initializeEventListeners() {
        this.buyBtn.addEventListener('click', () => this.executeTrade('buy'));
        this.sellBtn.addEventListener('click', () => this.executeTrade('sell'));
        this.stockSelect.addEventListener('change', (e) => {
            this.currentStock = e.target.value;
            this.updateChart();
        });
    }

    initializeChart() {
        const ctx = document.getElementById('stockChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#1a237e',
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: { y: { beginAtZero: false } }
            }
        });
    }

    async startSimulation() {
        const stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
        await this.syncAllPrices(stocks);
        this.priceInterval = setInterval(() => this.syncAllPrices(stocks), 10000);
        this.updateDisplay();
    }

    // Use Yahoo Finance free endpoint as a Google Finance alternative
    async syncAllPrices(stocks) {
        const apiUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stocks.join(',')}`;
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            stocks.forEach(stock => {
                const quote = data.quoteResponse.result.find(q => q.symbol === stock);
                if (quote && quote.regularMarketPrice) {
                    this.stockPrices.set(stock, quote.regularMarketPrice);
                    if (!this.priceHistory.has(stock)) {
                        this.priceHistory.set(stock, []);
                    }
                    const history = this.priceHistory.get(stock);
                    history.push({ price: quote.regularMarketPrice, timestamp: Date.now() });
                    if (history.length > 1000) history.shift();
                }
            });
            this.updateChart();
            this.updateDisplay();
        } catch (e) {
            console.error('Error fetching stock data:', e);
        }
    }

    executeTrade(type) {
        const shares = parseInt(this.sharesInput.value);
        if (isNaN(shares) || shares <= 0) {
            alert('Please enter a valid number of shares');
            return;
        }
        const price = this.stockPrices.get(this.currentStock);
        if (!price) {
            alert('No price data available');
            return;
        }
        const total = shares * price;
        if (type === 'buy') {
            if (total > this.cash) {
                alert('Not enough cash');
                return;
            }
            this.cash -= total;
            const currentShares = this.portfolio.get(this.currentStock) || 0;
            this.portfolio.set(this.currentStock, currentShares + shares);
        } else {
            const currentShares = this.portfolio.get(this.currentStock) || 0;
            if (shares > currentShares) {
                alert('Not enough shares');
                return;
            }
            this.cash += total;
            this.portfolio.set(this.currentStock, currentShares - shares);
        }
        this.sharesInput.value = '';
        this.updateDisplay();
        this.saveData();
    }

    updateChart() {
        if (!this.chart) return;
        const priceData = this.priceHistory.get(this.currentStock) || [];
        this.chart.data.labels = priceData.map(d => new Date(d.timestamp).toLocaleTimeString());
        this.chart.data.datasets[0].data = priceData.map(d => d.price);
        this.chart.update('none');
    }

    updateDisplay() {
        const currentStockPrice = this.stockPrices.get(this.currentStock) || 0;
        this.currentPrice.textContent = currentStockPrice.toFixed(2);
        let totalPortfolioValue = this.cash;
        this.portfolioList.innerHTML = '';
        this.portfolio.forEach((shares, stock) => {
            if (shares > 0) {
                const price = this.stockPrices.get(stock) || 0;
                const value = shares * price;
                totalPortfolioValue += value;
                const stockDiv = document.createElement('div');
                stockDiv.innerHTML = `${stock}: ${shares} shares @ $${price.toFixed(2)} = $${value.toFixed(2)}`;
                this.portfolioList.appendChild(stockDiv);
            }
        });
        this.portfolioValue.textContent = totalPortfolioValue.toFixed(2);
        this.availableCash.textContent = this.cash.toFixed(2);
    }
}

window.addEventListener('load', () => {
    new StockMarketSimulator();
});
