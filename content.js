
// 플로팅 버튼 컨테이너
const floatingButtonContainer = document.createElement('div');
floatingButtonContainer.id = 'floating-button-container';
document.body.appendChild(floatingButtonContainer);

// 플로팅 버튼
const button = document.createElement('button');
button.id = 'floating-button';
button.innerHTML = '<span class="ai-icon">✨</span>'; // AI를 상징하는 별표
floatingButtonContainer.appendChild(button);

// 진행 상황 창 컨테이너 (상단 중앙에 독립적으로 위치)
const progressWindowContainer = document.createElement('div');
progressWindowContainer.id = 'progress-window-container';
progressWindowContainer.classList.add('neumorphic'); // 뉴모피즘 스타일 적용
document.body.appendChild(progressWindowContainer);

// 프롬프트 컨테이너 (결과 창) - 플로팅 버튼 아래에 위치
const promptContainer = document.createElement('div');
promptContainer.id = 'prompt-container';
promptContainer.classList.add('neumorphic'); // 뉴모피즘 스타일 적용
document.body.appendChild(promptContainer);

// 토스트 알림 컨테이너 (다이나믹 아일랜드 스타일)
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

let toastTimeout; // 토스트 자동 숨김을 위한 타이머



// 토스트 알림 기능 (다이나믹 아일랜드 스타일)

/**
 * 웹페이지 상단 중앙에 토스트 알림을 표시합니다.
 * @param {string} message 표시할 메시지
 * @param {'info'|'success'|'warning'|'error'} type 알림 유형 (loading은 Progress Window가 담당)
 * @param {number} duration 알림 표시 시간 (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    console.log(`[TOAST] Showing ${type} toast: ${message}`);
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;

    // 기존 토스트 제거 (겹침 방지)
    toastContainer.innerHTML = '';
    toastContainer.appendChild(toast);

    // 애니메이션 시작 (투명도 0 -> 1)
    requestAnimationFrame(() => { // DOM 업데이트 후 애니메이션 적용
        toast.classList.add('show');
    });
    
    // 일정 시간 후 사라지도록
    clearTimeout(toastTimeout); // 이전 타이머 클리어
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide'); // 사라지는 애니메이션 클래스 추가
        // 애니메이션 완료 후 요소 제거
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}



// 진행 상황 창 기능

/**
 * 진행 상황 창을 표시하고 메시지를 업데이트합니다.
 * @param {string} message 표시할 메시지
 * @param {'loading'|'info'|'success'|'warning'|'error'} type 메시지 유형
 * @param {boolean} show 스피너 표시 여부 및 창 표시 여부
 * @param {number} progress 로더 대신 프로그레스 바일 경우 진행률 (0-100)
 */
function updateProgressWindow(message, type = 'loading', show = false, progress = -1) {
    let progressBarHtml = '';
    if (type === 'loading' && progress >= 0) { // 특정 진행률이 있을 경우 (현재 사용 안함, 확장성 목적)
        progressBarHtml = `<div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>`;
    } else if (type === 'loading') { // 불확정 프로그레스 바 (기본 로딩 상태)
        progressBarHtml = `<div class="progress-bar-container"><div class="progress-bar progress-bar-indeterminate"></div></div>`;
    }

    progressWindowContainer.innerHTML = `
        <div class="progress-content ${type}">
            ${type === 'loading' ? progressBarHtml : `<div class="status-icon ${type}"></div>`}
            <span class="progress-message-text">${message}</span>
        </div>
        <div class="no-click-message">다른 곳을 클릭하지 마세요.</div>
    `;
    
    // 애니메이션을 위해 display와 show 클래스 제어
    if (show) {
        progressWindowContainer.style.display = 'block';
        requestAnimationFrame(() => { // DOM 업데이트 후 애니메이션 적용
            progressWindowContainer.classList.add('show');
        });
    } else { // 숨길 때
        progressWindowContainer.classList.remove('show');
        // 애니메이션 완료 후 display: none 처리
        progressWindowContainer.addEventListener('transitionend', () => {
            progressWindowContainer.style.display = 'none';
        }, { once: true });
    }
}

function hideProgressWindow() {
    console.log("[PROGRESS WINDOW] Hiding progress window.");
    progressWindowContainer.classList.remove('show');
    progressWindowContainer.addEventListener('transitionend', () => {
        progressWindowContainer.style.display = 'none';
    }, { once: true });
}


// 플로팅 버튼 및 결과창 위치 설정 로드 및 적용

let currentButtonPosition = 'bottom-right'; // 현재 버튼 위치를 저장할 변수 (기본값)

/**
 * 저장된 버튼 위치 설정에 따라 플로팅 버튼의 CSS 클래스를 적용합니다.
 * @param {string} position 'top-left', 'bottom-right' 등 위치 문자열
 */
function applyButtonPosition(position) {
    console.log(`[UI] Applying button position: ${position}`);
    // 기존 위치 클래스 제거
    const positionClasses = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'
    ];
    floatingButtonContainer.classList.remove(...positionClasses);
    
    // 새 위치 클래스 추가
    floatingButtonContainer.classList.add(position);
    currentButtonPosition = position; // 현재 위치 업데이트
    
    // 버튼 위치 변경 시 결과창 위치도 즉시 업데이트
    updatePromptWindowPosition();
}

/**
 * 플로팅 버튼 및 아이콘 크기를 설정합니다.
 * @param {string} sizePercentage '50'부터 '200'까지의 문자열 퍼센티지 값 (예: '100')
 */
function applyButtonAndIconSize(sizePercentage) {
    const floatButton = document.getElementById('floating-button');
    const aiIcon = floatButton ? floatButton.querySelector('.ai-icon') : null;

    if (floatButton) {
        // styles.css에 정의된 --button-size 변수의 기본값 48px를 기준으로 스케일링
        const baseButtonSize = 48; 
        const newSize = (parseInt(sizePercentage) / 100) * baseButtonSize;
        // --button-size 변수 업데이트를 통해 버튼 크기 조절
        floatButton.style.setProperty('--button-size', `${newSize}px`); 
        // 명시적으로 width/height도 설정 (일부 브라우저에서 CSS 변수 업데이트가 즉시 반영되지 않을 경우 대비)
        floatButton.style.width = `${newSize}px`; 
        floatButton.style.height = `${newSize}px`;
        console.log(`[UI] Floating button size updated to: ${newSize}px`);
    }

    if (aiIcon) {
        // 아이콘 폰트 크기 조절 (styles.css에 정의된 .ai-icon 폰트 크기 기본값 20px를 기준으로 스케일링)
        const baseIconFontSize = 20; 
        const newIconFontSize = (parseInt(sizePercentage) / 100) * baseIconFontSize;
        aiIcon.style.fontSize = `${newIconFontSize}px`;
        console.log(`[UI] AI icon font size updated to: ${newIconFontSize}px`);
    }
    // 버튼 크기 변경 후 결과 창 위치 재계산
    updatePromptWindowPosition();
}


/**
 * 프롬프트 결과 창의 위치를 버튼 위치에 맞춰 업데이트합니다.
 * 화면 경계도 고려하여 창이 화면 밖으로 나가지 않도록 조정합니다.
 */
function updatePromptWindowPosition() {
    console.log("[UI] Updating prompt window position.");
    
    // 현재 스타일을 저장
    const initialDisplay = promptContainer.style.display;
    const initialVisibility = promptContainer.style.visibility;
    const initialOpacity = promptContainer.style.opacity;

    // 크기 측정을 위해 잠시 보이게 설정 (화면에는 안 보이게)
    promptContainer.style.display = 'block'; 
    promptContainer.style.visibility = 'hidden';
    promptContainer.style.opacity = '0';
    
    const buttonRect = floatingButtonContainer.getBoundingClientRect();
    const containerRect = promptContainer.getBoundingClientRect(); // 결과창의 현재 크기 가져오기
    
    // 측정 후 다시 원래 상태로 복원
    promptContainer.style.display = initialDisplay;
    promptContainer.style.visibility = initialVisibility;
    promptContainer.style.opacity = initialOpacity;


    let top = 'auto';
    let left = 'auto';
    let right = 'auto';
    let bottom = 'auto';
    let transform = ''; // 중앙 정렬 시 transform 사용

    const margin = 15; // 버튼과 창 사이의 여백

    // 세로 위치 결정 (버튼 아래에 위치)
    if (currentButtonPosition.includes('top')) {
        top = buttonRect.bottom + margin;
    } else if (currentButtonPosition.includes('bottom')) {
        // 창이 버튼 위로 올라가야 하므로, 버튼 상단 위치에서 창 높이와 마진을 뺌
        top = buttonRect.top - containerRect.height - margin; 
        bottom = 'auto'; 
    } else { // middle-left, middle-right, middle-center (기본은 버튼 아래)
        top = buttonRect.bottom + margin;
    }

    // 가로 위치 결정 (버튼 기준으로 정렬)
    if (currentButtonPosition.includes('left')) {
        left = buttonRect.left; // 버튼의 왼쪽 끝과 결과창의 왼쪽 끝 맞춤
        right = 'auto'; 
    } else if (currentButtonPosition.includes('right')) {
        // 창의 오른쪽 끝을 버튼의 오른쪽 끝과 맞추기
        left = buttonRect.right - containerRect.width; 
        right = 'auto'; 
    } else { // top-center, middle-center, bottom-center (가로 중앙 정렬)
        left = '50%';
        transform += 'translateX(-50%)';
        right = 'auto'; 
    }
    // 최종 위치 적용 (초과 시 화면 경계 보정)
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalLeft = (typeof left === 'number') ? left : 
                    (left === '50%' ? (windowWidth / 2) - (containerRect.width / 2) : 0); 
    
    if (typeof right === 'number') {
        finalLeft = windowWidth - containerRect.width - right;
    }

    let finalTop = typeof top === 'number' ? top : 0; 
    if (typeof bottom === 'number') { 
        finalTop = windowHeight - containerRect.height - bottom;
    }

    // 화면 왼쪽/오른쪽 경계 보정
    if (finalLeft < 10) finalLeft = 10;
    if (finalLeft + containerRect.width > windowWidth - 10) {
        finalLeft = windowWidth - containerRect.width - 10;
    }
    // 화면 위/아래 경계 보정
    if (finalTop < 10) finalTop = 10;
    if (finalTop + containerRect.height > windowHeight - 10) {
        finalTop = windowHeight - containerRect.height - 10;
    }
    
    // 최종 스타일 적용
    promptContainer.style.top = `${finalTop}px`;
    promptContainer.style.left = `${finalLeft}px`;
    promptContainer.style.right = 'auto'; 
    promptContainer.style.bottom = 'auto';
    promptContainer.style.transform = transform; 

    console.log(`[UI] Prompt container position calculated: Top: ${finalTop}px, Left: ${finalLeft}px`); // 디버깅 로그
}


// 창 크기 변경 시 UI 위치 업데이트
window.addEventListener('resize', updatePromptWindowPosition);


// 초기 버튼 위치 로드 및 적용 (확장 프로그램 로드 시 한 번 실행)
chrome.storage.sync.get('buttonPosition', (data) => {
    const savedPosition = data.buttonPosition || 'bottom-right'; // 기본값을 'bottom-right'로 설정
    applyButtonPosition(savedPosition);
});


// 복사 버튼 기능

/**
 * 텍스트를 클립보드에 복사하고 토스트 알림을 표시합니다.
 * @param {string} text 복사할 텍스트
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('프롬프트가 클립보드에 복사되었습니다!', 'success'))
        .catch(err => showToast('클립보드 복사에 실패했습니다.', 'error'));
}



// 이벤트 리스너 (주요 기능 트리거)
// 플로팅 버튼 클릭 이벤트
button.addEventListener('click', async () => {
    console.log("[CLICK] Floating button clicked. Initiating process.");
    promptContainer.style.display = 'none'; // 기존 프롬프트 창 숨기기
    promptContainer.classList.remove('show'); // 결과 창에 애니메이션 클래스 제거 (재사용 대비)

    updateProgressWindow('클립보드에서 이미지 확인 중...', 'loading', true); // 초기 메시지 변경

    try {
        const clipboardItems = await navigator.clipboard.read();
        let imageBlob = null;

        for (const clipboardItem of clipboardItems) {
            for (const type of clipboardItem.types) {
                if (type.startsWith('image/')) {
                    imageBlob = await clipboardItem.getType(type);
                    console.log("[CLIPBOARD] Image Blob found.");
                    break;
                }
            }
            if (imageBlob) break;
        }

        if (!imageBlob) { // 이미지가 아닌 경우 바로 예외 처리
            console.warn("[CLIPBOARD] No image found in clipboard.");
            hideProgressWindow();
            showToast('클립보드에 이미지가 없습니다. 이미지를 복사한 후 다시 시도해주세요.', 'error');
            return; // 이후 작업 중단
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const imageDataUrl = reader.result;
            console.log("[API CALL] Sending image data to background for Gemini processing.");

            updateProgressWindow('Gemini API로 프롬프트 생성 요청 중...', 'loading', true);
            
            // Gemini API 응답 타임아웃 설정 (예: 30초)
            const timeoutDuration = 30000; // 30초
            const timeoutPromise = new Promise((resolve, reject) => {
                const id = setTimeout(() => {
                    clearTimeout(id); // 자신을 클리어
                    reject(new Error(`API 응답 시간 초과 (${timeoutDuration / 1000}초). 네트워크 상태를 확인하거나 API 키를 확인해주세요.`));
                }, timeoutDuration);
            });

            const apiRequestPromise = chrome.runtime.sendMessage({
                action: "processImageWithGemini",
                imageDataUrl: imageDataUrl
            });

            let response;
            try {
                response = await Promise.race([apiRequestPromise, timeoutPromise]);
                console.log("[API CALL] Response received from background:", response);
            } catch (timeoutError) {
                console.error("[API CALL] Timeout or other error during API request:", timeoutError);
                hideProgressWindow();
                // 오류 메시지 표시
                promptContainer.innerHTML = `
                    <div class="prompt-header">
                        <strong>오류 발생</strong>
                        <button class="close-button">X</button>
                    </div>
                    <div style="color: var(--error-color);">${timeoutError.message}</div>
                `;
                showToast(`오류: ${timeoutError.message}`, 'error');
                promptContainer.style.display = 'block';
                // 애니메이션 시작
                requestAnimationFrame(() => {
                    promptContainer.classList.add('show');
                });
                updatePromptWindowPosition();
                promptContainer.querySelector('.close-button').addEventListener('click', () => {
                    promptContainer.classList.remove('show');
                    promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
                });
                return; // 타임아웃 발생 시 이후 로직 실행 중단
            }

            hideProgressWindow(); // Gemini API 응답 후 진행 상황 창 숨기기

            if (response.error) {
                console.error("[API CALL] API returned an error:", response.error);
                // 오류 발생 시 프롬프트 창에 오류 메시지 표시
                promptContainer.innerHTML = `
                    <div class="prompt-header">
                        <strong>오류 발생</strong>
                        <button class="close-button">X</button>
                    </div>
                    <div style="color: var(--error-color);">${response.error}</div>
                `;
                showToast(`오류: ${response.error}`, 'error'); // 토스트 알림
            } else {
                console.log("[API CALL] Prompts generated successfully.");
                // 성공 시 프롬프트 결과 표시
                promptContainer.innerHTML = `
                    <div class="prompt-header">
                        <strong>프롬프트 결과</strong>
                        <button class="close-button">X</button>
                    </div>
                    <div class="prompt-group">
                        <strong>NovelAI:</strong>
                        <textarea class="prompt-textarea neumorphic-input" readonly>${response.novelai}</textarea>
                        <button class="copy-button neumorphic-button" data-copy-target="novelai">복사</button>
                    </div>
                    <div class="prompt-group">
                        <strong>Stable Diffusion:</strong>
                        <textarea class="prompt-textarea neumorphic-input" readonly>${response.stable_diffusion}</textarea>
                        <button class="copy-button neumorphic-button" data-copy-target="stable_diffusion">복사</button>
                    </div>
                `;
                // 복사 버튼 이벤트 리스너 추가 (이벤트 위임 대신 각 버튼에 직접 할당)
                promptContainer.querySelectorAll('.copy-button').forEach(copyBtn => {
                    copyBtn.addEventListener('click', (e) => {
                        const textarea = e.target.previousElementSibling;
                        if (textarea && textarea.classList.contains('prompt-textarea')) {
                            copyToClipboard(textarea.value);
                        }
                    });
                });
                
                showToast('프롬프트가 성공적으로 생성되었습니다!', 'success'); // 토스트 알림
            }
            promptContainer.style.display = 'block'; // 결과 창 표시
            // 결과 창 콘텐츠가 로드된 후 정확한 크기를 반영하기 위해 애니메이션 전 위치 업데이트
            updatePromptWindowPosition(); 
            
            // 애니메이션 시작
            requestAnimationFrame(() => {
                promptContainer.classList.add('show');
            });

            // 닫기 버튼 이벤트 리스너는 결과 창 표시 후 추가해야 함
            promptContainer.querySelector('.close-button').addEventListener('click', () => {
                promptContainer.classList.remove('show'); // 숨김 애니메이션 시작
                promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
            });

        };
        reader.readAsDataURL(imageBlob); // 이미지 Blob을 Base64로 변환
    } catch (err) {
        // 클립보드 접근 또는 메시지 전송 중 오류 발생 시
        console.error('클립보드 접근 또는 확장 프로그램 오류가 발생했습니다:', err);
        hideProgressWindow(); // 오류 발생 시 진행창 숨기기
        promptContainer.innerHTML = `
            <div class="prompt-header">
                <strong>오류 발생</strong>
                <button class="close-button">X</button>
            </div>
            <div style="color: var(--error-color);">클립보드 접근 또는 확장 프로그램 오류가 발생했습니다.<br>(${err.message})</div>
        `;
        showToast('확장 프로그램 오류가 발생했습니다. 개발자 도구를 확인해주세요.', 'error'); // 토스트 알림
        promptContainer.style.display = 'block'; // 오류 메시지라도 보이도록
        updatePromptWindowPosition(); // 결과창 위치 다시 설정
        
        // 애니메이션 시작
        requestAnimationFrame(() => {
            promptContainer.classList.add('show');
        });

        // 닫기 버튼 이벤트 리스너 추가
        promptContainer.querySelector('.close-button').addEventListener('click', () => {
            promptContainer.classList.remove('show');
            promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
        });
    }
});


// 플로팅 버튼, 진행 상황 창, 프롬프트 창이 아닌 다른 곳을 클릭하면 모두 숨김
document.addEventListener('click', (event) => {
    const target = event.target;
    // 클릭된 요소가 플로팅 버튼 컨테이너, 진행 상황 창, 프롬프트 창 또는 그 자손이 아니라면 숨김
    if (!floatingButtonContainer.contains(target) && 
        !progressWindowContainer.contains(target) &&
        !promptContainer.contains(target)) {
        
        if (promptContainer.style.display === 'block') {
            promptContainer.classList.remove('show'); // 숨김 애니메이션 시작
            // 애니메이션 완료 후 display: none
            promptContainer.addEventListener('transitionend', () => {
                promptContainer.style.display = 'none'; 
            }, { once: true });
            console.log("[UI HIDE] Prompt container hidden by outside click.");
        }
        // progressWindowContainer는 pointer-events: none 으로 클릭을 받지 않으며,
        // 일정 시간 후 자동으로 사라지므로 별도의 클릭 숨김 로직이 불필요
    }
});


// background.js 또는 popup.js로부터 메시지 수신 (예: 컨텍스트 메뉴에서 이미지 복사, 팝업에서 설정 변경)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "copyImageToClipboard") {
        console.log("[MESSAGE] Received copyImageToClipboard request.");
        // 컨텍스트 메뉴를 통한 이미지 복사 처리 (현재 manifest에서 컨텍스트 메뉴 제거됨)
        // 이 메시지는 이제 들어오지 않거나, 다른 방법으로 트리거 될 때만 작동합니다.
        if (request.srcUrl) {
            updateProgressWindow('이미지 복사 중...', 'loading', true); // 진행 상황 창
            fetch(request.srcUrl)
                .then(response => response.blob())
                .then(blob => {
                    return navigator.clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob
                        })
                    ]);
                })
                .then(() => {
                    console.log('이미지 데이터가 클립보드에 성공적으로 복사되었습니다.');
                    showToast('이미지가 클립보드에 복사되었습니다.', 'success'); // 토스트 알림
                    updateProgressWindow('이미지 복사 완료', 'success', false); // 진행 상황 창 닫기
                })
                .catch(err => {
                    console.error('이미지 데이터 클립보드 복사 실패:', err);
                    showToast('이미지 복사 실패: ' + err.message, 'error'); // 토스트 알림
                    updateProgressWindow('이미지 복사 실패', 'error', false); // 진행 상황 창 닫기
                });
        } else {
            console.warn('이미지 URL을 찾을 수 없어 클립보드 복사 실패.');
            showToast('복사할 이미지 URL을 찾을 수 없습니다.', 'warning'); // 토스트 알림
            updateProgressWindow('복사할 이미지 없음', 'warning', false); // 진행 상황 창 닫기
        }
    } else if (request.action === "updateUI") { // 팝업에서 UI 설정 변경 시
        console.log("[MESSAGE] Received updateUI request:", request);
        // 버튼 위치 업데이트
        if (request.buttonPosition) {
            applyButtonPosition(request.buttonPosition);
        }
        // 아이콘 크기 업데이트
        if (request.iconSize) { 
            applyButtonAndIconSize(request.iconSize);
        }
        // 다른 UI 설정이 추가되면 여기에 추가
    }
});

// 초기 아이콘 크기 로드 및 적용 (확장 프로그램 로드 시 한 번 실행)
chrome.storage.sync.get('iconSize', (data) => {
    const savedIconSize = data.iconSize || '100'; // 기본값 100%
    applyButtonAndIconSize(savedIconSize); // 초기 로드 시 크기 적용
    console.log(`[UI] Initial size applied based on storage: ${savedIconSize}%`);
});

// 문서 로드 후 초기 UI 위치를 한 번 업데이트 (레이아웃 안정화)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updatePromptWindowPosition();
        console.log("[UI] DOMContentLoaded: Initial prompt window position updated.");
    }, 100); 
});