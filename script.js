// Stock Market Simulator Class
class StockMarketSimulator {
    constructor() {
        // Load saved data or initialize with default values
        const savedData = this.loadSavedData();
        this.portfolio = new Map(savedData.portfolio);
        this.cash = savedData.cash;
        this.stockPrices = new Map();
        this.chart = null;
        this.priceHistory = new Map();
        this.currentStock = 'AAPL';
        this.currentTimeframe = '1D';
        this.pendingOrders = new Map();
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeChart();
        this.initializeWebSocket();
        this.startSimulation();
    }

    loadSavedData() {
        const savedData = localStorage.getItem('stockMarketData');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            return {
                cash: parsed.cash,
                portfolio: parsed.portfolio ? JSON.parse(parsed.portfolio) : []
            };
        }
        return {
            cash: 100000,
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
        this.newsFeed = document.getElementById('newsFeed');
        this.timeframeButtons = document.querySelectorAll('.timeframe-btn');
        this.orderTypeSelect = document.getElementById('orderType');
        this.limitPriceInput = document.getElementById('limitPrice');
        this.stopPriceInput = document.getElementById('stopPrice');
        this.algoSelect = document.getElementById('algoSelect');
    }

    initializeEventListeners() {
        this.buyBtn.addEventListener('click', () => this.executeTrade('buy'));
        this.sellBtn.addEventListener('click', () => this.executeTrade('sell'));
        this.stockSelect.addEventListener('change', (e) => {
            this.currentStock = e.target.value;
            this.updateChart();
        });

        this.timeframeButtons.forEach(button => {
            button.addEventListener('click', () => this.changeTimeframe(button.dataset.period));
        });

        this.orderTypeSelect.addEventListener('change', () => this.toggleOrderInputs());
        
        this.algoSelect.addEventListener('change', () => this.toggleAlgoTrading());
    }

    initializeWebSocket() {
        // In a real application, you would connect to a real WebSocket server
        // For simulation, we'll create a mock WebSocket
        this.mockWebSocket = {
            send: (data) => {
                // Simulate server response
                setTimeout(() => {
                    const response = this.generateMockPriceData();
                    this.handleWebSocketMessage(response);
                }, 100);
            }
        };

        // Start sending price updates
        setInterval(() => {
            this.mockWebSocket.send('REQUEST_PRICE_UPDATE');
        }, 1000);
    }

    generateMockPriceData() {
        const stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
        const data = {};
        
        stocks.forEach(stock => {
            const currentPrice = this.stockPrices.get(stock) || this.generateInitialPrice();
            const change = (Math.random() - 0.5) * 10;
            data[stock] = {
                price: Math.max(currentPrice + change, 1),
                volume: Math.floor(Math.random() * 1000000),
                timestamp: Date.now()
            };
        });
        
        return data;
    }

    handleWebSocketMessage(data) {
        Object.entries(data).forEach(([stock, details]) => {
            this.stockPrices.set(stock, details.price);
            
            if (!this.priceHistory.has(stock)) {
                this.priceHistory.set(stock, []);
            }
            
            const history = this.priceHistory.get(stock);
            history.push({
                price: details.price,
                volume: details.volume,
                timestamp: details.timestamp
            });
            
            // Keep last 1000 data points for historical analysis
            if (history.length > 1000) {
                history.shift();
            }
            
            if (stock === this.currentStock) {
                this.updateChart();
                this.checkPendingOrders(stock, details.price);
            }
        });
        
        this.updateDisplay();
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
                scales: {
                    y: { beginAtZero: false }
                }
            }
        });
    }

    changeTimeframe(period) {
        this.currentTimeframe = period;
        this.timeframeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
        this.updateChart();
    }

    updateChart() {
        if (!this.chart) return;
        
        const priceData = this.priceHistory.get(this.currentStock) || [];
        const timeframeData = this.filterDataByTimeframe(priceData);
        
        this.chart.data.labels = timeframeData.map(d => new Date(d.timestamp).toLocaleTimeString());
        this.chart.data.datasets[0].data = timeframeData.map(d => d.price);
        this.chart.update('none');
    }

    filterDataByTimeframe(data) {
        const now = Date.now();
        const periods = {
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
            '1M': 30 * 24 * 60 * 60 * 1000,
            '3M': 90 * 24 * 60 * 60 * 1000
        };
        
        return data.filter(d => d.timestamp > now - periods[this.currentTimeframe]);
    }

    toggleOrderInputs() {
        const orderType = this.orderTypeSelect.value;
        this.limitPriceInput.classList.toggle('hidden', orderType === 'market');
        this.stopPriceInput.classList.toggle('hidden', orderType !== 'stop');
    }

    checkPendingOrders(stock, price) {
        if (!this.pendingOrders.has(stock)) return;
        
        const orders = this.pendingOrders.get(stock);
        const executedOrders = [];
        
        orders.forEach(order => {
            if (this.shouldExecuteOrder(order, price)) {
                this.executeOrder(order);
                executedOrders.push(order);
            }
        });
        
        executedOrders.forEach(order => {
            orders.delete(order);
        });
    }

    shouldExecuteOrder(order, price) {
        switch (order.type) {
            case 'limit':
                return (order.side === 'buy' && price <= order.limitPrice) ||
                       (order.side === 'sell' && price >= order.limitPrice);
            case 'stop':
                return (order.side === 'buy' && price >= order.stopPrice) ||
                       (order.side === 'sell' && price <= order.stopPrice);
            default:
                return true;
        }
    }

    executeOrder(order) {
        const price = this.stockPrices.get(order.stock);
        const total = order.shares * price;
        
        if (order.side === 'buy') {
            if (total > this.cash) return;
            this.cash -= total;
            const currentShares = this.portfolio.get(order.stock) || 0;
            this.portfolio.set(order.stock, currentShares + order.shares);
        } else {
            const currentShares = this.portfolio.get(order.stock) || 0;
            if (order.shares > currentShares) return;
            this.cash += total;
            this.portfolio.set(order.stock, currentShares - order.shares);
        }
        
        this.updateDisplay();
        this.saveData();
    }

    executeTrade(type) {
        const shares = parseInt(this.sharesInput.value);
        if (isNaN(shares) || shares <= 0) {
            alert('Please enter a valid number of shares');
            return;
        }

        const orderType = this.orderTypeSelect.value;
        const order = {
            stock: this.currentStock,
            shares,
            side: type,
            type: orderType
        };

        if (orderType === 'limit') {
            order.limitPrice = parseFloat(this.limitPriceInput.value);
            if (isNaN(order.limitPrice) || order.limitPrice <= 0) {
                alert('Please enter a valid limit price');
                return;
            }
        } else if (orderType === 'stop') {
            order.stopPrice = parseFloat(this.stopPriceInput.value);
            if (isNaN(order.stopPrice) || order.stopPrice <= 0) {
                alert('Please enter a valid stop price');
                return;
            }
        }

        if (orderType === 'market') {
            this.executeOrder(order);
        } else {
            if (!this.pendingOrders.has(this.currentStock)) {
                this.pendingOrders.set(this.currentStock, new Set());
            }
            this.pendingOrders.get(this.currentStock).add(order);
        }

        this.sharesInput.value = '';
        this.limitPriceInput.value = '';
        this.stopPriceInput.value = '';
    }

    updateDisplay() {
        // Update current price
        const currentStockPrice = this.stockPrices.get(this.currentStock);
        this.currentPrice.textContent = currentStockPrice.toFixed(2);

        // Update portfolio display
        let totalPortfolioValue = this.cash;
        this.portfolioList.innerHTML = '';
        
        this.portfolio.forEach((shares, stock) => {
            if (shares > 0) {
                const price = this.stockPrices.get(stock);
                const value = shares * price;
                totalPortfolioValue += value;
                
                const stockDiv = document.createElement('div');
                stockDiv.innerHTML = `${stock}: ${shares} shares @ $${price.toFixed(2)} = $${value.toFixed(2)}`;
                this.portfolioList.appendChild(stockDiv);
            }
        });

        // Update summary values
        this.portfolioValue.textContent = totalPortfolioValue.toFixed(2);
        this.availableCash.textContent = this.cash.toFixed(2);
    }

    generateNews() {
        const news = [
            'Market shows strong upward trend',
            'Tech stocks surge on positive earnings',
            'Federal Reserve announces policy changes',
            'Global markets respond to economic data',
            'New technology breakthrough impacts stocks'
        ];

        const newsItem = document.createElement('div');
        newsItem.textContent = news[Math.floor(Math.random() * news.length)];
        this.newsFeed.insertBefore(newsItem, this.newsFeed.firstChild);

        // Keep only last 5 news items
        if (this.newsFeed.children.length > 5) {
            this.newsFeed.removeChild(this.newsFeed.lastChild);
        }
    }

    startSimulation() {
        // Initialize random stock prices
        const stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
        stocks.forEach(stock => {
            this.stockPrices.set(stock, this.generateInitialPrice());
        });

        // Store interval IDs
        this.priceInterval = setInterval(() => this.updatePrices(), 1000);
        this.newsInterval = setInterval(() => this.generateNews(), 10000);

        // Add window focus/blur event listeners
        window.addEventListener('focus', () => this.resumeSimulation());
        window.addEventListener('blur', () => this.pauseSimulation());

        this.updateDisplay();
    }

    pauseSimulation() {
        clearInterval(this.priceInterval);
        clearInterval(this.newsInterval);
    }

    resumeSimulation() {
        if (!this.priceInterval) {
            this.priceInterval = setInterval(() => this.updatePrices(), 1000);
        }
        if (!this.newsInterval) {
            this.newsInterval = setInterval(() => this.generateNews(), 10000);
        }
    }

    generateInitialPrice() {
        return Math.random() * 1000 + 100;
    }

    updatePrices() {
        this.stockPrices.forEach((price, stock) => {
            const change = (Math.random() - 0.5) * 10;
            const newPrice = Math.max(price + change, 1);
            this.stockPrices.set(stock, newPrice);
            
            if (stock === this.currentStock) {
                const history = this.priceHistory.get(stock) || [];
                history.push(newPrice);
                if (history.length > 50) history.shift();
                this.updateChart();
            }
        });
        this.updateDisplay();
    }
}

// Initialize the simulator when the page loads
window.addEventListener('load', () => {
    new StockMarketSimulator();
});