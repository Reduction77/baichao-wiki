Recognition assets are served from this Site and loaded only when import starts. Images never leave the browser.

- ONNX Runtime Web 1.23.2: npm package onnxruntime-web, Microsoft, MIT; see onnx/LICENSE. Only the WASM runtime is distributed. https://github.com/microsoft/onnxruntime/tree/v1.23.2
- PP-OCRv4 Chinese mobile recognition model, PaddleOCR authors; Apache-2.0, see ocr/LICENSE. ONNX conversion distributed by RapidAI/RapidOCR; see ocr/RapidOCR-LICENSE. Source: https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/PP-OCRv4/rec/ch_PP-OCRv4_rec_mobile.onnx . No detector or orientation classifier is loaded. The character dictionary is extracted from this exact model's character metadata, with CTC blank and space entries.
- Tesseract.js 7.0.0 and tesseract.js-core 7.0.0, Apache-2.0; licenses included. Used only if a numeric score needs a second reading.
- English tessdata_fast model, Apache-2.0: https://github.com/tesseract-ocr/tessdata_fast . Numeric fallback only.
- Character images come from the Wiki's existing local snapshot and remain subject to KURO GAMES copyright.

Avatar descriptors, text cropping, constrained dictionary decoding and confirmation UI are this project's implementation. No wc-upload application code is embedded or executed. User reports and test fixtures are not distributed.

manifest.json records the exact sizes and SHA-256 hashes of all distributed runtime files, model weights and licenses.
