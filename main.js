/* main.js - みんなで育てる友情の木 メイン画面ロジック */

const treeApp = {
    // 設定値
    config: {
        apiUrl: null, // F-11: API URL (ローカルストレージから読み込む)
        pollingInterval: 30000, // F-04: ポーリング間隔 (初期値30秒, 設定で上書き)
        stages: [], // F-10: 成長段階の閾値
        images: [], // F-10: 各段階の画像URL/ID
        environments: [], // F-02: 背景環境要素（画像URLなど）
        language: 'ja', // F-12: デフォルト言語
        milestones: {}, // F-03: マイルストーン設定 { stageIndex: { title_ja: "...", message_ja: "...", title_en: "...", message_en: "..." } }
        debugMode: false, // デバッグ情報表示用
    },
    // 状態変数
    state: {
        currentTotalValue: 0,
        currentStage: 0,
        lastTotalValue: 0, // 前回ポーリング時の値 (差分表示用)
        isInitialLoad: true,
        pollingTimer: null,
        isLoading: false,
        activeImageIndex: -1, // アニメーション用
        animationTimeout: null,
        isAnimating: false,
        retryCount: 0, // F-07: 画像読み込みリトライ
        maxRetry: 3,
        lastError: null, // F-06: 最後のエラー情報
        statsData: null, // F-13: 統計データ
    },
    // DOM要素キャッシュ
    elements: {
        loading: null,
        errorMessage: null,
        errorDetails: null,
        errorSuggestion: null,
        retryButton: null,
        appContainer: null,
        stageDisplay: null,
        totalValueDisplay: null,
        progressBar: null,
        progressText: null,
        recentProgress: null, // F-01
        treeContainer: null,
        treeImageWrapper: null,
        environmentBackground: null, // F-02
        realtimeNotice: null, // F-03
        milestoneMessage: null, // F-03
        milestoneTitle: null,
        milestoneBody: null,
        closeMilestoneButton: null,
        langSelect: null, // F-12
        usageStatsSection: null, // F-13
        usageStatsContent: null, // F-13
        adminLink: null,
    },
    // 国際化(i18n)文字列
    i18n: {
        ja: {
            appTitle: "みんなで育てる友情の木",
            appDescription: "クラスの友達との交流回数に応じて成長する友情の木のWebアプリケーションです。",
            mainHeader: "みんなで育てる友情の木",
            langSelectLabel: "言語選択",
            loadingMessage: "データを読み込み中...",
            errorTitle: "エラーが発生しました",
            errorSuggestionDefault: "時間をおいて再読み込みするか、管理者に連絡してください。",
            retryButton: "再試行",
            currentStageLabel: "現在の成長段階:",
            totalInteractionsLabel: "累計交流回数:",
            progressLabel: "次の段階への進捗",
            progressNextStage: "次の段階まであと {remaining} 回",
            progressMaxStage: "最大段階に到達！",
            recentProgressText: "前回から {diff} 回の交流がありました！",
            treeImageAlt: "友情の木の現在の画像",
            milestoneDefaultTitle: "おめでとう！",
            milestoneDefaultMessage: "新たな段階に到達しました！",
            closeButton: "閉じる",
            usageStatsTitle: "利用統計 (簡易)",
            loadingStats: "統計データを読み込み中...",
            statsFetchError: "統計データの取得に失敗しました。",
            adminLink: "設定",
            errorApiUrlNotSet: "API URLが設定されていません。管理画面で設定してください。",
            errorFetchFailed: "サーバーとの通信に失敗しました ({status})。",
            errorDataFormat: "サーバーから受信したデータの形式が正しくありません。",
            errorImageConfigNotFound: "現在の段階 ({stage}) の画像設定が見つかりません。",
            errorImageLoadFailed: "画像 ({url}) の読み込みに失敗しました。",
            errorConfigLoadFailed: "設定情報の読み込みに失敗しました。デフォルト設定で試行します。",
            errorStatsLoadFailed: "統計情報の読み込みに失敗しました。",
        },
        en: {
            appTitle: "Our Friendship Tree",
            appDescription: "A web application showing a friendship tree that grows based on the number of interactions between classmates.",
            mainHeader: "Our Friendship Tree",
            langSelectLabel: "Select Language",
            loadingMessage: "Loading data...",
            errorTitle: "An Error Occurred",
            errorSuggestionDefault: "Please try reloading after a while or contact the administrator.",
            retryButton: "Retry",
            currentStageLabel: "Current Stage:",
            totalInteractionsLabel: "Total Interactions:",
            progressLabel: "Progress to next stage",
            progressNextStage: "{remaining} more interactions to the next stage",
            progressMaxStage: "Reached the final stage!",
            recentProgressText: "{diff} interactions since last update!",
            treeImageAlt: "Current image of the friendship tree",
            milestoneDefaultTitle: "Congratulations!",
            milestoneDefaultMessage: "You've reached a new stage!",
            closeButton: "Close",
            usageStatsTitle: "Usage Statistics (Simple)",
            loadingStats: "Loading statistics...",
            statsFetchError: "Failed to fetch statistics.",
            adminLink: "Settings",
            errorApiUrlNotSet: "API URL is not configured. Please set it in the admin panel.",
            errorFetchFailed: "Failed to communicate with the server ({status}).",
            errorDataFormat: "Received invalid data format from the server.",
            errorImageConfigNotFound: "Image configuration not found for the current stage ({stage}).",
            errorImageLoadFailed: "Failed to load image ({url}).",
            errorConfigLoadFailed: "Failed to load configuration. Trying with default settings.",
             errorStatsLoadFailed: "Failed to load statistics.",
        },
    },

    /**
     * 初期化処理
     */
    init: function() {
        // DOM要素をキャッシュ
        this.elements.loading = document.getElementById('loading');
        this.elements.errorMessage = document.getElementById('error-message');
        this.elements.errorDetails = document.getElementById('error-details');
        this.elements.errorSuggestion = document.getElementById('error-suggestion');
        this.elements.retryButton = document.getElementById('retry-button');
        this.elements.appContainer = document.getElementById('app-container');
        this.elements.stageDisplay = document.getElementById('stage-display');
        this.elements.totalValueDisplay = document.getElementById('total-value-display');
        this.elements.progressBar = document.getElementById('progress-bar');
        this.elements.progressText = document.getElementById('progress-text');
        this.elements.recentProgress = document.getElementById('recent-progress');
        this.elements.treeContainer = document.getElementById('tree-container');
        this.elements.treeImageWrapper = document.getElementById('tree-image-wrapper');
        this.elements.environmentBackground = document.getElementById('environment-background');
        this.elements.realtimeNotice = document.getElementById('realtime-notice');
        this.elements.milestoneMessage = document.getElementById('milestone-message');
        this.elements.milestoneTitle = document.getElementById('milestone-title');
        this.elements.milestoneBody = document.getElementById('milestone-body');
        this.elements.closeMilestoneButton = document.getElementById('close-milestone');
        this.elements.langSelect = document.getElementById('lang-select');
        this.elements.usageStatsSection = document.getElementById('usage-stats-section');
        this.elements.usageStatsContent = document.getElementById('usage-stats-content');
        this.elements.adminLink = document.querySelector('.admin-link');

        console.log("Tree App Initializing...");

        // F-11: ローカルストレージからAPI URLを取得
        // N-03: セキュリティリスク: ローカルストレージはXSS攻撃に対して脆弱。
        // 将来的にサーバーサイド設定や認証トークン方式への移行を検討すべき。
        this.config.apiUrl = localStorage.getItem('treeAppApiUrl');

        if (!this.config.apiUrl) {
            this.showError('errorApiUrlNotSet');
            return; // API URLがなければ処理中断
        }
        console.log(`API URL loaded: ${this.config.apiUrl}`);

        // F-12: 言語設定
        const savedLang = localStorage.getItem('treeAppLang') || 'ja';
        this.config.language = savedLang;
        this.elements.langSelect.value = savedLang;
        this.updateLanguageUI();
        this.elements.langSelect.addEventListener('change', (e) => {
            this.setLanguage(e.target.value);
        });

        // イベントリスナー設定
        this.elements.retryButton.addEventListener('click', () => this.retryFetch());
        this.elements.closeMilestoneButton.addEventListener('click', () => this.hideMilestoneMessage());
        this.elements.usageStatsSection.addEventListener('toggle', (event) => {
             if (event.target.open && !this.state.statsData) {
                 this.fetchStatsData();
             }
        });

        // N-06: キーボード操作対応 (基本的なフォーカス移動はブラウザが担う)
        // 必要に応じてカスタム要素に tabindex や keydown イベントを追加
        this.elements.adminLink.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // デフォルトのスペース挙動を抑制
                window.location.href = this.elements.adminLink.href;
            }
        });
        this.elements.closeMilestoneButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.hideMilestoneMessage();
            }
        });

        // F-10: 設定情報を取得してからデータ取得開始
        this.loadConfig().then(() => {
            this.fetchData(true); // 初回データ取得
            // F-04: ポーリング開始
            this.startPolling();
        }).catch(error => {
            console.error("Initialization failed:", error);
            // 設定取得失敗でも、デフォルトで動かせるなら動かす
            this.showError('errorConfigLoadFailed', error.message);
            this.fetchData(true);
            this.startPolling();
        });
    },

    /**
     * 指定された言語にUIを更新する (F-12)
     */
    updateLanguageUI: function() {
        const lang = this.config.language;
        document.documentElement.lang = lang; // htmlタグのlang属性を更新
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (this.i18n[lang] && this.i18n[lang][key]) {
                if (el.tagName === 'TITLE' || el.tagName === 'META') {
                     el.content = this.i18n[lang][key]; // content属性の場合
                } else if (el.tagName === 'IMG' || el.tagName === 'DIV' && el.getAttribute('role') === 'img') {
                     el.setAttribute('aria-label', this.i18n[lang][key]); // aria-labelの場合
                }
                 else {
                     el.textContent = this.i18n[lang][key]; // textContentの場合
                }
            } else {
                 console.warn(`Missing i18n key: ${key} for lang: ${lang}`);
            }
        });
        // エラーメッセージやプログレスバーのテキストなど、動的に生成される部分も更新
        if (this.state.lastError) {
             this.showError(this.state.lastError.key, this.state.lastError.details, true);
        }
        this.updateProgressDisplay(this.state.currentTotalValue, this.state.currentStage);
        // 統計セクションのタイトルなども更新
        const statsSummary = this.elements.usageStatsSection.querySelector('summary');
        if(statsSummary) statsSummary.textContent = this.getText('usageStatsTitle');
    },

    /**
     * 言語を設定し、UIを更新、ローカルストレージに保存 (F-12)
     * @param {string} lang - 'ja' or 'en'
     */
    setLanguage: function(lang) {
        if (this.i18n[lang]) {
            this.config.language = lang;
            localStorage.setItem('treeAppLang', lang); // 言語設定を保存
            this.updateLanguageUI();
            console.log(`Language changed to: ${lang}`);
            // 必要であれば統計データ等も再取得/再描画
            if (this.elements.usageStatsSection.open && this.state.statsData) {
                 this.displayStatsData(); // 表示のみ更新
            }
        }
    },

    /**
     * 国際化されたテキストを取得 (F-12)
     * @param {string} key - i18nキー
     * @param {object} params - 埋め込みパラメータ (例: { remaining: 10 })
     * @returns {string} - 対応する言語のテキスト
     */
    getText: function(key, params = {}) {
        const lang = this.config.language;
        let text = (this.i18n[lang] && this.i18n[lang][key]) ? this.i18n[lang][key] : key;
        // パラメータ置換
        for (const p in params) {
            text = text.replace(`{${p}}`, params[p]);
        }
        return text;
    },

    /**
     * サーバーから設定情報を取得 (F-10)
     * @returns {Promise}
     */
    loadConfig: async function() {
        console.log("Loading config...");
        this.showLoading();
        try {
            const response = await fetch(`${this.config.apiUrl}?action=getConfig`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const configData = await response.json();

            if (configData.error) {
                 throw new Error(`Server error: ${configData.error}`);
            }

            if (configData.stages && configData.images) {
                this.config.stages = configData.stages;
                this.config.images = configData.images;
                this.config.environments = configData.environments || []; // F-02 追加
                this.config.milestones = configData.milestones || {}; // F-03 追加
                this.config.pollingInterval = configData.pollingInterval || this.config.pollingInterval; // A-17
                this.config.language = configData.language || this.config.language; // A-18 (サーバー設定優先も考慮)
                this.config.debugMode = configData.debugMode || false; // A-16
                console.log("Config loaded successfully:", this.config);

                 // 言語設定がサーバーから取得された場合、UIを更新
                if (configData.language) {
                    this.elements.langSelect.value = this.config.language;
                    this.updateLanguageUI();
                }
                 // ポーリング間隔が変更されていたらタイマーを再設定
                if (configData.pollingInterval && this.state.pollingTimer) {
                     this.stopPolling();
                     this.startPolling();
                     console.log(`Polling interval updated to: ${this.config.pollingInterval}ms`);
                }

                this.hideError();
            } else {
                throw new Error(this.getText('errorDataFormat'));
            }
        } catch (error) {
            console.error("Failed to load config:", error);
            // デフォルト設定を使うなどのフォールバックは init で考慮
            throw error; // エラーを呼び出し元に伝える
        } finally {
            this.hideLoading();
        }
    },

    /**
     * サーバーから最新データを取得 (F-04)
     * @param {boolean} isInitial - 初回読み込みかどうか
     */
    fetchData: async function(isInitial = false) {
        if (this.state.isLoading) {
            console.log("Already loading data. Skipping fetch.");
            return;
        }
        console.log("Fetching data...");
        this.state.isLoading = true;
        if (isInitial) {
            this.showLoading();
        }
        this.hideError(); // 前のエラーをクリア

        try {
            const response = await fetch(`${this.config.apiUrl}?action=getData`);
            if (!response.ok) {
                throw new Error(this.getText('errorFetchFailed', { status: response.status }));
            }
            const data = await response.json();

            if (data.error) {
                 throw new Error(`Server error: ${data.error}`);
            }

            if (typeof data.totalValue !== 'number') {
                 throw new Error(this.getText('errorDataFormat'));
            }

            console.log("Data received:", data);
            const newTotalValue = data.totalValue;
            this.state.lastTotalValue = this.state.currentTotalValue; // 更新前に保持
            this.state.currentTotalValue = newTotalValue;

            const previousStage = this.state.currentStage;
            this.state.currentStage = this.calculateStage(newTotalValue);

            this.updateDisplay(newTotalValue, this.state.currentStage);

            // F-03: 成長アニメーションとマイルストーンチェック
            if (!isInitial && this.state.currentStage > previousStage) {
                 console.log(`Stage changed: ${previousStage} -> ${this.state.currentStage}`);
                 this.startGrowthAnimation(previousStage, this.state.currentStage);
                 this.checkMilestone(this.state.currentStage);
            } else {
                // アニメーションがない場合は直接表示
                this.displayImageForStage(this.state.currentStage);
            }

             // F-03: リアルタイム通知 (前回より値が増えていたら)
            if (!isInitial && newTotalValue > this.state.lastTotalValue) {
                 this.showRealtimeNotice();
                 this.showRecentProgress(newTotalValue - this.state.lastTotalValue);
            } else {
                 this.elements.recentProgress.style.display = 'none';
            }


            this.state.isInitialLoad = false;
            this.state.retryCount = 0; // 成功したのでリトライカウントリセット
            this.state.lastError = null; // エラー解消

        } catch (error) {
            console.error("Failed to fetch data:", error);
            this.showError('errorFetchFailed', error.message); // 適切なキーに修正必要かも
            this.state.lastError = { key: 'errorFetchFailed', details: error.message }; // F-06
            // エラー時もポーリングは継続する（サーバー復旧に備える）
        } finally {
            this.state.isLoading = false;
            this.hideLoading();
        }
    },

    /**
     * 統計データを取得 (F-13)
     */
     fetchStatsData: async function() {
         if (!this.config.apiUrl) return;
         console.log("Fetching stats data...");
         this.elements.usageStatsContent.innerHTML = `<p>${this.getText('loadingStats')}</p>`; // ローディング表示

         try {
             // action=getStats エンドポイントをGAS側に実装する必要がある (S-14)
             const response = await fetch(`${this.config.apiUrl}?action=getStats`);
             if (!response.ok) {
                 throw new Error(this.getText('errorFetchFailed', { status: response.status }));
             }
             const statsData = await response.json();

             if (statsData.error) {
                 throw new Error(`Server error: ${statsData.error}`);
             }

             this.state.statsData = statsData;
             this.displayStatsData();

         } catch (error) {
             console.error("Failed to fetch stats data:", error);
             this.elements.usageStatsContent.innerHTML = `<p class="error">${this.getText('statsFetchError')}</p>`;
         }
     },

    /**
     * 取得した統計データを表示 (F-13)
     */
    displayStatsData: function() {
        if (!this.state.statsData) return;
        this.elements.usageStatsContent.innerHTML = ''; // 内容クリア

        // TODO: ここで統計データを整形して表示する
        // 例: Chart.jsなどのライブラリを使ってグラフ表示
        // 要件定義書 A-19, F-13 にあるような情報を表示
        const { hourlyAccess, stageHistory } = this.state.statsData;

        // 仮の表示
        let html = `<h4>${this.getText('hourlyAccessTitle', '時間帯別アクセス (仮)')}</h4>`;
        if (hourlyAccess && Object.keys(hourlyAccess).length > 0) {
            html += '<ul>';
            for (const hour in hourlyAccess) {
                html += `<li>${hour}:00 - ${hour+1}:00 : ${hourlyAccess[hour]} ${this.getText('accessCountUnit', 'アクセス')}</li>`;
            }
            html += '</ul>';
        } else {
            html += `<p>${this.getText('noDataAvailable', 'データがありません')}</p>`;
        }

        html += `<h4>${this.getText('stageHistoryTitle', '成長段階の履歴 (仮)')}</h4>`;
        if (stageHistory && stageHistory.length > 0) {
            html += '<ol>';
            stageHistory.forEach(item => {
                html += `<li>${new Date(item.timestamp).toLocaleString(this.config.language)}: ${this.getText('stageReached', '段階 {stage} に到達', {stage: item.stage})}</li>`;
            });
            html += '</ol>';
        } else {
            html += `<p>${this.getText('noDataAvailable', 'データがありません')}</p>`;
        }

        // TODO: Chart.jsなどでグラフを描画する場合はここで行う
        // 例: <canvas id="hourlyChart"></canvas> をHTMLに追加し、ここで描画

        this.elements.usageStatsContent.innerHTML = html;
    },


    /**
     * 累計値から現在の成長段階を計算
     * @param {number} totalValue - 累計交流回数
     * @returns {number} - 現在の成長段階 (0から始まるインデックス)
     */
    calculateStage: function(totalValue) {
        if (!this.config.stages || this.config.stages.length === 0) {
            return 0; // 設定がない場合は常に段階0
        }
        let currentStage = 0;
        // stages 配列は [閾値1, 閾値2, ...] となっている想定
        // 段階0: 0 <= value < 閾値1
        // 段階1: 閾値1 <= value < 閾値2
        // ...
        for (let i = 0; i < this.config.stages.length; i++) {
            if (totalValue >= this.config.stages[i]) {
                currentStage = i + 1;
            } else {
                break; // 閾値を超えなかったらループ終了
            }
        }
        // 最大段階を超えないように調整
        const maxStageIndex = this.config.images.length - 1;
        return Math.min(currentStage, maxStageIndex);
    },

    /**
     * 画面表示を更新 (F-01)
     * @param {number} totalValue - 累計交流回数
     * @param {number} stage - 現在の成長段階
     */
    updateDisplay: function(totalValue, stage) {
        this.elements.totalValueDisplay.textContent = totalValue;
        this.elements.stageDisplay.textContent = stage;
        this.updateProgressDisplay(totalValue, stage);
    },

    /**
     * プログレスバー表示を更新 (F-01)
     * @param {number} totalValue - 累計交流回数
     * @param {number} stage - 現在の成長段階
     */
     updateProgressDisplay: function(totalValue, stage) {
        const stages = this.config.stages;
        const maxStageIndex = this.config.images.length - 1; // 画像の数に基づいた最大段階

        if (!stages || stages.length === 0 || stage >= maxStageIndex) {
            // 設定がない、または最大段階に到達した場合
            this.elements.progressBar.value = 100;
            this.elements.progressBar.setAttribute('aria-valuenow', '100');
            this.elements.progressText.textContent = this.getText('progressMaxStage');
            return;
        }

        const currentStageThreshold = (stage === 0) ? 0 : stages[stage - 1];
        const nextStageThreshold = stages[stage]; // 次の段階の閾値

        if (typeof nextStageThreshold !== 'number') {
            // 次の段階の閾値が設定されていない場合 (最後の閾値の後)
             this.elements.progressBar.value = 100;
             this.elements.progressBar.setAttribute('aria-valuenow', '100');
             this.elements.progressText.textContent = this.getText('progressMaxStage'); // 実質最大段階
             return;
        }

        const range = nextStageThreshold - currentStageThreshold;
        const progressInRange = totalValue - currentStageThreshold;
        const percentage = (range > 0) ? Math.max(0, Math.min(100, (progressInRange / range) * 100)) : 0;
        const remaining = nextStageThreshold - totalValue;

        this.elements.progressBar.value = percentage;
        this.elements.progressBar.setAttribute('aria-valuenow', percentage.toFixed(0));
        this.elements.progressText.textContent = this.getText('progressNextStage', { remaining: remaining });
    },

    /**
    * 直近の進捗を表示 (F-01 追加)
    * @param {number} diff - 前回からの増加量
    */
    showRecentProgress: function(diff) {
        if (diff > 0) {
            this.elements.recentProgress.textContent = this.getText('recentProgressText', { diff });
            this.elements.recentProgress.style.display = 'block';
        } else {
            this.elements.recentProgress.style.display = 'none';
        }
    },


    /**
     * 指定された段階の画像を表示 (F-02)
     * @param {number} stageIndex - 表示する段階のインデックス
     */
    displayImageForStage: function(stageIndex) {
        if (this.state.isAnimating) return; // アニメーション中は表示変更しない

        const imageUrlOrId = this.getImageIdentifierForStage(stageIndex);
        const environmentUrl = this.getEnvironmentForStage(stageIndex); // F-02 背景取得

        if (!imageUrlOrId) {
            console.warn(`Image identifier not found for stage ${stageIndex}`);
            this.showError('errorImageConfigNotFound', { stage: stageIndex });
            this.elements.treeImageWrapper.innerHTML = ''; // 画像をクリア
            return;
        }

        // 背景を設定 (F-02)
        if (environmentUrl) {
             this.elements.environmentBackground.style.backgroundImage = `url('${environmentUrl}')`;
        } else {
             this.elements.environmentBackground.style.backgroundImage = 'none'; // 設定がなければクリア
        }


        // 現在表示されている画像があれば非表示にする
        const currentActiveImage = this.elements.treeImageWrapper.querySelector('.tree-image.active');
        if (currentActiveImage) {
            currentActiveImage.classList.remove('active');
        }

        // 新しい画像要素を作成または取得
        let newImage = this.elements.treeImageWrapper.querySelector(`img[data-stage='${stageIndex}']`);
        if (!newImage) {
            newImage = document.createElement('img');
            newImage.dataset.stage = stageIndex;
            newImage.classList.add('tree-image');
            newImage.alt = this.getText('treeImageAlt'); // N-06: 代替テキスト
             newImage.style.opacity = 0; // 最初は非表示
             newImage.style.visibility = 'hidden';
            this.elements.treeImageWrapper.appendChild(newImage);

            // F-07: 画像読み込みとエラー処理
            newImage.onload = () => {
                console.log(`Image for stage ${stageIndex} loaded: ${newImage.src}`);
                 // 読み込み完了後に active クラスを付与してフェードイン
                 requestAnimationFrame(() => {
                     newImage.classList.add('active');
                 });
                this.hideError(); // 画像読み込み成功したらエラー解除
            };
            newImage.onerror = () => {
                console.error(`Failed to load image for stage ${stageIndex}: ${newImage.src}`);
                this.showError('errorImageLoadFailed', { url: newImage.src });
                 // TODO: F-07 リトライ処理や代替画像表示
                 newImage.src = this.getWhitePixel(); // 真っ白な画像を表示
                 newImage.classList.add('active'); // エラーでも表示は試みる
            };

             // 画像ソースを設定 (URL or Drive ID)
             this.getImageUrl(imageUrlOrId)
                 .then(url => {
                     newImage.src = url;
                 })
                 .catch(error => {
                     console.error(`Error getting image URL for ${imageUrlOrId}:`, error);
                     this.showError('errorImageLoadFailed', { url: imageUrlOrId });
                     newImage.src = this.getWhitePixel();
                     newImage.classList.add('active');
                 });

        } else {
             // 既存の画像要素があれば、再度 active にするだけ
             requestAnimationFrame(() => {
                 newImage.classList.add('active');
             });
        }
    },

     /**
     * 段階に応じた画像識別子(URL or Drive ID)を取得
     * @param {number} stageIndex
     * @returns {string | null}
     */
    getImageIdentifierForStage: function(stageIndex) {
        if (this.config.images && stageIndex >= 0 && stageIndex < this.config.images.length) {
            return this.config.images[stageIndex] || null; // 空文字列や null を返す
        }
        return null;
    },

    /**
     * 段階に応じた環境背景画像URLを取得 (F-02)
     * @param {number} stageIndex
     * @returns {string | null}
     */
    getEnvironmentForStage: function(stageIndex) {
        // 環境要素の決定ロジック (例: 段階に応じて循環させる、特定の段階で固定するなど)
        if (this.config.environments && this.config.environments.length > 0) {
            // 例: 段階数に応じて循環させる
            const envIndex = stageIndex % this.config.environments.length;
            return this.config.environments[envIndex] || null;
        }
        return null; // 設定がなければnull
    },


    /**
     * 画像URLまたはDrive IDから実際の画像URLを取得 (F-07)
     * Google Drive IDの場合はGAS APIを介して一時的なURLを取得する想定
     * @param {string} identifier - 画像URL または Google Drive ファイルID
     * @returns {Promise<string>} - 解決された画像URL
     */
     getImageUrl: async function(identifier) {
         if (!identifier) {
             return Promise.reject("Identifier is empty.");
         }
         if (identifier.toLowerCase().startsWith('http://') || identifier.toLowerCase().startsWith('https://')) {
             // 通常のURLの場合
             return Promise.resolve(identifier);
         } else if (identifier.match(/^[a-zA-Z0-9_-]{28,33}$/)) { // Google Drive IDっぽい形式かチェック
             // Google Drive ID の場合 (GASのエンドポイントを叩く必要あり)
             // 注意: この機能を使うには、GAS側に action=getImageUrl などの処理が必要
             console.log(`Getting Drive URL for ID: ${identifier}`);
              // return `${this.config.apiUrl}?action=getImageUrl&id=${identifier}`; // 簡単な実装例（非推奨：毎回GASを叩く）
             // より良い方法は、GAS側で一度URLを取得しキャッシュするか、直接Driveの公開URLを使う設定にする
             // ここでは、直接公開URLを使うことを想定 (fileIdから推測)
             // 重要: Driveファイルが「リンクを知っている全員が閲覧可能」になっている必要がある (S-07)
             // Driveの仕様変更に注意
             // return `https://drive.google.com/uc?export=view&id=${identifier}`;
             // さらに推奨されるのはViewer URL
              return `https://drive.google.com/file/d/${identifier}/view?usp=sharing`; // これはプレビューページ
              // 直接画像を表示するには `https://drive.google.com/thumbnail?id=FILE_ID&sz=wWIDTH-hHEIGHT` もあるが制限あり
              // 最も確実なのはGASで一時URLを生成するエンドポイントだが、今回は構成をシンプルにするためuc?export=viewを使う
               return `https://drive.google.com/uc?export=view&id=${identifier}`;
         } else {
             // 不明な形式
             return Promise.reject(`Invalid image identifier format: ${identifier}`);
         }
     },

     /**
      * 画像読み込み失敗時の代替白画像 (F-07)
      * @returns {string} - 1x1の白いピクセルのData URI
      */
     getWhitePixel: function() {
         return 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
     },

    /**
     * 成長アニメーションを開始 (F-03)
     * @param {number} fromStage - 開始段階
     * @param {number} toStage - 終了段階
     */
    startGrowthAnimation: function(fromStage, toStage) {
        if (this.state.isAnimating) {
            console.log("Animation already in progress. Skipping.");
            return;
        }
        this.state.isAnimating = true;
        this.elements.treeContainer.style.animation = 'none'; // 前回のアニメーションリセット

        let stagesToShow = [];
        for (let i = fromStage; i <= toStage; i++) {
            const imgId = this.getImageIdentifierForStage(i);
            if (imgId) stagesToShow.push({ stage: i, id: imgId });
        }

        if (stagesToShow.length === 0) {
            this.state.isAnimating = false;
            this.displayImageForStage(toStage); // アニメ対象なければ最終段階表示
            return;
        }

        console.log("Starting growth animation:", stagesToShow.map(s => s.stage));
        let currentIndex = 0;

        const showNextImage = () => {
            if (currentIndex >= stagesToShow.length) {
                // アニメーション終了
                this.state.isAnimating = false;
                 this.state.activeImageIndex = toStage; // 最終状態を記録
                console.log("Animation finished.");
                return;
            }

            const stageInfo = stagesToShow[currentIndex];
            this.state.activeImageIndex = stageInfo.stage; // アニメーション中の段階を記録

            this.displayImageForStage(stageInfo.stage); // 画像を表示/読み込み開始

            currentIndex++;
            // 次の画像への切り替え時間 (画像のフェード時間より少し長く)
            const delay = (currentIndex === stagesToShow.length) ? 800 : 1000; // 最後は少し短く
            this.state.animationTimeout = setTimeout(showNextImage, delay);
        };

        // アニメーション開始前に既存の画像を消す
        this.elements.treeImageWrapper.querySelectorAll('.tree-image.active').forEach(img => img.classList.remove('active'));
        clearTimeout(this.state.animationTimeout); // 念のため既存タイマー解除

        showNextImage(); // アニメーション開始
    },

    /**
     * リアルタイム通知を表示 (F-03)
     */
    showRealtimeNotice: function() {
        const notice = this.elements.realtimeNotice;
        notice.classList.add('show');
        // アニメーション終了後にクラスを削除
        setTimeout(() => {
            notice.classList.remove('show');
        }, 1000); // CSSのトランジション時間と合わせるか少し長めに
    },

    /**
     * マイルストーン達成をチェックし、メッセージを表示 (F-03)
     * @param {number} currentStage - 現在到達した段階
     */
    checkMilestone: function(currentStage) {
        const milestone = this.config.milestones[currentStage];
        if (milestone) {
             const lang = this.config.language;
             const title = milestone[`title_${lang}`] || milestone.title_ja || this.getText('milestoneDefaultTitle');
             const message = milestone[`message_${lang}`] || milestone.message_ja || this.getText('milestoneDefaultMessage');
             this.showMilestoneMessage(title, message);
        }
    },

    /**
     * マイルストーンメッセージを表示 (F-03)
     * @param {string} title
     * @param {string} message
     */
    showMilestoneMessage: function(title, message) {
        this.elements.milestoneTitle.textContent = title;
        this.elements.milestoneBody.textContent = message;
        this.elements.milestoneMessage.classList.add('show');
        this.elements.closeMilestoneButton.focus(); // N-06: フォーカス移動
    },

    /**
     * マイルストーンメッセージを非表示 (F-03)
     */
    hideMilestoneMessage: function() {
        this.elements.milestoneMessage.classList.remove('show');
        // フォーカスをメインコンテンツ等に戻す (必要であれば)
        // this.elements.appContainer.focus(); // 例
    },

    /**
     * ローディング表示を表示 (F-05)
     */
    showLoading: function() {
        this.elements.loading.style.display = 'flex';
        this.elements.loading.setAttribute('aria-busy', 'true');
        this.elements.appContainer.setAttribute('aria-busy', 'true'); // メインコンテンツも処理中を示す
    },

    /**
     * ローディング表示を非表示 (F-05)
     */
    hideLoading: function() {
        this.elements.loading.style.display = 'none';
        this.elements.loading.setAttribute('aria-busy', 'false');
         this.elements.appContainer.setAttribute('aria-busy', 'false');
    },

    /**
     * エラーメッセージを表示 (F-06)
     * @param {string} i18nKey - i18nのエラーキー
     * @param {string | object} details - エラー詳細またはパラメータ
     * @param {boolean} isUpdateOnly - UI更新のみでstate.lastErrorは更新しないフラグ
     */
    showError: function(i18nKey, details = '', isUpdateOnly = false) {
         const message = this.getText(i18nKey, typeof details === 'object' ? details : {});
         const detailText = typeof details === 'string' && details ? details : '';

         this.elements.errorDetails.textContent = message + (detailText ? ` (${detailText})` : '');

        // F-06: エラー原因に応じた対処法提示（簡易版）
        let suggestionKey = 'errorSuggestionDefault';
        if (i18nKey === 'errorApiUrlNotSet') {
             suggestionKey = 'errorSuggestionApiUrl'; // 例: 管理画面への誘導（i18nに追加必要）
             this.elements.errorSuggestion.innerHTML = `API URLが設定されていません。<a href="admin.html">管理画面</a>で設定してください。`; // 日本語固定だがi18n対応すべき
        } else if (i18nKey === 'errorImageConfigNotFound') {
             suggestionKey = 'errorSuggestionImageConfig'; // 例
             this.elements.errorSuggestion.textContent = this.getText(suggestionKey, '管理画面で画像設定を確認してください。'); // デフォルト文言
        } else {
             this.elements.errorSuggestion.textContent = this.getText(suggestionKey);
        }


        this.elements.errorMessage.style.display = 'flex';
        document.body.classList.add('error-state'); // F-06: 視覚的フィードバック用クラス

        if (!isUpdateOnly) {
             this.state.lastError = { key: i18nKey, details: details };
        }
        this.hideLoading(); // エラー時はローディング解除
    },

    /**
     * エラーメッセージを非表示 (F-06)
     */
    hideError: function() {
        if (this.elements.errorMessage.style.display !== 'none') {
            this.elements.errorMessage.style.display = 'none';
             document.body.classList.remove('error-state');
             // this.state.lastError = null; // エラー表示を消すタイミングでクリア (fetch成功時にもクリアしている)
        }
    },

    /**
     * ポーリングを開始 (F-04)
     */
    startPolling: function() {
        this.stopPolling(); // 既存のタイマーがあればクリア
        console.log(`Starting polling every ${this.config.pollingInterval / 1000} seconds.`);
        this.state.pollingTimer = setInterval(() => {
            this.fetchData();
        }, this.config.pollingInterval);
    },

    /**
     * ポーリングを停止 (F-04)
     */
    stopPolling: function() {
        if (this.state.pollingTimer) {
            clearInterval(this.state.pollingTimer);
            this.state.pollingTimer = null;
            console.log("Polling stopped.");
        }
    },

    /**
     * データ取得をリトライ (F-06)
     */
     retryFetch: function() {
         console.log("Retrying fetch data...");
         this.hideError();
         // 設定がなければまず設定読み込みを試みる
         if (!this.config.stages || this.config.stages.length === 0) {
             this.loadConfig().then(() => {
                 this.fetchData(true);
                 this.startPolling(); // ポーリングも再開
             }).catch(error => {
                 console.error("Retry failed during config load:", error);
                 this.showError('errorConfigLoadFailed', error.message);
             });
         } else {
             this.fetchData(this.state.isInitialLoad); // 通常のデータ取得
              if (!this.state.pollingTimer) { // ポーリングが止まっていれば再開
                   this.startPolling();
              }
         }
     },
};

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    treeApp.init();
});
