// 진행 상황 창 컨테이너 (상단 중앙에 독립적으로 위치)
const impuProgressWindowContainer = document.createElement('div');
impuProgressWindowContainer.id = 'impu-progress-window-container';
impuProgressWindowContainer.classList.add('impu-neumorphic');
document.body.appendChild(impuProgressWindowContainer);

// 프롬프트 컨테이너 (결과 창)
const impuPromptContainer = document.createElement('div');
impuPromptContainer.id = 'impu-prompt-container';
impuPromptContainer.classList.add('impu-neumorphic');
document.body.appendChild(impuPromptContainer);

// 토스트 알림 컨테이너 (애플의 그것과 비슷한 스타일)
const impuToastContainer = document.createElement('div');
impuToastContainer.id = 'impu-toast-container';
document.body.appendChild(impuToastContainer);

let impuToastTimeout; // 토스트 자동 숨김을 위한 타이머


// 선택 영역 캡처를 위한 DOM 생성
const impuSelectionOverlay = document.createElement('div');
impuSelectionOverlay.id = 'impu-selection-overlay';
impuSelectionOverlay.style.position = 'fixed';
impuSelectionOverlay.style.top = '0';
impuSelectionOverlay.style.left = '0';
impuSelectionOverlay.style.width = '100%';
impuSelectionOverlay.style.height = '100%';
impuSelectionOverlay.style.background = 'rgba(0, 0, 0, 0.6)'; // styles.css에서 투명하게 변경할 예정
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

// 캡처 버튼 컨테이너는 이제 모달 내부로 이동하므로 여기서 DOM 생성하지 않음

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
            updateProgressWindow('선택 영역 이미지 캡처 중...', 'loading', true);
            
            // 캡처 시작 전 가이드 텍스트를 완전히 숨김
            impuCaptureGuideText.style.opacity = '0';
            impuCaptureGuideText.style.display = 'none'; // 추가: 완전히 숨김
            // 오버레이 및 선택 상자 숨김
            impuSelectionOverlay.classList.remove('show');
            impuSelectionOverlay.classList.add('hide');
            impuSelectionOverlay.addEventListener('transitionend', handleOverlayTransitionEnd, { once: true });
            impuSelectionBox.style.display = 'none';
            
            // 마우스 이벤트 리스너 제거
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
            cancelSelection();
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
            cancelSelection();
        } else if (impuCaptureModalOverlay.classList.contains('show')) {
            hideCaptureModal();
        }
        document.removeEventListener('keydown', handleEscapeKey);
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

    updateProgressWindow('영역을 드래그하여 선택하세요...', 'info', true);
    document.addEventListener('keydown', handleEscapeKey);
    addSelectionEventListeners(); // 영역 선택 시작 시 이벤트 리스너 추가
}

function cancelSelection() {
    if (impuSelectionOverlay) {
        impuSelectionOverlay.classList.remove('show');
        impuSelectionOverlay.classList.add('hide');
        impuSelectionOverlay.addEventListener('transitionend', handleOverlayTransitionEnd, { once: true });
    }

    impuSelectionBox.style.display = 'none';
    impuCaptureGuideText.style.opacity = '0'; // 캡처 가이드 텍스트를 숨김
    impuCaptureGuideText.style.display = 'none'; // 가이드 텍스트를 완전히 숨김

    isSelecting = false;
    hideProgressWindow();
    showToast('영역 선택이 취소되었습니다.', 'warning');
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
    // 이 시점에서 selection overlay는 이미 hide 상태로 전환 중이거나 숨겨진 상태여야 함
    // 혹시 모를 상황을 대비하여 명시적으로 다시 호출.
    // removeSelectionEventListeners(); // 캡처 모달이 뜨는 시점에서 이전에 제거되었어야 함. 중복 호출은 무해.
}

function hideCaptureModal() {
    if (impuCaptureModalOverlay) {
        impuCaptureModalOverlay.classList.remove('show');
        impuCaptureModalOverlay.classList.add('hide');
        impuCaptureModalOverlay.addEventListener('transitionend', handleModalTransitionEnd, { once: true });
    }
    // 모달이 닫힐 때 ESC 키 이벤트 리스너 제거
    document.removeEventListener('keydown', handleEscapeKey);
    showToast('캡처 이미지가 취소되었습니다.', 'warning');
    // 모달 닫을 때도 마우스 이벤트 리스너 제거 (확실하게)
    // removeSelectionEventListeners(); // 이 함수는 주로 영역 선택 관련 리스너 제거용이므로 여기서는 직접적인 영향이 덜함
}

// 모달 내 버튼 리스너
impuConvertButton.addEventListener('click', async () => {
    if (capturedImageDataUrl) {
        hideCaptureModal(); // 모달 숨기기
        showToast('이미지 분석 중...', 'loading', 30000); // 새로운 로딩 토스트
        // WebP 변환은 background.js에서 처리하므로 여기서 별도 Blob 변환은 필요 없음
        await processImageAndGeneratePrompts(capturedImageDataUrl, null, null, null, 'both');
    } else {
        showToast('캡처된 이미지가 없습니다.', 'error');
    }
});

impuModalCancelButton.addEventListener('click', hideCaptureModal);


// (기존 handleMouseDown, handleMouseMove, handleMouseUp 함수는 위로 이동하여 명명된 함수가 됨)


// 토스트 알림 기능 (다이내믹 아일랜드 스타일)
function showToast(message, type = 'info', duration = 3000) {
    console.log(`[TOAST] Showing ${type} toast: ${message}`);

    const existingLoadingToast = impuToastContainer.querySelector('.impu-toast.loading');

    // 기존 로딩 토스트가 있으면 메시지 업데이트 및 타이머 재설정
    if (existingLoadingToast && type === 'loading') {
        const messageTextSpan = existingLoadingToast.querySelector('.impu-toast-message-text');
        if (messageTextSpan) {
            messageTextSpan.textContent = message;
        }
        clearTimeout(existingLoadingToast._toastTimeout);
        existingLoadingToast._toastTimeout = setTimeout(() => {
            existingLoadingToast.classList.remove('show');
            existingLoadingToast.classList.add('hide');
            existingLoadingToast.addEventListener('transitionend', () => existingLoadingToast.remove(), { once: true });
        }, duration);
        return;
    // 로딩 토스트가 있는데 다른 타입의 토스트가 들어오면 기존 로딩 토스트 제거
    } else if (existingLoadingToast && type !== 'loading') {
        clearTimeout(existingLoadingToast._toastTimeout);
        existingLoadingToast.classList.remove('show');
        existingLoadingToast.classList.add('hide');
        existingLoadingToast.addEventListener('transitionend', () => existingLoadingToast.remove(), { once: true });
    }

    const toast = document.createElement('div');
    toast.classList.add('impu-toast', type);

    let contentHtml = '';
    let progressBarHtml = '';

    if (type === 'loading') {
        contentHtml = `
            <div class="impu-toast-content-wrapper">
                <span class="impu-toast-message-text">${message}</span>
            </div>
            <div class="impu-no-click-message">다른 곳을 클릭하지 마세요.</div>
        `;
        progressBarHtml = `<div class="impu-toast-progress-bar"><div class="impu-toast-progress-fill"></div></div>`;
    } else {
        contentHtml = `
            <div class="impu-toast-content-wrapper">
                <div class="impu-toast-icon"></div>
                <span class="impu-toast-message-text">${message}</span>
            </div>
        `;
    }

    toast.innerHTML = contentHtml + progressBarHtml;

    // 현재 표시 중인 토스트가 있다면 제거 (새로운 토스트가 들어올 때)
    // 이 부분을 함수 상단으로 이동하여 `existingLoadingToast`와 함께 처리 (이전 수정에서 반영됨)
    // 기존 코드:
    // const existingToast = impuToastContainer.querySelector('.impu-toast');
    // if (existingToast && existingToast !== toast) {
    //     clearTimeout(existingToast._toastTimeout);
    //     existingToast.classList.remove('show');
    //     existingToast.classList.add('hide');
    //     existingToast.addEventListener('transitionend', () => existingToast.remove(), { once: true });
    // }

    // 새로운 existingToast 변수 선언을 함수 상단으로 이동했으므로,
    // 이 블록은 더 이상 필요하지 않습니다. (이전 수정에서 이미 반영됨)
    let existingToast = impuToastContainer.querySelector('.impu-toast'); // 함수 상단에서 선언되었으므로 여기서 다시 선언하지 않고 재할당.
    if (existingToast && existingToast !== toast) { // `existingLoadingToast` 처리 이후 다른 토스트가 남아있을 경우를 대비
        clearTimeout(existingToast._toastTimeout);
        existingToast.classList.remove('show');
        existingToast.classList.add('hide');
        existingToast.addEventListener('transitionend', () => existingToast.remove(), { once: true });
    }


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


// 진행 상황 창 기능
function updateProgressWindow(message, type = 'loading', show = false, progress = -1) {
    let progressBarHtml = '';
    if (type === 'loading' && progress >= 0) {
        progressBarHtml = `<div class="impu-progress-bar-container"><div class="impu-progress-bar" style="width: ${progress}%;"></div></div>`;
    } else if (type === 'loading') {
        progressBarHtml = `<div class="impu-progress-bar-container"><div class="impu-progress-bar impu-progress-bar-indeterminate"></div></div>`;
    }

    impuProgressWindowContainer.innerHTML = `
        <div class="impu-progress-content ${type}">
            ${type === 'loading' ? progressBarHtml : `<div class="impu-status-icon ${type}"></div>`}
            <span class="impu-progress-message-text">${message}</span>
        </div>
        <div class="impu-no-click-message">다른 곳을 클릭하지 마세요.</div>
    `;

    if (show) {
        impuProgressWindowContainer.style.display = 'block';
        impuProgressWindowContainer.style.pointerEvents = 'auto'; // 이벤트 활성화
        requestAnimationFrame(() => {
            impuProgressWindowContainer.classList.add('show');
        });
    } else {
        impuProgressWindowContainer.classList.remove('show');
        impuProgressWindowContainer.addEventListener('transitionend', () => {
            impuProgressWindowContainer.style.display = 'none';
            impuProgressWindowContainer.style.pointerEvents = 'none'; // 이벤트 비활성화
        }, { once: true });
    }
}

function hideProgressWindow() {
    console.log("[PROGRESS WINDOW] Hiding progress window.");
    impuProgressWindowContainer.classList.remove('show');
    impuProgressWindowContainer.addEventListener('transitionend', () => {
        impuProgressWindowContainer.style.display = 'none';
        impuProgressWindowContainer.style.pointerEvents = 'none'; // 이벤트 비활성화
    }, { once: true });
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
        .then(() => showToast('프롬프트가 클립보드에 복사되었습니다!', 'impu-success'))
        .catch(err => showToast('클립보드 복사에 실패했습니다.', 'impu-error'));
}


async function processImageAndGeneratePrompts(imageDataUrl, detectedExifComment = null, detectedNovelaiPrompt = null, detectedStableDiffusionPrompt = null, extractionMethod = 'both') {
    console.log("[API CALL] Sending image data to background for Gemini processing.");

    impuPromptContainer.style.display = 'none';
    impuPromptContainer.classList.remove('show');
    impuPromptContainer.style.pointerEvents = 'none'; // 처리 중에는 이벤트 비활성화

    showToast('Gemini API로 프롬프트 생성 요청 중...', 'loading', 30000);

    const timeoutDuration = 30000;
    const timeoutPromise = new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error(`API 응답 시간 초과 (${timeoutDuration / 1000}초). 네트워크 상태를 확인하거나 API 키를 확인해주세요.`));
        }, timeoutDuration);
    });

    const apiRequestPromise = chrome.runtime.sendMessage({
        action: "processImageWithGemini",
        imageDataUrl: imageDataUrl,
        extractionMethod: extractionMethod,
        detectedExifComment: detectedExifComment,
        detectedNovelaiPrompt: detectedNovelaiPrompt,
        detectedStableDiffusionPrompt: detectedStableDiffusionPrompt
    });

    let response;
    try {
        response = await Promise.race([apiRequestPromise, timeoutPromise]);
        console.log("[API CALL] Response received from background:", response);
    } catch (timeoutError) {
        console.error("[API CALL] Timeout or other error during API request:", timeoutError);
        showToast(`오류: ${timeoutError.message}`, 'error');
        impuPromptContainer.innerHTML = `
            <div class="impu-prompt-header">
                <strong style="color: var(--text-color);">오류 발생</strong>
                <button class="impu-close-button">X</button>
            </div>
            <div style="color: var(--error-color);">이미지 처리 중 오류가 발생했습니다.<br>(${timeoutError.message})</div>
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
        const finalDetectedNovelaiPrompt = response.detectedNovelaiPrompt || detectedNovelaiPrompt;
        const finalDetectedStableDiffusionPrompt = response.detectedStableDiffusionPrompt || detectedStableDiffusionPrompt;
        const finalDetectedExifComment = response.detectedExifComment || detectedExifComment;

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


async function handleImageProcessing(imageBlob, srcUrl = null) {
    console.log("[PROCESS] Initiating image processing. Source:", srcUrl ? `URL: ${srcUrl}` : "Clipboard or Captured Area");

    impuPromptContainer.style.display = 'none';
    impuPromptContainer.classList.remove('show');
    impuPromptContainer.style.pointerEvents = 'none'; // 처리 중에는 이벤트 비활성화

    const settings = await new Promise(resolve => {
        chrome.storage.local.get('extractionMethod', resolve);
    });
    const extractionMethod = settings.extractionMethod || 'both';
    console.log(`[PROCESS] Extraction method selected: ${extractionMethod}`);

    showToast('이미지 분석 중...', 'loading', 30000);

    try {
        let extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };

        if (imageBlob.type === 'image/png') {
            if (extractionMethod === 'metadata' || extractionMethod === 'both') {
                showToast('PNG 메타데이터 추출 중...', 'loading', 30000);
                try {
                    extractedExifData = await getPngTextChunks(imageBlob);
                    if (extractedExifData.exifString) {
                        console.log("[PNG METADATA] Detected PNG metadata:", extractedExifData.exifString);
                    } else {
                        console.log("[PNG METADATA] No relevant PNG metadata found.");
                    }
                } catch (pngParseError) {
                    console.warn("PNG 메타데이터 읽기 실패:", pngParseError);
                    extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };
                }
            }
        } else {
            console.log("[PNG METADATA] Not a PNG image, skipping metadata extraction.");
        }

        let webpDataUrl = null;
        if (extractionMethod === 'gemini' || extractionMethod === 'both') {
            showToast('이미지 압축 및 WebP 변환 중...', 'loading', 30000);
            webpDataUrl = await convertBlobToWebPBase64(imageBlob);
        }

        if ((extractionMethod === 'gemini' || extractionMethod === 'both') && !webpDataUrl) {
            showToast('Gemini API를 위한 이미지 변환에 실패했습니다.', 'error');
            return;
        }

        if (extractionMethod === 'metadata' && !extractedExifData.exifString && !extractedExifData.novelai && !extractedExifData.stableDiffusion) {
            showToast('이미지에서 추출된 메타데이터가 없습니다.', 'warning');
            if (extractionMethod === 'metadata') {
                return;
            }
        }
        
        await processImageAndGeneratePrompts(
            webpDataUrl, 
            extractedExifData.exifString, 
            extractedExifData.novelai, 
            extractedExifData.stableDiffusion, 
            extractionMethod
        );

    } catch (err) {
        console.error('이미지 처리 중 오류 발생:', err);
        showToast('이미지 처리 중 오류가 발생했습니다. 개발자 도구를 확인해주세요.', 'error');
        impuPromptContainer.innerHTML = `
            <div class="impu-prompt-header">
                <strong style="color: var(--text-color);">오류 발생</strong>
                <button class="impu-close-button">X</button>
            </div>
            <div style="color: var(--error-color);">이미지 처리 중 오류가 발생했습니다.<br>(${err.message})</div>
        `;
        impuPromptContainer.style.display = 'block';
        impuPromptContainer.style.pointerEvents = 'auto'; // 오류 시에도 이벤트 활성화
        requestAnimationFrame(() => { impuPromptContainer.classList.add('show'); });
        impuPromptContainer.querySelector('.impu-close-button').addEventListener('click', () => {
            impuPromptContainer.classList.remove('show');
            impuPromptContainer.addEventListener('transitionend', () => {
                impuPromptContainer.style.display = 'none';
                impuPromptContainer.style.pointerEvents = 'none';
            }, { once: true });
        });
    }
}


function getPngTextChunks(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const buffer = e.target.result;
            const dataView = new DataView(buffer);
            const extractedMetadata = {};

            const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            for (let i = 0; i < pngSignature.length; i++) {
                if (dataView.getUint8(i) !== pngSignature[i]) {
                    console.warn("[PNG PARSER] Invalid PNG signature. Not a PNG file?");
                    return resolve({ exifString: null, novelai: null, stableDiffusion: null });
                }
            }
            console.log("[PNG PARSER] PNG signature valid. Starting chunk parsing.");

            let offset = 8;

            while (offset < buffer.byteLength) {
                if (offset + 8 > buffer.byteLength) {
                    console.log("[PNG PARSER] Reached end of file or insufficient bytes for next chunk header.");
                    break;
                }
                const length = dataView.getUint32(offset, false);
                offset += 4;

                const typeCode = dataView.getUint32(offset, false);
                const type = String.fromCharCode(
                    (typeCode >> 24) & 0xFF,
                    (typeCode >> 16) & 0xFF,
                    (typeCode >> 8) & 0xFF,
                    typeCode & 0xFF
                );
                offset += 4;

                console.log(`[PNG PARSER] Found chunk: Type=${type}, Length=${length}, Offset=${offset - 8}`);

                if (type === 'IHDR' || type === 'IDAT' || type === 'IEND' || length === 0) {
                    offset += length;
                    offset += 4;
                    continue;
                }

                if (length > 0 && length < 500000) {
                    try {
                        const chunkData = new Uint8Array(buffer, offset, length);
                        
                        if (type === 'tEXt') {
                            let keywordEnd = 0;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, keywordEnd));
                            const text = new TextDecoder('latin1').decode(chunkData.subarray(keywordEnd + 1));
                            extractedMetadata[keyword] = text;
                            console.log(`[PNG PARSER] tEXt chunk (parsed): ${keyword}=${text.substring(0, Math.min(text.length, 50))}...`);
                        } else if (type === 'iTXt') {
                            let currentDataOffset = 0;
                            let keywordEnd = currentDataOffset;
                            while (keywordEnd < chunkData.length && chunkData[currentDataOffset] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('utf-8').decode(chunkData.subarray(currentDataOffset, keywordEnd));
                            currentDataOffset = keywordEnd + 1;

                            currentDataOffset++;
                            currentDataOffset++;

                            let langTagEnd = currentDataOffset;
                            while (langTagEnd < chunkData.length && chunkData[langTagEnd] !== 0x00) {
                                langTagEnd++;
                            }
                            currentDataOffset = langTagEnd + 1;

                            let transKeyEnd = currentDataOffset;
                            while (transKeyEnd < chunkData.length && chunkData[transKeyEnd] !== 0x00) {
                                transKeyEnd++;
                            }
                            currentDataOffset = transKeyEnd + 1;

                            const text = new TextDecoder('utf-8').decode(chunkData.subarray(currentDataOffset));
                            extractedMetadata[keyword] = text;
                            console.log(`[PNG PARSER] iTXt chunk (parsed): ${keyword}=${text.substring(0, Math.min(text.length, 50))}...`);
                        } else if (type === 'zTXt') {
                            let keywordEnd = 0;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, keywordEnd));
                            extractedMetadata[keyword] = `[Compressed zTXt data for ${keyword}]`;
                            console.log(`[PNG PARSER] zTXt chunk (parsed): ${keyword}=[Compressed data]`);
                        } else {
                            try {
                                const decodedText = new TextDecoder('utf-8', { fatal: true }).decode(chunkData);
                                if (decodedText.length > 10 && (decodedText.includes(':') || decodedText.includes('{') || decodedText.includes('}'))) {
                                    extractedMetadata[type] = decodedText;
                                    console.log(`[PNG PARSER] Attempting decode of custom chunk (${type}): ${decodedText.substring(0, Math.min(decodedText.length, 100))}...`);
                                }
                            } catch (decodeError) {
                                console.warn(`[PNG PARSER] Failed to decode chunk ${type} as UTF-8: ${decodeError.message}`);
                            }
                        }

                    } catch (parseError) {
                        console.warn(`[PNG PARSER] Error processing chunk ${type}: ${parseError.message}`);
                    }
                }
                
                offset += length;
                offset += 4;
            }

            console.log("[PNG PARSER] Finished chunk parsing. Extracted metadata:", extractedMetadata);

            let finalExifString = null;
            let novelaiPrompt = null;
            let stableDiffusionPrompt = null;
            let foundRelevantAiMetadata = false;

            const AI_GENERATION_TAGS = [
                'Software', 'ImageDescription', 'UserComment', 'Artist', 'Copyright',
                'ProcessingSoftware', 'OriginalRawFileName', 'DocumentName',
                'parameters', 'prompt', 'negative_prompt', 'workflow',
                'Comment', 'Description', 'Title', 'Author', 'Source',
                'Generation time', 'Signed Hash', 'seed', 'steps', 'cfg_scale',
                'sampler', 'height', 'width', 'strength', 'noise_schedule', 'model',
                'clip_skip', 'version', 'uc'
            ];
            const AI_KEYWORDS = [
                'stable diffusion', 'midjourney', 'dall-e', 'dalle', 'ai generated',
                'artificial intelligence', 'neural network', 'gan', 'diffusion',
                'automatic1111', 'invokeai', 'comfyui', 'prompt', 'novelai',
                'swarmui', 'stableswarmui', 'stable swarm ui', 'imagine'
            ];

            if (extractedMetadata.Comment) {
                console.log("[PNG PARSER] Found 'Comment' chunk. Attempting JSON parse.");
                try {
                    const commentObj = JSON.parse(extractedMetadata.Comment);
                    console.log("[PNG PARSER] Successfully parsed 'Comment' as JSON:", commentObj);

                    const parts = [];
                    
                    if (commentObj.prompt) {
                        let text = commentObj.prompt;
                        if (typeof text === 'string' && text.startsWith('{"caption":')) {
                            try { const inner = JSON.parse(text); if (inner.caption && inner.caption.base_caption) text = inner.caption.base_caption; } catch (e) { /* ignore */ }
                        }
                        parts.push(`Prompt: ${text}`);
                        if (!novelaiPrompt) novelaiPrompt = text;
                        if (!stableDiffusionPrompt) stableDiffusionPrompt = text;
                    }
                    if (commentObj.v4_prompt && commentObj.v4_prompt.caption && commentObj.v4_prompt.caption.base_caption) {
                        const text = commentObj.v4_prompt.caption.base_caption;
                        parts.push(`V4 Prompt: ${text}`);
                        if (!novelaiPrompt) novelaiPrompt = text;
                        if (!stableDiffusionPrompt) stableDiffusionPrompt = text;
                    }

                    if (commentObj.uc) {
                        let text = commentObj.uc;
                        if (typeof text === 'string' && text.startsWith('{"caption":')) {
                            try { const inner = JSON.parse(text); if (inner.caption && inner.caption.base_caption) text = inner.caption.base_caption; } catch (e) { /* ignore */ }
                        }
                        parts.push(`Negative Prompt: ${text}`);
                        if (stableDiffusionPrompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt')) stableDiffusionPrompt += ` [Negative Prompt: ${text}]`;
                        else if (!stableDiffusionPrompt) stableDiffusionPrompt = `[Negative Prompt: ${text}]`;
                    }
                    if (commentObj.v4_negative_prompt && commentObj.v4_negative_prompt.caption && commentObj.v4_negative_prompt.caption.base_caption) {
                        const text = commentObj.v4_negative_prompt.caption.base_caption; 
                        parts.push(`V4 Negative Prompt: ${text}`);
                        if (stableDiffusionPrompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt')) stableDiffusionPrompt += ` [Negative Prompt: ${text}]`;
                        else if (!stableDiffusionPrompt) stableDiffusionPrompt = `[Negative Prompt: ${text}]`;
                    }

                    if (commentObj.negative_prompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt')) {
                        parts.push(`Negative Prompt (SD): ${commentObj.negative_prompt}`);
                        if (stableDiffusionPrompt) stableDiffusionPrompt += ` [Negative Prompt: ${commentObj.negative_prompt}]`;
                        else stableDiffusionPrompt = `[Negative Prompt: ${commentObj.negative_prompt}]`;
                    }
                    
                    if (commentObj.steps) parts.push(`Steps: ${commentObj.steps}`);
                    if (commentObj.sampler) parts.push(`Sampler: ${commentObj.sampler}`);
                    if (commentObj.seed) parts.push(`Seed: ${commentObj.seed}`);
                    if (commentObj.height) parts.push(`Height: ${commentObj.height}`);
                    if (commentObj.width) parts.push(`Width: ${commentObj.width}`);
                    if (commentObj.scale) parts.push(`Scale (CFG): ${commentObj.scale}`);
                    if (commentObj.model) parts.push(`Model: ${commentObj.model}`);
                    if (commentObj.clip_skip) parts.push(`Clip Skip: ${commentObj.clip_skip}`);
                    if (commentObj.version) parts.push(`Version: ${commentObj.version}`);
                    if (commentObj.workflow) {
                        try {
                            const workflowJson = JSON.stringify(commentObj.workflow, null, 2);
                            parts.push(`ComfyUI Workflow:\n${workflowJson}`);
                        } catch(wfErr) {
                            parts.push(`ComfyUI Workflow: [Invalid JSON or too complex]`);
                        }
                    }

                    finalExifString = (parts.length > 0 ? parts.join('\n') : '') +
                                      '\n\n--- Full JSON Comment (Raw) ---\n' + JSON.stringify(commentObj, null, 2);
                    foundRelevantAiMetadata = true;

                } catch (e) {
                    console.warn(`[PNG PARSER] 'Comment' field is not valid JSON. Error: ${e.message}.`);
                    extractedMetadata['Comment (Parse Failed)'] = extractedMetadata.Comment;
                }
            }

            if (extractedMetadata.parameters) {
                if (!stableDiffusionPrompt) stableDiffusionPrompt = extractedMetadata.parameters;
                if (!novelaiPrompt) novelaiPrompt = extractedMetadata.parameters;
                if (!foundRelevantAiMetadata) {
                    finalExifString = `Parameters: ${extractedMetadata.parameters}`;
                    foundRelevantAiMetadata = true;
                } else if (finalExifString && !finalExifString.includes("Parameters:")) {
                    finalExifString += `\n\n--- Parameters ---\n${extractedMetadata.parameters}`;
                } else if (!finalExifString) {
                     finalExifString = `Parameters: ${extractedMetadata.parameters}`;
                     foundRelevantAiMetadata = true;
                }
            }
            
            const tempMetadataLines = [];
            for (const key in extractedMetadata) {
                if (key === 'Comment' || key === 'parameters') continue;

                const value = extractedMetadata[key];
                const lowerKey = key.toLowerCase();
                const lowerValue = String(value).toLowerCase();

                const isAiTag = AI_GENERATION_TAGS.some(tag => lowerKey === tag.toLowerCase() || lowerKey.includes(tag.toLowerCase()));
                const containsAiKeyword = AI_KEYWORDS.some(keyword => lowerValue.includes(keyword));

                if (isAiTag || containsAiKeyword || (value && typeof value === 'string' && value.length > 50 && !value.startsWith('[Compressed'))) {
                    tempMetadataLines.push(`${key}: ${value}`);
                    foundRelevantAiMetadata = true;

                    if ((lowerKey.includes('prompt') || lowerKey.includes('description')) && !novelaiPrompt) {
                        novelaiPrompt = value;
                        if (!stableDiffusionPrompt) stableDiffusionPrompt = value;
                    }
                }
            }
            if (tempMetadataLines.length > 0) {
                if (finalExifString) {
                    finalExifString += `\n\n--- Additional PNG Metadata Chunks ---\n\n${tempMetadataLines.join('\n\n')}`;
                } else {
                    finalExifString = tempMetadataLines.join('\n\n--- PNG Metadata Chunk ---\n\n');
                }
            }

            if (!novelaiPrompt && finalExifString) {
                const lines = finalExifString.split('\n');
                let foundPromptLine = false;
                for (const line of lines) {
                    if (line.toLowerCase().startsWith('prompt:')) {
                        novelaiPrompt = line.substring('prompt:'.length).trim();
                        stableDiffusionPrompt = novelaiPrompt;
                        foundPromptLine = true;
                        break;
                    }
                }

                if (!foundPromptLine) {
                    novelaiPrompt = finalExifString;
                    stableDiffusionPrompt = finalExifString;
                }

                let negativePromptText = null;
                const negativePromptMatch = finalExifString.match(/(?:Negative Prompt|negative_prompt|uc): (.*?)(?:\n|$)/i);
                if (negativePromptMatch && negativePromptMatch[1]) {
                    negativePromptText = negativePromptMatch[1].trim();
                }

                if (negativePromptText && stableDiffusionPrompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt:')) {
                    stableDiffusionPrompt += `, negative_prompt: ${negativePromptText}`;
                }
            }

            resolve({
                exifString: foundRelevantAiMetadata ? finalExifString : null,
                novelai: novelaiPrompt,
                stableDiffusion: stableDiffusionPrompt
            });
        };
        reader.onerror = (err) => {
            console.error("[PNG PARSER] FileReader error during PNG parsing:", err);
            reject(new Error("FileReader error during PNG parsing."));
        };
        reader.readAsArrayBuffer(blob);
    });
}


function displayMetadataResults(extractedExifData) {
    console.log("[UI] Displaying metadata only results.");
    impuPromptContainer.style.display = 'block';
    impuPromptContainer.style.pointerEvents = 'auto'; // 결과 창 활성화 시 이벤트 받음
    updatePromptWindowPosition();
    requestAnimationFrame(() => {
        impuPromptContainer.classList.add('show');
    });

    let combinedDetectedPrompt = '';
    if (extractedExifData.novelai) {
        combinedDetectedPrompt += `NovelAI 원문: ${extractedExifData.novelai}\n`;
    }
    if (extractedExifData.stableDiffusion && extractedExifData.stableDiffusion !== extractedExifData.novelai) {
        combinedDetectedPrompt += `Stable Diffusion 원문: ${extractedExifData.stableDiffusion}\n`;
    }
    if (!combinedDetectedPrompt && extractedExifData.exifString) {
         combinedDetectedPrompt = `원문 메타데이터: \n${extractedExifData.exifString}\n`;
    }

    if(!combinedDetectedPrompt) {
        combinedDetectedPrompt = "이미지에서 추출된 프롬프트가 없습니다.";
        showToast('이미지에서 추출된 메타데이터가 없습니다.', 'warning');
    } else {
        showToast('이미지 메타데이터가 성공적으로 추출되었습니다!', 'success');
    }

    impuPromptContainer.innerHTML = `
        <div class="impu-prompt-header">
            <strong style="color: var(--text-color);">메타데이터 추출 결과</strong>
            <button class="impu-close-button">X</button>
        </div>
        <div class="impu-prompt-group impu-detected-prompt-group">
            <strong>이미지에서 추출된 프롬프트:</strong>
            <textarea class="impu-prompt-textarea impu-neumorphic-input" readonly>${combinedDetectedPrompt.trim()}</textarea>
            <button class="impu-copy-button impu-neumorphic-button" data-copy-target="detected_combined">모두 복사</button>
        </div>
    `;
    impuPromptContainer.querySelector('.impu-close-button').addEventListener('click', () => {
        impuPromptContainer.classList.remove('show');
        impuPromptContainer.addEventListener('transitionend', () => {
            impuPromptContainer.style.display = 'none';
            impuPromptContainer.style.pointerEvents = 'none'; // 결과 창 닫힐 때 이벤트 비활성화
        }, { once: true });
    });
    impuPromptContainer.querySelectorAll('.impu-copy-button').forEach(copyBtn => {
        copyBtn.addEventListener('click', (e) => {
            const textarea = e.target.previousElementSibling;
            if (textarea && textarea.classList.contains('impu-prompt-textarea')) {
                copyToClipboard(textarea.value);
            }
        });
    });
}


async function convertBlobToWebPBase64(blob, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const dataUrl = canvas.toDataURL('image/webp', quality);
                resolve(dataUrl);

            } catch (e) {
                reject(new Error(`Failed to convert image to WebP: ${e.message}`));
            }
        };
        img.onerror = (e) => {
            reject(new Error(`Failed to load image for WebP conversion: ${e.message || 'unknown error'}`));
        };
        img.src = URL.createObjectURL(blob);
    });
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateUI") {
        console.log("[MESSAGE] Received updateUI request:", request);
        if (request.resultWindowPosition) {
            applyResultWindowPosition(request.resultWindowPosition);
        }
    } else if (request.action === "initiateGeminiProcessingFromUrl") {
        console.log("[MESSAGE] Received initiateGeminiProcessingFromUrl request from background:", request.srcUrl);
        showToast('이미지 로드 중...', 'loading', 30000);
        fetch(request.srcUrl)
            .then(response => response.blob())
            .then(blob => handleImageProcessing(blob, request.srcUrl))
            .catch(err => {
                console.error('URL 이미지 로드 실패:', err);
                showToast(`이미지 로드 실패 (URL): ${err.message}`, 'error');
            });
    } else if (request.action === "updateProgressWindow") {
        updateProgressWindow(request.message, request.type, request.show, request.progress);
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
        hideProgressWindow(); // 캡처 완료 후 진행 상황 창 숨김
        showCaptureModal(request.imageDataUrl); // 캡처된 이미지로 모달 표시
    }
});


document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updatePromptWindowPosition();
        console.log("[UI] DOMContentLoaded: Initial prompt window position updated.");
    }, 100);

    chrome.storage.local.get(['resultWindowPosition', 'extractionMethod'], (data) => {
        const savedPosition = data.resultWindowPosition || 'bottom-right';
        const savedExtractionMethod = data.extractionMethod || 'both';

        applyResultWindowPosition(savedPosition);
        console.log(`[UI] Initial settings applied based on storage: Position(${savedPosition}), ExtractionMethod(${savedExtractionMethod})`);
    });
});