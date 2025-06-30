// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "extractImagePrompt",
        title: "이미지 프롬프트 추출",
        contexts: ["image"]
    });
    // 선택 영역 이미지 추출 컨텍스트 메뉴 추가
    chrome.contextMenus.create({
        id: "extractSelectedAreaPrompt",
        title: "선택 영역 프롬프트 추출",
        contexts: ["page", "selection"]
    });
});

// 컨텍스트 메뉴 클릭 리스너
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "extractImagePrompt" && info.srcUrl) {
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'initiateGeminiProcessingFromUrl',
                srcUrl: info.srcUrl
            });
        } else {
            console.error("background.js: Could not get valid tab ID for image URL processing.");
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon.png',
                title: 'Imprompt 오류',
                message: '현재 탭 정보를 가져올 수 없어 이미지 처리 기능을 시작할 수 없습니다.'
            });
        }
    } else if (info.menuItemId === "extractSelectedAreaPrompt") {
        // 현재 활성 탭의 ID와 윈도우 ID를 모두 조회하여 사용
        chrome.tabs.query({ active: true, currentWindow: true, windowType: 'normal' }, function(tabs) { // windowType: 'normal' 추가
            if (tabs && tabs.length > 0 && tabs[0].id && tabs[0].windowId) {
                const activeTabId = tabs[0].id;
                const activeWindowId = tabs[0].windowId; // 윈도우 ID도 얻어옴

                // 메시지를 보낼 때 activeTabId와 activeWindowId를 request 객체에 명시적으로 담아 보냅니다.
                chrome.tabs.sendMessage(activeTabId, {
                    action: 'startAreaSelection',
                    tabId: activeTabId,
                    windowId: activeWindowId // 윈도우 ID도 함께 전달
                });
            } else {
                console.error("background.js: Could not get active tab or window ID for area selection (or not a normal window).");
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon.png',
                    title: 'Imprompt 오류',
                    message: '현재 활성 탭 또는 창 정보를 가져올 수 없어 영역 선택 기능을 시작할 수 없습니다. 일반 웹페이지에서 시도해주세요.'
                });
            }
        });
    }
});

/**
 * 이미지 Blob을 WebP 형식의 Base64 데이터 URL로 변환합니다.
 * OffscreenCanvas를 사용하여 워커 환경에서 변환합니다.
 * @param {Blob} blob - 변환할 이미지 Blob.
 * @param {number} quality - WebP 인코딩 품질 (0.0 ~ 1.0). 기본값은 0.6.
 * @returns {Promise<string>} WebP 형식의 Base64 데이터 URL.
 */
async function convertBlobToWebPBase64InWorker(blob, quality = 0.6) {
    return new Promise(async (resolve, reject) => {
        try {
            const bitmap = await createImageBitmap(blob);

            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);

            const webpBlob = await canvas.convertToBlob({
                type: 'image/webp',
                quality: quality
            });

            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(webpBlob);

        } catch (e) {
            reject(new Error(`Failed to convert image to WebP in worker: ${e.message}`));
        }
    });
}

/**
 * 이미지를 지정된 크기로 리사이즈하고 WebP 형식의 Base64 데이터 URL로 변환합니다.
 * @param {Blob} blob - 원본 이미지 Blob.
 * @param {number} maxWidth - 최대 너비.
 * @param {number} maxHeight - 최대 높이.
 * @param {number} quality - WebP 인코딩 품질 (0.0 ~ 1.0).
 * @returns {Promise<string|null>} WebP 형식의 Base64 데이터 URL 또는 null (실패 시).
 */
async function resizeImageAndConvertToWebP(blob, maxWidth, maxHeight, quality = 0.7) {
    return new Promise(async (resolve) => {
        try {
            const bitmap = await createImageBitmap(blob);
            
            let width = bitmap.width;
            let height = bitmap.height;

            // 이미지가 최대 크기보다 크면 다운스케일링
            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;
                if (width > height) { // 가로가 더 길면
                    width = maxWidth;
                    height = Math.round(width / aspectRatio);
                } else { // 세로가 더 길거나 같으면
                    height = maxHeight;
                    width = Math.round(height * aspectRatio);
                }
                // 다시 한 번 체크하여, 예를 들어 너비를 맞췄는데 높이가 너무 커진 경우 조정
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
                 if (width > maxWidth) { // 다시 한번 너비 체크
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            }
            
            // 너무 작은 이미지 (예: 썸네일용)는 최소 크기로 확대 (이미지 품질 고려)
            if (width < 64 && height < 64) {
                const scale = Math.max(64 / width, 64 / height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }


            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            // 이미지 그리기 전 부드러운 스케일링을 위한 설정
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(bitmap, 0, 0, width, height);

            const webpBlob = await canvas.convertToBlob({
                type: 'image/webp',
                quality: quality
            });

            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(webpBlob);

        } catch (e) {
            console.warn("resizeImageAndConvertToWebP 실패:", e);
            resolve(null);
        }
    });
}


/**
 * 워커에서 PNG Blob의 메타데이터를 추출합니다.
 * @param {Blob} blob - PNG 이미지 Blob.
 * @returns {Promise<{ exifString: string | null, novelai: string | null, stableDiffusion: string | null }>}
 */
function getPngTextChunksInWorker(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const buffer = e.target.result;
            const dataView = new DataView(buffer);
            const extractedMetadata = {};

            const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            for (let i = 0; i < pngSignature.length; i++) {
                if (dataView.getUint8(i) !== pngSignature[i]) {
                    console.warn("[PNG PARSER Worker] Invalid PNG signature. Not a PNG file?");
                    return resolve({ exifString: null, novelai: null, stableDiffusion: null });
                }
            }
            console.log("[PNG PARSER Worker] PNG signature valid. Starting chunk parsing.");

            let offset = 8;

            while (offset < buffer.byteLength) {
                if (offset + 8 > buffer.byteLength) {
                    console.log("[PNG PARSER Worker] Reached end of file or insufficient bytes for next chunk header.");
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

                console.log(`[PNG PARSER Worker] Found chunk: Type=${type}, Length=${length}, Offset=${offset - 8}`);

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
                            while (langTagEnd < chunkData.length && chunkData[langDataOffset] !== 0x00) { // Fix: langTagEnd -> langDataOffset
                                langTagEnd++;
                            }
                            currentDataOffset = langTagEnd + 1;

                            let transKeyEnd = currentDataOffset;
                            while (transKeyEnd < chunkData.length && chunkData[currentDataOffset] !== 0x00) { // Fix: transKeyEnd -> currentDataOffset
                                transKeyEnd++;
                            }
                            currentDataOffset = transKeyEnd + 1;

                            const text = new TextDecoder('utf-8').decode(chunkData.subarray(currentDataOffset));
                            extractedMetadata[keyword] = text;
                        } else if (type === 'zTXt') {
                            let keywordEnd = 0;
                            while (keywordEnd < chunkData.length && chunkData[keywordEnd] !== 0x00) {
                                keywordEnd++;
                            }
                            const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, keywordEnd));
                            extractedMetadata[keyword] = `[Compressed zTXt data for ${keyword}]`;
                        } else {
                            try {
                                const decodedText = new TextDecoder('utf-8', { fatal: true }).decode(chunkData);
                                if (decodedText.length > 10 && (decodedText.includes(':') || decodedText.includes('{') || decodedText.includes('}'))) {
                                    extractedMetadata[type] = decodedText;
                                }
                            } catch (decodeError) {
                                console.warn(`[PNG PARSER Worker] Failed to decode chunk ${type} as UTF-8: ${decodeError.message}`);
                            }
                        }

                    } catch (parseError) {
                        console.warn(`[PNG PARSER Worker] Error processing chunk ${type}: ${parseError.message}`);
                    }
                }
                
                offset += length;
                offset += 4;
            }

            console.log("[PNG PARSER Worker] Finished chunk parsing. Extracted metadata:", extractedMetadata);

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
                try {
                    const commentObj = JSON.parse(extractedMetadata.Comment);
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
                    console.warn(`[PNG PARSER Worker] 'Comment' field is not valid JSON. Error: ${e.message}.`);
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
            console.error("[PNG PARSER Worker] FileReader error during PNG parsing:", err);
            reject(new Error("FileReader error during PNG parsing."));
        };
        reader.readAsArrayBuffer(blob);
    });
}


// popup 페이지로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Gemini API 키 유효성 검사 요청 처리
    if (request.action === "validateGeminiApiKey") {
        const apiKey = request.apiKey;
        fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
            .then(response => {
                if (response.ok) {
                    return response.json().then(data => ({ success: true, data: data }));
                } else {
                    let errorMessage = `API 응답 오류 (${response.status}): `;
                    switch (response.status) {
                        case 400: errorMessage += "잘못된 요청입니다. API 키 형식을 확인하거나 입력이 올바른지 확인하세요."; break;
                        case 401: errorMessage += "인증되지 않은 API 키입니다. 유효한 API 키를 제공했는지 확인하세요."; break;
                        case 403: errorMessage += "API 키에 필요한 권한이 없습니다."; break;
                        case 429: errorMessage += "API 호출 제한을 초과했습니다. 잠시 후 다시 시도하세요."; break;
                        default: errorMessage += response.statusText; break;
                    }
                    return response.json().then(errorData => ({ success: false, error: errorData.error?.message || errorMessage }));
                }
            })
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({ success: false, error: `네트워크 오류: ${error.message}. 인터넷 연결을 확인하거나 Gemini API 서버 상태를 확인하세요.` });
            });
        return true;
    }

    // content.js 또는 popup.js에서 이미지 처리 및 프롬프트 생성 요청 (모든 이미지 처리의 중앙 관리)
    if (request.action === "processImageWithGeminiFromContentScript" || request.action === "processImageWithGeminiFromPopup") {
        const imageDataUrl = request.imageDataUrl; // Blob URL 또는 Data URL
        const imageType = request.imageType; // 'image/png', 'image/jpeg' 등
        const tabId = sender.tab ? sender.tab.id : null; // content script로부터 온 경우 tabId 사용
        const isFromPopup = request.action === "processImageWithGeminiFromPopup";

        // 진행 상태를 해당 탭 또는 팝업으로 업데이트
        const updateProcessStatus = (message) => {
            if (isFromPopup) {
                chrome.runtime.sendMessage({ action: "updatePopupStatus", message: message, type: 'loading' });
            } else if (tabId) {
                chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: true, message: message });
            }
        };
        const hideProcessStatus = () => {
             if (isFromPopup) {
                chrome.runtime.sendMessage({ action: "updatePopupStatus", message: "", type: 'success' }); // 팝업은 메시지를 지우는 방식으로 숨김
            } else if (tabId) {
                chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false });
            }
        };
        const sendFinalResponse = (response) => {
            if (isFromPopup) {
                sendResponse(response); // 팝업은 직접 응답 받음
            } else if (tabId) {
                chrome.tabs.sendMessage(tabId, { action: "displayGeneratedPrompts", response: response, extractionMethod: response.usedExtractionMethod });
            }
        };

        (async () => {
            updateProcessStatus('이미지 로딩 중...');

            let imageBlob;
            try {
                // imageDataUrl이 Blob URL일 수도, Data URL일 수도 있음
                imageBlob = await (await fetch(imageDataUrl)).blob();
            } catch (err) {
                console.error("Failed to fetch image data:", err);
                hideProcessStatus();
                sendFinalResponse({ error: `이미지 로드 실패: ${err.message}` });
                return;
            }

            const settings = await new Promise(resolve => {
                chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'promptLength', 'customPositivePrompt', 'customNegativePrompt', 'extractionMethod', 'geminiPositiveTemplate', 'geminiNegativeTemplate'], resolve);
            });
            const geminiApiKey = settings.geminiApiKey;
            const geminiModel = settings.geminiModel || 'gemini-1.5-flash';
            const promptLength = settings.promptLength || 'medium';
            const customPositivePrompt = settings.customPositivePrompt || '';
            const customNegativePrompt = settings.customNegativePrompt || '';
            const extractionMethod = settings.extractionMethod || 'both';
            const geminiPositiveTemplate = settings.geminiPositiveTemplate; // 팝업에서 설정된 템플릿 사용
            const geminiNegativeTemplate = settings.geminiNegativeTemplate; // 팝업에서 설정된 템플릿 사용


            let novelaiPrompt = "N/A";
            let stableDiffusionPrompt = "N/A";
            let extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };

            try {
                if (extractionMethod === 'metadata' || extractionMethod === 'both') {
                    if (imageType === 'image/png') {
                        updateProcessStatus('PNG 메타데이터 추출 중...');
                        try {
                            extractedExifData = await getPngTextChunksInWorker(imageBlob);
                            if (extractedExifData.exifString) {
                                console.log("[BACKGROUND] Detected PNG metadata:", extractedExifData.exifString);
                            } else {
                                console.log("[BACKGROUND] No relevant PNG metadata found.");
                            }
                        } catch (pngParseError) {
                            console.warn("PNG 메타데이터 읽기 실패:", pngParseError);
                            // 오류 발생 시에도 진행은 시켜야 하므로 에러로 처리하지 않음
                            extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };
                        }
                    } else {
                        console.log("[BACKGROUND] Not a PNG image, skipping metadata extraction.");
                    }
                }

                let webpDataUrl = null;
                if (extractionMethod === 'gemini' || extractionMethod === 'both') {
                    if (!geminiApiKey) {
                        hideProcessStatus();
                        sendFinalResponse({ error: "Gemini API 키가 설정되지 않았습니다. 확장 프로그램 팝업에서 설정해주세요." });
                        return;
                    }
                    updateProcessStatus('이미지 압축 및 WebP 변환 중...');
                    // Gemini API 전송을 위해 이미지 리사이징 (최대 1024x1024) 및 WebP 변환
                    webpDataUrl = await resizeImageAndConvertToWebP(imageBlob, 1024, 1024, 0.7); // 품질 0.7, 최대 1024px
                    if (!webpDataUrl) {
                        hideProcessStatus();
                        sendFinalResponse({ error: 'Gemini API를 위한 이미지 변환에 실패했습니다.' });
                        return;
                    }
                }

                if ((extractionMethod === 'metadata' || extractionMethod === 'both') && !extractedExifData.exifString && !extractedExifData.novelai && !extractedExifData.stableDiffusion) {
                    if (extractionMethod === 'metadata') {
                        hideProcessStatus();
                        sendFinalResponse({ 
                            novelai: "이미지에서 추출된 메타데이터가 없습니다.",
                            stable_diffusion: "이미지에서 추출된 메타데이터가 없습니다.",
                            detectedNovelaiPrompt: null,
                            detectedStableDiffusionPrompt: null,
                            detectedExifComment: null,
                            usedExtractionMethod: extractionMethod,
                            error: "이미지에서 추출된 메타데이터가 없습니다." // 팝업에서는 status 메시지로, content.js에서는 이 error를 바탕으로 결과창에 표시
                        });
                        return;
                    }
                }

                if (extractionMethod === 'gemini' || extractionMethod === 'both') {
                    let lengthInstruction = "";
                    let detailInstruction = "";
                    switch (promptLength) {
                        case "short":
                            lengthInstruction = "간결하고 핵심적인 프롬프트를 생성해 주세요 (최대 30단어).";
                            detailInstruction = "이미지의 주요 요소와 가장 중요한 특징만 간략하게 언급해주세요.";
                            break;
                        case "medium":
                            lengthInstruction = "보통 길이의 자세한 프롬프트를 생성해 주세요 (최대 80단어).";
                            detailInstruction = "주요 요소와 함께 적절한 세부 사항, 분위기를 포함해주세요.";
                            break;
                        case "long":
                            lengthInstruction = "매우 길고 상세하며 풍부한 설명을 담은 프롬프트를 생성해 주세요 (최대 200단어).";
                            detailInstruction = "주요 요소 외에 배경, 조명, 색상, 구도, 감정 등 이미지의 모든 디테일을 풍부하게 설명해주세요. 특정 스타일이나 분위기, 미세한 질감까지 언급해주세요.";
                            break;
                        case "very-long":
                            lengthInstruction = "극도로 길고, 상세하며, 창의적인 프롬프트를 생성해 주세요 (최대 400단어).";
                            detailInstruction = "이미지 내 모든 시각적 요소를 가능한 한 상세하게 묘사하고, 잠재적인 서사나 분위기, 광원 효과, 텍스처, 미세한 표정 변화, 배경의 깊이감, 구체적인 물체 배치까지 상상하여 포함해주세요. 예술적 스타일, 카메라 앵글, 렌즈 효과, 필름 종류 등 기술적인 디테일도 추가하여 풍부한 프롬프트를 만들어 주세요.";
                            break;
                    }
                    
                    // 사용자 정의 프롬프트 및 템플릿 적용
                    // 템플릿이 정의되어 있으면 템플릿 사용, 없으면 기존 기본 문구 사용
                    const finalPositiveInstructions = geminiPositiveTemplate || 
                        `이 이미지에 대한 NovelAI와 Stable Diffusion 프롬프트를 JSON 형식으로 생성해 주세요. ${lengthInstruction} ${detailInstruction}`;
                    const finalNegativeInstructions = geminiNegativeTemplate || 
                        `**부정적인 프롬프트**: 절대 적지 마세요. (예: bad hand, bad eyes).`;

                    // 사용자 정의 긍정/부정 프롬프트는 템플릿에 추가되는 방식
                    const userCustomPositive = customPositivePrompt ? `\n\n 사용자 정의 긍정 프롬프트 추가: ${customPositivePrompt}` : '';
                    const userCustomNegative = customNegativePrompt ? `\n\n 사용자 정의 부정 프롬프트 추가 (Stable Diffusion용): ${customNegativePrompt}` : '';


                    updateProcessStatus('Gemini AI 모델에 이미지 전송 중...');
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: `${finalPositiveInstructions}${userCustomPositive} ${finalNegativeInstructions}${userCustomNegative} 응답은 오직 JSON 블록만 포함해야 하며, 다른 설명 텍스트나 서론/결론은 제외해 주세요.

**NovelAI 프롬프트 규칙:**
- **강화 가중치**: 단어를 중괄호 {}로 감싸세요. 예: {high quality}, {{masterpiece}}
- **약화 가중치**: 단어를 대괄호 []로 감싸세요.
- **숫자 가중치**: '숫자::프롬프트::' 또는 '숫자::프롬프트1, 프rompt2::' 형식을 사용하세요. 숫자는 가중치 값을 나타냅니다. 예: 1.2::masterpiece::, 0.8::simple background::

**Stable Diffusion 프롬프트 규칙:**
- **가중치**: 단어를 괄호로 감싸고 콜론(:) 뒤에 숫자 가중치를 붙이세요. 예: (masterpiece:1.2), (blurry:0.8).

**프롬프트 공통 포함 요소 (NovelAI와 Stable Diffusion 모두):**
- **긍정적인 품질 태그**: (e.g., masterpiece, best quality, ultra detailed, intricate details, highly detailed, high resolution, 8k)
- **구도/앵글**: (e.g., full body, close-up, medium shot, wide shot, from above, from below, eye level, Dutch angle, dynamic pose)
- **분위기/감정**: (e.g., solemn, joyful, melancholic, serene, chaotic, ethereal, mysterious, vibrant, somber, peaceful, energetic)
- **그림체/스타일**: (e.g., anime style, oil painting, watercolor, cyberpunk, realistic, concept art, digital painting, ukiyo-e, cel-shaded, pencil sketch)
- **캐릭터 세부 사항**: (e.g., hair color, eye color, skin tone, clothing, accessories, specific attire, pose, facial expression, body type, age, gender)
- **배경 세부 사항**: (e.g., natural landscape, bustling city street, futuristic interior, ancient castle, dense forest, snowy mountain range, open field, misty swamp, starry night sky)
- **조명/색상**: (e.g., volumetric lighting, golden hour, neon glow, vibrant colors, monochrome, soft lighting, harsh shadows, cinematic lighting, dramatic lighting)
- **기타 세부 사항**: (e.g., weather conditions like rain or snow, time of day, specific objects in foreground/background, magical effects, fire, water splashes, lens flare, dust particles)

**요구하는 JSON 형식:**
\`\`\`json
{
  "novelai": "프롬프트 내용",
  "stable_diffusion": "프롬프트 내용"
}
\`\`\`
반드시 위 JSON 형식과 규칙을 지켜서 영어로 프롬프트를 생성해주세요.`
                                        },
                                        {
                                            inline_data: {
                                                mime_type: "image/webp",
                                                data: webpDataUrl.split(',')[1]
                                            }
                                        }
                                    ]
                                }
                            ]
                        })
                    });

                    const result = await response.json();
                    console.log("BACKGROUND - Gemini API Raw 응답:", result);

                    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
                        const fullGeminiText = result.candidates[0].content.parts[0].text;
                        let jsonString = '';

                        const jsonMatch = fullGeminiText.match(/```json\n([\s\S]*?)\n```/);
                        if (jsonMatch && jsonMatch[1]) {
                            jsonString = jsonMatch[1];
                        } else {
                            jsonString = fullGeminiText.trim();
                        }

                        let parsedResponse;
                        try {
                            parsedResponse = JSON.parse(jsonString);
                            console.log("BACKGROUND - Parsed JSON 응답:", parsedResponse);
                        } catch (e) {
                            console.error("BACKGROUND - Gemini 응답 JSON 파싱 실패:", e, "원본 텍스트:", fullGeminiText);
                            hideProcessStatus();
                            sendFinalResponse({
                                error: `Gemini 응답 파싱 실패. 응답 형식을 확인해주세요. (원본 일부: ${jsonString.substring(0, 150)}...)`
                            });
                            return;
                        }

                        novelaiPrompt = parsedResponse.novelai || "프롬프트 생성 실패 (NovelAI)";
                        stableDiffusionPrompt = parsedResponse.stable_diffusion || "프롬프트 생성 실패 (Stable Diffusion)";
                        updateProcessStatus('프롬프트 생성 완료!');

                    } else if (result.error) {
                        console.error("BACKGROUND - Gemini API 오류 응답:", result.error);
                        hideProcessStatus();
                        sendFinalResponse({ error: `Gemini API 오류: ${result.error.message}` });
                        return;
                    } else {
                        console.error("BACKGROUND - 예상치 못한 Gemini API 응답 형식:", result);
                        hideProcessStatus();
                        sendFinalResponse({ error: "Gemini API 응답 형식 오류입니다. 자세한 응답: " + JSON.stringify(result).substring(0, 200) + "..." });
                        return;
                    }
                } else { // extractionMethod가 'metadata'인 경우
                    novelaiPrompt = extractedExifData.novelai || "메타데이터에서 NovelAI 프롬프트 추출 실패";
                    stableDiffusionPrompt = extractedExifData.stableDiffusion || "메타데이터에서 Stable Diffusion 프롬프트 추출 실패";
                    updateProcessStatus('메타데이터 추출 완료!');
                }

                // 프롬프트 히스토리에 저장
                chrome.storage.local.get('promptHistory', async (data) => {
                    let history = data.promptHistory || [];

                    let thumbnailDataUrl = null;
                    try {
                        // 썸네일은 128x128로 리사이징
                        thumbnailDataUrl = await resizeImageAndConvertToWebP(imageBlob, 128, 128, 0.7);
                    } catch (thumbErr) {
                        console.warn("썸네일 생성 실패:", thumbErr);
                    }

                    history.push({
                        novelai: novelaiPrompt,
                        stable_diffusion: stableDiffusionPrompt,
                        timestamp: new Date().toISOString(),
                        detectedNovelai: extractedExifData.novelai,
                        detectedStableDiffusion: extractedExifData.stableDiffusion,
                        detectedExifComment: extractedExifData.exifString,
                        thumbnail: thumbnailDataUrl,
                        usedExtractionMethod: extractionMethod // 히스토리에도 추출 방식 저장
                    });
                    if (history.length > 20) {
                        history = history.slice(history.length - 20);
                    }
                    chrome.storage.local.set({ promptHistory: history }, () => {
                        console.log("Prompt saved to history.");
                    });
                });

                console.log("BACKGROUND - Final Prompts to send:", { novelai: novelaiPrompt, stable_diffusion: stableDiffusionPrompt, detectedNovelaiPrompt: extractedExifData.novelai, detectedStableDiffusionPrompt: extractedExifData.stableDiffusion, detectedExifComment: extractedExifData.exifString, usedExtractionMethod: extractionMethod });
                hideProcessStatus();
                sendFinalResponse({
                    novelai: novelaiPrompt,
                    stable_diffusion: stableDiffusionPrompt,
                    detectedNovelaiPrompt: extractedExifData.novelai,
                    detectedStableDiffusionPrompt: extractedExifData.stableDiffusion,
                    detectedExifComment: extractedExifData.exifString,
                    usedExtractionMethod: extractionMethod
                });

            } catch (error) {
                console.error("BACKGROUND - 전체 이미지 처리 중 오류:", error);
                hideProcessStatus();
                sendFinalResponse({ error: `이미지 처리 중 예상치 못한 오류가 발생했습니다: ${error.message}` });
            }
        })(); // 비동기 즉시 실행 함수

        return true; // 비동기 응답을 위해 true 반환
    }

    // content.js로부터 캡처할 영역 정보를 받는 리스너 추가 (background에서만 captureVisibleTab 가능)
    if (request.action === "captureArea") {
        const { x, y, width, height } = request.area;
        const tabId = request.tabId;
        const windowId = request.windowId;

        if (!tabId || !windowId) {
            console.error("No tab ID or window ID provided for capture.");
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon.png',
                title: 'Imprompt 오류',
                message: '캡처할 탭 또는 창 정보를 찾을 수 없습니다.'
            });
            chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); // 오버레이 닫기
            sendResponse({ success: false, error: "No tab ID or window ID." });
            return true;
        }

        chrome.windows.get(windowId, { populate: true }, async function(targetWindow) {
            if (chrome.runtime.lastError || !targetWindow || targetWindow.type !== 'normal' || !targetWindow.tabs.some(t => t.id === tabId)) {
                console.error("Capture failed: Target window is no longer valid, not 'normal' type, or tab not found within it.", chrome.runtime.lastError);
                chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); // 오버레이 닫기
                chrome.tabs.sendMessage(tabId, { action: "showToast", message: `화면 캡처 실패: 탭을 찾을 수 없거나 접근할 수 없습니다.`, type: "error" });
                sendResponse({ success: false, error: "Target window not found or not accessible." });
                return;
            }
            
            chrome.tabs.captureVisibleTab(windowId, { format: "png" }, async function(dataUrl) {
                if (chrome.runtime.lastError) {
                    console.error("Capture visible tab error:", chrome.runtime.lastError.message);
                    chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); // 오버레이 닫기
                    chrome.tabs.sendMessage(tabId, { action: "showToast", message: `화면 캡처 실패: ${chrome.runtime.lastError.message}`, type: "error" });
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                if (!dataUrl) {
                    chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); // 오버레이 닫기
                    chrome.tabs.sendMessage(tabId, { action: "showToast", message: "캡처된 이미지를 가져올 수 없습니다.", type: "error" });
                    sendResponse({ success: false, error: "No data URL from capture." });
                    return;
                }

                try {
                    const imageBitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());

                    const canvas = new OffscreenCanvas(width, height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageBitmap, x, y, width, height, 0, 0, width, height);

                    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
                    const croppedImageDataUrl = await convertBlobToWebPBase64InWorker(croppedBlob, 0.8); // 모달에 보낼 때 품질 좀 더 높임

                    // 캡처된 이미지를 content.js의 모달로 전송
                    chrome.tabs.sendMessage(tabId, {
                        action: 'showCapturedImageModal', // 새로운 액션
                        imageDataUrl: croppedImageDataUrl,
                    });
                    // 캡처 성공 후에는 '캡처 중' 상태를 숨김
                    chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); 
                    sendResponse({ success: true, message: "Image cropped and sent to modal." });

                } catch (e) {
                    console.error("Error cropping or processing image:", e);
                    chrome.tabs.sendMessage(tabId, { action: "updateProcessStatus", show: false }); // 오버레이 닫기
                    chrome.tabs.sendMessage(tabId, { action: "showToast", message: `이미지 처리 오류: ${e.message}`, type: "error" });
                    sendResponse({ success: false, error: e.message });
                }
            });
        });
        return true;
    }
});