/**
 * QNN Memory Estimator
 *
 * Educated guesses derived from open-deepthink runtime behavior:
 * - Persona prompt ~30 KB per agent (all_layers_prompts)
 * - Per-epoch memory append ~5 KB JSON response (algorithm +~3 KB sandbox log)
 * - Summarization kicks in at 450,000 chars (~0.43 MB) per agent (app.py)
 * - agent_outputs dict holds latest response ~4 KB per agent
 */
const QnnMemoryCalculator = (() => {
    const BASE_AGENT_MB = 0.03;
    const PER_EPOCH_BRAINSTORM_MB = 0.005;
    const PER_EPOCH_ALGORITHM_MB = 0.008;
    const SUMMARIZATION_CAP_MB = 0.45;
    const STATE_OVERHEAD_PER_AGENT_MB = 0.004;

    const OS_BROWSER_RESERVE_GB = 2.5;
    const LOCAL_MODEL_RESERVE_GB = 1.5;

    function perEpochMb(mode) {
        return mode === 'algorithm' ? PER_EPOCH_ALGORITHM_MB : PER_EPOCH_BRAINSTORM_MB;
    }

    function estimateAgentMb(epochs, mode) {
        const epochsNum = Math.max(1, Number(epochs) || 1);
        const growth = epochsNum * perEpochMb(mode);
        const raw = BASE_AGENT_MB + growth + STATE_OVERHEAD_PER_AGENT_MB;
        return Math.min(raw, SUMMARIZATION_CAP_MB);
    }

    function agentGrowthTable(mode, maxEpochs = 10) {
        const rows = [];
        for (let e = 1; e <= maxEpochs; e++) {
            rows.push({ epoch: e, mb: estimateAgentMb(e, mode) });
        }
        return rows;
    }

    function estimateGrid(width, height, epochs, mode) {
        const w = Math.max(1, Number(width) || 1);
        const h = Math.max(1, Number(height) || 1);
        const totalAgents = w * h;
        const perAgent = estimateAgentMb(epochs, mode);
        const totalMb = totalAgents * perAgent;
        return { width: w, height: h, totalAgents, perAgentMb: perAgent, totalMb };
    }

    function fitOnLaptop(grid, ramGb, isLocalModel) {
        const ram = Math.max(1, Number(ramGb) || 8);
        const modelReserve = isLocalModel ? LOCAL_MODEL_RESERVE_GB : 0;
        const availableGb = Math.max(0.5, ram - OS_BROWSER_RESERVE_GB - modelReserve);
        const availableMb = availableGb * 1024;
        const fits = grid.totalMb <= availableMb;
        const maxAgents = Math.floor(availableMb / grid.perAgentMb);
        const maxSide = Math.floor(Math.sqrt(maxAgents));
        return {
            ramGb: ram,
            availableGb,
            availableMb,
            fits,
            maxAgents,
            maxSide,
            headroomMb: availableMb - grid.totalMb,
        };
    }

    function formatMb(mb) {
        if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
        if (mb >= 100) return `${mb.toFixed(0)} MB`;
        if (mb >= 10) return `${mb.toFixed(1)} MB`;
        return `${mb.toFixed(2)} MB`;
    }

    function renderPanel(container, state) {
        const {
            width, height, epochs, mode, ramGb, isLocalModel,
            widthLabel, heightLabel, autoRange,
        } = state;

        let grid;
        if (autoRange) {
            const low = estimateGrid(autoRange.minW, autoRange.minH, epochs, mode);
            const high = estimateGrid(autoRange.maxW, autoRange.maxH, epochs, mode);
            grid = estimateGrid(
                Math.round((autoRange.minW + autoRange.maxW) / 2),
                Math.round((autoRange.minH + autoRange.maxH) / 2),
                epochs,
                mode,
            );
            var rangeNote = `${autoRange.minW}–${autoRange.maxW} × ${autoRange.minH}–${autoRange.maxH}`;
            var totalRange = `${formatMb(low.totalMb)} – ${formatMb(high.totalMb)}`;
        } else {
            grid = estimateGrid(width, height, epochs, mode);
            var rangeNote = null;
            var totalRange = null;
        }

        const fit = fitOnLaptop(grid, ramGb, isLocalModel);
        const growth = agentGrowthTable(mode, Math.min(10, Math.max(epochs, 5)));

        const statusClass = fit.fits ? 'mem-calc-fit--ok' : 'mem-calc-fit--warn';
        const statusIcon = fit.fits ? '✅' : '⚠️';
        const statusText = fit.fits
            ? `Fits in ~${fit.availableGb.toFixed(1)} GB available (${fit.headroomMb.toFixed(0)} MB headroom)`
            : `Exceeds ~${fit.availableGb.toFixed(1)} GB available by ${formatMb(-fit.headroomMb)}`;

        const growthRows = growth.map((r) =>
            `<tr><td>Epoch ${r.epoch}</td><td>~${formatMb(r.mb)}</td></tr>`,
        ).join('');

        container.innerHTML = `
            <div class="mem-calc-header">📊 QNN Memory Estimator <span class="mem-calc-badge">theoretical</span></div>
            <div class="mem-calc-grid">
                <div class="mem-calc-stat">
                    <span class="mem-calc-label">Topology</span>
                    <span class="mem-calc-value">${rangeNote || `${grid.width} × ${grid.height}`} = <strong>${grid.totalAgents.toLocaleString()}</strong> agents</span>
                </div>
                <div class="mem-calc-stat">
                    <span class="mem-calc-label">${widthLabel || 'Width'} × ${heightLabel || 'Height'}</span>
                    <span class="mem-calc-value">${rangeNote ? `Auto range: ${rangeNote}` : `${grid.width} agents/layer × ${grid.height} layers`}</span>
                </div>
                <div class="mem-calc-stat">
                    <span class="mem-calc-label">Per agent (epoch ${epochs})</span>
                    <span class="mem-calc-value">~${formatMb(grid.perAgentMb)}</span>
                </div>
                <div class="mem-calc-stat">
                    <span class="mem-calc-label">Total state</span>
                    <span class="mem-calc-value">${totalRange || '~' + formatMb(grid.totalMb)}</span>
                </div>
            </div>
            <div class="mem-calc-fit ${statusClass}">
                ${statusIcon} <strong>${ramGb} GB laptop:</strong> ${statusText}
                ${!fit.fits ? `<br><span class="mem-calc-hint">Try ≤ ${fit.maxAgents.toLocaleString()} agents total (e.g. ${fit.maxSide}×${fit.maxSide}) on this RAM budget.</span>` : ''}
            </div>
            <details class="mem-calc-details">
                <summary>Single-agent growth reference (educated guess)</summary>
                <p class="mem-calc-note">Based on persona (~30 KB), ~${(perEpochMb(mode) * 1024).toFixed(0)} KB/epoch memory append, and 450 KB summarization cap per agent.</p>
                <table class="mem-calc-table">
                    <thead><tr><th>Epoch</th><th>Est. RAM/agent</th></tr></thead>
                    <tbody>${growthRows}</tbody>
                </table>
                <p class="mem-calc-note">Caps at ~${formatMb(SUMMARIZATION_CAP_MB)} after summarization. ${isLocalModel ? `Local model reserves ~${LOCAL_MODEL_RESERVE_GB} GB.` : 'Cloud API: no local model reserve.'} OS+browser ~${OS_BROWSER_RESERVE_GB} GB reserved.</p>
            </details>
        `;
    }

    function init(containerId, getState) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const update = () => {
            try {
                renderPanel(container, getState());
            } catch (_) { /* ignore during DOM init */ }
        };

        update();

        const watchIds = container.dataset.watch || '';
        watchIds.split(',').filter(Boolean).forEach((id) => {
            const el = document.getElementById(id.trim());
            if (!el) return;
            el.addEventListener('input', update);
            el.addEventListener('change', update);
        });

        document.querySelectorAll('input[name="qnn_size_mode"], input[name="algorithm_width_mode"]').forEach((el) => {
            el.addEventListener('change', update);
        });

        const providerEl = document.getElementById('llm-provider');
        if (providerEl) providerEl.addEventListener('change', update);

        return { update };
    }

    return {
        BASE_AGENT_MB,
        PER_EPOCH_BRAINSTORM_MB,
        PER_EPOCH_ALGORITHM_MB,
        SUMMARIZATION_CAP_MB,
        estimateAgentMb,
        estimateGrid,
        fitOnLaptop,
        formatMb,
        init,
    };
})();

if (typeof module !== 'undefined') module.exports = QnnMemoryCalculator;