/* ================================================================
   CREDIT RISK DASHBOARD — APP LOGIC
   Chart.js charts, data fetching, risk calculator, animations
   ================================================================ */

/* ── CONFIGURATION ───────────────────────────────────────────────── */
const MODEL_COLORS = {
    'Logistic Regression':   '#38bdf8',
    'Decision Tree':         '#fbbf24',
    'Random Forest':         '#34d399',
    'XGBoost':               '#fb7185',
    'R Logistic Regression': '#a78bfa'
};

const METRIC_ICONS = {
    accuracy:  { icon: 'fa-bullseye',       bg: 'rgba(56, 189, 248, 0.1)',  color: '#38bdf8' },
    auc:       { icon: 'fa-chart-area',     bg: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa' },
    f1:        { icon: 'fa-scale-balanced', bg: 'rgba(251, 191, 36, 0.1)',  color: '#fbbf24' },
    precision: { icon: 'fa-crosshairs',     bg: 'rgba(52, 211, 153, 0.1)',  color: '#34d399' }
};


/* ── CHART.JS GLOBAL DEFAULTS ────────────────────────────────────── */
Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 10, 18, 0.95)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.legend.labels.padding = 20;


/* ── INITIALIZATION ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 700,
        easing: 'ease-out-cubic',
        once: true,
        offset: 60
    });

    initNavigation();
    initScrollProgress();
    loadAllData();
});


/* ── DATA LOADING ────────────────────────────────────────────────── */
async function loadAllData() {
    try {
        const [metricsRes, rocRes, featureRes, gradeRes, incomeRes, rMetricsRes] = await Promise.all([
            fetch('../results/model_metrics.json'),
            fetch('../results/roc_data.json'),
            fetch('../results/feature_importance.json'),
            fetch('../results/default_by_grade.json'),
            fetch('../results/income_distribution.json'),
            fetch('../results/r_metrics.json')
        ]);

        const metrics       = await metricsRes.json();
        const rocData        = await rocRes.json();
        const features       = await featureRes.json();
        const grades         = await gradeRes.json();
        const income         = await incomeRes.json();
        const rMetrics       = await rMetricsRes.json();

        renderMetricCards(metrics, rMetrics);
        renderComparisonTable(metrics, rMetrics);
        renderROCChart(rocData);
        renderFeatureChart(features);
        renderGradeChart(grades);
        renderIncomeChart(income);
        animateHeroCounters();

        // Hide loader after a short delay for smoothness
        setTimeout(hideLoader, 400);
    } catch (err) {
        console.error('Error loading dashboard data:', err);
        setTimeout(hideLoader, 600);
    }
}


/* ── METRIC CARDS ────────────────────────────────────────────────── */
function renderMetricCards(metrics, rMetrics) {
    // Combine all models for finding the best
    const allModels = [...metrics];
    if (rMetrics && rMetrics.length > 0) {
        allModels.push(rMetrics[0]);
    }

    // Find best values
    const bestAccuracy  = allModels.reduce((best, m) => (m.accuracy || 0) > (best.accuracy || 0) ? m : best);
    const bestAUC       = metrics.reduce((best, m) => (m.auc || 0) > (best.auc || 0) ? m : best);
    const bestF1        = metrics.reduce((best, m) => (m.f1 || 0) > (best.f1 || 0) ? m : best);
    const bestPrecision = metrics.reduce((best, m) => (m.precision || 0) > (best.precision || 0) ? m : best);

    const cardsData = [
        {
            label: 'Best Accuracy',
            value: bestAccuracy.accuracy,
            model: bestAccuracy.model,
            key: 'accuracy',
            accent: '#38bdf8'
        },
        {
            label: 'Best AUC',
            value: bestAUC.auc,
            model: bestAUC.model,
            key: 'auc',
            accent: '#a78bfa'
        },
        {
            label: 'Best F1 Score',
            value: bestF1.f1,
            model: bestF1.model,
            key: 'f1',
            accent: '#fbbf24'
        },
        {
            label: 'Best Precision',
            value: bestPrecision.precision,
            model: bestPrecision.model,
            key: 'precision',
            accent: '#34d399'
        }
    ];

    const grid = document.getElementById('metricsGrid');
    grid.innerHTML = cardsData.map((card, i) => {
        const iconInfo = METRIC_ICONS[card.key];
        return `
            <div class="metric-card" data-aos="fade-up" data-aos-delay="${i * 100}"
                 style="--card-accent: ${card.accent}">
                <div class="metric-icon" style="--icon-bg: ${iconInfo.bg}; --icon-color: ${iconInfo.color}">
                    <i class="fas ${iconInfo.icon}"></i>
                </div>
                <div class="metric-label">${card.label}</div>
                <div class="metric-value">
                    <span class="counter" data-target="${card.value}">${card.value}</span><span class="unit">%</span>
                </div>
                <div class="metric-model"><i class="fas fa-circle"></i> ${card.model}</div>
            </div>
        `;
    }).join('');
}


/* ── MODEL COMPARISON TABLE ──────────────────────────────────────── */
function renderComparisonTable(metrics, rMetrics) {
    // Merge R model into list
    const allModels = [...metrics];
    if (rMetrics && rMetrics.length > 0) {
        allModels.push({
            model: rMetrics[0].model,
            accuracy: rMetrics[0].accuracy,
            precision: null,
            recall: null,
            f1: null,
            auc: null
        });
    }

    // Find best in each column
    const metricKeys = ['accuracy', 'precision', 'recall', 'f1', 'auc'];
    const bests = {};
    metricKeys.forEach(key => {
        let bestVal = -1;
        allModels.forEach(m => {
            if (m[key] !== null && m[key] !== undefined && m[key] > bestVal) {
                bestVal = m[key];
            }
        });
        bests[key] = bestVal;
    });

    const table = document.getElementById('comparisonTable');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Model</th>
                <th>Accuracy</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1 Score</th>
                <th>AUC-ROC</th>
            </tr>
        </thead>
        <tbody>
            ${allModels.map(m => {
                const color = MODEL_COLORS[m.model] || '#888';
                return `
                <tr>
                    <td>
                        <div class="model-name-cell">
                            <span class="model-dot" style="background: ${color}"></span>
                            ${m.model}
                        </div>
                    </td>
                    ${metricKeys.map(key => {
                        if (m[key] === null || m[key] === undefined) {
                            return `<td class="na-value">—</td>`;
                        }
                        const isBest = m[key] === bests[key];
                        return `<td class="${isBest ? 'best-value' : ''}">${m[key]}%${isBest ? '<span class="best-badge"><i class="fas fa-crown"></i> Best</span>' : ''}</td>`;
                    }).join('')}
                </tr>`;
            }).join('')}
        </tbody>
    `;
}


/* ── ROC CURVE CHART ─────────────────────────────────────────────── */
function renderROCChart(rocData) {
    const ctx = document.getElementById('rocChart').getContext('2d');

    // Build datasets for each model
    const datasets = Object.entries(rocData).map(([name, data]) => {
        const color = MODEL_COLORS[name] || '#888';
        const points = data.fpr.map((fpr, i) => ({ x: fpr, y: data.tpr[i] }));
        return {
            label: name,
            data: points,
            showLine: true,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            tension: 0.3
        };
    });

    // Add diagonal reference line
    datasets.push({
        label: 'Random (AUC = 0.5)',
        data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        showLine: true,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0
    });

    new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.8,
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: {
                    title: { display: true, text: 'False Positive Rate', font: { weight: '600', size: 13 } },
                    min: 0, max: 1,
                    ticks: { stepSize: 0.2, callback: v => v.toFixed(1) },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                    title: { display: true, text: 'True Positive Rate', font: { weight: '600', size: 13 } },
                    min: 0, max: 1,
                    ticks: { stepSize: 0.2, callback: v => v.toFixed(1) },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12, weight: '500' }, padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: TPR=${ctx.parsed.y.toFixed(3)}, FPR=${ctx.parsed.x.toFixed(3)}`
                    }
                }
            }
        }
    });
}


/* ── FEATURE IMPORTANCE CHART ────────────────────────────────────── */
function renderFeatureChart(features) {
    const ctx = document.getElementById('featureChart').getContext('2d');

    // Sort descending
    const sorted = [...features].sort((a, b) => a.importance - b.importance);
    const labels = sorted.map(f => formatFeatureName(f.feature));
    const values = sorted.map(f => f.importance);

    // Create gradient for bars
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.clientWidth, 0);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.8)');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: gradient,
                borderColor: 'rgba(56, 189, 248, 0.3)',
                borderWidth: 1,
                borderRadius: 6,
                barThickness: 22
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Importance: ${ctx.parsed.x}%`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Importance (%)', font: { weight: '600' } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => v + '%' }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 12, weight: '500' } }
                }
            }
        }
    });
}


/* ── DEFAULT RATE BY GRADE CHART ─────────────────────────────────── */
function renderGradeChart(grades) {
    const ctx = document.getElementById('gradeChart').getContext('2d');

    const labels = grades.map(g => `Grade ${g.grade}`);
    const values = grades.map(g => g.default_pct);

    // Color gradient: green A → red G
    const gradeColors = [
        'rgba(52, 211, 153, 0.85)',   // A — emerald
        'rgba(74, 222, 128, 0.85)',   // B
        'rgba(163, 230, 53, 0.85)',   // C — lime
        'rgba(251, 191, 36, 0.85)',   // D — amber
        'rgba(251, 146, 60, 0.85)',   // E — orange
        'rgba(248, 113, 113, 0.85)',  // F — red
        'rgba(251, 113, 133, 0.85)'   // G — rose
    ];
    const gradeBorders = gradeColors.map(c => c.replace('0.85', '1'));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: gradeColors,
                borderColor: gradeBorders,
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Default Rate: ${ctx.parsed.y}%`
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Default Rate (%)', font: { weight: '600' } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => v + '%' },
                    beginAtZero: true
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12, weight: '600' } }
                }
            }
        }
    });
}


/* ── INCOME VS DEFAULT RATE CHART ────────────────────────────────── */
function renderIncomeChart(income) {
    const ctx = document.getElementById('incomeChart').getContext('2d');

    const labels = income.map(i => i.income_group);
    const values = income.map(i => i.PD_pct);

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight);
    gradient.addColorStop(0, 'rgba(167, 139, 250, 0.4)');
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.02)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Default Rate (%)',
                data: values,
                borderColor: '#a78bfa',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#a78bfa',
                pointBorderColor: '#0d0d14',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 9,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `PD: ${ctx.parsed.y}%`
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Probability of Default (%)', font: { weight: '600' } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => v + '%' },
                    beginAtZero: true
                },
                x: {
                    title: { display: true, text: 'Income Group', font: { weight: '600' } },
                    grid: { display: false },
                    ticks: { font: { weight: '500' } }
                }
            }
        }
    });
}


/* ── RISK CALCULATOR ─────────────────────────────────────────────── */
function predictRisk() {
    const income  = parseFloat(document.getElementById('calcIncome').value) || 0;
    const loanAmt = parseFloat(document.getElementById('calcLoan').value)   || 0;
    const fico    = parseFloat(document.getElementById('calcFico').value)    || 0;
    const intRate = parseFloat(document.getElementById('calcRate').value)    || 0;

    // Validate inputs
    if (income <= 0 || loanAmt <= 0 || fico < 300 || fico > 850 || intRate <= 0) {
        alert('Please enter valid values for all fields.\nFICO: 300-850, Interest Rate: 0-35%');
        return;
    }

    // Simplified logistic scoring based on feature relationships observed in the data
    // Coefficients calibrated to produce ~18-20% default rate for an average borrower
    const dtiProxy = loanAmt / income;
    const z = 0.0
        + (intRate * 0.10)          // Higher interest rate → higher risk
        - (fico    * 0.004)         // Higher FICO → lower risk
        + (dtiProxy * 2.0)          // Higher debt-to-income → higher risk
        - (income  / 300000);       // Higher income → lower risk

    const probability = 1 / (1 + Math.exp(-z));
    const pct = (probability * 100).toFixed(1);

    // Expected Loss: EL = PD × EAD × LGD (Basel II formula)
    const lgd = 0.45; // Industry standard LGD
    const expectedLoss = probability * loanAmt * lgd;

    // Monthly installment estimate (36-month term)
    const monthlyRate = intRate / 100 / 12;
    const n = 36;
    const monthlyPayment = loanAmt * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);

    // Determine risk level
    let riskLevel, riskColor, riskIcon, riskGlow, riskBadgeBg, interpretation;
    if (probability < 0.15) {
        riskLevel   = 'LOW RISK';
        riskColor   = '#34d399';
        riskIcon    = 'fa-shield-check';
        riskGlow    = 'rgba(52, 211, 153, 0.3)';
        riskBadgeBg = 'rgba(52, 211, 153, 0.1)';
        interpretation = 'This borrower profile shows strong creditworthiness. Low probability of default.';
    } else if (probability < 0.35) {
        riskLevel   = 'MEDIUM RISK';
        riskColor   = '#fbbf24';
        riskIcon    = 'fa-triangle-exclamation';
        riskGlow    = 'rgba(251, 191, 36, 0.3)';
        riskBadgeBg = 'rgba(251, 191, 36, 0.1)';
        interpretation = 'Moderate risk profile. Additional credit verification recommended before approval.';
    } else {
        riskLevel   = 'HIGH RISK';
        riskColor   = '#fb7185';
        riskIcon    = 'fa-circle-exclamation';
        riskGlow    = 'rgba(251, 113, 133, 0.3)';
        riskBadgeBg = 'rgba(251, 113, 133, 0.1)';
        interpretation = 'Elevated default probability. High-risk profile — consider declining or adjusting terms.';
    }

    // Render result
    const resultDiv = document.getElementById('calcResult');
    resultDiv.innerHTML = `
        <div class="risk-result" style="--risk-color: ${riskColor}; --risk-glow: ${riskGlow}; --risk-badge-bg: ${riskBadgeBg}; --risk-pct: ${pct}">
            <div class="risk-gauge">
                <div class="risk-gauge-inner">
                    <span class="risk-pct">${pct}%</span>
                    <span class="risk-pct-label">Default Prob.</span>
                </div>
            </div>
            <div class="risk-level-badge">
                <i class="fas ${riskIcon}"></i> ${riskLevel}
            </div>
            <p style="font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 20px; max-width: 300px; margin-left: auto; margin-right: auto;">
                ${interpretation}
            </p>
            <div class="risk-details">
                <div class="risk-detail-row">
                    <span class="risk-detail-label">Expected Loss (Basel II)</span>
                    <span class="risk-detail-value">$${numberWithCommas(expectedLoss.toFixed(0))}</span>
                </div>
                <div class="risk-detail-row">
                    <span class="risk-detail-label">Est. Monthly Payment</span>
                    <span class="risk-detail-value">$${numberWithCommas(monthlyPayment.toFixed(0))}</span>
                </div>
                <div class="risk-detail-row">
                    <span class="risk-detail-label">Debt-to-Income Proxy</span>
                    <span class="risk-detail-value">${(dtiProxy * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
}


/* ── NAVIGATION ──────────────────────────────────────────────────── */
function initNavigation() {
    const navbar    = document.getElementById('navbar');
    const toggle    = document.getElementById('navToggle');
    const links     = document.getElementById('navLinks');
    const allLinks  = links.querySelectorAll('a');

    // Scroll class
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
        updateActiveNav();
    });

    // Mobile toggle
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        links.classList.toggle('open');
    });

    // Close mobile nav on link click
    allLinks.forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            links.classList.remove('open');
        });
    });
}

function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    let current = '';

    sections.forEach(section => {
        const top = section.offsetTop - 120;
        if (window.scrollY >= top) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
}


/* ── SCROLL PROGRESS BAR ────────────────────────────────────────── */
function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    window.addEventListener('scroll', () => {
        const scrollTop  = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = (scrollTop / scrollHeight) * 100;
        bar.style.width = progress + '%';
    });
}


/* ── HERO COUNTER ANIMATION ──────────────────────────────────────── */
function animateHeroCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    counters.forEach(el => {
        const target = parseInt(el.dataset.count);
        animateCounter(el, target, 2000);
    });
}

function animateCounter(element, target, duration) {
    const start = performance.now();
    const format = target >= 1000;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);

        if (format) {
            element.textContent = (current / 1000).toFixed(0) + 'K+';
        } else {
            element.textContent = current;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}


/* ── LOADER ──────────────────────────────────────────────────────── */
function hideLoader() {
    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
}


/* ── UTILITIES ───────────────────────────────────────────────────── */
function formatFeatureName(name) {
    const map = {
        'int_rate':                'Interest Rate',
        'emp_length':              'Employment Length',
        'dti':                     'Debt-to-Income',
        'home_ownership_MORTGAGE': 'Home: Mortgage',
        'fico_range_low':          'FICO Score',
        'annual_inc':              'Annual Income',
        'loan_amnt':               'Loan Amount',
        'home_ownership_RENT':     'Home: Rent',
        'grade':                   'Loan Grade',
        'home_ownership_OWN':      'Home: Own'
    };
    return map[name] || name;
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
