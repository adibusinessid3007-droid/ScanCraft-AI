from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps
from io import BytesIO

from image_processing import process_image

app = FastAPI(title="ScanCraft AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://10.93.191.209:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://10.93.191.209:5175",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_MODES = {"original", "natural", "enhanced", "grayscale", "bw"}
MAX_SIZE = 15 * 1024 * 1024


async def read_image(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {file.content_type}"
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Image must be under 15 MB.")

    try:
        image = Image.open(BytesIO(contents))
        image = ImageOps.exif_transpose(image)
        image.load()

        if image.width > 10000 or image.height > 10000:
            raise HTTPException(status_code=400, detail="Image dimensions are too large.")

        output = BytesIO()
        image.convert("RGB").save(output, format="PNG")
        return output.getvalue()

    except HTTPException:
        raise
    except Exception as error:
        print("Upload error:", repr(error))
        raise HTTPException(status_code=400, detail="Invalid or damaged image.")


@app.get("/")
def home():
    return {"message": "ScanCraft AI is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/process")
async def process_document(
    file: UploadFile = File(...),
    mode: str = Form("original")
):
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Invalid filter selected.")

    contents = await read_image(file)

    try:
        result = process_image(contents, mode)

        return Response(
            content=result,
            media_type="image/png",
            headers={
                "Cache-Control": "no-store",
                "X-Processing-Mode": mode,
            }
        )

    except Exception as error:
        print("PROCESSING ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail=f"Image processing error: {str(error)}"
        )