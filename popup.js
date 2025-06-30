document.addEventListener('DOMContentLoaded', restoreOptions);

// API 키 관련 버튼 리스너
document.getElementById('impu-saveApiKeyButton').addEventListener('click', saveApiKeyAndValidate);
document.getElementById('impu-toggleApiKeyVisibility').addEventListener('click', toggleApiKeyVisibility);

// 이미지 업로드 버튼 리스너
document.getElementById('impu-uploadImageButton').addEventListener('click', uploadImageAndProcess);

// 클립보드 이미지 처리 버튼 리스너
document.getElementById('impu-processClipboardImageButton').addEventListener('click', processClipboardImage);

// 탭 전환 로직
document.querySelectorAll('.impu-tab-button').forEach(button => {
    button.addEventListener('click', (event) => {
        document.querySelectorAll('.impu-tab-button').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        document.querySelectorAll('.impu-tab-content').forEach(content => content.classList.remove('active'));

        const targetTabId = event.target.dataset.tab + '-tab';
        document.getElementById(`impu-${targetTabId}`).classList.add('active'); // ID에 impu- 접두사 추가

        // 히스토리 탭으로 전환될 때만 히스토리 로드
        if (event.target.dataset.tab === 'history') {
            loadAndDisplayHistory();
        }
    });
});

// 접기/펴기 섹션 로직 추가
document.querySelectorAll('.impu-collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.closest('.impu-collapsible-section');
        section.classList.toggle('active'); // active 클래스 토글
        const icon = header.querySelector('.impu-collapse-icon');
        // 아이콘 텍스트 업데이트
        icon.textContent = section.classList.contains('active') ? '▼' : '▶';
    });
});


// 기타 설정 저장 버튼 리스너 추가
document.getElementById('impu-saveOtherSettingsButton').addEventListener('click', saveOtherSettings);


// 기타 버튼 리스너
document.getElementById('impu-clearAllHistoryButton').addEventListener('click', clearAllHistory);
document.getElementById('impu-resetAllSettingsButton').addEventListener('click', resetAllSettings);


/**
 * 팝업 내의 상태 메시지 영역에 진행 상태를 표시합니다.
 * @param {HTMLElement} statusElement - 메시지를 표시할 DOM 요소 (예: impu-imageUploadStatus).
 * @param {boolean} show - true면 표시, false면 숨김.
 * @param {string} message - 표시할 메시지.
 */
function updateSpecificProcessStatus(statusElement, show, message = '') {
    if (show) {
        statusElement.innerHTML = `<span class="impu-spinner"></span> ${message}`;
        statusElement.classList.add('loading');
        statusElement.style.color = 'var(--text-color-light)';
    } else {
        statusElement.textContent = '';
        statusElement.classList.remove('loading');
    }
}


/**
 * Gemini API 키를 저장하고 유효성을 검사합니다.
 */
async function saveApiKeyAndValidate() {
    const apiKey = document.getElementById('impu-geminiApiKey').value;
    const statusElement = document.getElementById('impu-apiKeyStatus');
    const apiKeyInput = document.getElementById('impu-geminiApiKey');

    statusElement.textContent = 'API 키 확인 중...';
    statusElement.style.color = 'var(--text-color-light)';
    apiKeyInput.classList.remove('impu-error-input', 'impu-success-input'); // 이전 상태 클래스 제거
    statusElement.classList.add('loading'); // 스피너 표시

    if (!apiKey) {
        statusElement.textContent = 'API 키를 입력해주세요.';
        statusElement.style.color = 'var(--error-color)';
        apiKeyInput.classList.add('impu-error-input');
        statusElement.classList.remove('loading'); // 스피너 숨김
        setTimeout(() => { statusElement.textContent = ''; apiKeyInput.classList.remove('impu-error-input'); }, 3000);
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            action: "validateGeminiApiKey",
            apiKey: apiKey
        });

        statusElement.classList.remove('loading'); // 스피너 숨김
        if (response.success) {
            await chrome.storage.local.set({ geminiApiKey: apiKey });
            statusElement.textContent = 'API 키가 유효하며 저장되었습니다!';
            statusElement.style.color = 'var(--success-color)';
            apiKeyInput.classList.add('impu-success-input');
        } else {
            statusElement.textContent = `API 키 유효성 검사 실패: ${response.error}`;
            statusElement.style.color = 'var(--error-color)';
            apiKeyInput.classList.add('impu-error-input');
        }
    } catch (error) {
        statusElement.classList.remove('loading'); // 스피너 숨김
        statusElement.textContent = `오류 발생: ${error.message}`;
        statusElement.style.color = 'var(--error-color)';
        apiKeyInput.classList.add('impu-error-input');
    }
    setTimeout(() => { statusElement.textContent = ''; apiKeyInput.classList.remove('impu-error-input', 'impu-success-input'); }, 3000);
}

/**
 * Gemini API 키 입력 필드의 가시성을 토글합니다.
 */
function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('impu-geminiApiKey');
    const toggleButton = document.getElementById('impu-toggleApiKeyVisibility');
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleButton.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleButton.textContent = '👁️';
    }
}

/**
 * 기타 설정을 저장합니다.
 */
function saveOtherSettings() {
    const selectedPosition = document.querySelector('input[name="resultWindowPosition"]:checked')?.value || 'bottom-right';
    const selectedModel = document.getElementById('impu-geminiModel').value;
    const promptLength = document.getElementById('impu-promptLength').value;
    const extractionMethod = document.querySelector('input[name="extractionMethod"]:checked')?.value || 'both';
    const customPositivePrompt = document.getElementById('impu-customPositivePrompt').value;
    const customNegativePrompt = document.getElementById('impu-customNegativePrompt').value;
    const geminiPositiveTemplate = document.getElementById('impu-geminiPositiveTemplate').value;
    const geminiNegativeTemplate = document.getElementById('impu-geminiNegativeTemplate').value;


    chrome.storage.local.set({
        resultWindowPosition: selectedPosition,
        geminiModel: selectedModel,
        promptLength: promptLength,
        extractionMethod: extractionMethod,
        customPositivePrompt: customPositivePrompt,
        customNegativePrompt: customNegativePrompt,
        geminiPositiveTemplate: geminiPositiveTemplate,
        geminiNegativeTemplate: geminiNegativeTemplate
    }, () => {
        const statusElement = document.getElementById('impu-otherSettingsStatus');
        statusElement.textContent = '설정이 저장되었습니다.';
        statusElement.style.color = 'var(--accent-color)';
        setTimeout(() => {
            statusElement.textContent = '';
        }, 1500);

        // content.js에 UI 업데이트 메시지 전송
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateUI",
                    resultWindowPosition: selectedPosition,
                    extractionMethod: extractionMethod // 현재는 content.js에서 직접 사용하지 않으나, 통일성을 위해 전송
                });
            }
        });
    });
}

/**
 * 저장된 옵션들을 복원합니다.
 */
function restoreOptions() {
    chrome.storage.local.get([
        'geminiApiKey',
        'resultWindowPosition',
        'geminiModel',
        'promptLength',
        'extractionMethod',
        'customPositivePrompt',
        'customNegativePrompt',
        'geminiPositiveTemplate', // 새로 추가된 템플릿
        'geminiNegativeTemplate', // 새로 추가된 템플릿
        'promptHistory'
    ], (data) => {
        document.getElementById('impu-geminiApiKey').value = data.geminiApiKey || '';

        const savedPosition = data.resultWindowPosition || 'bottom-right';
        const radio = document.getElementById(`impu-pos${capitalizeFirstLetter(savedPosition.replace('-', ''))}`); // ID에 impu- 접두사 추가
        if (radio) {
            radio.checked = true;
        }

        const savedModel = data.geminiModel || 'gemini-1.5-flash';
        const modelSelect = document.getElementById('impu-geminiModel'); // ID에 impu- 접두사 추가
        if (modelSelect) {
            modelSelect.value = savedModel;
        }

        const savedPromptLength = data.promptLength || 'medium';
        const promptLengthSelect = document.getElementById('impu-promptLength'); // ID에 impu- 접두사 추가
        if (promptLengthSelect) {
            promptLengthSelect.value = savedPromptLength;
        }

        const savedExtractionMethod = data.extractionMethod || 'both';
        const extractionRadio = document.getElementById(`impu-ext${capitalizeFirstLetter(savedExtractionMethod)}`); // ID에 impu- 접두사 추가
        if (extractionRadio) {
            extractionRadio.checked = true;
        }

        document.getElementById('impu-customPositivePrompt').value = data.customPositivePrompt || ''; // ID에 impu- 접두사 추가
        document.getElementById('impu-customNegativePrompt').value = data.customNegativePrompt || ''; // ID에 impu- 접두사 추가
        document.getElementById('impu-geminiPositiveTemplate').value = data.geminiPositiveTemplate ||
        `이 이미지에 대한 NovelAI와 Stable Diffusion 프롬프트를 JSON 형식으로 생성해 주세요. {promptLengthInstruction} {detailInstruction}`; // 기본 템플릿
        document.getElementById('impu-geminiNegativeTemplate').value = data.geminiNegativeTemplate ||
        `**부정적인 프롬프트**: 절대 적지 마세요. (예: bad hand, bad eyes).`; // 기본 템플릿

        // 초기 탭 활성화 (이미지 변환 탭)
        document.querySelectorAll('.impu-tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.impu-tab-button').forEach(btn => btn.classList.remove('active'));

        const imageConversionTab = document.getElementById('impu-image-conversion-tab'); // ID에 impu- 접두사 추가
        const imageConversionButton = document.querySelector('.impu-tab-button[data-tab="image-conversion"]'); // 클래스에 impu- 접두사 추가
        if (imageConversionTab) {
            imageConversionTab.classList.add('active');
        }
        if (imageConversionButton) {
            imageConversionButton.classList.add('active');
        }
        
        // 초기 접기/펴기 상태 설정
        document.querySelectorAll('.impu-collapsible-section').forEach(section => { // 클래스에 impu- 접두사 추가
            const header = section.querySelector('.impu-collapsible-header'); // 클래스에 impu- 접두사 추가
            const icon = header.querySelector('.impu-collapse-icon'); // 클래스에 impu- 접두사 추가
            // 섹션이 'active' 클래스를 가지고 있으면 ▼, 아니면 ▶
            icon.textContent = section.classList.contains('active') ? '▼' : '▶';
        });
    });

    // 버전 정보 표시
    chrome.runtime.getManifest(manifest => {
        document.getElementById('impu-version').textContent = manifest.version; // ID에 impu- 접두사 추가
    });
}

/**
 * 이미지를 업로드하고 프롬프트 생성을 요청합니다.
 */
async function uploadImageAndProcess() {
    const fileInput = document.getElementById('impu-imageUpload'); // ID에 impu- 접두사 추가
    const statusElement = document.getElementById('impu-imageUploadStatus'); // ID에 impu- 접두사 추가
    const files = fileInput.files;

    if (files.length === 0) {
        statusElement.textContent = '업로드할 이미지를 선택해주세요.';
        statusElement.style.color = 'var(--error-color)';
        setTimeout(() => { statusElement.textContent = ''; }, 3000);
        return;
    }

    const file = files[0];
    if (!file.type.startsWith('image/')) {
        statusElement.textContent = '이미지 파일만 업로드할 수 있습니다.';
        statusElement.style.color = 'var(--error-color)';
        setTimeout(() => { statusElement.textContent = ''; }, 3000);
        return;
    }

    const existingResults = document.getElementById('impu-popup-prompt-results'); // ID에 impu- 접두사 추가
    if (existingResults) {
        existingResults.remove();
    }

    updateSpecificProcessStatus(statusElement, true, '이미지 로드 및 처리 중...'); // 팝업 내 진행 상태 표시

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const imageDataUrl = reader.result;

            const response = await chrome.runtime.sendMessage({
                action: "processImageWithGeminiFromPopup",
                imageDataUrl: imageDataUrl,
                imageType: file.type
            });

            updateSpecificProcessStatus(statusElement, false); // 처리 완료 후 진행 상태 숨김

            if (response.error) {
                showToast(`오류: ${response.error}`, 'error'); // 오류 토스트 표시
                // 오류가 발생해도 결과창을 표시하여 오류 메시지를 볼 수 있도록 함
                displayPromptResultsInPopup(
                    response.novelai || "N/A", // 에러 발생 시 N/A
                    response.stable_diffusion || "N/A", // 에러 발생 시 N/A
                    response.detectedNovelaiPrompt,
                    response.detectedStableDiffusionPrompt,
                    response.detectedExifComment,
                    response.usedExtractionMethod,
                    response.error // 오류 메시지 전달
                );
            } else {
                displayPromptResultsInPopup(
                    response.novelai,
                    response.stable_diffusion,
                    response.detectedNovelaiPrompt,
                    response.detectedStableDiffusionPrompt,
                    response.detectedExifComment,
                    response.usedExtractionMethod
                );
            }
        };
        reader.onerror = (error) => {
            updateSpecificProcessStatus(statusElement, false);
            showToast(`파일 읽기 오류: ${error.message}`, 'error');
        };

    } catch (error) {
        updateSpecificProcessStatus(statusElement, false);
        showToast(`이미지 처리 오류: ${error.message}`, 'error');
    }
}

/**
 * 클립보드에 복사된 이미지를 처리하고 프롬프트 생성을 요청합니다.
 */
async function processClipboardImage() {
    const statusElement = document.getElementById('impu-clipboardImageStatus'); // ID에 impu- 접두사 추가
    
    const existingResults = document.getElementById('impu-popup-prompt-results'); // ID에 impu- 접두사 추가
    if (existingResults) {
        existingResults.remove();
    }
    
    updateSpecificProcessStatus(statusElement, true, '클립보드에서 이미지 로드 중...'); // 팝업 내 진행 상태 표시

    try {
        const clipboardItems = await navigator.clipboard.read();
        let imageBlob = null;

        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    imageBlob = await item.getType(type);
                    break;
                }
            }
            if (imageBlob) break;
        }

        if (!imageBlob) {
            updateSpecificProcessStatus(statusElement, false); // 진행 상태 숨김
            statusElement.textContent = '클립보드에 이미지 데이터가 없습니다.';
            statusElement.style.color = 'var(--error-color)';
            showToast('클립보드에 이미지 데이터가 없습니다.', 'error', 3000);
            setTimeout(() => { statusElement.textContent = ''; }, 3000);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(imageBlob);
        reader.onloadend = async () => {
            const imageDataUrl = reader.result;

            updateSpecificProcessStatus(statusElement, true, '클립보드 이미지 처리 중...'); // 메시지 업데이트

            const response = await chrome.runtime.sendMessage({
                action: "processImageWithGeminiFromPopup",
                imageDataUrl: imageDataUrl,
                imageType: imageBlob.type
            });

            updateSpecificProcessStatus(statusElement, false); // 처리 완료 후 진행 상태 숨김

            if (response.error) {
                showToast(`오류: ${response.error}`, 'error'); // 오류 토스트 표시
                displayPromptResultsInPopup(
                    response.novelai || "N/A",
                    response.stable_diffusion || "N/A",
                    response.detectedNovelaiPrompt,
                    response.detectedStableDiffusionPrompt,
                    response.detectedExifComment,
                    response.usedExtractionMethod,
                    response.error
                );
            } else {
                displayPromptResultsInPopup(
                    response.novelai,
                    response.stable_diffusion,
                    response.detectedNovelaiPrompt,
                    response.detectedStableDiffusionPrompt,
                    response.detectedExifComment,
                    response.usedExtractionMethod
                );
            }
        };
        reader.onerror = (error) => {
            updateSpecificProcessStatus(statusElement, false);
            showToast(`클립보드 이미지 읽기 오류: ${error.message}`, 'error');
            setTimeout(() => { statusElement.textContent = ''; }, 3000);
        };

    } catch (error) {
        updateSpecificProcessStatus(statusElement, false);
        if (error.name === 'NotAllowedError') {
            statusElement.textContent = '클립보드 접근 권한이 거부되었습니다. 권한을 허용해주세요.';
            statusElement.style.color = 'var(--error-color)';
            showToast('클립보드 접근 권한이 필요합니다.', 'error', 5000);
        } else {
            statusElement.textContent = `클립보드 이미지 처리 오류: ${error.message}`;
            statusElement.style.color = 'var(--error-color)';
            showToast(`클립보드 이미지 처리 오류: ${error.message}`, 'error', 5000);
        }
        console.error('Failed to read clipboard contents: ', error);
        setTimeout(() => { statusElement.textContent = ''; }, 3000);
    }
}


/**
 * 팝업 내에서 프롬프트 결과를 표시하는 함수
 */
function displayPromptResultsInPopup(geminiNovelai, geminiStableDiffusion, detectedNovelai, detectedStableDiffusion, detectedExifComment, usedExtractionMethod, errorMessage = null) {
    const resultsContainer = document.getElementById('impu-popup-prompt-results') || document.createElement('div'); // ID에 impu- 접두사 추가
    if (!resultsContainer.id) { // 새로 생성된 경우
        resultsContainer.id = 'impu-popup-prompt-results'; // ID에 impu- 접두사 추가
        document.getElementById('impu-image-conversion-tab').appendChild(resultsContainer); // ID에 impu- 접두사 추가
    }
    resultsContainer.classList.add('impu-neumorphic'); // 클래스에 impu- 접두사 추가
    resultsContainer.style.display = 'none'; // 초기에는 숨김 상태로 시작

    let detectedPromptHtml = '';
    if ((usedExtractionMethod === 'metadata' || usedExtractionMethod === 'both') && (detectedNovelai || detectedStableDiffusion || detectedExifComment)) {
        let combinedDetectedPrompt = '';
        if (detectedNovelai) {
            combinedDetectedPrompt += `NovelAI 원문: ${detectedNovelai}\n`;
        }
        if (detectedStableDiffusion && detectedStableDiffusion !== detectedNovelai) {
            combinedDetectedPrompt += `Stable Diffusion 원문: ${detectedStableDiffusion}\n`;
        }
        if (!combinedDetectedPrompt && detectedExifComment) {
             combinedDetectedPrompt = `원문 메타데이터: \n${detectedExifComment}\n`;
        }

        if(combinedDetectedPrompt) {
            detectedPromptHtml = `
                <div class="impu-collapsible-section active"> <div class="impu-collapsible-header">
                        <h3 class="impu-section-title" style="color: var(--text-color); font-size: 16px;">이미지에서 추출된 프롬프트</h3>
                        <span class="impu-collapse-icon">▼</span>
                    </div>
                    <div class="impu-collapsible-content">
                        <div class="impu-prompt-group impu-detected-prompt-group">
                            <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${combinedDetectedPrompt.trim()}</textarea>
                            <button class="impu-copy-button impu-neumorphic-button" data-copy-target="detected_combined_popup">모두 복사</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    const geminiGeneratedHtml = (usedExtractionMethod === 'gemini' || usedExtractionMethod === 'both') ? `
        <div class="impu-collapsible-section active"> <div class="impu-collapsible-header">
                <h3 class="impu-section-title" style="color: var(--text-color); font-size: 16px;">Gemini 생성 프롬프트</h3>
                <span class="impu-collapse-icon">▼</span>
            </div>
            <div class="impu-collapsible-content">
                <div class="impu-prompt-group">
                    <strong>NovelAI (Gemini 생성):</strong>
                    <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${geminiNovelai}</textarea>
                    <button class="impu-copy-button impu-neumorphic-button" data-copy-target="novelai_popup">복사</button>
                </div>
                <div class="impu-prompt-group">
                    <strong>Stable Diffusion (Gemini 생성):</strong>
                    <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${geminiStableDiffusion}</textarea>
                    <button class="impu-copy-button impu-neumorphic-button" data-copy-target="stable_diffusion_popup">복사</button>
                </div>
            </div>
        </div>
    ` : '';


    let errorHtml = '';
    if (errorMessage) {
        errorHtml = `
            <div style="color: var(--error-color); text-align: center; margin-bottom: 15px;">
                ${errorMessage}
            </div>
        `;
    }

    resultsContainer.innerHTML = `
        <div class="impu-prompt-header" style="border-bottom: 1px solid rgba(var(--text-color-light), 0.3); padding-bottom: 10px; margin-bottom: 15px;">
            <strong style="font-size: 18px; color: var(--text-color);">생성된 프롬프트</strong>
            <button class="impu-close-button" id="impu-closePopupResults" style="position: absolute; right: 5px; top: 5px;">X</button>
        </div>
        ${errorHtml}
        ${detectedPromptHtml}
        ${geminiGeneratedHtml}
    `;
    
    // 새로 추가된 접기/펴기 섹션에 대한 이벤트 리스너 다시 바인딩
    resultsContainer.querySelectorAll('.impu-collapsible-section').forEach(section => {
        const header = section.querySelector('.impu-collapsible-header');
        if (header) {
            header.addEventListener('click', () => {
                section.classList.toggle('active');
                const icon = header.querySelector('.impu-collapse-icon');
                icon.textContent = section.classList.contains('active') ? '▼' : '▶';
            });
            // 초기 상태에 따라 아이콘 설정 (기본은 active)
            const icon = header.querySelector('.impu-collapse-icon');
            if (icon) icon.textContent = section.classList.contains('active') ? '▼' : '▶';
        }
    });

    resultsContainer.style.display = 'block';
    requestAnimationFrame(() => {
        resultsContainer.classList.add('show');
    });


    resultsContainer.querySelectorAll('.impu-copy-button').forEach(copyBtn => { // 클래스에 impu- 접두사 추가
        copyBtn.addEventListener('click', (e) => {
            const textarea = e.target.previousElementSibling;
            if (textarea && textarea.classList.contains('impu-prompt-textarea')) { // 클래스에 impu- 접두사 추가
                copyToClipboard(textarea.value);
            }
        });
    });

    document.getElementById('impu-closePopupResults').addEventListener('click', () => { // ID에 impu- 접두사 추가
        resultsContainer.classList.remove('show');
        resultsContainer.addEventListener('transitionend', () => {
            resultsContainer.remove();
        }, { once: true });
    });
}


/**
 * 팝업에서 background.js로부터 진행 상황 메시지를 받을 때 호출됩니다.
 * 이 함수는 이제 팝업 내 상태 메시지 영역에 직접 로딩 스피너를 포함하여 표시합니다.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updatePopupStatus") {
        const imageUploadStatusElement = document.getElementById('impu-imageUploadStatus'); // ID에 impu- 접두사 추가
        const clipboardImageStatusElement = document.getElementById('impu-clipboardImageStatus'); // ID에 impu- 접두사 추가
        const apiKeyStatusElement = document.getElementById('impu-apiKeyStatus'); // ID에 impu- 접두사 추가
        const otherSettingsStatusElement = document.getElementById('impu-otherSettingsStatus'); // ID에 impu- 접두사 추가
        
        let statusElementToUse = null;

        const currentActiveTabId = document.querySelector('.impu-tab-content.active')?.id; // 클래스에 impu- 접두사 추가

        if (currentActiveTabId === 'impu-image-conversion-tab') { // ID에 impu- 접두사 추가
            // 이미지 업로드 또는 클립보드 이미지 처리 시
            // 이 요청은 background에서 updatePopupStatus를 직접 호출할 때만 발생
            // 이제 로딩 상태는 updateSpecificProcessStatus를 통해 제어되므로, 여기서는 메시지를 클리어하는 용도로만 사용
            if (request.type === 'loading') {
                // do nothing, status is handled by updateSpecificProcessStatus
            } else {
                // Clear any lingering loading message in either upload or clipboard status
                if (imageUploadStatusElement.classList.contains('loading')) {
                    updateSpecificProcessStatus(imageUploadStatusElement, false);
                }
                if (clipboardImageStatusElement.classList.contains('loading')) {
                    updateSpecificProcessStatus(clipboardImageStatusElement, false);
                }
                // then display toast if it's not a loading message
                if (request.message) {
                    showToast(request.message, request.type, request.duration);
                }
            }
        } else if (currentActiveTabId === 'impu-settings-info-tab') { // ID에 impu- 접두사 추가
            // API 키 저장 또는 기타 설정 저장 시
            // updatePopupStatus는 background에서 직접 API 키 저장 로직의 응답을 받을 때 사용됨
            // 이 부분은 API 키 유효성 검사 로직이 이미 statusElement를 직접 업데이트하므로,
            // 여기서는 다른 설정을 저장할 때의 상태 메시지 (otherSettingsStatusElement)에만 초점을 맞춤
            if (request.type === 'loading') {
                // API 키 유효성 검사는 이미 직접 statusElement를 업데이트하므로 여기서는 처리하지 않음
            } else {
                if (request.message) {
                    otherSettingsStatusElement.textContent = request.message;
                    otherSettingsStatusElement.style.color = request.type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
                    setTimeout(() => { otherSettingsStatusElement.textContent = ''; }, 1500);
                }
            }
        }
    }
});


/**
 * 프롬프트 히스토리를 로드하여 화면에 표시합니다.
 */
function loadAndDisplayHistory() {
    chrome.storage.local.get('promptHistory', (data) => {
        const history = data.promptHistory || [];
        const historyList = document.getElementById('impu-promptHistoryList'); // ID에 impu- 접두사 추가
        const noHistoryMessage = document.getElementById('impu-noHistoryMessage'); // ID에 impu- 접두사 추가
        historyList.innerHTML = '';

        if (history.length === 0) {
            noHistoryMessage.style.display = 'block';
            return;
        }
        noHistoryMessage.style.display = 'none';

        const reversedHistory = [...history].reverse();
        
        reversedHistory.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.classList.add('impu-history-item', 'impu-neumorphic'); // 클래스에 impu- 접두사 추가
            listItem.innerHTML = `
                <div class="impu-history-item-header">
                    <span class="impu-history-item-date">${new Date(item.timestamp).toLocaleString()}</span>
                    ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Prompt thumbnail" class="impu-history-thumbnail">` : ''}
                </div>
                <div class="impu-history-item-prompt-preview">
                    <strong>NovelAI:</strong> ${item.novelai.substring(0, 80)}${item.novelai.length > 80 ? '...' : ''}<br>
                    <strong>SD:</strong> ${item.stable_diffusion.substring(0, 80)}${item.stable_diffusion.length > 80 ? '...' : ''}
                </div>
                ${(item.detectedNovelai || item.detectedStableDiffusion || item.detectedExifComment) ? `
                <div class="impu-history-item-prompt-preview" style="margin-top: 5px;">
                    <strong>원문:</strong> ${
                        (item.detectedNovelai || item.detectedStableDiffusion || item.detectedExifComment || '').substring(0, 80)
                    }${
                        (item.detectedNovelai || item.detectedStableDiffusion || item.detectedExifComment || '').length > 80 ? '...' : ''
                    }
                </div>
                ` : ''}
                <div class="impu-history-item-buttons">
                    <button class="impu-history-item-button impu-neumorphic-button" data-copy-target="novelai" data-original-index="${reversedHistory.length - 1 - index}">NovelAI 복사</button>
                    <button class="impu-history-item-button impu-neumorphic-button" data-copy-target="stable_diffusion" data-original-index="${reversedHistory.length - 1 - index}">SD 복사</button>
                    ${(item.detectedNovelai || item.detectedStableDiffusion || item.detectedExifComment) ? `
                    <button class="impu-history-item-button impu-neumorphic-button" data-copy-target="detected_original" data-original-index="${reversedHistory.length - 1 - index}">원문 복사</button>
                    ` : ''}
                    <button class="impu-history-item-button impu-neumorphic-button delete-history-item" data-original-index="${reversedHistory.length - 1 - index}">삭제</button>
                </div>
            `;
            historyList.appendChild(listItem);
        });

        historyList.querySelectorAll('.impu-history-item-button').forEach(button => { // 클래스에 impu- 접두사 추가
            button.addEventListener('click', (event) => {
                const originalIndex = parseInt(event.target.dataset.originalIndex);
                const promptData = history[originalIndex];

                if (event.target.classList.contains('delete-history-item')) {
                    deleteHistoryItem(originalIndex);
                } else {
                    const targetType = event.target.dataset.copyTarget;
                    let textToCopy = '';
                    if (targetType === 'novelai') {
                        textToCopy = promptData.novelai;
                    } else if (targetType === 'stable_diffusion') {
                        textToCopy = promptData.stable_diffusion;
                    } else if (targetType === 'detected_original') {
                        let originalText = '';
                        if (promptData.detectedNovelai) {
                            originalText += `NovelAI 원문: ${promptData.detectedNovelai}\n`;
                        }
                        if (promptData.detectedStableDiffusion && promptData.detectedStableDiffusion !== promptData.detectedNovelai) {
                            originalText += `Stable Diffusion 원문: ${promptData.detectedStableDiffusion}\n`;
                        }
                        if (!originalText && promptData.detectedExifComment) {
                             originalText = `원문 메타데이터: \n${promptData.detectedExifComment}\n`;
                        }
                        textToCopy = originalText.trim();
                    }
                    copyToClipboard(textToCopy);
                }
            });
        });
    });
}

/**
 * 클립보드에 텍스트를 복사하고 토스트 알림을 표시합니다.
 * 이 함수는 content.js의 showToast를 호출하여 웹페이지 상단에 알림을 표시합니다.
 * @param {string} text 복사할 텍스트
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard from popup:', text);
            chrome.runtime.sendMessage({ action: "showToast", message: '클립보드에 복사되었습니다!', type: 'success', duration: 1500 });
        })
        .catch(err => {
            console.error('Failed to copy text from popup:', err);
            chrome.runtime.sendMessage({ action: "showToast", message: '클립보드 복사에 실패했습니다.', type: 'error', duration: 3000 });
        });
}


/**
 * 특정 인덱스의 히스토리 항목을 삭제합니다.
 * @param {number} index 삭제할 항목의 원래 인덱스 (역순 정렬 전 인덱스)
 */
function deleteHistoryItem(index) {
    chrome.storage.local.get('promptHistory', (data) => {
        let history = data.promptHistory || [];
        if (index > -1 && index < history.length) {
            history.splice(index, 1);
            chrome.storage.local.set({ promptHistory: history }, () => {
                console.log('History item deleted.');
                loadAndDisplayHistory();
                chrome.runtime.sendMessage({ action: "showToast", message: '히스토리 항목이 삭제되었습니다.', type: 'warning', duration: 1500 });
            });
        }
    });
}

/**
 * 모든 프롬프트 히스토리 항목을 삭제합니다.
 */
function clearAllHistory() {
    if (confirm('모든 프롬프트 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        chrome.storage.local.set({ promptHistory: [] }, () => {
            console.log('All prompt history cleared.');
            loadAndDisplayHistory();
            chrome.runtime.sendMessage({ action: "showToast", message: '모든 히스토리가 삭제되었습니다.', type: 'success', duration: 2000 });
        });
    }
}

/**
 * 모든 확장 프로그램 설정을 기본값으로 초기화합니다.
 */
function resetAllSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        chrome.storage.local.clear(() => {
            console.log('All settings cleared and reset to default.');
            restoreOptions();
            chrome.runtime.sendMessage({ action: "showToast", message: '모든 설정이 초기화되었습니다.', type: 'success', duration: 2000 });
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateUI",
                        resultWindowPosition: 'bottom-right',
                        extractionMethod: 'both'
                    });
                }
            });
        });
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}