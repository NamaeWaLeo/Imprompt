// 플로팅 버튼 컨테이너
const floatingButtonContainer = document.createElement('div');
floatingButtonContainer.id = 'floating-button-container';
document.body.appendChild(floatingButtonContainer);

// 플로팅 버튼
const button = document.createElement('button');
button.id = 'floating-button';
button.innerHTML = '<span class="ai-icon">✨</span>'; // 반짞빤ㅉㅃ깎
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

// 토스트 알림 컨테이너 (애플의 그것과 비슷한 스타일)
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

let toastTimeout; // 토스트 자동 숨김을 위한 타이머


// 토스트 알림 기능 (애플의 그것과 비슷한 스타일)

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

    toastContainer.innerHTML = '';
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
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
    if (type === 'loading' && progress >= 0) {
        progressBarHtml = `<div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>`;
    } else if (type === 'loading') {
        progressBarHtml = `<div class="progress-bar-container"><div class="progress-bar progress-bar-indeterminate"></div></div>`;
    }

    progressWindowContainer.innerHTML = `
        <div class="progress-content ${type}">
            ${type === 'loading' ? progressBarHtml : `<div class="status-icon ${type}"></div>`}
            <span class="progress-message-text">${message}</span>
        </div>
        <div class="no-click-message">다른 곳을 클릭하지 마세요.</div>
    `;

    if (show) {
        progressWindowContainer.style.display = 'block';
        requestAnimationFrame(() => {
            progressWindowContainer.classList.add('show');
        });
    } else {
        progressWindowContainer.classList.remove('show');
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

let currentButtonPosition = 'bottom-right';

function applyButtonPosition(position) {
    console.log(`[UI] Applying button position: ${position}`);
    const positionClasses = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'
    ];
    floatingButtonContainer.classList.remove(...positionClasses);

    floatingButtonContainer.classList.add(position);
    currentButtonPosition = position;

    updatePromptWindowPosition();
}

function applyButtonAndIconSize(sizePercentage) {
    const floatButton = document.getElementById('floating-button');
    const aiIcon = floatButton ? floatButton.querySelector('.ai-icon') : null;

    if (floatButton) {
        const baseButtonSize = 48;
        const newSize = (parseInt(sizePercentage) / 100) * baseButtonSize;
        floatButton.style.setProperty('--button-size', `${newSize}px`);
        floatButton.style.width = `${newSize}px`;
        floatButton.style.height = `${newSize}px`;
        console.log(`[UI] Floating button size updated to: ${newSize}px`);
    }

    if (aiIcon) {
        const baseIconFontSize = 20;
        const newIconFontSize = (parseInt(sizePercentage) / 100) * baseIconFontSize;
        aiIcon.style.fontSize = `${newIconFontSize}px`;
        console.log(`[UI] AI icon font size updated to: ${newIconFontSize}px`);
    }
    updatePromptWindowPosition();
}

function setFloatingButtonVisibility(hide) {
    if (hide) {
        floatingButtonContainer.style.display = 'none';
        console.log("[UI] Floating button hidden.");
    } else {
        floatingButtonContainer.style.display = 'flex';
        console.log("[UI] Floating button shown.");
    }
}


function updatePromptWindowPosition() {
    console.log(`[UI] Updating prompt window position. Current button position: ${currentButtonPosition}`);
    const buttonRect = floatingButtonContainer.getBoundingClientRect();
    const originalDisplay = promptContainer.style.display;
    promptContainer.style.display = 'block';
    const containerRect = promptContainer.getBoundingClientRect();
    promptContainer.style.display = originalDisplay;


    let top = 'auto';
    let left = 'auto';
    let right = 'auto';
    let bottom = 'auto';
    let transform = '';

    const margin = 15;

    if (currentButtonPosition.includes('top')) {
        top = buttonRect.bottom + margin;
    } else if (currentButtonPosition.includes('bottom')) {
        bottom = window.innerHeight - buttonRect.top + margin;
    } else { // middle
        top = buttonRect.bottom + margin;
    }

    if (currentButtonPosition.includes('left')) {
        left = buttonRect.left;
    } else if (currentButtonPosition.includes('right')) {
        right = window.innerWidth - buttonRect.right;
    } else { // center
        left = '50%';
        transform += 'translateX(-50%)';
    }

    promptContainer.style.top = typeof top === 'number' ? `${top}px` : top;
    promptContainer.style.bottom = typeof bottom === 'number' ? `${bottom}px` : bottom;
    promptContainer.style.left = typeof left === 'number' ? `${left}px` : left;
    promptContainer.style.right = typeof right === 'number' ? `${right}px` : right;
    promptContainer.style.transform = transform;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalLeft = promptContainer.offsetLeft;
    let finalTop = promptContainer.offsetTop;

    if (finalLeft < 10) {
        finalLeft = 10;
        promptContainer.style.transform = promptContainer.style.transform.replace(/translateX\(.*?\)/, '');
    } else if (finalLeft + containerRect.width > windowWidth - 10) {
        finalLeft = windowWidth - containerRect.width - 10;
        promptContainer.style.transform = promptContainer.style.transform.replace(/translateX\(.*?\)/, '');
    }

    if (finalTop < 10) {
        finalTop = 10;
    } else if (finalTop + containerRect.height > windowHeight - 10) {
        finalTop = windowHeight - containerRect.height - 10;
    }
    
    promptContainer.style.top = `${finalTop}px`;
    promptContainer.style.left = `${finalLeft}px`;
    promptContainer.style.right = 'auto';
    promptContainer.style.bottom = 'auto';


    console.log(`[UI] Prompt container final position: Top: ${promptContainer.style.top}, Left: ${promptContainer.style.left}`);
}


window.addEventListener('resize', updatePromptWindowPosition);


function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('프롬프트가 클립보드에 복사되었습니다!', 'success'))
        .catch(err => showToast('클립보드 복사에 실패했습니다.', 'error'));
}


async function processImageAndGeneratePrompts(imageDataUrl, detectedExifComment = null, detectedNovelaiPrompt = null, detectedStableDiffusionPrompt = null) {
    console.log("[API CALL] Sending image data to background for Gemini processing.");
    button.disabled = true;
    button.classList.add('disabled');

    promptContainer.style.display = 'none';
    promptContainer.classList.remove('show');

    updateProgressWindow('Gemini API로 프롬프트 생성 요청 중...', 'loading', true);

    const timeoutDuration = 30000;
    const timeoutPromise = new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
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
        promptContainer.innerHTML = `
            <div class="prompt-header">
                <strong>오류 발생</strong>
                <button class="close-button">X</button>
            </div>
            <div style="color: var(--error-color);">${timeoutError.message}</div>
        `;
        showToast(`오류: ${timeoutError.message}`, 'error');
        promptContainer.style.display = 'block';
        requestAnimationFrame(() => {
            promptContainer.classList.add('show');
        });
        updatePromptWindowPosition();
        promptContainer.querySelector('.close-button').addEventListener('click', () => {
            promptContainer.classList.remove('show');
            promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
        });
        button.disabled = false;
        button.classList.remove('disabled');
        return;
    }

    hideProgressWindow();

    if (response.error) {
        console.error("[API CALL] API returned an error:", response.error);
        promptContainer.innerHTML = `
            <div class="prompt-header">
                <strong>오류 발생</strong>
                <button class="close-button">X</button>
            </div>
            <div style="color: var(--error-color);">${response.error}</div>
        `;
        showToast(`오류: ${response.error}`, 'error');
    } else {
        console.log("[API CALL] Prompts generated successfully.");
        
        let detectedPromptHtml = '';
        if (detectedNovelaiPrompt || detectedStableDiffusionPrompt || detectedExifComment) {
            let combinedDetectedPrompt = '';
            if (detectedNovelaiPrompt) {
                combinedDetectedPrompt += `NovelAI 원문: ${detectedNovelaiPrompt}\n`;
            }
            if (detectedStableDiffusionPrompt && detectedStableDiffusionPrompt !== detectedNovelaiPrompt) {
                combinedDetectedPrompt += `Stable Diffusion 원문: ${detectedStableDiffusionPrompt}\n`;
            }
            if (!combinedDetectedPrompt && detectedExifComment) { // 둘 다 없는데 exifComment가 있다면 exifComment를 원문으로 사용 (최종 fallback)
                 combinedDetectedPrompt = `원문 메타데이터: \n${detectedExifComment}\n`;
            }

            if(combinedDetectedPrompt) {
                detectedPromptHtml = `
                    <div class="prompt-group detected-prompt-group">
                        <strong>이미지에서 추출된 프롬프트:</strong>
                        <textarea class="prompt-textarea neumorphic-input" readonly>${combinedDetectedPrompt.trim()}</textarea>
                        <button class="copy-button neumorphic-button" data-copy-target="detected_combined">모두 복사</button>
                    </div>
                `;
            }
        }


        promptContainer.innerHTML = `
            <div class="prompt-header">
                <strong>프롬프트 결과</strong>
                <button class="close-button">X</button>
            </div>
            ${detectedPromptHtml}
            <div class="prompt-group">
                <strong>NovelAI (Gemini 생성):</strong>
                <textarea class="prompt-textarea neumorphic-input" readonly>${response.novelai}</textarea>
                <button class="copy-button neumorphic-button" data-copy-target="novelai">복사</button>
            </div>
            <div class="prompt-group">
                <strong>Stable Diffusion (Gemini 생성):</strong>
                <textarea class="prompt-textarea neumorphic-input" readonly>${response.stable_diffusion}</textarea>
                <button class="copy-button neumorphic-button" data-copy-target="stable_diffusion">복사</button>
            </div>
        `;
        promptContainer.querySelectorAll('.copy-button').forEach(copyBtn => {
            copyBtn.addEventListener('click', (e) => {
                const textarea = e.target.previousElementSibling;
                if (textarea && textarea.classList.contains('prompt-textarea')) {
                    copyToClipboard(textarea.value);
                }
            });
        });

        showToast('프롬프트가 성공적으로 생성되었습니다!', 'success');
    }
    promptContainer.style.display = 'block';
    updatePromptWindowPosition();

    requestAnimationFrame(() => {
        promptContainer.classList.add('show');
    });

    promptContainer.querySelector('.close-button').addEventListener('click', () => {
        promptContainer.classList.remove('show');
        promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
    });
    button.disabled = false;
    button.classList.remove('disabled');
}


// **메인 이미지 처리 함수 (클립보드 및 URL 모두 처리)**
async function handleImageProcessing(imageBlob, srcUrl = null) {
    console.log("[PROCESS] Initiating image processing. Source:", srcUrl ? "URL" : "Clipboard");
    button.disabled = true;
    button.classList.add('disabled');

    promptContainer.style.display = 'none';
    promptContainer.classList.remove('show');

    updateProgressWindow('이미지 분석 중...', 'loading', true);

    try {
        let extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };

        if (imageBlob.type === 'image/png') {
            try {
                extractedExifData = await getPngTextChunks(imageBlob);
                if (extractedExifData.exifString) {
                    console.log("[PNG METADATA] Detected PNG metadata:", extractedExifData.exifString);
                } else {
                    console.log("[PNG METADATA] No relevant PNG metadata found.");
                }
            } catch (pngParseError) {
                console.warn("PNG 메타데이터 읽기 실패:", pngParseError);
                extractedExifData = { exifString: null, novelai: null, stableDiffusion: null }; // 오류 발생 시 초기화
            }
        }
        // JPEG 등 다른 이미지 타입의 EXIF 데이터는 필요하다면 여기에 추가 로직 구현


        updateProgressWindow('이미지 압축 및 변환 중...', 'loading', true);
        const webpDataUrl = await convertBlobToWebPBase64(imageBlob);

        // 추출된 EXIF 데이터와 프롬프트를 함께 전달
        await processImageAndGeneratePrompts(webpDataUrl, extractedExifData.exifString, extractedExifData.novelai, extractedExifData.stableDiffusion);

    } catch (err) {
        console.error('이미지 처리 중 오류 발생:', err);
        hideProgressWindow();
        promptContainer.innerHTML = `
            <div class="prompt-header">
                <strong>오류 발생</strong>
                <button class="close-button">X</button>
            </div>
            <div style="color: var(--error-color);">이미지 처리 중 오류가 발생했습니다.<br>(${err.message})</div>
        `;
        showToast('이미지 처리 중 오류가 발생했습니다. 개발자 도구를 확인해주세요.', 'error');
        promptContainer.style.display = 'block';
        requestAnimationFrame(() => { promptContainer.classList.add('show'); });
        updatePromptWindowPosition();
        promptContainer.querySelector('.close-button').addEventListener('click', () => {
            promptContainer.classList.remove('show');
            promptContainer.addEventListener('transitionend', () => promptContainer.style.display = 'none', { once: true });
        });
        button.disabled = false;
        button.classList.remove('disabled');
    }
}


/**
 * PNG Blob에서 tEXt, zTXt, iTXt 청크 데이터를 추출합니다.
 * 모든 4글자 청크 타입을 잠재적인 텍스트 청크로 가정하고 디코딩 시도.
 * @param {Blob} blob - PNG 이미지 Blob.
 * @returns {Promise<{ exifString: string | null, novelai: string | null, stableDiffusion: string | null }>}
 * 추출된 텍스트 청크를 병합한 문자열, NovelAI 프롬프트, Stable Diffusion 프롬프트.
 * 없으면 각 필드에 null.
 */
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

                // 중요: IHDR, IDAT, IEND 청크는 텍스트로 디코딩하지 않습니다.
                if (type === 'IHDR' || type === 'IDAT' || type === 'IEND' || length === 0) {
                    offset += length; // 데이터 스킵
                    offset += 4; // CRC 스킵
                    continue; // 다음 청크로 이동
                }

                if (length > 0 && length < 500000) { // 500KB (조절 가능) 이상은 텍스트가 아닐 가능성 높음
                    try {
                        const chunkData = new Uint8Array(buffer, offset, length);
                        
                        // 표준 텍스트 청크 타입 (tEXt, iTXt, zTXt)은 구조화된 파싱 시도
                        if (type === 'tEXt') {
                            let keywordEnd = 0;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, keywordEnd));
                            const text = new TextDecoder('latin1').decode(chunkData.subarray(keywordEnd + 1));
                            extractedMetadata[keyword] = text; // 키워드를 키로 사용
                            console.log(`[PNG PARSER] tEXt chunk (parsed): ${keyword}=${text.substring(0, Math.min(text.length, 50))}...`);
                        } else if (type === 'iTXt') {
                            let currentDataOffset = 0;
                            let keywordEnd = currentDataOffset;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) { 
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('utf-8').decode(chunkData.subarray(currentDataOffset, keywordEnd));
                            currentDataOffset = keywordEnd + 1;

                            currentDataOffset++; // compressionFlag
                            currentDataOffset++; // compressionMethod

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
                            extractedMetadata[keyword] = text; // 키워드를 키로 사용
                            console.log(`[PNG PARSER] iTXt chunk (parsed): ${keyword}=${text.substring(0, Math.min(text.length, 50))}...`);
                        } else if (type === 'zTXt') {
                            let keywordEnd = 0;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, keywordEnd));
                            extractedMetadata[keyword] = `[Compressed zTXt data for ${keyword}]`; // 압축 해제 라이브러리 필요
                            console.log(`[PNG PARSER] zTXt chunk (parsed): ${keyword}=[Compressed data]`);
                        } else {
                            // 그 외 모든 4글자 청크 타입에 대해 UTF-8 디코딩 시도
                            // Python PIL의 img.text가 비표준 청크도 읽어올 수 있음을 모방
                            try { // Decoding attempt with a try-catch for robustness
                                const decodedText = new TextDecoder('utf-8', { fatal: true }).decode(chunkData);
                                // 텍스트 내용의 유효성을 간단히 검사: 충분히 길고, JSON 또는 키-값 쌍처럼 보이는지
                                if (decodedText.length > 10 && (decodedText.includes(':') || decodedText.includes('{') || decodedText.includes('}'))) {
                                    extractedMetadata[type] = decodedText; // 청크 타입 자체를 키로 사용
                                    console.log(`[PNG PARSER] Attempting decode of custom chunk (${type}): ${decodedText.substring(0, Math.min(decodedText.length, 100))}...`);
                                } else {
                                    // 유효한 텍스트가 아니거나 너무 짧으면 스킵 (오류로 간주하지 않음)
                                    // console.log(`[PNG PARSER] Chunk ${type} does not appear to be valid text data.`);
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
                offset += 4; // CRC (4 bytes)
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
                'clip_skip', 'version', 'uc' // uc (unconditional_comment) 추가
            ];
            const AI_KEYWORDS = [
                'stable diffusion', 'midjourney', 'dall-e', 'dalle', 'ai generated',
                'artificial intelligence', 'neural network', 'gan', 'diffusion',
                'automatic1111', 'invokeai', 'comfyui', 'prompt', 'novelai',
                'swarmui', 'stableswarmui', 'stable swarm ui', 'imagine' // Imagine AI 추가
            ];

            // 1. "Comment" 키에 JSON 형태의 데이터가 있는지 확인하고 파싱
            if (extractedMetadata.Comment) {
                console.log("[PNG PARSER] Found 'Comment' chunk. Attempting JSON parse.");
                try {
                    const commentObj = JSON.parse(extractedMetadata.Comment);
                    console.log("[PNG PARSER] Successfully parsed 'Comment' as JSON:", commentObj);

                    const parts = [];
                    
                    // NovelAI 프롬프트 (prompt 또는 v4_prompt)
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
                        if (!novelaiPrompt) novelaiPrompt = text; // v4_prompt를 우선적으로
                        if (!stableDiffusionPrompt) stableDiffusionPrompt = text;
                    }

                    // NovelAI 부정 프롬프트 (uc 또는 v4_negative_prompt)
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

                    // Stable Diffusion 부정 프롬프트 (negative_prompt)
                    if (commentObj.negative_prompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt')) {
                        parts.push(`Negative Prompt (SD): ${commentObj.negative_prompt}`);
                        if (stableDiffusionPrompt) stableDiffusionPrompt += ` [Negative Prompt: ${commentObj.negative_prompt}]`;
                        else stableDiffusionPrompt = `[Negative Prompt: ${commentObj.negative_prompt}]`;
                    }
                    
                    // 기타 메타데이터
                    if (commentObj.steps) parts.push(`Steps: ${commentObj.steps}`);
                    if (commentObj.sampler) parts.push(`Sampler: ${commentObj.sampler}`);
                    if (commentObj.seed) parts.push(`Seed: ${commentObj.seed}`);
                    if (commentObj.height) parts.push(`Height: ${commentObj.height}`);
                    if (commentObj.width) parts.push(`Width: ${commentObj.width}`);
                    if (commentObj.scale) parts.push(`Scale (CFG): ${commentObj.scale}`);
                    if (commentObj.model) parts.push(`Model: ${commentObj.model}`);
                    if (commentObj.clip_skip) parts.push(`Clip Skip: ${commentObj.clip_skip}`);
                    if (commentObj.strength) parts.push(`Strength: ${commentObj.strength}`);
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

            // 2. "parameters" 필드 확인 (Stable Diffusion 등) - Comment JSON에서 찾지 못했을 경우
            if (extractedMetadata.parameters) {
                if (!stableDiffusionPrompt) stableDiffusionPrompt = extractedMetadata.parameters;
                if (!novelaiPrompt) novelaiPrompt = extractedMetadata.parameters; // NovelAI 프롬프트가 없으면 SD parameters를 사용
                if (!foundRelevantAiMetadata) { // Comment에서 이미 찾았다면 덮어쓰지 않음
                    finalExifString = `Parameters: ${extractedMetadata.parameters}`;
                    foundRelevantAiMetadata = true;
                } else if (finalExifString && !finalExifString.includes("Parameters:")) { // 이미 Comment를 파싱했다면 추가
                    finalExifString += `\n\n--- Parameters ---\n${extractedMetadata.parameters}`;
                } else if (!finalExifString) {
                     finalExifString = `Parameters: ${extractedMetadata.parameters}`;
                     foundRelevantAiMetadata = true;
                }
            }
            
            // 3. ImageDescription, Title, Description 등의 메타데이터 확인 및 AI 키워드 포함 여부 검사
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

                    // 여기서도 잠재적인 프롬프트 추출 시도 (fallback)
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

            // 최종적으로 추출된 프롬프트가 없으면 EXIF 코멘트 자체를 프롬프트로 시도 (fallback)
            if (!novelaiPrompt && finalExifString) {
                 // "prompt:"를 포함하는 라인 우선 추출 시도
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

                // "prompt:" 라인이 없으면 EXIF String 전체를 사용
                if (!foundPromptLine) {
                    novelaiPrompt = finalExifString;
                    stableDiffusionPrompt = finalExifString;
                }

                // Negative Prompt 추출 (있는 경우)
                let negativePromptText = null;
                const negativePromptMatch = finalExifString.match(/(?:Negative Prompt|negative_prompt|uc): (.*?)(?:\n|$)/i);
                if (negativePromptMatch && negativePromptMatch[1]) {
                    negativePromptText = negativePromptMatch[1].trim();
                }

                // Stable Diffusion 프롬프트에 Negative Prompt 추가 (이미 포함되어 있지 않은 경우)
                if (negativePromptText && stableDiffusionPrompt && !stableDiffusionPrompt.toLowerCase().includes('negative prompt:')) {
                    stableDiffusionPrompt += `, negative_prompt: ${negativePromptText}`;
                }
            }

            // 모든 경우에 최종 결과 객체를 반환
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


const PythonAIKeywords = [
    'stable diffusion', 'midjourney', 'dall-e', 'dalle', 'ai generated',
    'artificial intelligence', 'neural network', 'gan', 'diffusion',
    'automatic1111', 'invokeai', 'comfyui', 'prompt', 'novelai',
    'swarmui', 'stableswarmui', 'stable swarm ui'
];


button.addEventListener('click', async () => {
    updateProgressWindow('클립보드에서 이미지 확인 중...', 'loading', true);
    try {
        const clipboardItems = await navigator.clipboard.read();
        let imageBlob = null;

        for (const clipboardItem of clipboardItems) {
            for (const type of clipboardItem.types) {
                if (type.startsWith('image/')) {
                    imageBlob = await clipboardItem.getType(type);
                    console.log("[CLIPBOARD] Image Blob found. Type:", imageBlob.type);
                    break;
                }
            }
            if (imageBlob) break;
        }

        if (!imageBlob) {
            console.warn("[CLIPBOARD] No image found in clipboard.");
            hideProgressWindow();
            showToast('클립보드에 이미지가 없습니다. 이미지를 복사한 후 다시 시도해주세요.', 'error');
            button.disabled = false;
            button.classList.remove('disabled');
            return;
        }

        await handleImageProcessing(imageBlob);

    } catch (err) {
        console.error('클립보드 접근 또는 확장 프로그램 오류 발생:', err);
        hideProgressWindow();
        showToast('클립보드 접근 오류. 권한을 확인하거나 다시 시도해주세요.', 'error');
        button.disabled = false;
        button.classList.remove('disabled');
    }
});


async function convertBlobToWebPBase64(blob, quality = 0.8) {
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
        if (request.buttonPosition) {
            applyButtonPosition(request.buttonPosition);
        }
        if (request.iconSize) {
            applyButtonAndIconSize(request.iconSize);
        }
        if (typeof request.hideFloatingButton !== 'undefined') {
            setFloatingButtonVisibility(request.hideFloatingButton);
        }
    } else if (request.action === "initiateGeminiProcessingFromUrl") {
        console.log("[MESSAGE] Received initiateGeminiProcessingFromUrl request from background:", request.srcUrl);
        updateProgressWindow('이미지 로드 중...', 'loading', true);
        fetch(request.srcUrl)
            .then(response => response.blob())
            .then(blob => handleImageProcessing(blob, request.srcUrl))
            .catch(err => {
                console.error('URL 이미지 로드 실패:', err);
                hideProgressWindow();
                showToast(`이미지 로드 실패 (URL): ${err.message}`, 'error');
                button.disabled = false;
                button.classList.remove('disabled');
            });
    } else if (request.action === "updateProgressWindow") {
        updateProgressWindow(request.message, request.type, request.show, request.progress);
    } else if (request.action === "showToast") {
        showToast(request.message, request.type, request.duration);
    }
});


document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updatePromptWindowPosition();
        console.log("[UI] DOMContentLoaded: Initial prompt window position updated.");
    }, 100);

    chrome.storage.sync.get(['buttonPosition', 'iconSize', 'hideFloatingButton'], (data) => {
        const savedPosition = data.buttonPosition || 'bottom-right';
        const savedIconSize = data.iconSize || '100';
        const savedHideButton = data.hideFloatingButton || false;

        applyButtonPosition(savedPosition);
        applyButtonAndIconSize(savedIconSize);
        setFloatingButtonVisibility(savedHideButton);
        console.log(`[UI] Initial settings applied based on storage: Position(${savedPosition}), Size(${savedIconSize}%), Hidden(${savedHideButton})`);
    });
});