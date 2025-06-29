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
        // 컨텍스트 메뉴를 통해 이미지를 클릭한 경우, content.js에 진행 상황 메시지를 먼저 보냅니다.
        chrome.tabs.sendMessage(tab.id, {
            action: 'updateProgressWindow',
            message: '이미지 로드 중...', // 메시지 변경
            type: 'loading',
            show: true
        });

        try {
            const response = await fetch(info.srcUrl);
            const imageBlob = await response.blob();

            chrome.tabs.sendMessage(tab.id, {
                action: 'updateProgressWindow',
                message: '이미지 압축 및 변환 중...', // 메시지 변경
                type: 'loading',
                show: true
            });

            // background.js (Service Worker)에서 이미지 WebP 변환
            const webpDataUrl = await convertBlobToWebPBase64InWorker(imageBlob);

            // content.js에 메시지를 보내 실제 Gemini API 처리를 시작하도록 지시
            chrome.tabs.sendMessage(tab.id, {
                action: 'initiateGeminiProcessing',
                imageDataUrl: webpDataUrl // WebP로 변환된 Base64 데이터 전송
            });

        } catch (error) {
            console.error("BACKGROUND - Image processing error for context menu:", error);
            chrome.tabs.sendMessage(tab.id, {
                action: 'showToast',
                message: `이미지 처리 오류 (컨텍스트 메뉴): ${error.message}`,
                type: 'error'
            });
            chrome.tabs.sendMessage(tab.id, {
                action: 'updateProgressWindow',
                message: '',
                type: 'hide',
                show: false
            });
        }
    }
});

/**
 * Service Worker 환경에서 이미지 Blob을 WebP 형식의 Base64 데이터 URL로 변환합니다.
 * OffscreenCanvas를 사용하여 메인 스레드를 블록하지 않습니다.
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

// content script 또는 popup 페이지로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Gemini API 키 유효성 검사 요청 처리 (popup.js에서 호출)
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
- **약화 가중치**: 단어를 대괄호 []로 감싸세요. 예: [[blurry]]
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

    // content.js에서 플로팅 버튼 가시성 설정을 요청할 때
    if (request.action === 'getFloatingButtonVisibility') {
        chrome.storage.sync.get('hideFloatingButton', (data) => {
            sendResponse({ hideFloatingButton: data.hideFloatingButton || false });
        });
        return true; // 비동기 응답을 위해 true를 반환해야 합니다.
    }
});