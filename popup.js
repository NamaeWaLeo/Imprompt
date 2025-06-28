document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveApiKeyButton').addEventListener('click', saveApiKeyAndValidate);
document.getElementById('saveOtherSettingsButton').addEventListener('click', saveOtherSettings);

const iconSizeInput = document.getElementById('iconSize');
const iconSizeValueSpan = document.getElementById('iconSizeValue');

if (iconSizeInput && iconSizeValueSpan) {
    iconSizeInput.addEventListener('input', () => {
        iconSizeValueSpan.textContent = `${iconSizeInput.value}%`;
    });
}

async function saveApiKeyAndValidate() {
    const apiKey = document.getElementById('geminiApiKey').value;
    const statusElement = document.getElementById('apiKeyStatus');
    statusElement.textContent = 'API 키 확인 중...';
    statusElement.style.color = 'var(--text-color-light)';

    if (!apiKey) {
        statusElement.textContent = 'API 키를 입력해주세요.';
        statusElement.style.color = 'var(--error-color)';
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            action: "validateGeminiApiKey",
            apiKey: apiKey
        });

        if (response.success) {
            await chrome.storage.sync.set({ geminiApiKey: apiKey });
            statusElement.textContent = 'API 키가 유효하며 저장되었습니다!';
            statusElement.style.color = 'var(--success-color)';
        } else {
            statusElement.textContent = `API 키 유효성 검사 실패: ${response.error}`;
            statusElement.style.color = 'var(--error-color)';
        }
    } catch (error) {
        statusElement.textContent = `오류 발생: ${error.message}`;
        statusElement.style.color = 'var(--error-color)';
    }
    setTimeout(() => { statusElement.textContent = ''; }, 3000);
}

function saveOtherSettings() {
    const selectedPosition = document.querySelector('input[name="buttonPosition"]:checked')?.value || 'bottom-right';
    const selectedModel = document.getElementById('geminiModel').value;
    const promptLength = document.getElementById('promptLength').value;
    const iconSize = document.getElementById('iconSize').value; // 아이콘 크기 값 가져오기

    chrome.storage.sync.set({
        buttonPosition: selectedPosition,
        geminiModel: selectedModel,
        promptLength: promptLength,
        iconSize: iconSize // 아이콘 크기 저장
    }, () => {
        const statusElement = document.getElementById('otherSettingsStatus');
        statusElement.textContent = '다른 설정이 저장되었습니다.';
        statusElement.style.color = 'var(--accent-color)';
        setTimeout(() => {
            statusElement.textContent = '';
        }, 1500);

        // content.js에 UI 업데이트 메시지 전송
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateUI",
                    buttonPosition: selectedPosition,
                    iconSize: iconSize // 변경된 아이콘 크기 전달
                });
            }
        });
    });
}

function restoreOptions() {
    chrome.storage.sync.get(['geminiApiKey', 'buttonPosition', 'geminiModel', 'promptLength', 'iconSize'], (data) => {
        document.getElementById('geminiApiKey').value = data.geminiApiKey || '';

        const savedPosition = data.buttonPosition || 'bottom-right';
        const radio = document.getElementById(`pos${capitalizeFirstLetter(savedPosition.replace('-', ''))}`);
        if (radio) {
            radio.checked = true;
        }

        const savedModel = data.geminiModel || 'gemini-1.5-flash';
        const modelSelect = document.getElementById('geminiModel');
        if (modelSelect) {
            modelSelect.value = savedModel;
        }

        const savedPromptLength = data.promptLength || 'medium';
        const promptLengthSelect = document.getElementById('promptLength');
        if (promptLengthSelect) {
            promptLengthSelect.value = savedPromptLength;
        }

        const savedIconSize = data.iconSize || '100'; // 기본값 100% (원래 60%에서 변경)
        const iconSizeInput = document.getElementById('iconSize');
        const iconSizeValueSpan = document.getElementById('iconSizeValue');
        if (iconSizeInput && iconSizeValueSpan) {
            iconSizeInput.value = savedIconSize;
            iconSizeValueSpan.textContent = `${savedIconSize}%`;
        }
    });

    // 버전 정보 표시
    chrome.runtime.getManifest(manifest => {
        document.getElementById('version').textContent = manifest.version;
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}