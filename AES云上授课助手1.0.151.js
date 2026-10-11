// ==UserScript==
// @name         AES云上授课助手
// @namespace    https://scriptcat.org/
// @version      1.0.151
// @description  AES云上授课助手1.0.151 - 针对出头科技云上教学系统的自动刷课脚本（功能图标已替换为 HarmonyOS 线性风格并修复居中；LOGO 未改动）
// @Tag          网课自动化
// @author       绫白
// @match        https://csjs.web2.superchutou.com/*
// @match        https://*.superchutou.com/*
// @grant        GM_notification
// @grant        GM_log
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置项 ====================
    const CONFIG = {
        playbackRate: 1.5,
        autoMute: true,
        enableBackgroundPlay: true,
        checkInterval: 2000,
        startWaitTime: 2000,
        nextVideoDelay: 2000,
        showNotification: true,
        debug: true
    };

    // ==================== 工具函数 ====================
    // [③] 日志分级：warn/error 恒输出；info/success 受 CONFIG.debug 控制
    function log(message, type = 'info') {
        const prefix = '[AES助手]';
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `${prefix} [${timestamp}] ${message}`;
        const critical = (type === 'warn' || type === 'error');
        if (!CONFIG.debug && !critical) return;
        const styles = {
            info: 'color: #2196F3',
            success: 'color: #4CAF50',
            warn: 'color: #FF9800',
            error: 'color: #F44336'
        };
        console.log(`%c${fullMessage}`, styles[type] || styles.info);
        GM_log(fullMessage, type);
    }

    function notify(title, text, timeout = 5000) {
        if (CONFIG.showNotification) GM_notification({ title, text, timeout });
        log(`${title}: ${text}`, 'success');
    }

    // ==================== 倍速防护锁 - 模块级状态 ====================
    let _protoLocked = false;
    let _nativePlaybackRateDesc = null;

    // ==================== 独立矢量LOGO (防ID冲突) ====================
    // 【严格保留，未做任何改动】
    const LOGO_SVG = `<svg class="aes-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.319 19.5C4.289 19.5 2.645 17.857 2.645 15.826C2.645 14.2 3.713 12.82 5.19 12.336C5.068 11.818 5 11.278 5 10.723C5 7.412 7.686 4.726 10.997 4.726C13.632 4.726 15.861 6.417 16.672 8.777C16.882 8.726 17.102 8.7 17.328 8.7C19.358 8.7 21 10.342 21 12.373C21 12.874 20.897 13.351 20.71 13.784C21.496 14.243 22 15.09 22 16.055C22 17.406 20.905 18.5 19.555 18.5" stroke="url(#aes-grad1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 16L15 12.5L10 9V16Z" fill="url(#aes-grad2)"/>
        <path d="M7.5 10.5L9 11.5" stroke="#4facfe" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <defs>
        <linearGradient id="aes-grad1" x1="2.645" y1="4.726" x2="22" y2="19.5" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4facfe"/>
        <stop offset="1" stop-color="#764ba2"/>
        </linearGradient>
        <linearGradient id="aes-grad2" x1="10" y1="9" x2="15" y2="16" gradientUnits="userSpaceOnUse">
        <stop stop-color="#667eea"/>
        <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
        </defs>
        </svg>`;

    // ==================== 功能图标集 (HarmonyOS 线性风格) ====================
    // 双态约定：.icon-pair 中第一个 = 默认态(无 .alt)，第二个 = .alt 态
    // 如需替换为 HarmonyOS_Icons.zip 内官方 SVG：解开对应 key，
    // 粘贴官方 <path .../> 节点，并把其中的 black 统一改为 currentColor 即可。
    const ICONS = {
        play:   `<path d="M8.5 5.9v12.2c0 .92 1.01 1.48 1.79.99l10.06-6.1a1.16 1.16 0 000-1.98L10.29 4.91c-.78-.49-1.79.07-1.79.99z" fill="currentColor"/>`,
        pause:  `<rect x="7.2" y="5.2" width="3.2" height="13.6" rx="1.2" fill="currentColor"/><rect x="13.6" y="5.2" width="3.2" height="13.6" rx="1.2" fill="currentColor"/>`,
        prev:   `<path d="M6.4 5.5h1.8a.9.9 0 01.9.9v11.2a.9.9 0 01-.9.9H6.4a.9.9 0 01-.9-.9V6.4a.9.9 0 01.9-.9z" fill="currentColor"/><path d="M18.9 6.7v10.6c0 .83-.92 1.33-1.62.88l-7.94-5.3a1.05 1.05 0 010-1.76l7.94-5.3c.7-.45 1.62.05 1.62.88z" fill="currentColor"/>`,
        next:   `<path d="M17.6 5.5h-1.8a.9.9 0 00-.9.9v11.2a.9.9 0 00.9.9h1.8a.9.9 0 00.9-.9V6.4a.9.9 0 00-.9-.9z" fill="currentColor"/><path d="M5.1 6.7v10.6c0 .83.92 1.33 1.62.88l7.94-5.3a1.05 1.05 0 000-1.76L6.72 5.82c-.7-.45-1.62.05-1.62.88z" fill="currentColor"/>`,
        volume: `<path d="M11.3 5.02L7.2 8.35H4.9a1.15 1.15 0 00-1.15 1.15v5a1.15 1.15 0 001.15 1.15h2.3l4.1 3.33a.85.85 0 001.39-.66V5.68a.85.85 0 00-1.39-.66z" fill="currentColor"/><path d="M15.2 9.9a3.3 3.3 0 010 4.2M17.9 7.9a6.6 6.6 0 010 8.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
        mute:   `<path d="M11.3 5.02L7.2 8.35H4.9a1.15 1.15 0 00-1.15 1.15v5a1.15 1.15 0 001.15 1.15h2.3l4.1 3.33a.85.85 0 001.39-.66V5.68a.85.85 0 00-1.39-.66z" fill="currentColor"/><path d="M15.1 10.2l4.4 4.4M19.5 10.2l-4.4 4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
        plus:   `<path d="M12 5.8v12.4M5.8 12h12.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`,
        minus:  `<path d="M5.8 12h12.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`
    };

    // 统一 SVG 外壳：currentColor 继承按钮文字色，hover/active 变色零成本
    const iconSvg = (name) =>
        `<svg class="aes-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg>`;

    // ==================== 全局CSS提取 (解决CSP拦截) ====================
    // [⑦] 严格作用域隔离：所有选择器强制带 #aes-panel 前缀；@keyframes 改名 aes-pulse
    const PANEL_CSS = `
        #aes-panel {
            position: fixed; top: 80px; right: 20px; width: 320px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 999999;
            font-family: '汉仪文黑85W', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff; overflow: hidden;
            transition: all 0.3s ease; user-select: none;
        }
        #aes-panel.collapsed { width: 50px; height: 50px; border-radius: 50%; cursor: pointer; }
        #aes-panel.collapsed .panel-content { display: none; }
        #aes-panel.collapsed .panel-header { padding: 0; justify-content: center; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        #aes-panel.collapsed .panel-title { display: none; }
        #aes-panel.collapsed .toggle-btn { display: none; }
        #aes-panel.collapsed .collapsed-icon { display: flex !important; }
        #aes-panel .aes-logo { vertical-align: middle; margin-right: 6px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
        #aes-panel.collapsed .aes-logo { width: 26px; height: 26px; margin: 0; }
        #aes-panel .panel-header {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: move;
        }
        #aes-panel .panel-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; }
        #aes-panel .collapsed-icon { display: none; align-items: center; justify-content: center; width: 100%; height: 100%; }
        #aes-panel .toggle-btn {
            background: rgba(255,255,255,0.2); border: none; color: #fff;
            width: 24px; height: 24px; border-radius: 8px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s; font-size: 16px; line-height: 1;
        }
        #aes-panel .toggle-btn:hover { background: rgba(255,255,255,0.3); }
        #aes-panel .panel-content { padding: 16px; }
        #aes-panel .status-card { background: rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
        #aes-panel .status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        #aes-panel .status-label { font-size: 12px; color: #888; }
        #aes-panel .status-value { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
        #aes-panel .status-running { color: #4CAF50; }
        #aes-panel .status-stopped { color: #ff9800; }
        #aes-panel .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4CAF50; animation: aes-pulse 1.5s infinite; }
        #aes-panel .status-dot.stopped { background: #ff9800; animation: none; }
        @keyframes aes-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        #aes-panel .progress-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin: 8px 0; }
        #aes-panel .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); border-radius: 3px; transition: width 0.3s ease; }
        #aes-panel .progress-text { display: flex; justify-content: space-between; font-size: 11px; color: #888; }
        #aes-panel .video-info { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; margin-top: 8px; }
        #aes-panel .video-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #aes-panel .video-index { font-size: 11px; color: #888; }
        #aes-panel .control-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
        #aes-panel .ctrl-btn {
            background: rgba(255,255,255,0.1); border: none; color: #fff;
            padding: 10px 6px; border-radius: 10px; cursor: pointer;
            transition: all 0.2s; font-size: 16px;
        }
        #aes-panel .ctrl-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-1px); }
        #aes-panel .ctrl-btn.active { background: linear-gradient(135deg, #4CAF50, #8BC34A); }
        #aes-panel .ctrl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        #aes-panel .speed-section { margin-bottom: 12px; }
        #aes-panel .speed-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        #aes-panel .speed-current { color: #667eea; font-weight: 600; }
        #aes-panel .speed-buttons { display: flex; gap: 6px; }
        #aes-panel .speed-btn {
            flex: 1; background: rgba(255,255,255,0.1); border: none; color: #fff;
            padding: 8px 4px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: all 0.2s;
        }
        #aes-panel .speed-btn:hover { background: rgba(255,255,255,0.2); }
        #aes-panel .speed-btn.active { background: linear-gradient(135deg, #667eea, #764ba2); }
        #aes-panel .stats-row { display: flex; justify-content: space-around; padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.1); }
        #aes-panel .stat-item { text-align: center; }
        #aes-panel .stat-value { font-size: 18px; font-weight: 600; color: #fff; }
        #aes-panel .stat-label { font-size: 10px; color: #888; margin-top: 2px; }
        #aes-panel .stat-value.highlight { color: #4CAF50; }
        #aes-panel .footer-credit { text-align: center; padding: 10px 0 6px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 8px; }
        #aes-panel .footer-credit-text { font-size: 10px; color: #555; line-height: 1.5; }
        #aes-panel .footer-credit-text span { color: #4facfe; font-weight: bold; }
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
            #aes-panel { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            #aes-panel .stats-row, #aes-panel .footer-credit { border-top: none; position: relative; }
            #aes-panel .stats-row::after, #aes-panel .footer-credit::after {
                content: ''; position: absolute; left: 0; top: 0; width: 200%; height: 200%;
                transform-origin: 0 0; transform: scale(0.5); pointer-events: none; box-sizing: border-box;
            }
            #aes-panel .stats-row::after { border-top: 1px solid rgba(255,255,255,0.1); }
            #aes-panel .footer-credit::after { border-top: 1px solid rgba(255,255,255,0.08); }
        }
        #aes-panel .panel-header, #aes-panel.collapsed { touch-action: none; }

        /* ===== HarmonyOS 图标系统（替换原字符图标）===== */
        #aes-panel .aes-icon { display: block; pointer-events: none; }

        /* 关键修复：按钮改为 flex 居中，兼容单图标与双态图标两种结构 */
        #aes-panel .ctrl-btn {
            font-size: 0;
            line-height: 0;              /* 消除行内基线带来的垂直偏移 */
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #aes-panel .ctrl-btn svg { width: 18px; height: 18px; flex: none; }

        #aes-panel .toggle-btn { font-size: 0; line-height: 0; }
        #aes-panel .toggle-btn svg { width: 14px; height: 14px; flex: none; }

        /* 双态图标：默认显示第一个，加 .alt 切到第二个 */
        #aes-panel .icon-pair {
            display: flex;               /* 由 inline-flex 改为 flex，交给按钮的 flex 居中 */
            align-items: center;
            justify-content: center;
        }
        #aes-panel .icon-pair > svg:last-child { display: none; }
        #aes-panel .alt > .icon-pair > svg:first-child { display: none; }
        #aes-panel .alt > .icon-pair > svg:last-child { display: block; }
    `;

    // ==================== UI面板类 ====================
    class ControlPanel {
        constructor(manager) {
            this.manager = manager;
            this.panel = null;
            this.isCollapsed = false;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.updateTimer = null;
            this._lastToggleTime = 0;
            this._clampToken = 0;
            this._onPointerMove = null; // [②] document 级监听句柄
            this._onPointerEnd = null;  // [②]
            this.init();
        }

        init() {
            GM_addStyle(PANEL_CSS);
            this.createPanel();
            this.bindEvents();
            this.startUpdate();
            log('控制面板已创建(安全模式)', 'success');
        }

        createPanel() {
            // 【HTML 结构保留，含 LOGO 引用；功能按钮改为 HarmonyOS 图标】
            const container = document.createElement('div');
            container.id = 'aes-panel-container';
            container.innerHTML = `
                <div id="aes-panel">
                    <div class="panel-header">
                        <span class="panel-title">${LOGO_SVG}AES云上授课助手</span>
                        <span class="collapsed-icon">${LOGO_SVG}</span>
                        <button class="toggle-btn" id="toggle-btn" title="收起/展开">
                            <span class="icon-pair">${iconSvg('minus')}${iconSvg('plus')}</span>
                        </button>
                    </div>
                    <div class="panel-content">
                        <div class="status-card">
                            <div class="status-header">
                                <span class="status-label">运行状态</span>
                                <span class="status-value status-running" id="status-text">
                                    <span class="status-dot" id="status-dot"></span>
                                    <span id="status-label">运行中</span>
                                </span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">
                                <span id="current-time">00:00</span>
                                <span id="progress-percent">0%</span>
                                <span id="total-time">00:00</span>
                            </div>
                            <div class="video-info">
                                <div class="video-title" id="video-title">加载中...</div>
                                <div class="video-index" id="video-index">第 0/0 个视频</div>
                            </div>
                        </div>

                        <div class="control-grid">
                            <button class="ctrl-btn active" id="btn-play" title="播放/暂停">
                                <span class="icon-pair">${iconSvg('play')}${iconSvg('pause')}</span>
                            </button>
                            <button class="ctrl-btn" id="btn-prev" title="上一课">${iconSvg('prev')}</button>
                            <button class="ctrl-btn" id="btn-next" title="下一课">${iconSvg('next')}</button>
                            <button class="ctrl-btn" id="btn-mute" title="静音">
                                <span class="icon-pair">${iconSvg('volume')}${iconSvg('mute')}</span>
                            </button>
                        </div>

                        <div class="speed-section">
                            <div class="speed-header">
                                <span>播放速度</span>
                                <span class="speed-current" id="speed-display">1.5x</span>
                            </div>
                            <div class="speed-buttons">
                                <button class="speed-btn" data-speed="1">1x</button>
                                <button class="speed-btn" data-speed="1.25">1.25x</button>
                                <button class="speed-btn active" data-speed="1.5">1.5x</button>
                                <button class="speed-btn" data-speed="2">2x</button>
                                <button class="speed-btn" data-speed="3">3x</button>
                            </div>
                        </div>

                        <div class="stats-row">
                            <div class="stat-item">
                                <div class="stat-value highlight" id="stat-completed">0</div>
                                <div class="stat-label">已完成</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="stat-remaining">0</div>
                                <div class="stat-label">剩余</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="stat-percent">0%</div>
                                <div class="stat-label">总进度</div>
                            </div>
                        </div>

                        <div class="footer-credit">
                            <div class="footer-credit-text">由<span>智谱清言</span>与<span>ScriptCat</span>及创作者<span>绫白</span>共同驱动</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            this.panel = document.getElementById('aes-panel');
        }

        bindEvents() {
            // [R6] 面板内元素一律走面板作用域查询，杜绝宿主同名 ID 误绑
            this.panel.querySelector('#toggle-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });

            // [P5] dblclick 加防抖
            this.panel.querySelector('.panel-header').addEventListener('dblclick', () => {
                if (Date.now() - this._lastToggleTime < 300) return;
                this.toggleCollapse();
            });

            // —— 拖拽修复：悬浮球可拖 + 跨iframe/出窗不丢事件 + 视口钳制 ——
            this.panel.addEventListener('pointerdown', (e) => {
                if (!this.panel) return;
                if (!this.isCollapsed && !e.target.closest('.panel-header')) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                this._dragPending = true;
                this._dragPointerId = e.pointerId;
                this._dragStartX = e.clientX;
                this._dragStartY = e.clientY;
                const rect = this.panel.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;
            });

            // [②] 句柄化，便于 destroy 时移除
            this._onPointerMove = (e) => {
                if (!this.panel) return;
                if (this._dragPending && !this.isDragging) {
                    if (e.pointerId !== this._dragPointerId) return;
                    if (Math.hypot(e.clientX - this._dragStartX, e.clientY - this._dragStartY) < 3) return;
                    this.isDragging = true;
                    this._dragPending = false;
                    this.panel.style.transition = 'none';
                    try { this.panel.setPointerCapture(e.pointerId); } catch (err) {}
                }
                if (!this.isDragging) return;
                const maxX = Math.max(0, window.innerWidth - this.panel.offsetWidth);
                const maxY = Math.max(0, window.innerHeight - this.panel.offsetHeight);
                this.panel.style.left = Math.min(Math.max(0, e.clientX - this.dragOffset.x), maxX) + 'px';
                this.panel.style.top = Math.min(Math.max(0, e.clientY - this.dragOffset.y), maxY) + 'px';
                this.panel.style.right = 'auto';
            };

            this._onPointerEnd = () => {
                // [P5] 在清空 _dragPending 之前先判定"这是一次点击"
                const wasClick = this._dragPending && !this.isDragging;
                this._dragPending = false;
                if (this.isDragging) {
                    this.isDragging = false;
                    if (this.panel) this.panel.style.transition = '';
                }
                // [P5] 收起态悬浮球：单击展开
                if (wasClick && this.isCollapsed && this.panel) {
                    this.toggleCollapse();
                }
            };

            document.addEventListener('pointermove', this._onPointerMove);
            document.addEventListener('pointerup', this._onPointerEnd);
            document.addEventListener('pointercancel', this._onPointerEnd);

            // [R6] 控制按钮事件绑定收窄至面板作用域
            this.panel.querySelector('#btn-play').addEventListener('click', () => this.manager.togglePlay());
            this.panel.querySelector('#btn-prev').addEventListener('click', () => this.manager.playPrevVideo());
            this.panel.querySelector('#btn-next').addEventListener('click', () => this.manager.playNextVideo());
            this.panel.querySelector('#btn-mute').addEventListener('click', () => this.manager.toggleMute());

            // [⑦] 收窄到面板内查询，不再误绑宿主同名的 .speed-btn
            this.panel.querySelectorAll('.speed-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const speed = parseFloat(btn.dataset.speed);
                    this.manager.setSpeed(speed);
                    this.updateSpeedButtons(speed);
                });
            });
        }

        // [P4] 折叠/展开后，把面板钳制回视口内
        clampToViewport() {
            if (!this.panel) return;
            const token = ++this._clampToken;
            setTimeout(() => {
                if (token !== this._clampToken) return;
                if (!this.panel) return;
                const rect = this.panel.getBoundingClientRect();
                const maxX = Math.max(0, window.innerWidth - rect.width);
                const maxY = Math.max(0, window.innerHeight - rect.height);
                const left = parseFloat(this.panel.style.left);
                const top = parseFloat(this.panel.style.top);
                if (!isNaN(left)) {
                    const nx = Math.min(Math.max(0, left), maxX);
                    if (nx !== left) this.panel.style.left = nx + 'px';
                }
                if (!isNaN(top)) {
                    const ny = Math.min(Math.max(0, top), maxY);
                    if (ny !== top) this.panel.style.top = ny + 'px';
                }
            }, 320);
        }

        toggleCollapse() {
            this.isCollapsed = !this.isCollapsed;
            this._lastToggleTime = Date.now();
            this.panel.classList.toggle('collapsed', this.isCollapsed);
            // [R6][图标] 作用域查询 + class 切换（收起显示 +，展开显示 −）
            this.panel.querySelector('#toggle-btn').classList.toggle('alt', this.isCollapsed);
            this.clampToViewport();
        }

        updateSpeedButtons(speed) {
            // [⑦][R6] 收窄到面板内查询
            this.panel.querySelectorAll('.speed-btn').forEach(btn => btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed));
            this.panel.querySelector('#speed-display').textContent = speed + 'x';
        }

        startUpdate() {
            this.updateTimer = setInterval(() => this.updateDisplay(), 500);
        }

        // [①][P6][P7][P12] 面板不再因 video=null 整块冻结；索引语义统一；显示"已停止"；读缓存标题
        // [R6] 全部元素查询收窄至面板作用域；[R7] 未连接时清空残留进度读数
        // [图标] 播放/静音图标由 textContent 改为 .alt class 切换（预渲染双态，无 DOM 重建抖动）
        updateDisplay() {
            const video = this.manager.video;
            const total = this.manager.totalVideos;
            const rawIndex = this.manager.currentVideoIndex;
            const hasIndex = rawIndex >= 0 && rawIndex < total;
            const displayIndex = hasIndex ? rawIndex + 1 : 0;
            const completedCount = hasIndex ? rawIndex : 0;

            const titleEl = this.panel.querySelector('#video-title'); // [R6]
            if (hasIndex && this.manager._currentVideoTitle) {
                titleEl.textContent = this.manager._currentVideoTitle;
            } else if (!video) {
                titleEl.textContent = '未连接播放器';
            } else {
                titleEl.textContent = '加载中...';
            }

            this.panel.querySelector('#video-index').textContent = `第 ${displayIndex}/${total} 个视频`; // [R6]
            this.panel.querySelector('#stat-completed').textContent = completedCount; // [R6]
            this.panel.querySelector('#stat-remaining').textContent = Math.max(0, total - completedCount); // [R6]
            this.panel.querySelector('#stat-percent').textContent = total > 0 ? ((completedCount / total) * 100).toFixed(0) + '%' : '0%'; // [R6]

            if (!video) {
                this.panel.querySelector('#status-dot').classList.add('stopped'); // [R6]
                this.panel.querySelector('#status-label').textContent = '未连接播放器'; // [R6]
                // [图标] 无播放器：显示 ▶（.icon-pair 第一态），去掉激活态
                this.panel.querySelector('#btn-play').classList.remove('alt'); // [R6]
                this.panel.querySelector('#btn-play').classList.remove('active'); // [R6]
                // [R7] 清空上一课残留的进度条/时间/百分比，保证监控数据准确
                this.panel.querySelector('#progress-fill').style.width = '0%';
                this.panel.querySelector('#current-time').textContent = '00:00';
                this.panel.querySelector('#total-time').textContent = '00:00';
                this.panel.querySelector('#progress-percent').textContent = '0%';
                return;
            }

            const currentTime = video.currentTime || 0;
            const duration = video.duration || 0;
            const progress = duration > 0 ? (currentTime / duration * 100) : 0;
            const isPaused = video.paused;

            const statusDot = this.panel.querySelector('#status-dot'); // [R6]
            const statusLabel = this.panel.querySelector('#status-label'); // [R6]
            const playBtn = this.panel.querySelector('#btn-play'); // [R6]

            if (this.manager.userStopped) {
                statusDot.classList.add('stopped');
                statusLabel.textContent = '已停止';
                playBtn.classList.remove('alt');   // [图标] ▶
                playBtn.classList.remove('active');
            } else if (isPaused) {
                statusDot.classList.add('stopped');
                statusLabel.textContent = '已暂停';
                playBtn.classList.remove('alt');   // [图标] ▶
                playBtn.classList.remove('active');
            } else {
                statusDot.classList.remove('stopped');
                statusLabel.textContent = '运行中';
                playBtn.classList.add('alt');      // [图标] ⏸
                playBtn.classList.add('active');
            }

            this.panel.querySelector('#progress-fill').style.width = progress + '%'; // [R6]
            this.panel.querySelector('#current-time').textContent = this.manager.formatTime(currentTime); // [R6]
            this.panel.querySelector('#total-time').textContent = this.manager.formatTime(duration); // [R6]
            this.panel.querySelector('#progress-percent').textContent = progress.toFixed(0) + '%'; // [R6]

            const muteBtn = this.panel.querySelector('#btn-mute'); // [R6]
            muteBtn.classList.toggle('alt', video.muted);     // [图标] 静音↔有声
            muteBtn.classList.toggle('active', video.muted);
        }

        // [②] 补齐：清 timer + 移除 document 级拖拽监听 + 移除容器
        destroy() {
            if (this.updateTimer) { clearInterval(this.updateTimer); this.updateTimer = null; }
            if (this._onPointerMove) {
                document.removeEventListener('pointermove', this._onPointerMove);
                this._onPointerMove = null;
            }
            if (this._onPointerEnd) {
                document.removeEventListener('pointerup', this._onPointerEnd);
                document.removeEventListener('pointercancel', this._onPointerEnd);
                this._onPointerEnd = null;
            }
            this._clampToken++; // 使挂起的 clamp setTimeout 因 token 不匹配而失效
            document.getElementById('aes-panel-container')?.remove();
            this.panel = null;
        }
    }

    // ==================== 核心管理类 ====================
    class AutoPlayManager {
        constructor() {
            this.video = null;
            this.isPlaying = false;
            this.isCompleted = false;
            this.checkTimer = null;
            this.currentVideoIndex = -1;
            this.totalVideos = 0;
            this.panel = null;
            this.observer = null;
            this.userStopped = false;
            this._videoHandlers = null;
            this._retryTimer = null;
            this._retryCount = 0;
            this._videoItemsCache = null;
            this._videoItemsCacheTime = 0;
            this._currentVideoTitle = '';
            this._errRetry = 0;
            this._nextRetry = 0; // [⑪] 目录未加载重试计数
            // [R3][R4][R5] 定时器统一句柄化：句柄登记
            this._nextTimer = null;      // 连播定时器
            this._dirRetryTimer = null;  // 目录重试定时器
            this._startTimer = null;     // 启动等待定时器
            this._routeTimer = null;     // 路由延迟初始化定时器
            this._errTimer = null;       // 错误重连定时器
            this.init();
        }

        init() {
            log('AES智能云上刷课助手 v1.0.120 [开发灰度预览版] 启动', 'info');
            const savedRate = Number(GM_getValue('playbackRate'));
            if (Number.isFinite(savedRate) && savedRate >= 0.25 && savedRate <= 16) {
                CONFIG.playbackRate = savedRate;
            }
            const savedMute = GM_getValue('autoMute');
            if (savedMute !== undefined) CONFIG.autoMute = !!savedMute;
            this.registerMenuCommands();
            if (CONFIG.enableBackgroundPlay) this.setupAntiPause();
            this.setupRouteListener();
            this.panel = new ControlPanel(this);
            this.tryInitPlayer();
        }

        registerMenuCommands() {
            GM_registerMenuCommand('开始/暂停', this.togglePlay.bind(this));
            GM_registerMenuCommand('下一课', this.playNextVideo.bind(this));
            GM_registerMenuCommand('查看进度', this.showProgress.bind(this));
        }

        setupAntiPause() {
            try {
                Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
                Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            } catch (e) {}
            const forcePlay = () => {
                if (this.userStopped) return;
                if (this.video && this.isPlaying && this.video.paused && !this.video.ended) {
                    this.video.play().catch(() => {});
                }
            };
            document.addEventListener('visibilitychange', forcePlay);
            window.addEventListener('blur', forcePlay);
            document.addEventListener('mouseleave', forcePlay);
        }

        setupRouteListener() {
            let lastHash = location.hash;
            window.addEventListener('hashchange', () => {
                if (location.hash !== lastHash) {
                    lastHash = location.hash;
                    log('页面切换: ' + location.hash, 'info');
                    this.onRouteChange();
                }
            });
        }

        resetPlayerState() {
            if (this.checkTimer) { clearInterval(this.checkTimer); this.checkTimer = null; }
            if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
            // [R3][R4][R5] 统一清理所有已纳管定时器，防止停止/切集后被旧回调劫持
            if (this._nextTimer) { clearTimeout(this._nextTimer); this._nextTimer = null; }
            if (this._dirRetryTimer) { clearTimeout(this._dirRetryTimer); this._dirRetryTimer = null; }
            if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
            if (this._routeTimer) { clearTimeout(this._routeTimer); this._routeTimer = null; }
            if (this._errTimer) { clearTimeout(this._errTimer); this._errTimer = null; }
            this._retryCount = 0;
            this._errRetry = 0;
            if (this.observer) {
                try { this.observer.disconnect(); } catch (e) {}
                this.observer = null;
            }
            this.removeVideoEvents();
            this.video = null;
            this.isPlaying = false;
            this.isCompleted = false;
        }

        onRouteChange() {
            this.resetPlayerState();
            this.currentVideoIndex = -1;
            this._nextRetry = 0; // [⑪]
            this.invalidateVideoItemsCache();
            // [R5] 路由延迟初始化定时器句柄化（旧句柄已由 resetPlayerState 统一清理，不加 token）
            this._routeTimer = setTimeout(() => {
                this.updateCurrentVideoIndex();
                this.tryInitPlayer();
            }, 2000);
        }

        // [P12] 1 秒 TTL 缓存，避免每 500ms 全量查询
        getAllVideoItems() {
            const now = Date.now();
            if (this._videoItemsCache && (now - this._videoItemsCacheTime) < 1000) {
                return this._videoItemsCache;
            }
            this._videoItemsCache = Array.from(document.querySelectorAll('ul.ant-list-items > div > a'));
            this._videoItemsCacheTime = now;
            return this._videoItemsCache;
        }

        invalidateVideoItemsCache() {
            this._videoItemsCache = null;
            this._videoItemsCacheTime = 0;
        }

        // [④] 正则排除 ? 与 #，避免 URL 尾部 query 污染视频 ID
        getCurrentVideoId() {
            const match = location.hash.match(/#\/video\/([^/?#]+)/);
            return match ? match[1] : null;
        }

        // [④][总进度冻结] 先重置再精确匹配 + 宽松降级，避免 currentVideoIndex 冻死
        updateCurrentVideoIndex() {
            this.invalidateVideoItemsCache();
            const videoItems = this.getAllVideoItems();
            const currentId = this.getCurrentVideoId();
            this.totalVideos = videoItems.length;

            // 1) 先重置，匹配不到就明确"未定位"，不再保持旧值装死
            this.currentVideoIndex = -1;

            if (currentId) {
                // 2) 精确匹配优先：#/video/<id> 段完全相等（后面可跟 ? # 或字符串结尾）
                const esc = currentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exact = new RegExp('#\\/video\\/' + esc + '(?:[?#]|$)');
                let found = -1;
                for (let i = 0; i < videoItems.length; i++) {
                    const href = videoItems[i].getAttribute('href') || '';
                    if (exact.test(href)) { found = i; break; } // break：取第一个精确匹配
                }
                // 3) 降级：宽松 includes（兼容 href 格式与 hash 不完全一致）
                if (found === -1) {
                    for (let i = 0; i < videoItems.length; i++) {
                        const href = videoItems[i].getAttribute('href') || '';
                        if (href.includes(currentId)) { found = i; break; }
                    }
                }
                this.currentVideoIndex = found;
            }

            this._currentVideoTitle = (this.currentVideoIndex >= 0 && videoItems[this.currentVideoIndex])
                ? (videoItems[this.currentVideoIndex].textContent?.trim().split('时长')[0] || '')
                : '';
            log(`当前视频索引: ${this.currentVideoIndex + 1}/${this.totalVideos}`, 'info');
        }

        // [③][P10] 防 observer 累积 + findVideo 只调用一次 + 僵尸元素校验
        tryInitPlayer() {
            if (!location.hash.includes('/video/')) return;
            if (this.observer) {
                try { this.observer.disconnect(); } catch (e) {}
                this.observer = null;
            }
            log('正在查找视频播放器...', 'info');

            const isValid = (el) => {
                if (!el) return false;
                const doc = el.ownerDocument;
                return !!(doc && doc.body && doc.body.contains(el));
            };

            const findVideo = () => {
                let v = document.querySelector('#CuPlayer video')
                     || document.querySelector('.vjs-tech')
                     || document.querySelector('video');
                if (v && !isValid(v)) v = null;
                if (!v) {
                    try {
                        const iframes = document.querySelectorAll('iframe');
                        for (let iframe of iframes) {
                            if (iframe.contentDocument) {
                                const cand = iframe.contentDocument.querySelector('video');
                                if (cand && isValid(cand)) { v = cand; break; }
                            }
                        }
                    } catch (e) {}
                }
                return v;
            };

            const v0 = findVideo();
            if (v0) {
                this.video = v0;
                this.onPlayerReady();
                return;
            }

            const obs = new MutationObserver(() => {
                const v = findVideo();
                if (v) {
                    try { obs.disconnect(); } catch (e) {}
                    if (this.observer === obs) this.observer = null;
                    this.video = v;
                    this.onPlayerReady();
                }
            });
            this.observer = obs;
            obs.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                if (this.observer === obs) {
                    try { obs.disconnect(); } catch (e) {}
                    this.observer = null;
                    if (!this.video) log('未找到视频播放器(超时)', 'error');
                }
            }, 15000);
        }

        onPlayerReady() {
            log('视频播放器已就绪', 'success');
            this.updateCurrentVideoIndex();
            this.lockPlaybackRate(this.video);
            if (CONFIG.autoMute) this.video.muted = true;
            this.setupVideoEvents();
            // [R5] 启动等待定时器句柄化，防止陈旧回调重复启动（时序不变）
            this._startTimer = setTimeout(() => this.startAutoPlay(), CONFIG.startWaitTime);
        }

        // [②][⑥] 倍速防护锁：管住脚本管控的 video，放过其他 video；原型锁只装一次
        lockPlaybackRate(videoElement) {
            videoElement._aes_managed = true;
            if (!_protoLocked) {
                try {
                    _nativePlaybackRateDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
                    const nativeGet = _nativePlaybackRateDesc.get;
                    const nativeSet = _nativePlaybackRateDesc.set;
                    Object.defineProperty(HTMLVideoElement.prototype, 'playbackRate', {
                        get: function() {
                            if (this._aes_managed === true) {
                                return this._aes_rate !== undefined ? this._aes_rate : CONFIG.playbackRate;
                            }
                            return nativeGet.call(this);
                        },
                        set: function(val) {
                            if (this._aes_managed === true) {
                                if (this._aes_setting) {
                                    this._aes_rate = val;
                                    this._aes_setting = false;
                                } else {
                                    this._aes_rate = CONFIG.playbackRate;
                                }
                                nativeSet.call(this, this._aes_rate);
                            } else {
                                nativeSet.call(this, val);
                            }
                        },
                        configurable: true
                    });
                    _protoLocked = true;
                    log('已启用倍速防护锁: ' + CONFIG.playbackRate + 'x', 'success');
                } catch (e) {
                    log('原型锁安装失败，使用事件兜底', 'warn');
                }
            }
            videoElement._aes_setting = true;
            videoElement.playbackRate = CONFIG.playbackRate;
        }

        applyPlaybackRate() {
            if (this.video) {
                this.video._aes_setting = true;
                this.video.playbackRate = CONFIG.playbackRate;
            }
        }

        removeVideoEvents() {
            if (!this._videoHandlers) return;
            const { video, handlers } = this._videoHandlers;
            try {
                video.removeEventListener('play', handlers.play);
                video.removeEventListener('pause', handlers.pause);
                video.removeEventListener('ended', handlers.ended);
                video.removeEventListener('error', handlers.error);
                video.removeEventListener('ratechange', handlers.ratechange);
            } catch (e) {}
            this._videoHandlers = null;
        }

        setupVideoEvents() {
            if (!this.video) return;
            this.removeVideoEvents();
            const video = this.video;
            const handlers = {
                play: () => {
                    this.isPlaying = true;
                    this._errRetry = 0;
                },
                pause: () => {
                    if (!this.video || this.video !== video) return;
                    if (this.userStopped) return;
                    if (!video.ended && this.isPlaying) {
                        setTimeout(() => {
                            if (this.video === video && video.paused && !video.ended && !this.userStopped) {
                                video.play().catch(() => {});
                            }
                        }, 300);
                    }
                },
                ended: () => this.onVideoEnded(),
                error: () => {
                    // [④] 错误重连：次数上限 + 指数退避
                    if (!this.video || this.video !== video) return;
                    this._errRetry = (this._errRetry || 0) + 1;
                    if (this._errRetry > 5) {
                        // [R2] 仅首次超限通知一次，并掐断 checkVideoStatus 的重试驱动，杜绝通知风暴
                        if (this._errRetry === 6) {
                            log('视频源重连失败次数达上限，停止重试', 'error');
                            notify('播放中断', '重连超过 5 次已停止，请检查视频源');
                            this.isPlaying = false;
                        }
                        return;
                    }
                    const delay = Math.min(3000 * Math.pow(1.5, this._errRetry - 1), 30000);
                    log(`视频播放错误，${Math.round(delay / 1000)}秒后尝试第 ${this._errRetry} 次重连`, 'warn');
                    // [R3/R4/R5 定时器家族] 重连定时器句柄化 + userStopped 守卫，防止停止后被旧回调复活播放
                    if (this._errTimer) clearTimeout(this._errTimer);
                    this._errTimer = setTimeout(() => {
                        if (this.userStopped) return;
                        if (this.video === video) {
                            try { video.load(); } catch (e) {}
                            video.play().catch(() => {});
                        }
                    }, delay);
                },
                // [⑥] ratechange 无条件兜底
                ratechange: () => {
                    if (this.video !== video) return;
                    const realRate = _nativePlaybackRateDesc
                        ? _nativePlaybackRateDesc.get.call(video)
                        : video.playbackRate;
                    if (Math.abs(realRate - CONFIG.playbackRate) > 0.01) {
                        log('检测到速率被外部篡改，自动扳回 ' + CONFIG.playbackRate + 'x', 'warn');
                        video._aes_setting = true;
                        video.playbackRate = CONFIG.playbackRate;
                    }
                }
            };
            this._videoHandlers = { video, handlers };
            video.addEventListener('play', handlers.play);
            video.addEventListener('pause', handlers.pause);
            video.addEventListener('ended', handlers.ended);
            video.addEventListener('error', handlers.error);
            video.addEventListener('ratechange', handlers.ratechange);
        }

        // [③] 自动播放失败不再静默死亡：第二次失败后进入自愈模式
        startAutoPlay() {
            if (this.userStopped) return;
            if (!this.video) { this.tryInitPlayer(); return; }
            this.applyPlaybackRate();
            if (CONFIG.autoMute) this.video.muted = true;
            const total = this.getAllVideoItems().length;
            const idx = this.currentVideoIndex >= 0 ? this.currentVideoIndex + 1 : 0;
            const onSuccess = (muted) => {
                this.isPlaying = true;
                this._errRetry = 0;
                this.startStatusCheck();
                notify('刷课已开始' + (muted ? '(静音)' : ''), `第 ${idx}/${total} 个视频`);
            };
            this.video.play().then(() => onSuccess(false)).catch(err => {
                log('自动播放失败，强制静音重试: ' + err.message, 'warn');
                if (!this.video) return;
                this.video.muted = true;
                this.video.play().then(() => onSuccess(true)).catch(err2 => {
                    log('自动播放两次失败，进入自愈模式（等待用户交互或切页触发恢复）: ' + err2.message, 'warn');
                    this.isPlaying = true;
                    this.startStatusCheck();
                });
            });
        }

        stopAutoPlay() {
            this.userStopped = true;
            if (this.checkTimer) { clearInterval(this.checkTimer); this.checkTimer = null; }
            if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
            // [R3][R4][R5] 统一清理：停止后所有未决定时器一律作废，防止旧回调劫持
            if (this._nextTimer) { clearTimeout(this._nextTimer); this._nextTimer = null; }
            if (this._dirRetryTimer) { clearTimeout(this._dirRetryTimer); this._dirRetryTimer = null; }
            if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
            if (this._routeTimer) { clearTimeout(this._routeTimer); this._routeTimer = null; }
            if (this._errTimer) { clearTimeout(this._errTimer); this._errTimer = null; }
            this._retryCount = 0;
            this._errRetry = 0;
            if (this.video) this.video.pause();
            this.isPlaying = false;
            notify('刷课已停止', '脚本已暂停运行，点击 ▶ 可恢复');
        }

        // [P7] 面板暂停键 = 脚本启停开关
        // [R1] 修复死锁：userStopped 与运行态分支互斥，恢复路径重新可达
        togglePlay() {
            if (this.userStopped) {
                this.userStopped = false;
                this.startAutoPlay();
            } else {
                this.stopAutoPlay();
            }
        }

        toggleMute() {
            if (!this.video) return;
            this.video.muted = !this.video.muted;
            CONFIG.autoMute = this.video.muted;
            GM_setValue('autoMute', CONFIG.autoMute);
        }

        setSpeed(speed) {
            CONFIG.playbackRate = speed;
            GM_setValue('playbackRate', speed);
            this.applyPlaybackRate();
            notify('速度已设置', `播放速度: ${speed}x`);
        }

        startStatusCheck() {
            if (this.checkTimer) clearInterval(this.checkTimer);
            this.checkTimer = setInterval(() => this.checkVideoStatus(), CONFIG.checkInterval);
        }

        checkVideoStatus() {
            if (this.userStopped) return;
            if (!this.video) { this.tryInitPlayer(); return; }
            if (this.video.paused && !this.video.ended && this.isPlaying) this.video.play().catch(() => {});
        }

        onVideoEnded() {
            if (this.isCompleted) return;
            if (this.userStopped) return;
            this.isCompleted = true;
            log('视频播放完成！', 'success');
            const total = this.getAllVideoItems().length;
            const idx = this.currentVideoIndex >= 0 ? this.currentVideoIndex + 1 : 0;
            notify('课程已完成', `第 ${idx}/${total} 个视频播放完成`);
            if (this.checkTimer) { clearInterval(this.checkTimer); this.checkTimer = null; }
            // [R3] 连播定时器句柄化 + userStopped 守卫：正常连播时序与 DP4 完全一致，停止后不再被劫持
            this._nextTimer = setTimeout(() => {
                if (this.userStopped) return;
                this.playNextVideo();
            }, CONFIG.nextVideoDelay);
        }

        // [②] 切集后有限重试初始化播放器
        schedulePlayerInit() {
            if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
            this._retryCount = 0;
            const attempt = () => {
                if (this.video) { this._retryTimer = null; return; }
                this._retryCount++;
                this.updateCurrentVideoIndex();
                this.tryInitPlayer();
                if (this._retryCount < 10) {
                    this._retryTimer = setTimeout(attempt, 1500);
                } else {
                    this._retryTimer = null;
                    log('播放器初始化失败（已重试 ' + this._retryCount + ' 次）', 'error');
                }
            };
            this._retryTimer = setTimeout(attempt, 1500);
        }

        // [⑪] 目录未加载时轻量重试
        playNextVideo() {
            this.updateCurrentVideoIndex();
            const videoItems = this.getAllVideoItems();
            if (videoItems.length === 0) {
                this._nextRetry = (this._nextRetry || 0) + 1;
                if (this._nextRetry > 10) {
                    this._nextRetry = 0;
                    notify('切换失败', '课程目录未加载，已重试 10 次');
                    return;
                }
                log(`目录未加载，${1.5}秒后第 ${this._nextRetry} 次重试`, 'warn');
                // [R4] 目录重试定时器句柄化 + userStopped 守卫：重试节奏不变，停止后让路
                this._dirRetryTimer = setTimeout(() => {
                    if (this.userStopped) return;
                    this.playNextVideo();
                }, 1500);
                return;
            }
            this._nextRetry = 0;
            const nextIndex = this.currentVideoIndex + 1;
            if (nextIndex >= videoItems.length) {
                notify('🎉 刷课完成！', '所有视频已播放完毕');
                return;
            }
            const nextVideo = videoItems[nextIndex];
            const videoName = nextVideo.textContent?.trim().split('时长')[0] || `第${nextIndex + 1}个视频`;
            let currentHash = location.hash;
            // 【双保险切课：点击 + 500ms 后强制 hash 跳转，未做改动】
            nextVideo.click();
            setTimeout(() => {
                if (location.hash === currentHash) {
                    const href = nextVideo.getAttribute('href');
                    if (href) {
                        log('点击切换失效，执行强制Hash跳转', 'warn');
                        location.hash = href;
                    }
                }
            }, 500);
            notify('切换视频', `正在播放: ${videoName}`);
            this.userStopped = false;
            this.resetPlayerState();
            this.schedulePlayerInit();
        }

        // [⑪][R4] 与 playNextVideo 保持一致的目录重试
        playPrevVideo() {
            this.updateCurrentVideoIndex();
            const videoItems = this.getAllVideoItems();
            if (videoItems.length === 0) {
                this._nextRetry = (this._nextRetry || 0) + 1;
                if (this._nextRetry > 10) {
                    this._nextRetry = 0;
                    notify('切换失败', '课程目录未加载，已重试 10 次');
                    return;
                }
                // [R4] 句柄化 + userStopped 守卫
                this._dirRetryTimer = setTimeout(() => {
                    if (this.userStopped) return;
                    this.playPrevVideo();
                }, 1500);
                return;
            }
            this._nextRetry = 0;
            const prevIndex = this.currentVideoIndex - 1;
            if (prevIndex < 0) {
                notify('提示', '已经是第一个视频了');
                return;
            }
            const prevVideo = videoItems[prevIndex];
            let currentHash = location.hash;
            prevVideo.click();
            setTimeout(() => {
                if (location.hash === currentHash) {
                    const href = prevVideo.getAttribute('href');
                    if (href) location.hash = href;
                }
            }, 500);
            this.userStopped = false;
            this.resetPlayerState();
            this.schedulePlayerInit();
        }

        // [R8] 去除冗余目录查询（updateCurrentVideoIndex 内部已刷新 totalVideos）；
        // 未定位时以 0 显示，避免异常集数
        showProgress() {
            this.updateCurrentVideoIndex();
            const current = Math.max(0, this.currentVideoIndex + 1);
            const total = this.totalVideos;
            const percent = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
            let timeInfo = this.video
                ? `\n当前: ${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`
                : '';
            notify('当前进度', `第 ${current}/${total} 个视频 (${percent}%)${timeInfo}`);
        }

        formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '00:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return h > 0
                ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }

    // ==================== 启动 ====================
    if (document.readyState === 'complete') {
        new AutoPlayManager();
    } else {
        window.addEventListener('load', () => new AutoPlayManager());
    }
})();
