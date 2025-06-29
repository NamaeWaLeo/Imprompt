// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "extractImagePrompt",
        title: "이미지 프롬프트 추출",
        contexts: ["image"]
    });
});

// 컨텍스트 메뉴 클릭 리스너
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "extractImagePrompt" && info.srcUrl) {
        // 컨텍스트 메뉴를 통해 이미지를 클릭한 경우, content.js에 URL을 보내 처리를 위임합니다.
        // content.js가 직접 이미지 로드, 메타데이터 추출, WebP 변환을 수행하도록 합니다.
        chrome.tabs.sendMessage(tab.id, {
            action: 'initiateGeminiProcessingFromUrl', // 새로운 액션 타입
            srcUrl: info.srcUrl
        });
    }
});

/**
 * 이미지 Blob을 WebP 형식의 Base64 데이터 URL로 변환합니다.
 * @param {Blob} blob - 변환할 이미지 Blob.
 * @param {number} quality - WebP 인코딩 품질 (0.0 ~ 1.0). 기본값은 0.8.
 * @returns {Promise<string>} WebP 형식의 Base64 데이터 URL.
 */
async function convertBlobToWebPBase64InWorker(blob, quality = 0.8) {
    return new Promise(async (resolve, reject) => {
        try {
            const bitmap = await createImageBitmap(blob); // Blob에서 ImageBitmap 생성

            // OffscreenCanvas 생성 및 그리기
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);

            // WebP Blob으로 변환
            const webpBlob = await canvas.convertToBlob({
                type: 'image/webp',
                quality: quality
            });

            // Blob을 Base64로 변환
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
 * 워커에서 PNG Blob의 메타데이터를 추출합니다.
 * 이 함수는 content.js의 getPngTextChunks와 동일한 로직을 사용하며,
 * background 스크립트에서도 직접 호출 가능하도록 별도로 정의합니다.
 * @param {Blob} blob - PNG 이미지 Blob.
 * @returns {Promise<{ exifString: string | null, novelai: string | null, stableDiffusion: string | null }>}
 * 추출된 텍스트 청크를 병합한 문자열, NovelAI 프롬프트, Stable Diffusion 프롬프트.
 * 없으면 각 필드에 null.
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
                    offset += length; // 데이터 스킵
                    offset += 4; // CRC 스킵
                    continue; // 다음 청크로 이동
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
                    return response.json().then(errorData => ({ success: false, error: errorData.error?.message || response.statusText }));
                }
            })
            .then(result => {
                sendResponse(result); // 유효성 검사 결과를 popup.js로 다시 보냅니다.
            })
            .catch(error => {
                sendResponse({ success: false, error: `네트워크 오류: ${error.message}` });
            });
        return true; // 비동기 응답을 위해 true를 반환해야 합니다.
    }

    // 이미지 처리 및 프롬프트 생성 요청 처리 (content.js에서 호출)
    if (request.action === "processImageWithGemini") {
        const imageDataUrl = request.imageDataUrl; // content script에서 전달받은 Base64 이미지 데이터

        // 크롬 스토리지에서 Gemini API 키와 선택된 모델, 프롬프트 길이, 사용자 정의 프롬프트 정보를 가져옵니다.
        chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'promptLength', 'customPositivePrompt', 'customNegativePrompt'], async (data) => {
            const geminiApiKey = data.geminiApiKey;
            const geminiModel = data.geminiModel || 'gemini-1.5-flash';
            const promptLength = data.promptLength || 'medium';
            const customPositivePrompt = data.customPositivePrompt || '';
            const customNegativePrompt = data.customNegativePrompt || '';

            if (!geminiApiKey) {
                console.error("Gemini API 키가 설정되지 않았습니다.");
                sendResponse({ error: "Gemini API 키가 설정되지 않았습니다. 확장 프로그램 팝업에서 설정해주세요." });
                return;
            }

            let lengthInstruction = "";
            let detailInstruction = ""; // 길이별 디테일 지시사항 추가
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
                case "very-long": // 매우 길게 추가
                    lengthInstruction = "극도로 길고, 상세하며, 창의적인 프롬프트를 생성해 주세요 (최대 400단어).";
                    detailInstruction = "이미지 내 모든 시각적 요소를 가능한 한 상세하게 묘사하고, 잠재적인 서사나 분위기, 광원 효과, 텍스처, 미세한 표정 변화, 배경의 깊이감, 구체적인 물체 배치까지 상상하여 포함해주세요. 예술적 스타일, 카메라 앵글, 렌즈 효과, 필름 종류 등 기술적인 디테일도 추가하여 풍부한 프롬프트를 만들어 주세요.";
                    break;
            }

            // 사용자 정의 긍정/부정 프롬프트 추가
            const finalPositiveInstructions = customPositivePrompt ? ` 사용자 정의 긍정 프롬프트: ${customPositivePrompt}.` : '';
            const finalNegativeInstructions = customNegativePrompt ? ` 사용자 정의 부정 프롬프트: ${customNegativePrompt}.` : '';

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: `이 이미지에 대한 NovelAI와 Stable Diffusion 프롬프트를 JSON 형식으로 생성해 주세요. ${lengthInstruction} ${detailInstruction}${finalPositiveInstructions}${finalNegativeInstructions} 응답은 오직 JSON 블록만 포함해야 하며, 다른 설명 텍스트나 서론/결론은 제외해 주세요.

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
- **부정적인 프롬프트** : 절대 적지 마세요. (예: bad hand, bad eyes).

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
                                            mime_type: "image/webp", // WebP로 변경되었음을 명시
                                            data: imageDataUrl.split(',')[1]
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });

                const result = await response.json();
                console.log("BACKGROUND - Gemini API Raw 응답:", result); // Raw 응답 로깅

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
                        console.log("BACKGROUND - Parsed JSON 응답:", parsedResponse); // 파싱된 응답 로깅
                    } catch (e) {
                        console.error("BACKGROUND - Gemini 응답 JSON 파싱 실패:", e, "원본 텍스트:", fullGeminiText);
                        sendResponse({
                            error: `Gemini 응답 파싱 실패. 응답 형식을 확인해주세요. (원본 일부: ${jsonString.substring(0, 150)}...)`
                        });
                        return;
                    }

                    const novelaiPrompt = parsedResponse.novelai || "프롬프트 생성 실패 (NovelAI)";
                    const stableDiffusionPrompt = parsedResponse.stable_diffusion || "프롬프트 생성 실패 (Stable Diffusion)";

                    // 프롬프트 히스토리에 저장
                    chrome.storage.sync.get('promptHistory', (data) => {
                        const history = data.promptHistory || [];
                        history.push({
                            novelai: novelaiPrompt,
                            stable_diffusion: stableDiffusionPrompt,
                            timestamp: new Date().toISOString(), // ISO 8601 형식으로 저장
                            // thumbnail: imageDataUrl // 이미지 썸네일도 저장할 수 있으나, storage 용량 고려 필요
                        });
                        // 최대 20개까지만 저장 (예시)
                        if (history.length > 20) {
                            history = history.slice(history.length - 20);
                        }
                        chrome.storage.sync.set({ promptHistory: history }, () => {
                            console.log("Prompt saved to history.");
                        });
                    });


                    console.log("BACKGROUND - Final Prompts to send:", { novelai: novelaiPrompt, stable_diffusion: stableDiffusionPrompt }); // 최종 프롬프트 로깅
                    sendResponse({ novelai: novelaiPrompt, stable_diffusion: stableDiffusionPrompt }); // content.js로 결과 전송
                } else if (result.error) {
                    console.error("BACKGROUND - Gemini API 오류 응답:", result.error);
                    sendResponse({ error: `Gemini API 오류: ${result.error.message}` });
                } else {
                    console.error("BACKGROUND - 예상치 못한 Gemini API 응답 형식:", result);
                    sendResponse({ error: "Gemini API 응답 형식 오류입니다. 자세한 응답: " + JSON.stringify(result).substring(0, 200) + "..." });
                }
            } catch (error) {
                console.error("BACKGROUND - Gemini API 호출 중 네트워크 오류:", error);
                sendResponse({ error: `Gemini API 호출 중 네트워크 오류: ${error.message}` });
            }
        });
        return true;
    }

    // 팝업에서 이미지 업로드하여 Gemini 처리 요청
    if (request.action === "processImageWithGeminiFromPopup") {
        const imageDataUrl = request.imageDataUrl;
        const imageType = request.imageType; // 팝업에서 전달된 이미지 타입

        chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'promptLength', 'customPositivePrompt', 'customNegativePrompt'], async (data) => {
            const geminiApiKey = data.geminiApiKey;
            const geminiModel = data.geminiModel || 'gemini-1.5-flash';
            const promptLength = data.promptLength || 'medium';
            const customPositivePrompt = data.customPositivePrompt || '';
            const customNegativePrompt = data.customNegativePrompt || '';

            if (!geminiApiKey) {
                console.error("Gemini API 키가 설정되지 않았습니다.");
                sendResponse({ error: "Gemini API 키가 설정되지 않았습니다. 확장 프로그램 팝업에서 설정해주세요." });
                return;
            }

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

            const finalPositiveInstructions = customPositivePrompt ? ` 사용자 정의 긍정 프롬프트: ${customPositivePrompt}.` : '';
            const finalNegativeInstructions = customNegativePrompt ? ` 사용자 정의 부정 프롬프트: ${customNegativePrompt}.` : '';

            try {
                // Data URL을 Blob으로 변환하여 메타데이터 추출 및 WebP 변환
                const blob = await (await fetch(imageDataUrl)).blob();

                let extractedExifData = { exifString: null, novelai: null, stableDiffusion: null };
                // 이미지 타입이 PNG인 경우에만 메타데이터 추출 시도
                if (imageType === 'image/png') {
                    try {
                        extractedExifData = await getPngTextChunksInWorker(blob);
                        console.log("[BACKGROUND] Extracted PNG metadata from popup upload:", extractedExifData);
                    } catch (e) {
                        console.warn("[BACKGROUND] PNG metadata extraction failed for popup upload:", e);
                    }
                }

                const webpDataUrl = await convertBlobToWebPBase64InWorker(blob);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: `이 이미지에 대한 NovelAI와 Stable Diffusion 프롬프트를 JSON 형식으로 생성해 주세요. ${lengthInstruction} ${detailInstruction}${finalPositiveInstructions}${finalNegativeInstructions} 응답은 오직 JSON 블록만 포함해야 하며, 다른 설명 텍스트나 서론/결론은 제외해 주세요.

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
- **부정적인 프롬프트** : 절대 적지 마세요. (예: bad hand, bad eyes).

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
                                            mime_type: "image/webp", // WebP로 변경되었음을 명시
                                            data: webpDataUrl.split(',')[1]
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });

                const result = await response.json();
                console.log("BACKGROUND - Gemini API Raw 응답:", result); // Raw 응답 로깅

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
                        console.log("BACKGROUND - Parsed JSON 응답:", parsedResponse); // 파싱된 응답 로깅
                    } catch (e) {
                        console.error("BACKGROUND - Gemini 응답 JSON 파싱 실패:", e, "원본 텍스트:", fullGeminiText);
                        sendResponse({
                            error: `Gemini 응답 파싱 실패. 응답 형식을 확인해주세요. (원본 일부: ${jsonString.substring(0, 150)}...)`
                        });
                        return;
                    }

                    const novelaiPrompt = parsedResponse.novelai || "프롬프트 생성 실패 (NovelAI)";
                    const stableDiffusionPrompt = parsedResponse.stable_diffusion || "프롬프트 생성 실패 (Stable Diffusion)";

                    // 팝업에서 호출된 경우, 팝업에게 메타데이터 프롬프트도 함께 전달
                    if (sender.url && sender.url.includes("popup.html")) {
                        sendResponse({
                            novelai: novelaiPrompt,
                            stable_diffusion: stableDiffusionPrompt,
                            detectedNovelaiPrompt: extractedExifData.novelai,
                            detectedStableDiffusionPrompt: extractedExifData.stableDiffusion,
                            detectedExifComment: extractedExifData.exifString
                        });
                    } else { // content.js에서 호출된 경우
                        // 프롬프트 히스토리에 저장
                        chrome.storage.sync.get('promptHistory', (data) => {
                            const history = data.promptHistory || [];
                            history.push({
                                novelai: novelaiPrompt,
                                stable_diffusion: stableDiffusionPrompt,
                                timestamp: new Date().toISOString(),
                            });
                            // 최대 20개까지만 저장 (예시)
                            if (history.length > 20) {
                                history = history.slice(history.length - 20);
                            }
                            chrome.storage.sync.set({ promptHistory: history }, () => {
                                console.log("Prompt saved to history.");
                            });
                        });
                        sendResponse({ novelai: novelaiPrompt, stable_diffusion: stableDiffusionPrompt });
                    }
                } else if (result.error) {
                    console.error("BACKGROUND - Gemini API 오류 응답:", result.error);
                    sendResponse({ error: `Gemini API 오류: ${result.error.message}` });
                } else {
                    console.error("BACKGROUND - 예상치 못한 Gemini API 응답 형식:", result);
                    sendResponse({ error: "Gemini API 응답 형식 오류입니다. 자세한 응답: " + JSON.stringify(result).substring(0, 200) + "..." });
                }
            } catch (error) {
                console.error("BACKGROUND - Gemini API 호출 중 네트워크 오류:", error);
                sendResponse({ error: `Gemini API 호출 중 네트워크 오류: ${error.message}` });
            }
        });
        return true;
    }

    // content.js에서 플로팅 버튼 가시성 설정을 요청할 때
    if (request.action === 'getFloatingButtonVisibility') {
        chrome.storage.sync.get('hideFloatingButton', (data) => {
            sendResponse({ hideFloatingButton: data.hideFloatingButton || false });
        });
        return true; // 비동기 응답을 위해 true를 반환해야 합니다.
    }
});