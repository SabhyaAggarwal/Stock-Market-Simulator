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
            this.updateDisplay();
        });
    }

    initializeChart() {
        // Simple chart implementation without external dependencies
        const canvas = document.getElementById('stockChart');
        this.chartCtx = canvas.getContext('2d');
        this.chartWidth = canvas.width = 800;
        this.chartHeight = canvas.height = 280;
        this.drawChart();
    }

    async startSimulation() {
        const stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
        
        // Initialize with realistic base prices
        const basePrices = {
            'AAPL': 175.00,
            'GOOGL': 2800.00,
            'MSFT': 420.00,
            'AMZN': 3400.00,
            'TSLA': 250.00
        };
        
        // Set initial prices
        stocks.forEach(stock => {
            this.stockPrices.set(stock, basePrices[stock]);
            this.priceHistory.set(stock, []);
        });
        
        // Try to get real prices first, then fallback to simulation
        await this.fetchRealPrices(stocks, basePrices);
        
        // Update prices every 10 seconds
        this.priceInterval = setInterval(() => this.updateStockPrices(stocks), 10000);
        this.updateDisplay();
    }

    async fetchRealPrices(stocks, basePrices) {
        try {
            // Try multiple APIs for real stock prices
            await this.tryFinnhubAPI(stocks);
        } catch (error) {
            console.log('Real API failed, using simulated prices:', error.message);
            // Initialize with base prices and start simulation
            stocks.forEach(stock => {
                this.stockPrices.set(stock, basePrices[stock]);
                this.addPriceToHistory(stock, basePrices[stock]);
            });
        }
    }

    async tryFinnhubAPI(stocks) {
        // Finnhub free API (requires no CORS proxy)
        const API_KEY = 'demo'; // Using demo key for testing
        
        for (const stock of stocks) {
            try {
                const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock}&token=${API_KEY}`);
                const data = await response.json();
                
                if (data.c && data.c > 0) {
                    this.stockPrices.set(stock, data.c);
                    this.addPriceToHistory(stock, data.c);
                }
            } catch (e) {
                console.log(`Failed to fetch ${stock} from Finnhub:`, e.message);
                throw e;
            }
        }
    }

    updateStockPrices(stocks) {
        // Simulate realistic stock price movements
        stocks.forEach(stock => {
            const currentPrice = this.stockPrices.get(stock);
            if (currentPrice) {
                // Random walk with slight upward bias (realistic stock behavior)
                const change = (Math.random() - 0.48) * currentPrice * 0.02; // ±2% max change
                const newPrice = Math.max(currentPrice + change, currentPrice * 0.1); // Prevent negative prices
                this.stockPrices.set(stock, newPrice);
                this.addPriceToHistory(stock, newPrice);
            }
        });
        
        this.updateChart();
        this.updateDisplay();
    }

    addPriceToHistory(stock, price) {
        if (!this.priceHistory.has(stock)) {
            this.priceHistory.set(stock, []);
        }
        const history = this.priceHistory.get(stock);
        history.push({ price: price, timestamp: Date.now() });
        if (history.length > 100) history.shift(); // Keep last 100 points
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
        this.drawChart();
    }

    drawChart() {
        if (!this.chartCtx) return;
        
        const priceData = this.priceHistory.get(this.currentStock) || [];
        if (priceData.length === 0) return;
        
        // Clear canvas
        this.chartCtx.clearRect(0, 0, this.chartWidth, this.chartHeight);
        
        // Set up chart area
        const padding = 40;
        const chartArea = {
            x: padding,
            y: padding,
            width: this.chartWidth - padding * 2,
            height: this.chartHeight - padding * 2
        };
        
        // Calculate min/max prices for scaling
        const prices = priceData.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        // Draw background
        this.chartCtx.fillStyle = '#f5f6fa';
        this.chartCtx.fillRect(0, 0, this.chartWidth, this.chartHeight);
        
        // Draw grid lines
        this.chartCtx.strokeStyle = '#e3e6ee';
        this.chartCtx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = chartArea.y + (chartArea.height * i / 5);
            this.chartCtx.beginPath();
            this.chartCtx.moveTo(chartArea.x, y);
            this.chartCtx.lineTo(chartArea.x + chartArea.width, y);
            this.chartCtx.stroke();
        }
        
        // Draw price line
        if (priceData.length > 1) {
            this.chartCtx.strokeStyle = '#1a237e';
            this.chartCtx.lineWidth = 2;
            this.chartCtx.beginPath();
            
            priceData.forEach((point, index) => {
                const x = chartArea.x + (chartArea.width * index / (priceData.length - 1));
                const y = chartArea.y + chartArea.height - ((point.price - minPrice) / priceRange * chartArea.height);
                
                if (index === 0) {
                    this.chartCtx.moveTo(x, y);
                } else {
                    this.chartCtx.lineTo(x, y);
                }
            });
            
            this.chartCtx.stroke();
        }
        
        // Draw price labels
        this.chartCtx.fillStyle = '#666';
        this.chartCtx.font = '12px Inter, Arial, sans-serif';
        this.chartCtx.textAlign = 'right';
        
        for (let i = 0; i <= 5; i++) {
            const price = minPrice + (priceRange * (5 - i) / 5);
            const y = chartArea.y + (chartArea.height * i / 5) + 4;
            this.chartCtx.fillText('$' + price.toFixed(2), chartArea.x - 5, y);
        }
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
        
        this.portfolioValue.textContent = '$' + totalPortfolioValue.toFixed(2);
        this.availableCash.textContent = '$' + this.cash.toFixed(2);
    }
}

window.addEventListener('load', () => {
    new StockMarketSimulator();
});
