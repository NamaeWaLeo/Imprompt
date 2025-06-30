// 프롬프트 컨테이너 (결과 창)
const impuPromptContainer = document.createElement('div');
impuPromptContainer.id = 'impu-prompt-container';
impuPromptContainer.classList.add('impu-neumorphic');
document.body.appendChild(impuPromptContainer);

// 토스트 알림 컨테이너 (애플의 그것과 비슷한 스타일)
const impuToastContainer = document.createElement('div');
impuToastContainer.id = 'impu-toast-container';
document.body.appendChild(impuToastContainer);

// 선택 영역 캡처를 위한 DOM 생성
const impuSelectionOverlay = document.createElement('div');
impuSelectionOverlay.id = 'impu-selection-overlay';
impuSelectionOverlay.style.position = 'fixed';
impuSelectionOverlay.style.top = '0';
impuSelectionOverlay.style.left = '0';
impuSelectionOverlay.style.width = '100%';
impuSelectionOverlay.style.height = '100%';
impuSelectionOverlay.style.background = 'rgba(0, 0, 0, 0.6)';
impuSelectionOverlay.style.zIndex = '99999';
impuSelectionOverlay.style.cursor = 'crosshair';
impuSelectionOverlay.style.display = 'none';
impuSelectionOverlay.style.pointerEvents = 'none'; // 초기에는 이벤트 받지 않음
document.body.appendChild(impuSelectionOverlay);

const impuSelectionBox = document.createElement('div');
impuSelectionBox.id = 'impu-selection-box';
impuSelectionBox.style.border = '2px dashed var(--accent-color)';
impuSelectionBox.style.background = 'rgba(74, 144, 226, 0.15)';
impuSelectionBox.style.position = 'absolute';
impuSelectionBox.style.display = 'none';
impuSelectionOverlay.appendChild(impuSelectionBox);

const impuCaptureGuideText = document.createElement('div');
impuCaptureGuideText.id = 'impu-capture-guide-text';
impuCaptureGuideText.textContent = '영역을 드래그하여 선택하세요.';
impuSelectionOverlay.appendChild(impuCaptureGuideText);

// 캡처 이미지 확인 모달 DOM
const impuCaptureModalOverlay = document.createElement('div');
impuCaptureModalOverlay.id = 'impu-capture-modal-overlay';
impuCaptureModalOverlay.style.pointerEvents = 'none'; // 초기에는 이벤트 받지 않음
document.body.appendChild(impuCaptureModalOverlay);

const impuCaptureModalContainer = document.createElement('div');
impuCaptureModalContainer.id = 'impu-capture-modal-container';
impuCaptureModalContainer.classList.add('impu-neumorphic'); // 모달도 neumorphic 스타일 적용
impuCaptureModalOverlay.appendChild(impuCaptureModalContainer);

const impuModalImagePreview = document.createElement('img');
impuModalImagePreview.id = 'impu-modal-image-preview';
impuCaptureModalContainer.appendChild(impuModalImagePreview);

const impuModalActionButtons = document.createElement('div');
impuModalActionButtons.id = 'impu-modal-action-buttons';
impuCaptureModalContainer.appendChild(impuModalActionButtons);

const impuConvertButton = document.createElement('button');
impuConvertButton.id = 'impu-convert-button';
impuConvertButton.classList.add('impu-neumorphic-button');
impuConvertButton.textContent = '프롬프트로 변환';
impuModalActionButtons.appendChild(impuConvertButton);

const impuModalCancelButton = document.createElement('button');
impuModalCancelButton.id = 'impu-modal-cancel-button';
impuModalCancelButton.classList.add('impu-neumorphic-button');
impuModalCancelButton.textContent = '취소';
impuModalActionButtons.appendChild(impuModalCancelButton);


let isSelecting = false;
let startX, startY;
let currentRect = { x: 0, y: 0, width: 0, height: 0 };
let currentTabId = null;
let currentWindowId = null;
let capturedImageDataUrl = null; // 캡처된 이미지 데이터를 저장할 변수

// 진행 상태를 나타내는 플로팅 UI 컨테이너
const impuProgressStatusContainer = document.createElement('div');
impuProgressStatusContainer.id = 'impu-progress-status-container';
impuProgressStatusContainer.innerHTML = `
    <div class="impu-spinner"></div>
    <div class="impu-message"></div>
`;
document.body.appendChild(impuProgressStatusContainer);

/**
 * 웹페이지에 플로팅되는 진행 상태 UI를 표시하거나 숨깁니다.
 * @param {boolean} show - true면 표시, false면 숨김.
 * @param {string} message - 표시할 메시지.
 */
function updateProcessStatus(show, message = '') {
    const spinnerElement = impuProgressStatusContainer.querySelector('.impu-spinner');
    const messageElement = impuProgressStatusContainer.querySelector('.impu-message');

    if (show) {
        messageElement.textContent = message;
        impuProgressStatusContainer.classList.add('show');
    } else {
        impuProgressStatusContainer.classList.remove('show');
        impuProgressStatusContainer.addEventListener('transitionend', () => {
            if (!impuProgressStatusContainer.classList.contains('show')) {
                messageElement.textContent = ''; // 사라진 후 메시지 초기화
            }
        }, { once: true });
    }
}

// 마우스 이벤트 리스너를 외부에서 참조할 수 있도록 명명된 함수로 정의
function handleMouseDown(e) {
    if (e.button === 0) { // 좌클릭
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        impuSelectionBox.style.left = `${startX}px`;
        impuSelectionBox.style.top = `${startY}px`;
        impuSelectionBox.style.width = '0';
        impuSelectionBox.style.height = '0';
        impuSelectionBox.style.display = 'block';
        impuCaptureGuideText.style.opacity = '0'; // 드래그 시작 시 캡처 가이드 텍스트 숨김
        impuCaptureGuideText.style.display = 'none'; // 드래그 시작 시 가이드 텍스트를 완전히 숨김
    }
}

let animationFrameId = null;
let lastMouseX = 0;
let lastMouseY = 0;

function handleMouseMove(e) {
    if (!isSelecting) return;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = requestAnimationFrame(() => {
        const currentX = lastMouseX;
        const currentY = lastMouseY;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);

        impuSelectionBox.style.left = `${left}px`;
        impuSelectionBox.style.top = `${top}px`;
        impuSelectionBox.style.width = `${width}px`;
        impuSelectionBox.style.height = `${height}px`;

        // 캡처 가이드 텍스트 위치 및 내용 업데이트
        impuCaptureGuideText.textContent = `가로: ${width}px, 세로: ${height}px`;
        impuCaptureGuideText.style.left = `${left + width / 2}px`;
        impuCaptureGuideText.style.top = `${top + height / 2 + 30}px`;
        impuCaptureGuideText.style.transform = 'translate(-50%, -50%)';
        impuCaptureGuideText.style.opacity = '1';
        impuCaptureGuideText.style.display = 'block'; // 가이드 텍스트를 보이게

        animationFrameId = null;
    });
}

function handleMouseUp(e) {
    if (isSelecting) {
        isSelecting = false;

        const finalSelectionBoxRect = impuSelectionBox.getBoundingClientRect();
        
        // DPR (Device Pixel Ratio)을 고려하여 좌표와 크기 조정
        // getBoundingClientRect()는 CSS 픽셀을 반환하므로, 장치 픽셀로 변환해야 합니다.
        const dpr = window.devicePixelRatio || 1; // DPR이 없는 경우를 대비하여 1로 설정

        currentRect = {
            x: Math.round(finalSelectionBoxRect.left * dpr),
            y: Math.round(finalSelectionBoxRect.top * dpr),
            width: Math.round(finalSelectionBoxRect.width * dpr),
            height: Math.round(finalSelectionBoxRect.height * dpr)
        };

        // 최소 크기 확인 (DPR 적용 후에도 유효하게 유지)
        if (currentRect.width > 10 && currentRect.height > 10) {
            updateProcessStatus(true, '선택 영역 이미지 캡처 중...');
            
            // 캡처 시작 전 가이드 텍스트를 완전히 숨김
            impuCaptureGuideText.style.opacity = '0';
            impuCaptureGuideText.style.display = 'none'; // 추가: 완전히 숨김
            // 오버레이 및 선택 상자 숨김
            impuSelectionOverlay.classList.remove('show');
            impuSelectionOverlay.classList.add('hide');
            impuSelectionOverlay.addEventListener('transitionend', handleOverlayTransitionEnd, { once: true });
            impuSelectionBox.style.display = 'none';
            
            // 마우스 이벤트 리스너 제거 (캡처 성공 시에는 cancelSelection 호출 안함)
            removeSelectionEventListeners();

            // background.js로 캡처 요청
            // captureVisibleTab 호출 전에 DOM이 업데이트될 시간을 줍니다.
            requestAnimationFrame(() => {
                chrome.runtime.sendMessage({
                    action: 'captureArea',
                    area: currentRect,
                    tabId: currentTabId,
                    windowId: currentWindowId
                });
            });

        } else {
            showToast('너무 작은 영역을 선택했습니다.', 'warning');
            cancelSelection(true); // 너무 작아서 취소될 때만 true를 전달하여 토스트를 띄움
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
}

// 마우스 이벤트 리스너 등록 함수
function addSelectionEventListeners() {
    impuSelectionOverlay.addEventListener('mousedown', handleMouseDown);
    impuSelectionOverlay.addEventListener('mousemove', handleMouseMove);
    impuSelectionOverlay.addEventListener('mouseup', handleMouseUp);
}

// 마우스 이벤트 리스너 제거 함수
function removeSelectionEventListeners() {
    impuSelectionOverlay.removeEventListener('mousedown', handleMouseDown);
    impuSelectionOverlay.removeEventListener('mousemove', handleMouseMove);
    impuSelectionOverlay.removeEventListener('mouseup', handleMouseUp);
    impuSelectionOverlay.style.cursor = 'default'; // 커서 원래대로
    impuSelectionOverlay.style.pointerEvents = 'none'; // 오버레이 이벤트 비활성화
}


// handleEscapeKey 함수를 전역으로 이동
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        if (impuSelectionOverlay.classList.contains('show')) {
            cancelSelection(true); // ESC로 캡처 취소 시 토스트 띄움
        } else if (impuCaptureModalOverlay.classList.contains('show')) {
            hideCaptureModal(true); // ESC로 모달 취소 시 토스트 띄움
        }
        // 이스케이프 키가 눌러졌을 때, 모든 오버레이가 사라진 후 리스너 제거
        if (!impuSelectionOverlay.classList.contains('show') && !impuCaptureModalOverlay.classList.contains('show') && !impuProgressStatusContainer.classList.contains('show')) {
            document.removeEventListener('keydown', handleEscapeKey);
        }
    }
}

// transitionend 이벤트 핸들러를 별도의 명명된 함수로 정의
function handleOverlayTransitionEnd() {
    if (impuSelectionOverlay && !impuSelectionOverlay.classList.contains('show')) {
        impuSelectionOverlay.style.display = 'none';
        impuSelectionOverlay.style.pointerEvents = 'none'; // 확실하게 pointer-events 비활성화
        impuCaptureGuideText.style.display = 'none'; // 오버레이 사라질 때 가이드 텍스트도 숨김
    }
    impuSelectionOverlay.removeEventListener('transitionend', handleOverlayTransitionEnd);
}

function handleModalTransitionEnd() {
    if (impuCaptureModalOverlay && !impuCaptureModalOverlay.classList.contains('show')) {
        impuCaptureModalOverlay.style.display = 'none';
        impuCaptureModalOverlay.style.pointerEvents = 'none'; // 확실하게 pointer-events 비활성화
        // 모달이 완전히 사라진 후 이미지 데이터 초기화
        impuModalImagePreview.src = '';
        capturedImageDataUrl = null;
    }
    impuCaptureModalOverlay.removeEventListener('transitionend', handleModalTransitionEnd);
}


// startSelection 함수 수정: tabId 대신 windowId를 받아오도록 변경
function startSelection(tabId, windowId) {
    currentTabId = tabId;
    currentWindowId = windowId;

    impuSelectionOverlay.style.display = 'block';
    impuSelectionOverlay.style.pointerEvents = 'auto'; // 영역 선택 시작 시 이벤트 활성화
    impuSelectionOverlay.classList.remove('hide');
    impuSelectionOverlay.removeEventListener('transitionend', handleOverlayTransitionEnd); 

    requestAnimationFrame(() => {
        impuSelectionOverlay.classList.add('show');
    });

    impuCaptureGuideText.style.opacity = '1';
    impuCaptureGuideText.textContent = '영역을 드래그하여 선택하세요. (ESC로 취소)';
    impuCaptureGuideText.style.left = '50%';
    impuCaptureGuideText.style.top = '50%';
    impuCaptureGuideText.style.transform = 'translate(-50%, -50%)';
    impuCaptureGuideText.style.display = 'block'; // 가이드 텍스트 다시 보이게

    impuSelectionBox.style.display = 'none'; 
    isSelecting = false;

    updateProcessStatus(true, '영역을 드래그하여 선택하세요. (ESC로 취소)'); // 플로팅 진행 상태 UI 사용
    document.addEventListener('keydown', handleEscapeKey);
    addSelectionEventListeners(); // 영역 선택 시작 시 이벤트 리스너 추가
}

/**
 * 캡처 선택을 취소하고 UI를 초기화합니다.
 * @param {boolean} showToastMessage - 취소 토스트 메시지를 표시할지 여부.
 */
function cancelSelection(showToastMessage = false) {
    if (impuSelectionOverlay) {
        impuSelectionOverlay.classList.remove('show');
        impuSelectionOverlay.classList.add('hide');
        impuSelectionOverlay.addEventListener('transitionend', handleOverlayTransitionEnd, { once: true });
    }

    impuSelectionBox.style.display = 'none';
    impuCaptureGuideText.style.opacity = '0'; // 캡처 가이드 텍스트를 숨김
    impuCaptureGuideText.style.display = 'none'; // 가이드 텍스트를 완전히 숨김

    isSelecting = false;
    updateProcessStatus(false); // 진행 상태 UI 숨김
    if (showToastMessage) {
        showToast('영역 선택이 취소되었습니다.', 'warning');
    }
    document.removeEventListener('keydown', handleEscapeKey);
    removeSelectionEventListeners(); // 영역 선택 취소 시 이벤트 리스너 제거
}

function showCaptureModal(imageData) {
    impuModalImagePreview.src = imageData;
    capturedImageDataUrl = imageData; // 캡처된 이미지 데이터 저장

    impuCaptureModalOverlay.style.display = 'flex'; // flex로 변경하여 중앙 정렬
    impuCaptureModalOverlay.style.pointerEvents = 'auto'; // 모달 활성화 시 이벤트 받음
    impuCaptureModalOverlay.classList.remove('hide');
    impuCaptureModalOverlay.removeEventListener('transitionend', handleModalTransitionEnd);

    requestAnimationFrame(() => {
        impuCaptureModalOverlay.classList.add('show');
    });
    
    // 모달이 띄워질 때 ESC 키 이벤트 리스너 추가
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * 캡처 확인 모달을 숨깁니다.
 * @param {boolean} showToastMessage - 취소 토스트 메시지를 표시할지 여부.
 */
function hideCaptureModal(showToastMessage = false) {
    if (impuCaptureModalOverlay) {
        impuCaptureModalOverlay.classList.remove('show');
        impuCaptureModalOverlay.classList.add('hide');
        impuCaptureModalOverlay.addEventListener('transitionend', handleModalTransitionEnd, { once: true });
    }
    // 모달이 닫힐 때 ESC 키 이벤트 리스너 제거
    document.removeEventListener('keydown', handleEscapeKey);
    if (showToastMessage) {
        showToast('캡처 이미지가 취소되었습니다.', 'warning');
    }
}

// 모달 내 버튼 리스너
impuConvertButton.addEventListener('click', async () => {
    if (capturedImageDataUrl) {
        hideCaptureModal(false); // 모달 숨기기 (토스트 없음)
        updateProcessStatus(true, '이미지 분석 중...'); // 웹페이지 플로팅 진행 상태 UI 시작
        
        // background.js로 모든 처리를 위임
        chrome.runtime.sendMessage({
            action: "processImageWithGeminiFromContentScript",
            imageDataUrl: capturedImageDataUrl,
            imageType: 'image/png' // 캡처된 이미지는 PNG로 간주 (캡처 포맷이 PNG)
        });
    } else {
        showToast('캡처된 이미지가 없습니다.', 'error');
    }
});

impuModalCancelButton.addEventListener('click', () => {
    hideCaptureModal(true); // 취소 버튼 클릭 시 토스트 띄움
});


// 토스트 알림 기능 (다이내믹 아일랜드 스타일)
function showToast(message, type = 'info', duration = 3000) {
    console.log(`[TOAST] Showing ${type} toast: ${message}`);

    // 기존 토스트 모두 제거 (로딩 토스트 포함, 이제 로딩은 updateProcessStatus가 담당)
    impuToastContainer.querySelectorAll('.impu-toast').forEach(existingToast => {
        clearTimeout(existingToast._toastTimeout);
        existingToast.classList.remove('show');
        existingToast.classList.add('hide');
        existingToast.addEventListener('transitionend', () => existingToast.remove(), { once: true });
    });


    const toast = document.createElement('div');
    toast.classList.add('impu-toast', type);

    let contentHtml = `
        <div class="impu-toast-content-wrapper">
            <div class="impu-toast-icon"></div>
            <span class="impu-toast-message-text">${message}</span>
        </div>
    `;
    
    toast.innerHTML = contentHtml;

    impuToastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    toast._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}


// 결과창 위치 설정 로드 및 적용
let currentResultWindowPosition = 'bottom-right';

function applyResultWindowPosition(position) {
    console.log(`[UI] Applying result window position: ${position}`);
    const positionClasses = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'
    ];
    impuPromptContainer.classList.remove(...positionClasses);

    impuPromptContainer.classList.add(position);
    currentResultWindowPosition = position;

    updatePromptWindowPosition();
}

function updatePromptWindowPosition() {
    console.log(`[UI] Updating prompt window position. Current position: ${currentResultWindowPosition}`);
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const originalDisplay = impuPromptContainer.style.display;
    impuPromptContainer.style.display = 'block';
    const containerRect = impuPromptContainer.getBoundingClientRect();
    impuPromptContainer.style.display = originalDisplay;

    let top = 'auto';
    let left = 'auto';
    let right = 'auto';
    let bottom = 'auto';
    let transform = '';

    const margin = 15;

    if (currentResultWindowPosition.includes('top')) {
        top = margin;
    } else if (currentResultWindowPosition.includes('bottom')) {
        bottom = margin;
    } else {
        top = '50%';
        transform += 'translateY(-50%)';
    }

    if (currentResultWindowPosition.includes('left')) {
        left = margin;
    } else if (currentResultWindowPosition.includes('right')) {
        right = margin;
    } else {
        left = '50%';
        transform += (transform ? ' ' : '') + 'translateX(-50%)';
    }

    impuPromptContainer.style.top = typeof top === 'number' ? `${top}px` : top;
    impuPromptContainer.style.bottom = typeof bottom === 'number' ? `${bottom}px` : bottom;
    impuPromptContainer.style.left = typeof left === 'number' ? `${left}px` : left;
    impuPromptContainer.style.right = typeof right === 'number' ? `${right}px` : right;
    impuPromptContainer.style.transform = transform;

    let finalLeft = impuPromptContainer.offsetLeft;
    let finalTop = impuPromptContainer.offsetTop;

    // 화면 밖으로 나가지 않도록 조정 (기존 로직)
    if (finalLeft < 10) {
        finalLeft = 10;
        impuPromptContainer.style.transform = impuPromptContainer.style.transform.replace(/translateX\(.*?\)/, '');
    } else if (finalLeft + containerRect.width > windowWidth - 10) {
        finalLeft = windowWidth - containerRect.width - 10;
        impuPromptContainer.style.transform = impuPromptContainer.style.transform.replace(/translateX\(.*?\)/, '');
    }

    if (finalTop < 10) {
        finalTop = 10;
    } else if (finalTop + containerRect.height > windowHeight - 10) {
        finalTop = windowHeight - containerRect.height - 10;
    }
    
    impuPromptContainer.style.top = `${finalTop}px`;
    impuPromptContainer.style.left = `${finalLeft}px`;
    impuPromptContainer.style.right = 'auto';
    impuPromptContainer.style.bottom = 'auto';

    console.log(`[UI] Prompt container final position: Top: ${impuPromptContainer.style.top}, Left: ${impuPromptContainer.style.left}`);
}


window.addEventListener('resize', updatePromptWindowPosition);


function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('프롬프트가 클립보드에 복사되었습니다!', 'success'))
        .catch(err => showToast('클립보드 복사에 실패했습니다.', 'error'));
}


async function displayGeneratedPrompts(response, extractionMethod) {
    console.log("[API CALL] Response received from background:", response);

    if (response && response.error) { // response가 정의되었는지 확인
        console.error("[API CALL] API returned an error:", response.error);
        showToast(`오류: ${response.error}`, 'error');
        impuPromptContainer.innerHTML = `
            <div class="impu-prompt-header">
                <strong style="color: var(--text-color);">오류 발생</strong>
                <button class="impu-close-button">X</button>
            </div>
            <div style="color: var(--error-color);">${response.error}</div>
        `;
        impuPromptContainer.style.display = 'block';
        impuPromptContainer.style.pointerEvents = 'auto'; // 오류 시에는 이벤트 활성화
        requestAnimationFrame(() => { impuPromptContainer.classList.add('show'); });
        impuPromptContainer.querySelector('.impu-close-button').addEventListener('click', () => {
            impuPromptContainer.classList.remove('show');
            impuPromptContainer.addEventListener('transitionend', () => {
                impuPromptContainer.style.display = 'none';
                impuPromptContainer.style.pointerEvents = 'none';
            }, { once: true });
        });
        return; // 오류 발생 시 함수 종료
    } else if (response) { // response가 성공적으로 정의된 경우
        console.log("[API CALL] Prompts generated successfully.");
        showToast('프롬프트 생성 완료!', 'success');
        
        let detectedPromptHtml = '';
        const finalDetectedNovelaiPrompt = response.detectedNovelaiPrompt; // background에서 최종적으로 처리된 값 사용
        const finalDetectedStableDiffusionPrompt = response.detectedStableDiffusionPrompt; // background에서 최종적으로 처리된 값 사용
        const finalDetectedExifComment = response.detectedExifComment; // background에서 최종적으로 처리된 값 사용

        if ((extractionMethod === 'metadata' || extractionMethod === 'both') && (finalDetectedNovelaiPrompt || finalDetectedStableDiffusionPrompt || finalDetectedExifComment)) {
            let combinedDetectedPrompt = '';
            if (finalDetectedNovelaiPrompt) {
                combinedDetectedPrompt += `NovelAI 원문: ${finalDetectedNovelaiPrompt}\n`;
            }
            if (finalDetectedStableDiffusionPrompt && finalDetectedStableDiffusionPrompt !== finalDetectedNovelaiPrompt) {
                combinedDetectedPrompt += `Stable Diffusion 원문: ${finalDetectedStableDiffusionPrompt}\n`;
            }
            if (!combinedDetectedPrompt && finalDetectedExifComment) {
                 combinedDetectedPrompt = `원문 메타데이터: \n${finalDetectedExifComment}\n`;
            }

            if(combinedDetectedPrompt) {
                detectedPromptHtml = `
                    <div class="impu-prompt-group impu-detected-prompt-group">
                        <strong>이미지에서 추출된 프롬프트:</strong>
                        <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${combinedDetectedPrompt.trim()}</textarea>
                        <button class="impu-copy-button impu-neumorphic-button" data-copy-target="detected_combined">모두 복사</button>
                    </div>
                `;
            }
        }

        const geminiGeneratedHtml = (extractionMethod === 'gemini' || extractionMethod === 'both') ? `
            <div class="impu-prompt-group">
                <strong>NovelAI (Gemini 생성):</strong>
                <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${response.novelai}</textarea>
                <button class="impu-copy-button impu-neumorphic-button" data-copy-target="novelai">복사</button>
            </div>
            <div class="impu-prompt-group">
                <strong>Stable Diffusion (Gemini 생성):</strong>
                <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${response.stable_diffusion}</textarea>
                <button class="impu-copy-button impu-neumorphic-button" data-copy-target="stable_diffusion">복사</button>
            </div>
        ` : '';

        impuPromptContainer.innerHTML = `
            <div class="impu-prompt-header">
                <strong style="color: var(--text-color);">프롬프트 결과</strong>
                <button class="impu-close-button">X</button>
            </div>
            ${detectedPromptHtml}
            ${geminiGeneratedHtml}
        `;
        impuPromptContainer.querySelectorAll('.impu-copy-button').forEach(copyBtn => {
            copyBtn.addEventListener('click', (e) => {
                const textarea = e.target.previousElementSibling;
                if (textarea && textarea.classList.contains('impu-prompt-textarea')) {
                    copyToClipboard(textarea.value);
                }
            });
        });
    } else { // response가 undefined인 경우
        console.error("[API CALL] No response received from background script.");
        showToast('백그라운드 스크립트로부터 응답이 없습니다.', 'error');
        impuPromptContainer.innerHTML = `
            <div class="impu-prompt-header">
                <strong style="color: var(--text-color);">오류 발생</strong>
                <button class="impu-close-button">X</button>
            </div>
            <div style="color: var(--error-color);">백그라운드 스크립트로부터 응답을 받지 못했습니다.</div>
        `;
        impuPromptContainer.style.display = 'block';
        impuPromptContainer.style.pointerEvents = 'auto'; // 오류 시에는 이벤트 활성화
        requestAnimationFrame(() => { impuPromptContainer.classList.add('show'); });
        impuPromptContainer.querySelector('.impu-close-button').addEventListener('click', () => {
            impuPromptContainer.classList.remove('show');
            impuPromptContainer.addEventListener('transitionend', () => {
                impuPromptContainer.style.display = 'none';
                impuPromptContainer.style.pointerEvents = 'none';
            }, { once: true });
        });
        return; // 오류 발생 시 함수 종료
    }

    impuPromptContainer.style.display = 'block';
    impuPromptContainer.style.pointerEvents = 'auto'; // 프롬프트 창 활성화 시 이벤트 받음
    updatePromptWindowPosition();

    requestAnimationFrame(() => {
        impuPromptContainer.classList.add('show');
    });

    impuPromptContainer.querySelector('.impu-close-button').addEventListener('click', () => {
        impuPromptContainer.classList.remove('show');
        impuPromptContainer.addEventListener('transitionend', () => {
            impuPromptContainer.style.display = 'none';
            impuPromptContainer.style.pointerEvents = 'none'; // 프롬프트 창 닫힐 때 이벤트 비활성화
        }, { once: true });
    });
}

/**
 * 이미지 Blob 데이터를 받아 background.js로 처리를 위임합니다.
 * @param {Blob} imageBlob - 처리할 이미지 Blob 데이터.
 * @param {string|null} srcUrl - 원본 이미지 URL (선택 사항).
 * @param {string} source - 'url' 또는 'clipboard' 또는 'captured'.
 */
async function handleImageProcessing(imageBlob, srcUrl = null, source = 'url') {
    console.log(`[PROCESS] Initiating image processing. Source: ${source}. Blob type: ${imageBlob.type}`);

    impuPromptContainer.style.display = 'none';
    impuPromptContainer.classList.remove('show');
    impuPromptContainer.style.pointerEvents = 'none'; // 처리 중에는 이벤트 비활성화

    updateProcessStatus(true, `이미지 ${source === 'captured' ? '분석' : '로드'} 및 처리 중...`); // 웹페이지 플로팅 진행 상태 UI 시작

    try {
        const imageDataUrl = URL.createObjectURL(imageBlob); // Blob URL 생성

        chrome.runtime.sendMessage({
            action: "processImageWithGeminiFromContentScript",
            imageDataUrl: imageDataUrl, // Blob URL을 넘겨서 background에서 fetch하도록
            imageType: imageBlob.type,
            srcUrl: srcUrl // URL에서 로드된 경우 원본 URL 전달
        }, (response) => {
            // 이 콜백은 background.js가 sendFinalResponse를 호출하여 content.js에 응답을 보낼 때 실행됩니다.
            // 모든 UI 업데이트는 background.js의 메시지를 통해 이루어지므로 여기서는 직접 UI를 업데이트하지 않습니다.
        });
    } catch (err) {
        console.error('이미지 처리 시작 실패:', err);
        updateProcessStatus(false); // 오류 발생 시 UI 숨김
        showToast(`이미지 처리 시작 실패: ${err.message}`, 'error');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updatePromptWindowPosition();
        console.log("[UI] DOMContentLoaded: Initial prompt window position updated.");
    }, 100);

    chrome.storage.local.get(['resultWindowPosition', 'extractionMethod'], (data) => {
        const savedPosition = data.resultWindowPosition || 'bottom-right';

        applyResultWindowPosition(savedPosition);
        console.log(`[UI] Initial settings applied based on storage: Position(${savedPosition})`);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateUI") {
        console.log("[MESSAGE] Received updateUI request:", request);
        if (request.resultWindowPosition) {
            applyResultWindowPosition(request.resultWindowPosition);
        }
    } else if (request.action === "initiateGeminiProcessingFromUrl") {
        console.log("[MESSAGE] Received initiateGeminiProcessingFromUrl request from background:", request.srcUrl);
        fetch(request.srcUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => handleImageProcessing(blob, request.srcUrl, 'url'))
            .catch(err => {
                console.error('URL 이미지 로드 실패:', err);
                updateProcessStatus(false); // 오류 발생 시 UI 숨김
                showToast(`이미지 로드 실패 (URL): ${err.message}`, 'error');
            });
    } else if (request.action === "showToast") {
        showToast(request.message, request.type, request.duration);
    } else if (request.action === "startAreaSelection") {
        if (request.tabId && request.windowId) {
            startSelection(request.tabId, request.windowId);
        } else {
            console.error("Error: tab.id or window.id is missing in the request for area selection.");
            showToast("영역 선택을 시작할 탭 또는 창 정보를 찾을 수 없습니다.", "error");
        }
    } else if (request.action === "showCapturedImageModal") { // 새로운 메시지 액션
        console.log("[MESSAGE] Received showCapturedImageModal request with image data.");
        updateProcessStatus(false); // 캡처 완료 후 진행 상태 UI 숨김
        showCaptureModal(request.imageDataUrl); // 캡처된 이미지로 모달 표시
    } else if (request.action === "updateProcessStatus") { // 백그라운드 스크립트에서 진행 상태 UI를 제어하기 위한 메시지
        updateProcessStatus(request.show, request.message);
    } else if (request.action === "displayGeneratedPrompts") { // 백그라운드 스크립트에서 최종 결과를 content.js로 전달
        updateProcessStatus(false); // 최종 결과 표시 전 UI 숨김
        displayGeneratedPrompts(request.response, request.extractionMethod);
    }
});