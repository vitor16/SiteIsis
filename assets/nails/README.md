# Nail photo inference assets

The nail simulator uses the unmodified `nail-seg.onnx` model from [hzaustingg/Fingernail-segmentation-Demo](https://huggingface.co/spaces/hzaustingg/Fingernail-segmentation-Demo), also published as [austingg/finger-nail-seg](https://github.com/austingg/finger-nail-seg). The publisher supplies GPL-3.0, reproduced in `MODEL-LICENSE`. The original model and its associated source are available at those links. Model: YOLOv8s segmentation, fixed RGB 768×768 input; outputs boxes, confidence and mask prototypes. The public source model is downloaded directly when using file://. Hosted pages use the bundled binary.

ONNX Runtime Web 1.22.0, WASM-only build, from Microsoft (MIT; `RUNTIME-LICENSE`). `ort.min.js` is the upstream `dist/ort.wasm.min.js` renamed locally. The corresponding WASM and module loader are shipped alongside it. Inference runs in a dedicated worker with one thread, without cross-origin isolation requirements.

The four hand model images were supplied by the user and are stored unchanged as hand-*.png. They are reference models, not labeled as salon work. `model-previews.js` embeds copies solely for file:// canvas compatibility. Uploaded photos remain on the user's device.

The model can miss tips, transparent edges, hidden nails or decorations. The interface describes this as an illustrative color preview. Shape and length controls specify the requested salon service and do not claim to reconstruct hand geometry.
