document.addEventListener('DOMContentLoaded', restoreOptions);

// API 키 관련 버튼 리스너
document.getElementById('saveApiKeyButton').addEventListener('click', saveApiKeyAndValidate);

// 다른 설정 저장 버튼 리스너 (기존과 동일하게 변경 감지 시 자동 저장)
// document.getElementById('saveOtherSettingsButton').addEventListener('click', saveOtherSettings); // 이 버튼은 이제 수동 클릭이 아니라 변경 감지 시 자동 저장

// 아이콘 크기 슬라이더 값 표시
const iconSizeInput = document.getElementById('iconSize');
const iconSizeValueSpan = document.getElementById('iconSizeValue');
if (iconSizeInput && iconSizeValueSpan) {
    iconSizeInput.addEventListener('input', () => {
        iconSizeValueSpan.textContent = `${iconSizeInput.value}%`;
    });
}

// 탭 전환 로직
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (event) => {
        // 모든 탭 버튼에서 active 클래스 제거
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        // 클릭된 버튼에 active 클래스 추가
        event.target.classList.add('active');

        // 모든 탭 콘텐츠 숨기기
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // 클릭된 탭에 해당하는 콘텐츠 보여주기
        const targetTabId = event.target.dataset.tab + '-tab';
        document.getElementById(targetTabId).classList.add('active');

        // 히스토리 탭으로 전환될 때만 히스토리 로드
        if (event.target.dataset.tab === 'history') {
            loadAndDisplayHistory();
        }
    });
});

// 플로팅 버튼 숨김 체크박스도 '다른 설정 저장'에 포함되도록 이벤트 리스너 추가
const hideFloatingButtonCheckbox = document.getElementById('hideFloatingButton');
if (hideFloatingButtonCheckbox) {
    hideFloatingButtonCheckbox.addEventListener('change', saveOtherSettings);
}

// 프롬프트 길이, 모델, 버튼 위치 등 변경 시 자동 저장 (UX 개선)
document.getElementById('geminiModel').addEventListener('change', saveOtherSettings);
document.getElementById('promptLength').addEventListener('change', saveOtherSettings);
document.querySelectorAll('input[name="buttonPosition"]').forEach(radio => {
    radio.addEventListener('change', saveOtherSettings);
});
document.getElementById('iconSize').addEventListener('input', saveOtherSettings);
document.getElementById('customPositivePrompt').addEventListener('input', saveOtherSettings); // 사용자 정의 프롬프트 자동 저장
document.getElementById('customNegativePrompt').addEventListener('input', saveOtherSettings); // 사용자 정의 프롬프트 자동 저장

// 새로운 버튼 리스너 추가
document.getElementById('clearAllHistoryButton').addEventListener('click', clearAllHistory);
document.getElementById('resetAllSettingsButton').addEventListener('click', resetAllSettings);


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
    const iconSize = document.getElementById('iconSize').value;
    const hideFloatingButton = document.getElementById('hideFloatingButton').checked;
    const customPositivePrompt = document.getElementById('customPositivePrompt').value;
    const customNegativePrompt = document.getElementById('customNegativePrompt').value;

    chrome.storage.sync.set({
        buttonPosition: selectedPosition,
        geminiModel: selectedModel,
        promptLength: promptLength,
        iconSize: iconSize,
        hideFloatingButton: hideFloatingButton,
        customPositivePrompt: customPositivePrompt,
        customNegativePrompt: customNegativePrompt
    }, () => {
        const statusElement = document.getElementById('otherSettingsStatus');
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
                    buttonPosition: selectedPosition,
                    iconSize: iconSize,
                    hideFloatingButton: hideFloatingButton
                });
            }
        });
    });
}

function restoreOptions() {
    chrome.storage.sync.get([
        'geminiApiKey',
        'buttonPosition',
        'geminiModel',
        'promptLength',
        'iconSize',
        'hideFloatingButton',
        'customPositivePrompt',
        'customNegativePrompt',
        'promptHistory' // 히스토리 데이터도 로드
    ], (data) => {
        document.getElementById('geminiApiKey').value = data.geminiApiKey || '';

        const savedPosition = data.buttonPosition || 'bottom-right';
        const radio = document.getElementById(`pos${capitalizeFirstLetter(savedPosition.replace('-', ''))}`);
        if (radio) {
            radio.checked = true;
        }

        // Gemini 모델 선택지 복원
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

        const savedIconSize = data.iconSize || '100';
        const iconSizeInput = document.getElementById('iconSize');
        const iconSizeValueSpan = document.getElementById('iconSizeValue');
        if (iconSizeInput && iconSizeValueSpan) {
            iconSizeInput.value = savedIconSize;
            iconSizeValueSpan.textContent = `${savedIconSize}%`;
        }

        const savedHideFloatingButton = data.hideFloatingButton || false;
        const hideFloatingButtonCheckbox = document.getElementById('hideFloatingButton');
        if (hideFloatingButtonCheckbox) {
            hideFloatingButtonCheckbox.checked = savedHideFloatingButton;
        }

        // 사용자 정의 프롬프트 로드
        document.getElementById('customPositivePrompt').value = data.customPositivePrompt || '';
        document.getElementById('customNegativePrompt').value = data.customNegativePrompt || '';

        // 초기 탭 활성화 (기본 설정 탭)
        document.getElementById('settings-tab').classList.add('active');
        document.querySelector('.tab-button[data-tab="settings"]').classList.add('active');
    });

    // 버전 정보 표시
    chrome.runtime.getManifest(manifest => {
        document.getElementById('version').textContent = manifest.version;
    });
}

/**
 * 프롬프트 히스토리를 로드하여 화면에 표시합니다.
 */
function loadAndDisplayHistory() {
    chrome.storage.sync.get('promptHistory', (data) => {
        const history = data.promptHistory || [];
        const historyList = document.getElementById('promptHistoryList');
        const noHistoryMessage = document.getElementById('noHistoryMessage');
        historyList.innerHTML = ''; // 기존 목록 초기화

        if (history.length === 0) {
            noHistoryMessage.style.display = 'block';
            return;
        }
        noHistoryMessage.style.display = 'none';

        // 최신 항목이 위로 오도록 역순으로 정렬
        // 주의: 역순 정렬 후 원본 인덱스를 사용하기 위해 `history.length - 1 - index`를 계산해야 합니다.
        // 또는, 데이터를 복사하여 역순 정렬하고 인덱스를 직접 사용합니다.
        const reversedHistory = [...history].reverse(); // 원본 배열을 유지하면서 복사본을 역순으로
        
        reversedHistory.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.classList.add('history-item', 'neumorphic'); // 뉴모피즘 스타일 적용
            listItem.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-date">${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                <div class="history-item-prompt-preview">
                    <strong>NovelAI:</strong> ${item.novelai.substring(0, 80)}${item.novelai.length > 80 ? '...' : ''}<br>
                    <strong>SD:</strong> ${item.stable_diffusion.substring(0, 80)}${item.stable_diffusion.length > 80 ? '...' : ''}
                </div>
                <div class="history-item-buttons">
                    <button class="history-item-button neumorphic-button" data-copy-target="novelai" data-original-index="${reversedHistory.length - 1 - index}">NovelAI 복사</button>
                    <button class="history-item-button neumorphic-button" data-copy-target="stable_diffusion" data-original-index="${reversedHistory.length - 1 - index}">SD 복사</button>
                    <button class="history-item-button neumorphic-button delete-history-item" data-original-index="${reversedHistory.length - 1 - index}">삭제</button>
                </div>
            `;
            historyList.appendChild(listItem);
        });

        // 복사 및 삭제 버튼 이벤트 리스너 추가
        historyList.querySelectorAll('.history-item-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const originalIndex = parseInt(event.target.dataset.originalIndex); // 원본 인덱스 사용
                const promptData = history[originalIndex]; // 원본 배열에서 데이터 가져오기

                if (event.target.classList.contains('delete-history-item')) {
                    deleteHistoryItem(originalIndex);
                } else {
                    const targetType = event.target.dataset.copyTarget;
                    if (targetType === 'novelai') {
                        copyToClipboard(promptData.novelai);
                    } else if (targetType === 'stable_diffusion') {
                        copyToClipboard(promptData.stable_diffusion);
                    }
                }
            });
        });
    });
}

/**
 * 클립보드에 텍스트를 복사하고 토스트 알림을 표시합니다.
 * 이 함수는 content.js에도 있지만, 팝업 내에서도 사용되므로 중복 정의합니다.
 * @param {string} text 복사할 텍스트
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard from popup:', text);
            // 팝업에서는 showToast 함수가 없으므로 별도 메시지 처리
            const statusElement = document.getElementById('otherSettingsStatus'); // 기존 상태 메시지 공간 활용
            if (statusElement) {
                statusElement.textContent = '클립보드에 복사되었습니다!';
                statusElement.style.color = 'var(--success-color)';
                setTimeout(() => { statusElement.textContent = ''; }, 1500);
            }
        })
        .catch(err => {
            console.error('Failed to copy text from popup:', err);
            const statusElement = document.getElementById('otherSettingsStatus');
            if (statusElement) {
                statusElement.textContent = '클립보드 복사에 실패했습니다.';
                statusElement.style.color = 'var(--error-color)';
                setTimeout(() => { statusElement.textContent = ''; }, 3000);
            }
        });
}

/**
 * 특정 인덱스의 히스토리 항목을 삭제합니다.
 * @param {number} index 삭제할 항목의 원래 인덱스 (역순 정렬 전 인덱스)
 */
function deleteHistoryItem(index) {
    chrome.storage.sync.get('promptHistory', (data) => {
        let history = data.promptHistory || [];
        if (index > -1 && index < history.length) {
            history.splice(index, 1); // 해당 인덱스의 항목 삭제
            chrome.storage.sync.set({ promptHistory: history }, () => {
                console.log('History item deleted.');
                loadAndDisplayHistory(); // 목록 새로고침
                const statusElement = document.getElementById('otherSettingsStatus'); // 임시 알림
                if (statusElement) {
                    statusElement.textContent = '히스토리 항목이 삭제되었습니다.';
                    statusElement.style.color = 'var(--warning-color)';
                    setTimeout(() => { statusElement.textContent = ''; }, 1500);
                }
            });
        }
    });
}

/**
 * 모든 프롬프트 히스토리 항목을 삭제합니다.
 */
function clearAllHistory() {
    if (confirm('모든 프롬프트 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        chrome.storage.sync.set({ promptHistory: [] }, () => {
            console.log('All prompt history cleared.');
            loadAndDisplayHistory(); // 목록 새로고침
            const statusElement = document.getElementById('otherSettingsStatus');
            if (statusElement) {
                statusElement.textContent = '모든 히스토리가 삭제되었습니다.';
                statusElement.style.color = 'var(--success-color)';
                setTimeout(() => { statusElement.textContent = ''; }, 2000);
            }
        });
    }
}

/**
 * 모든 확장 프로그램 설정을 기본값으로 초기화합니다.
 */
function resetAllSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        chrome.storage.sync.clear(() => {
            console.log('All settings cleared and reset to default.');
            restoreOptions(); // 기본값으로 UI 다시 로드
            const statusElement = document.getElementById('otherSettingsStatus');
            if (statusElement) {
                statusElement.textContent = '모든 설정이 초기화되었습니다.';
                statusElement.style.color = 'var(--success-color)';
                setTimeout(() => { statusElement.textContent = ''; }, 2000);
            }
            // content.js에 UI 초기화 메시지 전송 (초기화된 기본값으로)
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateUI",
                        buttonPosition: 'bottom-right', // 기본값
                        iconSize: '100', // 기본값
                        hideFloatingButton: false // 기본값
                    });
                }
            });
        });
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}