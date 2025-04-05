/* admin.js - 管理画面フロントエンドロジック */
// 要件: A-01~A-21, F-11, N-02, N-03, N-04, N-06

/**
 * @class AdminApp
 * @description 管理画面の全機能を管理するクラス
 */
class AdminApp {
    constructor() {
        this.apiUrl = localStorage.getItem('treeAppApiUrl') || '';
        this.config = null; // サーバーから取得した設定 (stages, images, pollingInterval, language, etc.)
        this.fetchTryCount = 0; // A-11: 代替保存試行カウンタ
        this.MAX_FETCH_RETRY = 3;
        this.isDebugMode = false; // A-16
        this.MAX_STAGES = 30; // F-02, A-04
        this.MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB (A-07)
        this.RECOMMENDED_IMAGE_ASPECT_RATIO = 16 / 9; // A-07

        this.elements = {
            apiUrlInput: document.getElementById('api-url'),
            saveApiUrlBtn: document.getElementById('save-api-url-btn'),
            testConnectionBtn: document.getElementById('test-connection-btn'),
            loader: document.getElementById('loader'),
            successMessage: document.getElementById('success-message'),
            errorMessage: document.getElementById('error-message'),
            debugModeCheckbox: document.getElementById('debug-mode'),
            debugInfo: document.getElementById('debug-info'),
            navLinks: document.querySelectorAll('.nav-item a'),
            contentSections: document.querySelectorAll('.content-section'),
            menuToggle: document.querySelector('.menu-toggle'), // レスポンシブ用
            sidebar: document.querySelector('.sidebar'),       // レスポンシブ用
            mainContent: document.querySelector('.main-content'), // レスポンシブ用

            // 基本設定
            homeBtn: document.getElementById('home-btn'),
            // 成長段階 (A-04, A-05)
            stageSettingsGrid: document.getElementById('stage-settings-grid'),
            maxMeetingsInput: document.getElementById('max-meetings'),
            resetStagesBtn: document.getElementById('reset-stages-btn'),
            autoDistributeBtn: document.getElementById('auto-distribute-btn'),
            // 画像設定 (A-06, A-07, A-08, A-09)
            stageSelector: document.getElementById('stage-selector'),
            imageIdUrlInput: document.getElementById('image-id-url-input'),
            setIdUrlBtn: document.getElementById('set-id-url-btn'),
            imageUploadInput: document.getElementById('image-upload-input'),
            uploadImageBtn: document.getElementById('upload-image-btn'),
            imagePreview: document.getElementById('image-preview'),
            imageGrid: document.getElementById('image-grid'),
            clearAllImagesBtn: document.getElementById('clear-all-images-btn'),
            dropZoneUrl: document.getElementById('drop-zone-url'), // A-06 (D&D)
            dropZoneUpload: document.getElementById('drop-zone-upload'), // A-07 (D&D)
            // その他設定 (A-17, A-18, A-20, A-21)
            pollingIntervalInput: document.getElementById('polling-interval'),
            languageSelect: document.getElementById('language-select'),
            exportSettingsBtn: document.getElementById('export-settings-btn'),
            importSettingsInput: document.getElementById('import-settings-input'),
            importSettingsBtn: document.getElementById('import-settings-btn'),
            historyList: document.getElementById('history-list'),
            // 保存ボタン (A-10)
            saveSettingsBtn: document.getElementById('save-settings-btn'),
            saveStagesOnlyBtn: document.getElementById('save-stages-only-btn'),
            saveImagesOnlyBtn: document.getElementById('save-images-only-btn'),
            // 統計 (A-19)
            statsContainer: document.getElementById('stats-container'),
            refreshStatsBtn: document.getElementById('refresh-stats-btn'),
            // プレビュー (A-13 - 将来用)
            // previewBtn: document.getElementById('preview-btn'),
        };

        // フォーム送信を乗っ取る (A-11 代替保存用)
        this.hiddenForm = this._createHiddenForm();
        document.body.appendChild(this.hiddenForm);

        this._addEventListeners();
        this._init();
    }

    /**
     * 初期化処理
     * @private
     */
    _init() {
        console.log('AdminApp initializing...');
        this.elements.apiUrlInput.value = this.apiUrl;
        this._updateDebugMode(); // デバッグモード初期状態反映

        if (this.apiUrl) {
            console.log('API URL found in localStorage:', this.apiUrl);
            this.loadConfig(); // API URLがあれば設定を読み込む
            this.loadStats(); // 統計情報も読み込む
            this.loadHistory(); // 設定履歴も読み込む
        } else {
            console.warn('API URL not set. Please set it in the Basic Settings section.');
            this.showInfoMessage('API URLが設定されていません。基本設定画面で設定してください。', 'basic-settings'); // 初期タブを表示
        }

        // 初期表示タブを設定 (URLハッシュがあればそれを優先)
        const initialSectionId = window.location.hash.substring(1) || 'basic-settings';
        this.activateSection(initialSectionId);

        this._setupStageSelector(); // 画像設定用の段階セレクタを生成
        this._setupDragAndDrop(); // D&D設定
    }

    /**
     * イベントリスナーの設定
     * @private
     */
    _addEventListeners() {
        // API URL 設定
        this.elements.saveApiUrlBtn.addEventListener('click', () => this.saveApiUrl());
        this.elements.testConnectionBtn.addEventListener('click', () => this.testConnection());

        // デバッグモード
        this.elements.debugModeCheckbox.addEventListener('change', () => this._updateDebugMode());

        // ナビゲーション (A-01)
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('href').substring(1);
                this.activateSection(sectionId);
                // レスポンシブ: メニューを閉じる
                if (window.innerWidth <= 768) {
                    this.elements.sidebar.classList.remove('open');
                }
            });
            // キーボード操作対応 (Enter/Space) - N-06
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            });
        });

         // ハンバーガーメニュー (レスポンシブ)
        if (this.elements.menuToggle) {
            this.elements.menuToggle.addEventListener('click', () => {
                this.elements.sidebar.classList.toggle('open');
            });
             // メインコンテンツクリックでメニューを閉じる
            this.elements.mainContent.addEventListener('click', () => {
                 if (this.elements.sidebar.classList.contains('open')) {
                     this.elements.sidebar.classList.remove('open');
                 }
            });
        }

        // メイン画面へ戻る
        this.elements.homeBtn?.addEventListener('click', () => window.location.href = 'index.html');

        // 成長段階設定 (A-05)
        this.elements.resetStagesBtn?.addEventListener('click', () => this.setupDefaultStages());
        this.elements.autoDistributeBtn?.addEventListener('click', () => this.autoDistributeStages());

        // 画像設定 (A-06, A-07, A-09)
        this.elements.setIdUrlBtn?.addEventListener('click', () => this.setImageIdentifier());
        this.elements.uploadImageBtn?.addEventListener('click', () => this.uploadAndSaveImage());
        this.elements.imageUploadInput?.addEventListener('change', (e) => this._handleFileSelect(e.target.files));
        this.elements.clearAllImagesBtn?.addEventListener('click', () => this.clearAllImages());
        this.elements.stageSelector?.addEventListener('change', () => this.updateImageConfigPanelForSelectedStage()); // 選択変更時に更新

        // その他設定 (A-17, A-18, A-20)
        this.elements.exportSettingsBtn?.addEventListener('click', () => this.exportSettings());
        this.elements.importSettingsBtn?.addEventListener('click', () => this.elements.importSettingsInput.click()); // ファイル選択ダイアログを開く
        this.elements.importSettingsInput?.addEventListener('change', (e) => this.importSettings(e));

        // 統計 (A-19)
        this.elements.refreshStatsBtn?.addEventListener('click', () => this.loadStats());

        // 保存ボタン (A-10)
        this.elements.saveSettingsBtn?.addEventListener('click', () => this.saveSettings('all'));
        this.elements.saveStagesOnlyBtn?.addEventListener('click', () => this.saveSettings('stages'));
        this.elements.saveImagesOnlyBtn?.addEventListener('click', () => this.saveSettings('images'));

        // キーボード操作: Enterでボタンクリックなど (N-06)
        this._enableKeyboardSubmit([this.elements.apiUrlInput], this.elements.saveApiUrlBtn);
    }

    /**
     * 特定の入力フィールドでEnterキーが押された時に指定のボタンをクリックする
     * @param {HTMLInputElement[]} inputs - 対象の入力フィールド配列
     * @param {HTMLButtonElement} button - クリックするボタン
     * @private
     */
    _enableKeyboardSubmit(inputs, button) {
        inputs.forEach(input => {
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    button?.click();
                }
            });
        });
    }

    /**
     * サイドナビのセクションをアクティブにする (A-01)
     * @param {string} sectionId - アクティブにするセクションのID
     */
    activateSection(sectionId) {
        // 他のセクションを非表示にし、ナビゲーションのアクティブ状態を解除
        this.elements.contentSections.forEach(section => section.classList.remove('active'));
        this.elements.navLinks.forEach(link => link.classList.remove('active'));

        // 対象セクションを表示し、対応するナビリンクをアクティブにする
        const sectionToShow = document.getElementById(sectionId);
        const linkToActivate = document.querySelector(`.nav-item a[href="#${sectionId}"]`);

        if (sectionToShow) {
            sectionToShow.classList.add('active');
            window.location.hash = sectionId; // URLハッシュも更新
        } else {
             // デフォルトまたは最初のセクションを表示
            console.warn(`Section with id "${sectionId}" not found. Showing default.`);
            this.elements.contentSections[0]?.classList.add('active');
            this.elements.navLinks[0]?.classList.add('active');
             window.location.hash = this.elements.contentSections[0]?.id || '';
        }

        if (linkToActivate) {
            linkToActivate.classList.add('active');
            // アクセシビリティ: 現在地を示す - N-06
            this.elements.navLinks.forEach(link => link.removeAttribute('aria-current'));
            linkToActivate.setAttribute('aria-current', 'page');
        }
    }

    // --- API通信関連 ---

    /**
     * サーバー (GAS) へリクエストを送信する共通関数
     * @param {string} action - GAS側で処理を振り分けるためのアクション名
     * @param {object} [payload={}] - POSTリクエストで送信するデータ
     * @param {string} [method='GET'] - HTTPメソッド ('GET' or 'POST')
     * @returns {Promise<object>} - サーバーからのレスポンス (JSONパース済み)
     * @private
     */
    async _fetchApi(action, payload = {}, method = 'GET') {
        if (!this.apiUrl) {
            throw new Error('API URL is not set.');
        }

        this.showLoader();
        this.hideMessage(); // 前回のメッセージをクリア
        this.fetchTryCount = 0; // A-11: fetch開始時にリセット

        const url = new URL(this.apiUrl);
        url.searchParams.append('action', action);
        if (this.isDebugMode) {
            url.searchParams.append('debug', 'true'); // A-16
        }

        const options = {
            method: method,
            headers: {},
            // mode: 'cors', // GAS Webアプリでは通常不要だが、念のため
            redirect: 'follow', // GAS Webアプリのリダイレクトに対応
        };

        if (method.toUpperCase() === 'POST') {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(payload);
            // A-11: 代替保存のためにFetch APIでは custom header を付与しない
            // options.headers['X-Requested-With'] = 'XMLHttpRequest'; // Optional: identify AJAX
        }

        try {
            const response = await fetch(url.toString(), options);

            if (!response.ok) {
                let errorData = { message: `HTTP error! status: ${response.status}` };
                try {
                    // エラーレスポンスのボディに詳細が含まれているか試す
                    const errorJson = await response.json();
                    errorData = { ...errorData, ...errorJson };
                } catch (e) { /* ignore JSON parse error */ }
                throw new Error(errorData.message || 'Unknown fetch error', { cause: errorData });
            }

            const data = await response.json();
            this._logDebugInfo('API Response:', data); // A-16
            return data;
        } catch (error) {
            console.error(`API request failed (Action: ${action}):`, error);
            this._logDebugInfo(`API request failed (Action: ${action}):`, error.message, error.cause || error); // A-16
            // A-11: Fetchでの保存失敗時の代替処理
            if (method.toUpperCase() === 'POST' && action === 'saveConfig') {
                this.fetchTryCount++;
                console.warn(`Workspace save attempt ${this.fetchTryCount} failed. Retrying or using fallback.`);
                if (this.fetchTryCount >= this.MAX_FETCH_RETRY && this.isDebugMode) {
                    console.log('Trying fallback form submission...');
                    this.saveSettingsViaForm(payload); // デバッグモード時のみ代替送信を試みる
                    // Fallback form submission is asynchronous in a way, so we don't await it here.
                    // We throw the original error to indicate the primary method failed.
                    throw error; // 元のエラーをスローして、呼び出し元に失敗を伝える
                } else {
                    // Retry logic could be implemented here, but for simplicity, we just throw.
                     throw error; // リトライしない場合はエラーをスロー
                }
            } else {
                 throw error; // 保存以外、またはリトライ回数未満/デバッグOFFの場合は通常のエラー
            }
        } finally {
            this.hideLoader();
        }
    }


    /**
     * 設定情報をサーバーから読み込む (A-03)
     */
    async loadConfig() {
        try {
            const response = await this._fetchApi('getConfig');
            if (response.status === 'success' && response.data) {
                this.config = response.data;
                console.log('Configuration loaded:', this.config);
                this.updateUiWithConfig(); // UIに設定を反映
                this.showSuccessMessage('設定情報を読み込みました。');
            } else {
                throw new Error(response.message || 'Failed to load config data.');
            }
        } catch (error) {
            this.showErrorMessage('設定情報の読み込みに失敗しました。', `API接続を確認するか、GASのログを確認してください。<br>エラー: ${error.message}`);
            this.config = null; // 読み込み失敗時はconfigをクリア
        }
    }

    /**
     * 現在の設定をUIに反映する
     */
    updateUiWithConfig() {
        if (!this.config) return;

        // 成長段階 (A-04)
        this._populateStageSettings();

        // 画像設定 (A-08)
        this._populateImageGrid();
        this.updateImageConfigPanelForSelectedStage(); // 現在選択中の段階の情報を表示

        // その他設定 (A-17, A-18)
        this.elements.pollingIntervalInput.value = this.config.pollingInterval || 30; // 初期値30秒
        this.elements.languageSelect.value = this.config.language || 'ja'; // 初期値 日本語
    }

    /**
     * 変更された設定をサーバーに保存する (A-10)
     * @param {'all' | 'stages' | 'images' | 'other'} saveType - 保存する設定の種類
     */
    async saveSettings(saveType = 'all') {
        if (!this.config) {
            this.showErrorMessage('設定情報が読み込まれていないため、保存できません。');
            return;
        }

        const settingsToSave = {
            saveType: saveType,
            data: {}
        };

        try {
            // 現在のUIから設定値を取得
            if (saveType === 'all' || saveType === 'stages') {
                settingsToSave.data.stages = this._getStageSettingsFromUi();
                settingsToSave.data.maxMeetings = parseInt(this.elements.maxMeetingsInput.value, 10) || 0; // A-05用に最大値も保存
            }
            if (saveType === 'all' || saveType === 'images') {
                // 画像設定は this.config.images を直接使う (UIからではなく内部状態から)
                settingsToSave.data.images = this.config.images || Array(this.MAX_STAGES + 1).fill('');
            }
            if (saveType === 'all' || saveType === 'other') {
                 settingsToSave.data.pollingInterval = parseInt(this.elements.pollingIntervalInput.value, 10) || 30;
                 settingsToSave.data.language = this.elements.languageSelect.value || 'ja';
            }

            // 対応するボタンを取得
            let saveButton;
            if (saveType === 'all') saveButton = this.elements.saveSettingsBtn;
            else if (saveType === 'stages') saveButton = this.elements.saveStagesOnlyBtn;
            else if (saveType === 'images') saveButton = this.elements.saveImagesOnlyBtn;
            // 'other' 専用の保存ボタンはない想定

            this._setButtonState(saveButton, 'saving', '保存中...'); // A-15

            const response = await this._fetchApi('saveConfig', settingsToSave, 'POST');

            if (response.status === 'success') {
                this.showSuccessMessage('設定を保存しました。');
                // 保存成功したらローカルのconfigも更新 (部分保存の場合も考慮)
                if (settingsToSave.data.stages) this.config.stages = settingsToSave.data.stages;
                if (settingsToSave.data.maxMeetings !== undefined) this.config.maxMeetings = settingsToSave.data.maxMeetings;
                if (settingsToSave.data.images) this.config.images = settingsToSave.data.images;
                if (settingsToSave.data.pollingInterval) this.config.pollingInterval = settingsToSave.data.pollingInterval;
                if (settingsToSave.data.language) this.config.language = settingsToSave.data.language;

                this.updateUiWithConfig(); // UIを再描画して整合性を保つ
                this.loadHistory(); // 履歴を再読み込み (S-13)
                this._setButtonState(saveButton, 'saved-success', '保存完了'); // A-15
            } else {
                throw new Error(response.message || 'Failed to save settings.');
            }
        } catch (error) {
            // _fetchApi内で代替保存が試みられ、それも失敗した場合にここに来る
            this.showErrorMessage('設定の保存に失敗しました。', `エラー: ${error.message}<br>デバッグモードを有効にして再試行するか、GASのログを確認してください。`);
             const button = saveType === 'all' ? this.elements.saveSettingsBtn : (saveType === 'stages' ? this.elements.saveStagesOnlyBtn : this.elements.saveImagesOnlyBtn);
             this._setButtonState(button, 'saved-error', '保存失敗'); // A-15
        } finally {
            // ボタンの状態を少し遅れて元に戻す
            const button = saveType === 'all' ? this.elements.saveSettingsBtn : (saveType === 'stages' ? this.elements.saveStagesOnlyBtn : this.elements.saveImagesOnlyBtn);
            setTimeout(() => this._resetButtonState(button), 2000);
        }
    }

    /**
     * API URLを保存する (A-02, F-11)
     */
    saveApiUrl() {
        const newApiUrl = this.elements.apiUrlInput.value.trim();
        if (newApiUrl) {
            // 簡単なURL形式のチェック (より厳密なチェックも可能)
            if (!newApiUrl.startsWith('https://script.google.com/macros/s/')) {
                 this.showErrorMessage('無効なAPI URL形式です。Google Apps ScriptのWebアプリURLを入力してください。');
                 return;
            }
            this.apiUrl = newApiUrl;
            // N-03: ローカルストレージ保存のリスクについてコメント
            // 注意: ローカルストレージはXSS攻撃に対して脆弱な可能性があります。
            // 機密情報を含まない一時的な設定として利用しますが、
            // 本番環境ではサーバーサイドでの管理やより安全な認証方式を検討してください。
            localStorage.setItem('treeAppApiUrl', this.apiUrl);
            this.showSuccessMessage('API URLを保存しました。ページをリロードして設定を読み込みます。');
            // 設定を読み込むためにリロードを促すか、自動リロードする
            setTimeout(() => window.location.reload(), 1500);
        } else {
            this.showErrorMessage('API URLを入力してください。');
        }
    }

    /**
     * 接続テストを実行する (A-12)
     */
    async testConnection() {
        if (!this.apiUrl) {
            this.showErrorMessage('API URLが設定されていません。');
            return;
        }
        try {
            const response = await this._fetchApi('test');
            if (response.status === 'success') {
                this.showSuccessMessage(`接続テスト成功！ サーバーからの応答: ${response.message}`);
            } else {
                throw new Error(response.message || 'Connection test failed.');
            }
        } catch (error) {
            this.showErrorMessage('接続テスト失敗。', `API URLが正しいか、GAS Webアプリが正しくデプロイされ、アクセス権が「全員」に設定されているか確認してください。<br>エラー: ${error.message}`);
        }
    }

    // --- 成長段階設定 (A-04, A-05) ---

    /**
     * configから成長段階設定UIを生成する
     * @private
     */
    _populateStageSettings() {
        const container = this.elements.stageSettingsGrid;
        if (!container || !this.config || !this.config.stages) return;

        container.innerHTML = ''; // 既存の内容をクリア
        this.elements.maxMeetingsInput.value = this.config.maxMeetings || 0; // 最大値も表示

        for (let i = 0; i <= this.MAX_STAGES; i++) {
            const value = this.config.stages[i] !== undefined ? this.config.stages[i] : '';
            const row = document.createElement('div');
            row.className = 'stage-row';

            const label = document.createElement('label');
            label.htmlFor = `stage-input-${i}`;
            label.textContent = `段階 ${i}:`;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `stage-input-${i}`;
            input.className = 'stage-input';
            input.min = '0';
            input.value = value;
            input.dataset.stageIndex = i; // インデックスを保持

            if (i === 0) {
                input.value = 0;
                input.disabled = true; // 段階0は編集不可
                input.setAttribute('aria-readonly', 'true'); // N-06
            }

            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);
        }
    }

    /**
     * UIから成長段階の閾値を取得する
     * @returns {number[]} 段階ごとの閾値の配列
     * @private
     */
    _getStageSettingsFromUi() {
        const stages = Array(this.MAX_STAGES + 1).fill(0);
        const inputs = this.elements.stageSettingsGrid.querySelectorAll('.stage-input');
        let isValid = true;
        let previousValue = 0;

        inputs.forEach(input => {
            const index = parseInt(input.dataset.stageIndex, 10);
            const value = parseInt(input.value, 10);

            if (isNaN(value) || value < 0) {
                this.showErrorMessage(`段階 ${index} に無効な値が入力されています。0以上の数値を入力してください。`);
                input.focus();
                isValid = false;
                return; // forEachの次の反復へ
            }
             if (index > 0 && value <= previousValue) {
                 this.showErrorMessage(`段階 ${index} の値(${value})は、前の段階(${index-1})の値(${previousValue})より大きくする必要があります。`);
                 input.focus();
                 isValid = false;
                 return;
             }

            stages[index] = value;
            previousValue = value;
        });

        if (!isValid) {
             throw new Error("成長段階の設定値が無効です。");
        }
        return stages;
    }

    /**
     * 成長段階設定をデフォルト値にリセットする (A-05)
     */
    setupDefaultStages() {
        const maxMeetings = parseInt(this.elements.maxMeetingsInput.value, 10);
        if (isNaN(maxMeetings) || maxMeetings <= 0) {
            this.showErrorMessage('有効な「最大交流回数」を入力してください。');
            this.elements.maxMeetingsInput.focus();
            return;
        }
        if (!confirm(`最大交流回数 ${maxMeetings} をもとに、段階設定をデフォルト値（段階ごとに増加量が大きくなる形）にリセットしますか？ 現在の入力内容は破棄されます。`)) {
            return;
        }

        const stages = [0];
        // 例: 段階が進むほど必要な回数が増えるように (単純な例)
        let incrementBase = maxMeetings / (this.MAX_STAGES * (this.MAX_STAGES + 1) / 2); // 等差数列の和で割る
        let currentSum = 0;
        for (let i = 1; i <= this.MAX_STAGES; i++) {
            let increment = Math.round(incrementBase * i);
            currentSum += increment;
            stages[i] = Math.min(currentSum, maxMeetings); // 最大値を超えないように
        }
        // 最大段階は必ず最大値にする
        stages[this.MAX_STAGES] = maxMeetings;


        // UIに反映
        const inputs = this.elements.stageSettingsGrid.querySelectorAll('.stage-input');
        inputs.forEach(input => {
            const index = parseInt(input.dataset.stageIndex, 10);
            if (index > 0) { // 段階0は変更しない
                input.value = stages[index];
            }
        });
        this.showInfoMessage('成長段階設定をデフォルト値にリセットしました。忘れずに「段階設定のみ保存」または「全設定を保存」してください。');
    }

    /**
     * 最大交流回数までを均等に割り振る (A-05)
     */
    autoDistributeStages() {
        const maxMeetings = parseInt(this.elements.maxMeetingsInput.value, 10);
        if (isNaN(maxMeetings) || maxMeetings <= 0) {
            this.showErrorMessage('有効な「最大交流回数」を入力してください。');
            this.elements.maxMeetingsInput.focus();
            return;
        }
        if (!confirm(`最大交流回数 ${maxMeetings} をもとに、段階設定を均等に割り振りますか？ 現在の入力内容は破棄されます。`)) {
            return;
        }

        const stages = [0];
        for (let i = 1; i <= this.MAX_STAGES; i++) {
            stages[i] = Math.round((maxMeetings / this.MAX_STAGES) * i);
        }

        // UIに反映
        const inputs = this.elements.stageSettingsGrid.querySelectorAll('.stage-input');
        inputs.forEach(input => {
            const index = parseInt(input.dataset.stageIndex, 10);
            if (index > 0) {
                input.value = stages[index];
            }
        });
        this.showInfoMessage('成長段階設定を均等に割り振りました。忘れずに「段階設定のみ保存」または「全設定を保存」してください。');
    }

    // --- 画像設定 (A-06, A-07, A-08, A-09) ---

     /**
     * 画像設定用の段階セレクタを初期化
     * @private
     */
    _setupStageSelector() {
        const selector = this.elements.stageSelector;
        if (!selector) return;
        selector.innerHTML = ''; // クリア
        for (let i = 0; i <= this.MAX_STAGES; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `段階 ${i}`;
            selector.appendChild(option);
        }
    }

    /**
     * configから画像グリッドを生成する (A-08)
     * @private
     */
    _populateImageGrid() {
        const grid = this.elements.imageGrid;
        if (!grid || !this.config || !this.config.images) return;

        grid.innerHTML = ''; // クリア
        const images = this.config.images;

        for (let i = 0; i <= this.MAX_STAGES; i++) {
            const identifier = images[i] || ''; // URL or Drive ID or empty
            const item = document.createElement('div');
            item.className = 'image-item';

            const img = document.createElement('img');
            img.alt = `段階 ${i} の画像プレビュー`;
            img.src = identifier ? this._getPotentialImageUrl(identifier) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 未設定時は透過gif
            // エラー時の代替画像
            img.onerror = () => { img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 100 100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">No Image</text></svg>'; };
            img.loading = 'lazy'; // 遅延読み込み

            const text = document.createElement('p');
            text.textContent = `段階 ${i}: ${identifier ? (identifier.length > 15 ? identifier.substring(0, 12) + '...' : identifier) : '未設定'}`;
            text.title = identifier || '未設定'; // フルパスをツールチップで

            const editBtn = document.createElement('button');
            editBtn.textContent = '編集';
            editBtn.className = 'btn btn-secondary edit-image-btn';
            editBtn.type = 'button';
            editBtn.dataset.stageIndex = i;
            editBtn.setAttribute('aria-label', `段階 ${i} の画像を編集`);
            editBtn.addEventListener('click', () => {
                this.elements.stageSelector.value = i; // セレクタを該当段階に設定
                this.updateImageConfigPanelForSelectedStage(); // 設定パネルを更新
                // 設定パネルのあるセクションにスクロールするなどのUX改善も可能
                this.elements.imageIdUrlInput.focus();
            });

            item.appendChild(img);
            item.appendChild(text);
            item.appendChild(editBtn);
            grid.appendChild(item);
        }
    }

     /**
     * 画像識別子から表示用のURLを推測する（完全ではない）
     * @param {string} identifier URL or Drive ID
     * @returns {string} Image URL or placeholder
     * @private
     */
    _getPotentialImageUrl(identifier) {
        if (!identifier) return '';
        // Google Drive IDの場合の簡易的なサムネイルURL (要権限 or 共有設定)
        if (identifier.length > 20 && !identifier.startsWith('http')) { // heuristic
             // 注意: このURLは直接画像を表示しない場合があります。GAS側で取得する方が確実。
             // return `https://drive.google.com/thumbnail?id=${identifier}`;
             // 代わりにGASに問い合わせるか、固定プレースホルダーを返す
             return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 100 100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10">Drive ID</text></svg>';
        }
        // URLの場合
        if (identifier.startsWith('http')) {
            return identifier;
        }
        return ''; // 不明な形式
    }

    /**
     * 選択された成長段階に応じて画像設定パネルの内容を更新する
     */
    updateImageConfigPanelForSelectedStage() {
        if (!this.config || !this.config.images) return;
        const selectedStage = parseInt(this.elements.stageSelector.value, 10);
        const currentIdentifier = this.config.images[selectedStage] || '';

        this.elements.imageIdUrlInput.value = currentIdentifier;
        // プレビュー更新
        this.elements.imagePreview.src = currentIdentifier ? this._getPotentialImageUrl(currentIdentifier) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        this.elements.imagePreview.onerror = () => { this.elements.imagePreview.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Preview N/A</text></svg>'; };
        this.elements.imagePreview.alt = `段階 ${selectedStage} の現在の画像プレビュー`;

        // アップロードボタンのテキスト更新
        this.elements.uploadImageBtn.textContent = `段階 ${selectedStage} に画像をアップロード`;
    }

    /**
     * URLまたはDrive IDを設定する (A-06)
     */
    setImageIdentifier(identifierFromDrop = null) {
        if (!this.config) return;
        const stageIndex = parseInt(this.elements.stageSelector.value, 10);
        const identifier = (identifierFromDrop !== null) ? identifierFromDrop : this.elements.imageIdUrlInput.value.trim();

         // 簡単なバリデーション
        if (identifier && !identifier.startsWith('http') && identifier.length < 10) { // Drive IDは通常もっと長い
             this.showErrorMessage('無効な形式のようです。画像URL(http://...)またはGoogle DriveファイルIDを入力してください。空にすると設定をクリアします。');
             return;
        }

        this.config.images = this.config.images || Array(this.MAX_STAGES + 1).fill('');
        this.config.images[stageIndex] = identifier;

        this.updateUiWithConfig(); // グリッドとプレビューを更新
        this.showInfoMessage(`段階 ${stageIndex} の画像設定を「${identifier || '未設定'}」に変更しました。忘れずに「画像設定のみ保存」または「全設定を保存」してください。`);
    }

    /**
     * 画像をアップロードして設定する (A-07)
     */
    async uploadAndSaveImage(file = null) {
        if (!this.config) return;

        const selectedFile = file || this.elements.imageUploadInput.files[0];
        if (!selectedFile) {
            this.showErrorMessage('アップロードするファイルを選択してください。');
            return;
        }

        // ファイル形式チェック (PNG, JPG, GIF)
        const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
        if (!allowedTypes.includes(selectedFile.type)) {
             this.showErrorMessage('無効なファイル形式です。PNG, JPG, GIF形式の画像を選択してください。');
             return;
        }

        // ファイルサイズチェック (A-07)
        if (selectedFile.size > this.MAX_FILE_SIZE) {
             this.showErrorMessage(`ファイルサイズが大きすぎます (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)。${(this.MAX_FILE_SIZE / 1024 / 1024)}MB以下のファイルを選択してください。`);
             return;
        }

        // 解像度チェック (推奨)
        const img = new Image();
        img.onload = async () => {
            console.log(`Image dimensions: ${img.width}x${img.height}`);
            const aspectRatio = img.width / img.height;
            if (Math.abs(aspectRatio - this.RECOMMENDED_IMAGE_ASPECT_RATIO) > 0.1) { // 多少の誤差は許容
                 this.showInfoMessage(`推奨解像度 (16:9, 例: 1280x720) と異なるようです (${img.width}x${img.height})。表示が崩れる可能性があります。`, '', true); // 既存メッセージを消さずに追加
            }

             // Base64エンコードしてサーバーに送信
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Data = reader.result.split(',')[1]; // "data:image/png;base64," の部分を除去
                const stageIndex = parseInt(this.elements.stageSelector.value, 10);
                const payload = {
                    stage: stageIndex,
                    fileName: `stage_${stageIndex}_${selectedFile.name}`, // サーバー側で使うファイル名
                    mimeType: selectedFile.type,
                    base64Data: base64Data
                };

                const uploadButton = this.elements.uploadImageBtn;
                this._setButtonState(uploadButton, 'saving', 'アップロード中...');

                try {
                    const response = await this._fetchApi('uploadImage', payload, 'POST');
                    if (response.status === 'success' && response.fileId) {
                        // アップロード成功後、返されたFile IDを設定
                        this.config.images = this.config.images || Array(this.MAX_STAGES + 1).fill('');
                        this.config.images[stageIndex] = response.fileId; // Drive IDを設定
                        this.updateUiWithConfig(); // UI更新
                        this.showSuccessMessage(`段階 ${stageIndex} の画像をアップロードし、設定しました (ID: ${response.fileId})。忘れずに「画像設定のみ保存」または「全設定を保存」してください。`);
                        this._setButtonState(uploadButton, 'saved-success', 'アップロード完了');
                    } else {
                        throw new Error(response.message || 'Failed to upload image.');
                    }
                } catch (error) {
                    this.showErrorMessage('画像のアップロードに失敗しました。', `エラー: ${error.message}<br>Driveのフォルダ権限やGASの実行制限を確認してください。`);
                     this._setButtonState(uploadButton, 'saved-error', 'アップロード失敗');
                } finally {
                    setTimeout(() => this._resetButtonState(uploadButton), 2000);
                }
            };
            reader.onerror = (error) => {
                 console.error('FileReader error:', error);
                 this.showErrorMessage('ファイルの読み込みに失敗しました。');
            }
            reader.readAsDataURL(selectedFile); // Base64で読み込み開始
        };
         img.onerror = () => {
             console.error('Could not load image to check dimensions.');
             // 解像度チェックはスキップしてアップロードに進むこともできる
             // this.showInfoMessage('画像の解像度を確認できませんでした。');
         };
         img.src = URL.createObjectURL(selectedFile); // 一時URLで画像を読み込み
    }

    /**
     * 全ての画像設定をクリアする (A-09)
     */
    clearAllImages() {
        if (!this.config) return;
        if (!confirm('本当にすべての成長段階の画像設定をクリアしますか？ この操作は元に戻せません。')) {
            return;
        }
        this.config.images = Array(this.MAX_STAGES + 1).fill('');
        this.updateUiWithConfig();
        this.showInfoMessage('すべての画像設定をクリアしました。忘れずに「画像設定のみ保存」または「全設定を保存」してください。');
    }

    /**
     * ドラッグ＆ドロップの初期設定 (A-06, A-07)
     * @private
     */
    _setupDragAndDrop() {
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // URL/ID入力欄へのドロップ (A-06)
        if (this.elements.dropZoneUrl) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                this.elements.dropZoneUrl.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false); // prevent browser default behavior
            });
             ['dragenter', 'dragover'].forEach(eventName => {
                this.elements.dropZoneUrl.addEventListener(eventName, () => {
                    this.elements.dropZoneUrl.classList.add('dragover');
                }, false);
            });
             ['dragleave', 'drop'].forEach(eventName => {
                this.elements.dropZoneUrl.addEventListener(eventName, () => {
                    this.elements.dropZoneUrl.classList.remove('dragover');
                }, false);
            });

            this.elements.dropZoneUrl.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                // テキストデータ（URLやID）がドロップされた場合
                const droppedText = dt.getData('text/plain');
                if (droppedText) {
                    console.log('Dropped Text:', droppedText);
                    this.elements.imageIdUrlInput.value = droppedText;
                    this.setImageIdentifier(droppedText); // そのまま設定を試みる
                }
                 // 画像ファイルがドロップされた場合 (URLを取得しようと試みる)
                 else if (dt.files && dt.files.length > 0) {
                     console.log('Dropped image file (trying to get URL/info):', dt.files[0]);
                     // 通常、ファイルから直接URLは取得できないが、もし画像がWebページからのドラッグなら関連情報があるかも
                     const htmlData = dt.getData('text/html');
                     if (htmlData) {
                         const match = htmlData.match(/<img.*?src=["'](.*?)["']/);
                         if (match && match[1]) {
                             this.elements.imageIdUrlInput.value = match[1];
                             this.setImageIdentifier(match[1]);
                             this.showInfoMessage('ドロップされた画像からURLを抽出しました。');
                             return; // URLが見つかったら終了
                         }
                     }
                     this.showErrorMessage('画像ファイルをここにドロップしてもURL/IDは設定できません。URL/IDをテキストでドロップするか、下の「画像アップロード」エリアにファイルをドロップしてください。');
                 }
            }, false);
        }

        // 画像アップロードエリアへのドロップ (A-07)
        if (this.elements.dropZoneUpload) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                this.elements.dropZoneUpload.addEventListener(eventName, preventDefaults, false);
            });
             ['dragenter', 'dragover'].forEach(eventName => {
                this.elements.dropZoneUpload.addEventListener(eventName, () => {
                    this.elements.dropZoneUpload.classList.add('dragover');
                }, false);
            });
             ['dragleave', 'drop'].forEach(eventName => {
                this.elements.dropZoneUpload.addEventListener(eventName, () => {
                    this.elements.dropZoneUpload.classList.remove('dragover');
                }, false);
            });

            this.elements.dropZoneUpload.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length > 0) {
                    console.log('Dropped files for upload:', files);
                    this._handleFileSelect(files); // ファイル選択処理を呼ぶ
                } else {
                     const droppedText = dt.getData('text/plain');
                     if (droppedText) {
                         this.showErrorMessage('テキストデータはアップロードできません。画像ファイルをドロップしてください。');
                     }
                }
            }, false);
        }
    }

     /**
      * ファイル選択またはドロップされたファイルを処理 (A-07)
      * @param {FileList} files - 選択またはドロップされたファイルリスト
      * @private
      */
     _handleFileSelect(files) {
         if (files && files.length > 0) {
             const file = files[0]; // 最初のファイルのみ処理
             // プレビュー表示 (簡易)
             const reader = new FileReader();
             reader.onload = (e) => {
                 this.elements.imagePreview.src = e.target.result;
                 this.elements.imagePreview.alt = `選択されたファイルのプレビュー: ${file.name}`;
             }
             reader.readAsDataURL(file);
             // アップロードボタンを有効化するなどの処理も可能
             this.elements.imageUploadInput.files = files; // inputにもファイルをセット (直接D&Dした場合)
             this.showInfoMessage(`ファイル「${file.name}」を選択しました。「アップロード」ボタンを押して確定してください。`);
         }
     }

    // --- その他設定 (A-17, A-18, A-20, A-21) ---

    /**
     * 設定情報をファイルとしてエクスポートする (A-20, S-12)
     */
    async exportSettings() {
        if (!this.config) {
            this.showErrorMessage('設定情報が読み込まれていないため、エクスポートできません。');
            return;
        }
        if (!confirm('現在の設定情報をファイルにエクスポートしますか？')) return;

        try {
            // GASにエクスポート用データをリクエスト (現在の全設定を返すことを期待)
            const response = await this._fetchApi('exportConfig');
            if (response.status === 'success' && response.data) {
                 const jsonData = JSON.stringify(response.data, null, 2); // 整形してJSON文字列化
                 const blob = new Blob([jsonData], { type: 'application/json' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
                 a.download = `tree-app-settings-backup-${timestamp}.json`;
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 URL.revokeObjectURL(url);
                 this.showSuccessMessage('設定情報をエクスポートしました。');
            } else {
                 throw new Error(response.message || 'Failed to fetch data for export.');
            }
        } catch (error) {
            this.showErrorMessage('設定情報のエクスポートに失敗しました。', `エラー: ${error.message}`);
        }
    }

    /**
     * ファイルから設定情報をインポートする (A-20, S-12)
     * @param {Event} event - ファイル入力のchangeイベント
     */
    importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm(`ファイル「${file.name}」から設定情報をインポートしますか？ 現在の設定は上書きされます。この操作は元に戻せません。`)) {
            // Reset the input field value to allow selecting the same file again
            event.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedConfig = JSON.parse(e.target.result);
                console.log('Imported config data:', importedConfig);

                // 簡単なバリデーション (必要に応じて強化)
                if (!importedConfig || typeof importedConfig !== 'object' || !importedConfig.stages || !importedConfig.images) {
                    throw new Error('無効な設定ファイル形式です。');
                }

                // サーバーにインポートデータを送信して保存
                 const response = await this._fetchApi('importConfig', { data: importedConfig }, 'POST');

                 if (response.status === 'success') {
                     this.showSuccessMessage(`ファイル「${file.name}」から設定情報をインポートし、保存しました。ページをリロードして反映します。`);
                     // 成功したらリロードして新しい設定を読み込む
                     setTimeout(() => window.location.reload(), 2000);
                 } else {
                     throw new Error(response.message || 'Failed to save imported settings.');
                 }

            } catch (error) {
                this.showErrorMessage('設定ファイルのインポートまたは保存に失敗しました。', `ファイル形式が正しいか、サーバー側の処理を確認してください。<br>エラー: ${error.message}`);
            } finally {
                 // Reset the input field value
                 event.target.value = null;
            }
        };
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            this.showErrorMessage('設定ファイルの読み込みに失敗しました。');
             event.target.value = null;
        };
        reader.readAsText(file);
    }

    /**
     * 設定変更履歴を読み込んで表示する (A-21, S-13)
     */
    async loadHistory() {
        const listElement = this.elements.historyList;
        if (!listElement) return;
        listElement.innerHTML = '<li>履歴を読み込み中...</li>';

        try {
            const response = await this._fetchApi('getHistory');
            if (response.status === 'success' && response.data) {
                listElement.innerHTML = ''; // クリア
                if (response.data.length === 0) {
                     listElement.innerHTML = '<li>変更履歴はありません。</li>';
                     return;
                }

                response.data.forEach(entry => {
                    const li = document.createElement('li');
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'history-info';
                    const dateSpan = document.createElement('span');
                     // ISO 8601形式の日付を読みやすい形式に変換
                    try {
                        dateSpan.textContent = `日時: ${new Date(entry.timestamp).toLocaleString('ja-JP')}`;
                    } catch (e) {
                        dateSpan.textContent = `日時: ${entry.timestamp}`; // 変換失敗時はそのまま表示
                    }
                    const userSpan = document.createElement('span');
                    userSpan.textContent = `変更者: ${entry.user || '不明'}`; // 認証がない場合は不明
                    const changesSpan = document.createElement('span');
                     // 変更内容の概要を表示 (例: stages, imagesが変更されたなど)
                    changesSpan.textContent = `変更内容: ${Object.keys(entry.changes).join(', ') || '詳細不明'}`;
                    changesSpan.title = JSON.stringify(entry.changes, null, 2); // ツールチップで詳細

                    infoDiv.appendChild(dateSpan);
                    infoDiv.appendChild(userSpan);
                    infoDiv.appendChild(changesSpan);

                    const rollbackBtn = document.createElement('button');
                    rollbackBtn.textContent = 'この時点に戻す';
                    rollbackBtn.className = 'btn btn-warning btn-sm';
                    rollbackBtn.type = 'button';
                    rollbackBtn.dataset.versionId = entry.versionId; // 識別子を保持
                    rollbackBtn.addEventListener('click', () => this.rollbackSettings(entry.versionId, entry.timestamp));

                    li.appendChild(infoDiv);
                    li.appendChild(rollbackBtn);
                    listElement.appendChild(li);
                });
            } else {
                 listElement.innerHTML = `<li>履歴の読み込みに失敗しました: ${response.message || '不明なエラー'}</li>`;
            }
        } catch (error) {
             listElement.innerHTML = `<li>履歴の読み込み中にエラーが発生しました: ${error.message}</li>`;
        }
    }

    /**
     * 指定したバージョンの設定にロールバックする (A-21, S-13)
     * @param {string} versionId - ロールバック対象のバージョンID
     * @param {string} timestamp - ロールバック対象のタイムスタンプ（確認用）
     */
    async rollbackSettings(versionId, timestamp) {
        const dateString = new Date(timestamp).toLocaleString('ja-JP');
        if (!confirm(`本当に ${dateString} 時点の設定に戻しますか？ 現在の設定は失われます。この操作は元に戻せません。`)) {
            return;
        }

        try {
            const response = await this._fetchApi('rollbackConfig', { versionId: versionId }, 'POST');
            if (response.status === 'success') {
                this.showSuccessMessage(`設定を ${dateString} 時点にロールバックしました。ページをリロードして反映します。`);
                // 成功したらリロードして反映
                setTimeout(() => window.location.reload(), 2000);
            } else {
                 throw new Error(response.message || 'Failed to rollback settings.');
            }
        } catch (error) {
            this.showErrorMessage('設定のロールバックに失敗しました。', `エラー: ${error.message}`);
        }
    }

    // --- 統計関連 (A-19, S-14) ---

    /**
     * 利用統計データを読み込んで表示する (A-19)
     */
    async loadStats() {
        const container = this.elements.statsContainer;
        if (!container) return;
        container.innerHTML = '<p>統計データを読み込み中...</p>';

        try {
            const response = await this._fetchApi('getStats');
            if (response.status === 'success' && response.data) {
                container.innerHTML = ''; // クリア
                const stats = response.data;

                // 例: 簡単な統計カードを表示
                container.appendChild(this._createStatCard('累計交流回数', stats.totalMeetings || 'N/A'));
                container.appendChild(this._createStatCard('現在の成長段階', stats.currentStage || 'N/A'));
                container.appendChild(this._createStatCard('直近のアクティビティ', stats.recentActivity || 'N/A'));

                // 例: 時間帯別アクティビティ (テーブル表示)
                if (stats.activityByHour) {
                    const tableHtml = `
                        <h3>時間帯別 交流回数</h3>
                        <table>
                            <thead><tr><th>時間</th><th>回数</th></tr></thead>
                            <tbody>
                                ${Object.entries(stats.activityByHour).map(([hour, count]) => `<tr><td>${hour}:00-${hour}:59</td><td>${count}</td></tr>`).join('')}
                            </tbody>
                        </table>`;
                    container.appendChild(this._createStatCardHtml(tableHtml));
                }
                 // グラフ表示はライブラリが必要 (例: Chart.js)
                 // container.appendChild(this._createStatChart('成長段階の推移', stats.stageHistory));

                 this.showInfoMessage('統計データを更新しました。', '', true); // 他メッセージ消さずに表示

            } else {
                 container.innerHTML = `<p>統計データの読み込みに失敗しました: ${response.message || '不明なエラー'}</p>`;
            }
        } catch (error) {
             container.innerHTML = `<p>統計データの読み込み中にエラーが発生しました: ${error.message}</p>`;
        }
    }

     /**
      * 統計表示用のシンプルなカード要素を作成
      * @param {string} title カードのタイトル
      * @param {string|number} value 表示する値
      * @returns {HTMLElement} カード要素
      * @private
      */
     _createStatCard(title, value) {
         const card = document.createElement('div');
         card.className = 'stat-card';
         card.innerHTML = `<h3>${title}</h3><p>${value}</p>`;
         return card;
     }
       /**
      * 統計表示用のHTMLコンテンツを持つカード要素を作成
      * @param {string} htmlContent カード内部のHTML
      * @returns {HTMLElement} カード要素
      * @private
      */
     _createStatCardHtml(htmlContent) {
         const card = document.createElement('div');
         card.className = 'stat-card';
         card.innerHTML = htmlContent;
         return card;
     }

    // --- UIフィードバック (ローディング、メッセージ) ---

    /** ローダーを表示 */
    showLoader() {
        if (this.elements.loader) this.elements.loader.style.display = 'block';
    }

    /** ローダーを非表示 */
    hideLoader() {
        if (this.elements.loader) this.elements.loader.style.display = 'none';
    }

    /**
     * メッセージを表示する共通関数
     * @param {string} message 表示するメッセージ
     * @param {'success' | 'error' | 'info'} type メッセージの種類
     * @param {string} [details=''] 詳細情報（エラー時など）
     * @param {boolean} [append=false] 既存のメッセージを消さずに追加するか
     * @private
     */
    _showMessage(message, type, details = '', append = false) {
        const element = type === 'error' ? this.elements.errorMessage : (type === 'success' ? this.elements.successMessage : document.getElementById('info-message')); // info用も取得 or 生成
        if (!element) return;

        let content = `<p>${message}</p>`;
        if (details) {
            content += `<p><strong>詳細:</strong> ${details}</p>`;
        }

        if (append && element.style.display === 'block') {
            element.innerHTML += `<hr style="margin: 5px 0; border-top: 1px dashed;">${content}`; // 追記の場合区切り線
        } else {
            element.innerHTML = content;
        }

        element.className = `message ${type}`; // アニメーション用クラスも付与
        element.style.display = 'block';
        element.setAttribute('role', 'alert'); // N-06 アクセシビリティ

        // エラーメッセージの場合、関連する場所にフォーカスを移動させるなどの配慮が可能
        // if (type === 'error') { /* focus logic */ }

        // 古いメッセージを非表示にする (追記モードでない場合)
        if (!append) {
            if (type !== 'error' && this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
            if (type !== 'success' && this.elements.successMessage) this.elements.successMessage.style.display = 'none';
            if (type !== 'info' && document.getElementById('info-message')) document.getElementById('info-message').style.display = 'none';
        }

        // 一定時間後に自動で消す（成功・情報メッセージのみ）
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                // メッセージが追記されていない場合のみ消す
                if (element.innerHTML === content) {
                    element.style.display = 'none';
                }
            }, 5000); // 5秒後に消す
        }
    }

    /** 成功メッセージを表示 */
    showSuccessMessage(message, details = '') {
        this._showMessage(message, 'success', details);
    }

    /** エラーメッセージを表示 */
    showErrorMessage(message, details = '') {
        this._showMessage(message, 'error', details);
    }

    /** 情報メッセージを表示 */
    showInfoMessage(message, sectionToFocus = null, append = false) {
        // infoメッセージ用の要素がなければ作成
        let infoElement = document.getElementById('info-message');
        if (!infoElement) {
            infoElement = document.createElement('div');
            infoElement.id = 'info-message';
            // メインコンテンツの先頭に追加するのが一般的
            this.elements.mainContent?.insertBefore(infoElement, this.elements.mainContent.firstChild);
        }
        this._showMessage(message, 'info', '', append);

        // 指定されたセクションの先頭にフォーカスを移動 (アクセシビリティ)
        if (sectionToFocus) {
            const sectionElement = document.getElementById(sectionToFocus);
             // セクション自体、または最初のフォーカス可能な要素にフォーカス
            const focusable = sectionElement?.querySelector('h2, button, input, select, textarea, a[href]');
            if (focusable) {
                 focusable.focus({ preventScroll: true }); // スクロールせずにフォーカス
                 sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /** すべてのメッセージを非表示 */
    hideMessage() {
        if (this.elements.successMessage) this.elements.successMessage.style.display = 'none';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        const infoElement = document.getElementById('info-message');
        if (infoElement) infoElement.style.display = 'none';
    }

     /**
      * ボタンの状態を変更する (A-15)
      * @param {HTMLButtonElement} button 対象ボタン
      * @param {'saving' | 'saved-success' | 'saved-error' | 'loading'} state 状態
      * @param {string} text ボタンに表示するテキスト
      * @private
      */
     _setButtonState(button, state, text) {
         if (!button) return;
         // Remove previous state classes
         button.classList.remove('saving', 'saved-success', 'saved-error', 'loading');
         if (state) {
             button.classList.add(state);
         }
         button.disabled = (state === 'saving' || state === 'loading'); // 保存中・読み込み中は無効化
         button.textContent = text;
     }
      /**
      * ボタンの状態をデフォルトに戻す
      * @param {HTMLButtonElement} button 対象ボタン
      * @private
      */
     _resetButtonState(button) {
         if (!button) return;
         button.classList.remove('saving', 'saved-success', 'saved-error', 'loading');
         button.disabled = false;
          // 元のテキストに戻す (data属性などに元のテキストを保持しておくのが望ましい)
         // 簡単な実装として、IDに基づいて判断
         if (button.id === 'save-settings-btn') button.textContent = '全設定を保存';
         else if (button.id === 'save-stages-only-btn') button.textContent = '段階設定のみ保存';
         else if (button.id === 'save-images-only-btn') button.textContent = '画像設定のみ保存';
         else if (button.id === 'upload-image-btn') {
             const stageIndex = this.elements.stageSelector?.value || 0;
             button.textContent = `段階 ${stageIndex} に画像をアップロード`;
         }
         // 他のボタンについても同様に元のテキストを設定
     }


    // --- デバッグ関連 (A-16) ---

    /**
     * デバッグモードの有効/無効を切り替え、表示を更新
     * @private
     */
    _updateDebugMode() {
        this.isDebugMode = this.elements.debugModeCheckbox.checked;
        this.elements.debugInfo.style.display = this.isDebugMode ? 'block' : 'none';
        this.elements.debugInfo.setAttribute('aria-hidden', !this.isDebugMode); // N-06
        if (this.isDebugMode) {
            console.log('Debug mode enabled.');
            this._logDebugInfo('Debug mode enabled.');
        } else {
            console.log('Debug mode disabled.');
             this.elements.debugInfo.textContent = ''; // 無効化時にクリア
        }
    }

    /**
     * デバッグ情報を表示エリアに出力
     * @param {...any} args 出力する情報
     * @private
     */
    _logDebugInfo(...args) {
        if (!this.isDebugMode) return;
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return arg.toString();
                }
            }
            return arg;
        }).join(' ');

        const timestamp = new Date().toLocaleTimeString();
        this.elements.debugInfo.textContent += `[${timestamp}] ${message}\n\n`;
        // 自動スクロール
        this.elements.debugInfo.scrollTop = this.elements.debugInfo.scrollHeight;
    }

    // --- 代替保存処理 (A-11) ---

    /**
     * 代替保存用の隠しフォームを作成
     * @returns {HTMLFormElement} 隠しフォーム要素
     * @private
     */
     _createHiddenForm() {
        const form = document.createElement('form');
        form.method = 'post';
        form.target = '_blank'; // 結果を別タブで表示（GASからの応答が見えるように）
        form.style.display = 'none';
        form.setAttribute('aria-hidden', 'true');

        const actionInput = document.createElement('input');
        actionInput.type = 'hidden';
        actionInput.name = 'action';
        form.appendChild(actionInput);

        const dataInput = document.createElement('input');
        dataInput.type = 'hidden';
        dataInput.name = 'data'; // GAS側で e.parameter.data で受け取る
        form.appendChild(dataInput);

         if (this.isDebugMode) {
             const debugInput = document.createElement('input');
             debugInput.type = 'hidden';
             debugInput.name = 'debug';
             debugInput.value = 'true';
             form.appendChild(debugInput);
         }

        return form;
    }

    /**
     * 隠しフォームを使ってデータをPOST送信する (A-11)
     * @param {object} payload 送信するデータオブジェクト
     */
    saveSettingsViaForm(payload) {
        if (!this.apiUrl) {
            console.error('Fallback form submission failed: API URL not set.');
            return;
        }
        console.warn('Attempting fallback form submission...');
        this.showInfoMessage('通常の保存リクエストに失敗しました。代替手段としてフォーム送信を試みます...(デバッグモード時のみ)', null, true);

        const form = this.hiddenForm;
        form.action = this.apiUrl; // 送信先URLを設定

        // フォーム内の隠しフィールドに値を設定
        form.querySelector('input[name="action"]').value = 'saveConfig'; // アクション名
        form.querySelector('input[name="data"]').value = JSON.stringify(payload); // JSONデータを文字列として設定

        form.submit(); // フォームを送信
    }
}

// --- 初期化 ---
// DOMContentLoaded を待って AdminApp インスタンスを作成
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});
